import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {PoolClient} from 'pg';
import {db,transaction} from './db';
import {Failure,type User} from './access';
import {listCategories} from './categories';
import {buildProfile,coarseLocation,conditionKey,distanceMeters,profileConditionSchema,profileContextSchema,profileRuleSchema,type ProfileContext,type ProfileEvidence,type ProfileRule} from '@/lib/personal-profile';
import {sceneSchema} from '@/lib/entry-scene';
import {preferenceFields,type PreferenceField} from '@/lib/preference-learning';

export async function profileSettings(user:string){
 const row=(await db.query('SELECT p.location_enabled,p.retain_location,COALESCE(m.enabled,true) AS enabled FROM users u LEFT JOIN profile_settings p ON p.user_id=u.id LEFT JOIN memory_settings m ON m.user_id=u.id WHERE u.id=$1',[user])).rows[0];
 return {enabled:row?.enabled!==false,locationEnabled:!!row?.location_enabled,retainLocation:!!row?.retain_location};
}
export async function profilePlaces(user:string){return (await db.query('SELECT id,name,latitude,longitude,radius,version FROM profile_places WHERE user_id=$1 ORDER BY name,id',[user])).rows;}
export async function profileRules(user:string):Promise<(ProfileRule&{id:string;version:number})[]>{return (await db.query('SELECT id,condition,field,value,state,version FROM profile_rules WHERE user_id=$1 ORDER BY updated_at DESC,id',[user])).rows;}

/** Read current facts, never a stale aggregate containing revoked or deleted sources. */
export async function profileEvidence(user:string):Promise<ProfileEvidence[]>{
 return (await db.query(`SELECT * FROM (
 SELECT DISTINCT ON(COALESCE(t.event_id,t.id)) t.id,COALESCE(t.event_id,t.id) AS "eventId",t.book_id AS "bookId",t.version,
 t.kind,t.category,t.payee,t.platform,t.title,t.product,t.note,t.scene,
 CASE WHEN a.owner_id=$1 AND NOT a.archived THEN t.account_id ELSE NULL END AS "accountId",
 t.preference_suggestions AS "preferenceSuggestions",t.updated_at AS at,to_char(t.date,'YYYY-MM-DD') AS date,t.occurred_at AS "occurredAt",
 CASE WHEN pc.context->>'useAsTransactionPlace'='true' AND ps.retain_location AND ps.location_enabled THEN pc.place_id ELSE NULL END AS "placeId"
 FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$1
 LEFT JOIN accounts a ON a.id=t.account_id
 LEFT JOIN profile_contexts pc ON pc.transaction_id=t.id AND pc.user_id=$1
 LEFT JOIN profile_settings ps ON ps.user_id=$1
 WHERE t.created_by=$1 AND NOT t.deleted AND t.kind IN ('expense','income')
 AND NOT EXISTS(SELECT 1 FROM category_feedback other WHERE other.transaction_id=t.id AND other.user_id<>$1)
 AND NOT EXISTS(SELECT 1 FROM memory_exclusions x JOIN transactions forgotten ON forgotten.id=x.source_id WHERE x.user_id=$1 AND x.source_type='transaction' AND COALESCE(forgotten.event_id,forgotten.id)=COALESCE(t.event_id,t.id))
 ORDER BY COALESCE(t.event_id,t.id),t.updated_at DESC,t.id
 ) evidence ORDER BY date DESC,id`,[user])).rows;
}

export async function sanitizeProfileContext(user:string,value:unknown):Promise<ProfileContext|undefined>{
 if(value==null)return undefined;
 const parsed=profileContextSchema.parse(value),settings=await profileSettings(user);
 if(!settings.enabled||!settings.locationEnabled)return {...parsed,location:undefined,placeId:undefined,useAsTransactionPlace:false};
 try{new Intl.DateTimeFormat('en',{timeZone:parsed.timeZone}).format();}catch{throw new Failure('Invalid time zone');}
 const places=await profilePlaces(user);
 if(parsed.placeId&&!places.some(p=>p.id===parsed.placeId))return {...parsed,location:undefined,placeId:undefined,useAsTransactionPlace:false};
 let location=parsed.location?coarseLocation(parsed.location):undefined;
 if(location&&(Math.abs(Date.now()-Date.parse(location.capturedAt))>15*60000||location.accuracy>50000))location=undefined;
 // Selecting a saved place is explicit. Coordinates alone can identify an area, never a merchant or home.
 const nearby=location?places.filter(p=>p.latitude!=null&&p.longitude!=null&&location!.accuracy<=p.radius&&distanceMeters(location!,p)<=p.radius):[];
 const placeId=parsed.placeId||(nearby.length===1?nearby[0].id:undefined);
 return {...parsed,location:undefined,placeId,useAsTransactionPlace:parsed.useAsTransactionPlace&&!!placeId};
}

