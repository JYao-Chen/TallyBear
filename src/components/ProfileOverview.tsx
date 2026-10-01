'use client';
import {useEffect,useState,type CSSProperties} from 'react';
import {ArrowRight,ArrowUpRight,BookOpen,CheckCheck,Clock3,Compass,Globe,MapPin,Pause,Play,Search,ShoppingBag,ShoppingBasket,Sparkles,Store,Tag,TrainFront,Utensils,Wallet,type LucideIcon} from 'lucide-react';
import type {ProfileInsight} from '@/lib/personal-profile';
import type {PreferenceField} from '@/lib/preference-learning';
import {useI18n} from './LanguageProvider';
import {useTheme} from './ThemeProvider';
import {AccountIcon} from './VisualSelect';

// Existing TallyBear world: a companion-led overview and a scene atlas, not a second data table.
// Counts remain global; grouped cards are the current page. Evidence always opens the existing editor.
const sceneIcons:Record<string,LucideIcon>={dining:Utensils,transport:TrainFront,shopping:ShoppingBag,groceries:ShoppingBasket,general:Compass};
const fieldIcons:Partial<Record<PreferenceField,LucideIcon>>={accountId:Wallet,category:Tag,payee:Store,platform:Globe,'scene.type':Compass,'scene.meal':Utensils,'scene.diningMode':Utensils,'scene.transport':TrainFront,'scene.origin':MapPin,'scene.destination':MapPin};
type Labels={field:(f:PreferenceField)=>string;label:(v:string,f?:PreferenceField)=>string};

export function ProfileOverviewSummary({summary,status,onStatus}:{summary:{transactions:number;stable:number;changed:number;tentative:number;firstDate?:string;lastDate?:string};status:string;onStatus:(value:string)=>void}){
 const {locale}=useI18n(),{theme}=useTheme(),en=locale==='en',t=(zh:string,english:string)=>en?english:zh;
 const [playing,setPlaying]=useState(false);
 useEffect(()=>{const media=matchMedia('(prefers-reduced-motion: reduce)');if(!media.matches)setPlaying(true);const stop=()=>{if(media.matches)setPlaying(false);};media.addEventListener('change',stop);return()=>media.removeEventListener('change',stop);},[]);
 useEffect(()=>{if(!playing)return;const timer=setTimeout(()=>setPlaying(false),4500);return()=>clearTimeout(timer);},[playing]);
 const states=[['stable',CheckCheck,t('稳定习惯','Established habits'),t('经常重复的选择','Choices you make regularly'),summary.stable],['changed',ArrowUpRight,t('近期变化','Recent changes'),t('看看偏好是否变了','See what may have changed'),summary.changed],['tentative',Search,t('仍在观察','Still learning'),t('等更多记录来确认','More evidence is needed'),summary.tentative]] as const;
 return <section className="portrait-overview-intro" aria-label={t('画像概况','Profile at a glance')}>
  <div className="portrait-companion-story"><div className="portrait-companion" aria-hidden="true">{theme==='minimal'?<Compass size={66} strokeWidth={1.2}/>:<picture><source media="(prefers-reduced-motion: reduce)" srcSet="/stickers/bubu-yier-001.png"/><img src={'/stickers/bubu-yier-001.'+(playing?'gif':'png')} alt="" width={112} height={112}/></picture>}</div>
   <div className="portrait-story-copy"><h3>{summary.transactions?t('你的习惯，有迹可循','Your habits, with a little context'):t('从第一笔开始认识你','It starts with your first entry')}</h3><p>{t('常用什么钱包，在哪些场景有不同选择，一起从记录里看。','Discover familiar wallets and the choices you make in different situations.')}</p><div className="portrait-activity-caption"><BookOpen size={14}/><span>{summary.transactions.toLocaleString(locale)} {t('笔有效记录','valid records')}</span>{summary.firstDate&&<span>{summary.firstDate} — {summary.lastDate}</span>}</div></div>
   {theme!=='minimal'&&<button type="button" className="portrait-motion-toggle" aria-label={playing?t('暂停表情动画','Pause companion animation'):t('播放表情动画','Play companion animation')} onClick={()=>setPlaying(v=>!v)}>{playing?<Pause size={14}/>:<Play size={14}/>}</button>}
  </div>
  <div className="portrait-state-shortcuts">{states.map(([key,Icon,title,description,count])=><button type="button" className={'portrait-state-shortcut '+key} key={key} aria-pressed={status===key} onClick={()=>onStatus(status===key?'':key)}><Icon size={20}/><span><strong>{title}</strong><small>{description}</small></span><b>{count}</b><ArrowRight size={15}/></button>)}</div>
 </section>;
}