export async function saveProfileContext(c:PoolClient,user:string,id:string,value:unknown){
 if(value===undefined)return;
 const settings=await profileSettings(user);
 if(!settings.retainLocation||!settings.locationEnabled||!settings.enabled){await c.query('DELETE FROM profile_contexts WHERE user_id=$1 AND transaction_id=$2',[user,id]);return;}
 const context=await sanitizeProfileContext(user,value);if(!context)return;
 const allowed=await c.query('SELECT 1 FROM transactions t JOIN members m ON m.book_id=t.book_id AND m.user_id=$1 WHERE t.id=$2 AND t.created_by=$1 AND NOT t.deleted',[user,id]);if(!allowed.rowCount)return;
 // Keep only the named area after confirmation. Raw/coarse coordinates are not persisted per transaction.
 await c.query('INSERT INTO profile_contexts(user_id,transaction_id,place_id,context) VALUES($1,$2,$3,$4) ON CONFLICT(user_id,transaction_id) DO UPDATE SET place_id=$3,context=$4',[user,id,context.placeId||null,{recordedAt:context.recordedAt,timeZone:context.timeZone,useAsTransactionPlace:context.useAsTransactionPlace}]);
}

async function options(user:string){
 const wallets=(await db.query('SELECT id,name,type FROM accounts WHERE owner_id=$1 AND NOT archived ORDER BY name',[user])).rows;
 const categories=(await listCategories(user)).filter(c=>!c.archived).map(c=>c.name);
 return {wallets,categories,fields:preferenceFields};
}
async function validateRule(user:string,raw:unknown){
 const rule=profileRuleSchema.parse(raw),available=await options(user);
 const pairs=[...Object.entries(rule.condition.fields),[rule.field,rule.value]];
 for(const [field,value] of pairs){if(!value)continue;if(field.startsWith('scene.')&&!sceneSchema.safeParse({[field.slice(6)]:value}).success)throw new Failure('Invalid preference value');if(field==='accountId'&&!available.wallets.some(w=>w.id===value))throw new Failure('Wallet not available',403);if(field==='category'&&!available.categories.includes(value))throw new Failure('Category not available');}
 if(rule.condition.placeId&&!(await db.query('SELECT 1 FROM profile_places WHERE id=$1 AND user_id=$2',[rule.condition.placeId,user])).rowCount)throw new Failure('Place not found',404);
 return rule;
}
async function event(c:PoolClient,user:string,operation:string,ruleId?:string,previous?:unknown){await c.query('INSERT INTO profile_events(user_id,operation,rule_id,previous) VALUES($1,$2,$3,$4)',[user,operation,ruleId||null,previous||null]);}

export async function personalProfileRoute(user:User,method:string,params:URLSearchParams,body:any){
 const page=z.coerce.number().int().min(1).parse(params.get('page')||1),q=z.string().max(200).parse(params.get('q')||'');
 if(method==='GET'){
  const section=params.get('section')||'overview';
  if(section==='settings')return {...await profileSettings(user.id),places:await profilePlaces(user.id),...await options(user.id)};
  if(section==='events'){const result=await db.query(`SELECT e.id,e.operation,e.rule_id,e.created_at,(e.previous IS NOT NULL AND e.rule_id IS NOT NULL AND e.operation IN ('save_rule','replace','delete_rule') AND NOT EXISTS(SELECT 1 FROM profile_events newer WHERE newer.user_id=e.user_id AND newer.rule_id=e.rule_id AND newer.id>e.id)) AS "canUndo",count(*) OVER()::int AS total FROM profile_events e WHERE e.user_id=$1 ORDER BY e.id DESC LIMIT 20 OFFSET $2`,[user.id,(page-1)*20]);return {items:result.rows,total:result.rows[0]?.total||0,page};}
  if(section==='rules'){const rules=await profileRules(user.id),selected=rules.find(r=>r.id===params.get('ruleId')),current=selected?Math.floor(rules.indexOf(selected)/20)+1:page;return {items:rules.slice((current-1)*20,current*20),total:rules.length,page:current,selected,...await options(user.id),places:await profilePlaces(user.id)};}
  const rows=await profileEvidence(user.id),insights=buildProfile(rows),rules=await profileRules(user.id),places=await profilePlaces(user.id),available=await options(user.id);
  const searchText=(v:unknown)=>JSON.stringify(v).toLocaleLowerCase();
  const status=params.get('status');
  const filtered=insights.filter(i=>(!status||i.status===status)&&(!q||searchText({...i,choices:i.choices.map(c=>({...c,label:i.field==='accountId'?available.wallets.find(w=>w.id===c.value)?.name:c.value})),place:places.find(p=>p.id===i.condition.placeId)?.name}).includes(q.toLocaleLowerCase())));
  const selected=params.get('key');
  if(selected){const insight=insights.find(i=>i.key===selected);if(!insight)throw new Failure('Profile insight no longer available',404);const sources=insight.choices.flatMap(c=>c.sources.map(s=>({...s,value:c.value})));return {insight:{...insight,choices:insight.choices.map(c=>({...c,sources:[]}))},sources:sources.slice((page-1)*20,page*20),total:sources.length,page,...available,places};}
  return {items:filtered.slice((page-1)*12,page*12).map(i=>({...i,choices:i.choices.slice(0,3).map(c=>({...c,sources:c.sources.slice(0,3)}))})),total:filtered.length,page,rules,places,...available,settings:await profileSettings(user.id),summary:{transactions:rows.length,stable:insights.filter(i=>i.status==='stable').length,changed:insights.filter(i=>i.status==='changed').length,tentative:insights.filter(i=>i.status==='tentative').length,firstDate:rows.at(-1)?.date||null,lastDate:rows[0]?.date||null},generatedAt:new Date().toISOString()};
 }
 const operation=z.enum(['resolve_place','settings','save_rule','delete_rule','undo','save_place','delete_place','forget_locations','export']).parse(body.operation);
 if(operation==='resolve_place')return await sanitizeProfileContext(user.id,body.context)||{};
 if(operation==='export')return {generatedAt:new Date().toISOString(),settings:await profileSettings(user.id),places:await profilePlaces(user.id),rules:await profileRules(user.id),insights:buildProfile(await profileEvidence(user.id))};
 return transaction(async c=>{
  if(operation==='settings'){
   const input=z.object({enabled:z.boolean(),locationEnabled:z.boolean(),retainLocation:z.boolean()}).parse(body);
   if(input.retainLocation&&!input.locationEnabled)throw new Failure('Enable location assistance before retaining named places');
   await c.query('INSERT INTO memory_settings(user_id,enabled) VALUES($1,$2) ON CONFLICT(user_id) DO UPDATE SET enabled=$2',[user.id,input.enabled]);
   await c.query('INSERT INTO profile_settings(user_id,location_enabled,retain_location) VALUES($1,$2,$3) ON CONFLICT(user_id) DO UPDATE SET location_enabled=$2,retain_location=$3,updated_at=now()',[user.id,input.locationEnabled,input.retainLocation]);
   if(!input.retainLocation)await c.query('DELETE FROM profile_contexts WHERE user_id=$1',[user.id]);
   await event(c,user.id,'settings');return {ok:true};
  }
  if(operation==='save_rule'){
   const rule=await validateRule(user.id,body.rule),old=rule.id?(await c.query('SELECT * FROM profile_rules WHERE id=$1 AND user_id=$2 FOR UPDATE',[rule.id,user.id])).rows[0]:null;
   if(rule.id&&(!old||old.version!==rule.version))throw new Failure('Rule changed; refresh and try again',409);
   const existing=(await c.query('SELECT * FROM profile_rules WHERE user_id=$1 AND field=$2 FOR UPDATE',[user.id,rule.field])).rows;
   const identical=!rule.id&&existing.find(r=>conditionKey(profileConditionSchema.parse(r.condition))===conditionKey(rule.condition)&&r.state===rule.state&&r.value===rule.value);
   if(identical)return {ok:true,id:identical.id};
   const same=existing.filter(r=>r.id!==rule.id&&conditionKey(profileConditionSchema.parse(r.condition))===conditionKey(rule.condition)&&r.state==='confirmed'&&rule.state==='confirmed'&&r.value!==rule.value);
   // Never silently replace an explicit rule, even if a new statistical suggestion wins.
   if(same.length&&!body.replaceConflicts)throw new Failure('An explicit rule already exists for this context; confirm replacement',409);
   const id=old?.id||randomUUID();
   for(const conflict of same){await c.query("UPDATE profile_rules SET state='disabled',version=version+1,updated_at=now() WHERE id=$1",[conflict.id]);await event(c,user.id,'replace',conflict.id,conflict);}
   if(old)await c.query('UPDATE profile_rules SET condition=$3,field=$4,value=$5,state=$6,version=version+1,updated_at=now() WHERE id=$1 AND user_id=$2',[id,user.id,rule.condition,rule.field,rule.value,rule.state]);
   else await c.query('INSERT INTO profile_rules(id,user_id,condition,field,value,state) VALUES($1,$2,$3,$4,$5,$6)',[id,user.id,rule.condition,rule.field,rule.value,rule.state]);
   await event(c,user.id,'save_rule',id,old||{created:true});return {ok:true,id};
  }
  if(operation==='delete_rule'){
   const id=z.string().uuid().parse(body.id),version=z.number().int().parse(body.version);
   const old=(await c.query('DELETE FROM profile_rules WHERE id=$1 AND user_id=$2 AND version=$3 RETURNING *',[id,user.id,version])).rows[0];if(!old)throw new Failure('Rule changed; refresh and try again',409);
   await event(c,user.id,'delete_rule',id,old);return {ok:true};
  }
  if(operation==='undo'){
   const id=z.coerce.number().int().positive().parse(body.id),e=(await c.query('SELECT * FROM profile_events WHERE id=$1 AND user_id=$2 FOR UPDATE',[id,user.id])).rows[0];
   if(!e?.previous||!e.rule_id||!['save_rule','replace','delete_rule'].includes(e.operation))throw new Failure('This change cannot be undone');
   if((await c.query('SELECT 1 FROM profile_events WHERE user_id=$1 AND rule_id=$2 AND id>$3',[user.id,e.rule_id,id])).rowCount)throw new Failure('A newer change exists',409);
   const p=e.previous;
   if(p.created)await c.query('DELETE FROM profile_rules WHERE id=$1 AND user_id=$2',[e.rule_id,user.id]);
   else {await validateRule(user.id,{id:p.id,version:p.version,condition:p.condition,field:p.field,value:p.value,state:p.state});await c.query('INSERT INTO profile_rules(id,user_id,condition,field,value,state,version) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(id) DO UPDATE SET condition=$3,field=$4,value=$5,state=$6,version=profile_rules.version+1,updated_at=now()',[p.id,user.id,p.condition,p.field,p.value,p.state,p.version+1]);}
   await event(c,user.id,'undo',e.rule_id);return {ok:true};
  }
  if(operation==='save_place'){
   const input=z.object({id:z.string().uuid().optional(),version:z.number().int().optional(),name:z.string().trim().min(1).max(80),latitude:z.number().min(-90).max(90).nullable().default(null),longitude:z.number().min(-180).max(180).nullable().default(null),radius:z.number().int().min(1500).max(50000).default(1500)}).parse(body);
   if((input.latitude===null)!==(input.longitude===null))throw new Failure('Both coordinates are required');
   const settings=await profileSettings(user.id);if(input.latitude!==null&&!settings.locationEnabled)throw new Failure('Location assistance is disabled');
   const lat=input.latitude===null?null:Math.round(input.latitude*100)/100,lon=input.longitude===null?null:Math.round(input.longitude*100)/100,id=input.id||randomUUID();
   if(input.id){const r=await c.query('UPDATE profile_places SET name=$3,latitude=$4,longitude=$5,radius=$6,version=version+1 WHERE id=$1 AND user_id=$2 AND version=$7',[id,user.id,input.name,lat,lon,input.radius,input.version]);if(!r.rowCount)throw new Failure('Place changed; refresh and try again',409);}
   else await c.query('INSERT INTO profile_places(id,user_id,name,latitude,longitude,radius) VALUES($1,$2,$3,$4,$5,$6)',[id,user.id,input.name,lat,lon,input.radius]);
   await event(c,user.id,'save_place');return {ok:true,id};
  }
  if(operation==='delete_place'||operation==='forget_locations'){
   const ids=operation==='delete_place'?[z.string().uuid().parse(body.id)]:(await c.query('SELECT id FROM profile_places WHERE user_id=$1',[user.id])).rows.map(r=>r.id);
   if(operation==='delete_place'&&!(await c.query('SELECT 1 FROM profile_places WHERE user_id=$1 AND id=$2',[user.id,ids[0]])).rowCount)throw new Failure('Place not found',404);
   await c.query('DELETE FROM profile_contexts WHERE user_id=$1 AND ($3 OR place_id=ANY($2::uuid[]))',[user.id,ids,operation==='forget_locations']);
   const rules=(await c.query("DELETE FROM profile_rules WHERE user_id=$1 AND condition->>'placeId'=ANY($2::text[]) RETURNING id",[user.id,ids])).rows.map(r=>r.id);
   await c.query("UPDATE profile_events SET previous=NULL WHERE user_id=$1 AND (rule_id=ANY($2::uuid[]) OR previous->'condition'->>'placeId'=ANY($3::text[]))",[user.id,rules,ids]);
   await c.query('DELETE FROM profile_places WHERE user_id=$1 AND id=ANY($2::uuid[])',[user.id,ids]);
   await event(c,user.id,operation);return {ok:true};
  }
  throw new Failure('Unsupported profile operation');
 });
}