export function ProfileInsightBoard({items,selected,onSelect,field,label,places}:{items:ProfileInsight[];selected:string|undefined;onSelect:(insight:ProfileInsight)=>void;places:{id:string;name:string}[]}&Labels){
 const {locale}=useI18n(),en=locale==='en',t=(zh:string,english:string)=>en?english:zh;
 const groups=new Map<string,ProfileInsight[]>();
 for(const item of items){const key=item.condition.fields['scene.type']||'general';groups.set(key,[...(groups.get(key)||[]),item]);}
 return <div className="portrait-scene-atlas">{[...groups].map(([scene,insights])=>{const SceneIcon=sceneIcons[scene]||Compass;return <section key={scene} style={{'--scene-rows':Math.ceil(insights.length/2)} as CSSProperties} className={'portrait-scene-group'+(insights.length>1?' is-wide':'')}>
  <div className="portrait-scene-heading"><SceneIcon size={21}/><h4>{scene==='general'?t('日常与其他场景','Everyday & other contexts'):label(scene)}</h4><span>{insights.length} {t('项 · 本页','on this page')}</span></div>
  <div className="portrait-scene-cards">{insights.map(i=>{const best=i.choices[0],Icon=fieldIcons[i.field]||Tag;
   const context=Object.entries(i.condition.fields).filter(([f])=>f!=='scene.type').map(([f,v])=>field(f as PreferenceField)+' · '+label(v,f as PreferenceField));
   if(i.condition.dayType)context.push(label(i.condition.dayType));if(i.condition.timeBand)context.push(label(i.condition.timeBand));if(i.condition.placeId){const place=places.find(p=>p.id===i.condition.placeId);if(place)context.push(place.name);}
   return <button type="button" aria-pressed={selected===i.key} className={'portrait-insight portrait-visual-insight'+(selected===i.key?' is-selected':'')} key={i.key} onClick={()=>onSelect(i)}>
    <span className="portrait-insight-top"><span className={'portrait-state '+i.status}>{i.status==='stable'?<CheckCheck size={12}/>:i.status==='changed'?<ArrowUpRight size={12}/>:<Clock3 size={12}/>} {label(i.status)}</span><span>{i.count} {t('笔依据','records')}</span></span>
    <span className="portrait-preference-value"><span className="portrait-preference-icon" aria-hidden="true">{i.field==='accountId'?<AccountIcon name={label(best.value,i.field)} size={30}/>:<Icon size={29} strokeWidth={1.6}/>}</span><span><small>{field(i.field)}</small><strong>{label(best.value,i.field)}</strong></span></span>
    <span className="portrait-context-chips"><span>{i.condition.kind==='income'?t('收入','Income'):t('支出','Expense')}</span>{context.length?context.map((v,index)=><span key={index}>{v}</span>):<span>{t('该场景的一般习惯','General habit in this context')}</span>}</span>
    {i.status==='changed'&&i.previousValue&&i.previousValue!==best.value&&<span className="portrait-change-path"><span>{label(i.previousValue,i.field)}</span><ArrowRight size={14}/><strong>{label(best.value,i.field)}</strong></span>}
    <span className="portrait-evidence-summary"><span>{t('加权支持','Weighted support')} <b>{Math.round(best.share*100)}%</b></span><span className="portrait-weight"><span style={{width:Math.max(0,Math.min(100,Math.round(best.share*100)))+'%'}}/></span></span>
    <span className="portrait-insight-bottom"><span>{t('查看依据','View evidence')} <ArrowRight size={15}/></span><span>{i.choices.length>1?t('有其他选择','Alternatives available'):t('可纠正','You can correct this')}</span></span>
   </button>;
  })}</div>
 </section>;})}</div>;
}
