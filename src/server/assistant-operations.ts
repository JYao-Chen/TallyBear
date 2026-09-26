import {NextRequest} from 'next/server';
import {z} from 'zod';
import {Failure,type User} from './access';

type Operation={title:string;method:string;path:string;fields:string;help:string;fixed?:Record<string,unknown>;admin?:boolean;query?:string};
const operation=(title:string,method:string,path:string,fields:string,help='',fixed?:Record<string,unknown>):Operation=>({title,method,path,fields,help,fixed});
// Closed catalog: model output cannot choose an HTTP method, URL or secret field.
export const assistantOperations:Record<string,Operation>={
 export:operation('导出账本 CSV','GET','books/:bookId/export','from to q category account kind mode activity scope','先确认日期与筛选；scope=personal_wallet可导出个人钱包；返回下载链接，由用户点击下载'),
 books:operation('查询账本','GET','books',''),
 book_create:operation('创建账本','POST','books','name kind','kind=private/shared'),
 book_edit:operation('修改账本','PUT','books/:bookId/metadata','name icon description kind','提供完整信息，保留未修改字段'),
 members:operation('查询账本成员','GET','books/:bookId/members',''),
 member_set:operation('邀请或调整账本成员','POST','books/:bookId/members','username role','role=editor/viewer，仅所有者'),
 member_remove:operation('移除账本成员','DELETE','books/:bookId/members','id'),
 reports:operation('查询历史对话和报告','GET','books/:bookId/chat','id'),
 report_save:operation('保存分析报告','POST','books/:bookId/chat','turnId title','',{operation:'save_report'}),
 report_edit:operation('修改分析报告','POST','books/:bookId/chat','id version title content','',{operation:'edit_report'}),
 report_delete:operation('删除分析报告','POST','books/:bookId/chat','id version','',{operation:'delete_report'}),
 conversation_delete:operation('删除其他历史对话','POST','books/:bookId/chat','id','当前对话请使用历史列表删除，不能删除承载本卡片的对话',{operation:'delete'}),
 conversation_rename:operation('重命名对话','POST','books/:bookId/chat','id title','',{operation:'rename'}),
 wallets:operation('查询全部可用钱包','GET','assets',''),
 wallet_history:operation('查询余额校正记录','GET','assets/history','account'),
 wallet_create:operation('创建钱包','POST','assets','name opening familyId type holder institution suffix','opening为整数分；type=wechat/alipay/bank/cash/credit/investment/other'),
 wallet_edit:operation('修改钱包','PATCH','assets','id version name opening type holder institution suffix','保留未修改字段',{operation:'edit'}),
 wallet_archive:operation('归档或恢复钱包','PATCH','assets','id version archived','archived=true归档，false恢复',{operation:'archive'}),
 wallet_delete:operation('删除钱包','PATCH','assets','id version expectedBalance','必须先查询版本与余额',{operation:'delete'}),
 wallet_reconcile:operation('校正钱包余额','PATCH','assets','id version balance expectedBalance note','balance为用户确认的实际余额，整数分；不是消费',{operation:'reconcile'}),
 wallet_merge:operation('合并钱包','POST','assets/merge','id targetId version targetVersion expectedBalance expectedTargetBalance balance','所有金额为整数分，合并后余额必须用户指定或明确同意'),
 activities:operation('查询活动（含归档）','GET','activities',''),
 activity_detail:operation('查询活动详情','GET','activities/:id',''),
 activity_create:operation('创建活动','POST','activities','name category familyId description startsOn endsOn budget'),
 activity_edit:operation('修改活动','PUT','activities','id name category familyId description startsOn endsOn budget','先查询详情，保留所有未修改字段'),
 activity_archive:operation('归档或恢复活动','PATCH','activities','id archived'),
 activity_delete:operation('删除活动','DELETE','activities','id'),
 activity_assign:operation('调整账单活动归属','PUT','activities/assign','transactionId activityId bookId','先查询真实交易和活动'),
 categories:operation('查询个人分类','GET','books/:bookId/categories',''),
 category_save:operation('新增或修改分类','PUT','books/:bookId/categories','name newName icon archived','保留原图标和停用状态；重命名也更新本人历史分类',{operation:'save'}),
 category_delete:operation('删除分类','PUT','books/:bookId/categories','name', '',{operation:'delete'}),
 category_reorder:operation('调整分类顺序','PUT','books/:bookId/categories','names','必须包含完整分类名称列表',{operation:'reorder'}),
 families:operation('查询家庭与邀请','GET','families',''),
 family_detail:operation('查询家庭成员及授权','GET','families/:familyId',''),
 family_create:operation('创建家庭','POST','families','name description avatar'),
 family_edit:operation('修改家庭','PUT','families/:familyId','name description avatar'),
 family_delete:operation('解散家庭','DELETE','families/:familyId',''),
 family_invite:operation('邀请家庭成员','POST','families/:familyId/invitations','username'),
 family_cancel_invite:operation('撤回家庭邀请','DELETE','families/:familyId/invitations','userId'),
 family_respond:operation('接受或拒绝家庭邀请','POST','families/:familyId/invitation','accept'),
 family_remove:operation('退出家庭或移除成员','DELETE','families/:familyId/members','userId'),
 family_owner:operation('转交家庭负责人','PUT','families/:familyId/owner','userId'),
 family_link:operation('关联家庭账本','POST','families/:familyId/books','bookId'),
 family_unlink:operation('解除家庭账本关联','DELETE','families/:familyId/books','bookId'),
 family_access:operation('设置家庭账本权限','PUT','families/:familyId/access','bookId userId role','role=editor/viewer/none'),
 family_inbox:operation('查询待收款','GET','family-inbox',''),
 family_finance:operation('查询家庭往来','GET','family-finance/:familyId',''),
 family_movement_edit:operation('修改家庭往来详情','POST','family-finance/:familyId','id displayBookId title note transactionTime platform externalId removeAttachments','transactionTime为HH:mm或空；保留未修改字段',{operation:'edit'}),
 family_movement_cancel:operation('取消家庭往来','POST','family-finance/:familyId','id','',{operation:'cancel'}),
 family_movement_display:operation('调整家庭往来展示账本','POST','family-finance/:familyId','id displayBookId','',{operation:'display'}),
 schedules:operation('查询周期订阅','GET','books/:bookId/schedules',''),
 schedule_update:operation('编辑周期订阅','POST','books/:bookId/schedules','id version name value frequency nextDate intervalCount amortize','value为完整账目；保留未修改字段',{operation:'save'}),
 schedule_pause:operation('暂停或恢复订阅','POST','books/:bookId/schedules','id version paused','',{operation:'pause'}),
 schedule_skip:operation('跳过本期订阅','POST','books/:bookId/schedules','id version dueDate','',{operation:'skip'}),
 schedule_confirm:operation('确认本期订阅扣款','POST','books/:bookId/schedules','id version dueDate paidDate amount startDate startMonth','amount为整数分',{operation:'confirm'}),
 schedule_delete:operation('删除周期订阅','POST','books/:bookId/schedules','id version','',{operation:'delete'}),
 templates:operation('查询常用一笔','GET','books/:bookId/templates',''),
 template_save:operation('编辑常用一笔','PUT','books/:bookId/templates','id version name value','value为完整账目'),
 template_delete:operation('删除常用一笔','DELETE','books/:bookId/templates','id version'),
 installments:operation('查询分期及还款','GET','installments',''),
 installment_update:operation('修改分期计划','POST','installments','id version name terms firstDate fees schedule','schedule可指定每期date/principal/fee',{operation:'schedule'}),
 installment_void:operation('撤销分期还款','POST','installments','id version paymentId','',{operation:'void'}),
 installment_delete:operation('删除分期计划','POST','installments','id version','',{operation:'delete'}),
 budgets:operation('查询预算','GET','books/:bookId/budgets','month'),
 budget_delete:operation('删除预算','DELETE','books/:bookId/budgets','month category'),
 allocations:operation('查询费用分摊','GET','books/:bookId/allocations','month'),
 allocation_remove:operation('取消费用分摊','PUT','books/:bookId/allocations','id version remove','remove=true'),
 attention:operation('查询待补充或回收站','GET','books/:bookId/attention','mode offset','mode=trash查询已删除账目'),
 transaction_restore:operation('恢复已删除账目','PATCH','books/:bookId/transactions','id version','',{deleted:false}),
 organize_preview:operation('查询批量整理影响','GET','books/:bookId/organize','ids','ids为逗号分隔真实交易ID'),
 organize:operation('批量移动、关联或删除账目','POST','books/:bookId/organize','ids operation targetBook versions','operation=move/copy/delete；先organize_preview读取完整关联组和版本'),
 receipts:operation('查询账单凭证','GET','books/:bookId/receipts','transaction'),
 photos_attach:operation('关联已有照片','POST','books/:bookId/photos','transaction ids','只能选择已经上传且有权使用的照片编号'),
 photos_remove:operation('移除账单照片关联','DELETE','books/:bookId/photos','transaction ids'),
 profile:operation('查询个人资料','GET','me',''),
 profile_update:operation('修改个人资料','PUT','me','name avatar'),
 theme:operation('切换主题','PATCH','me','theme','theme=bear/minimal'),
 jobs:operation('查询后台任务','GET','jobs',''),
 job_detail:operation('查询后台任务详情','GET','jobs/:id',''),
 job_cancel:operation('取消后台任务','POST','jobs/:id/cancel',''),
 job_retry:operation('重试后台任务','POST','jobs/:id/retry',''),
 memories:operation('查询记忆及来源','GET','memories','id page q status kind events settings targets'),
 memory_manage:operation('管理财务记忆','POST','memories','operation id version targetId name eventId enabled sourceId itemId value title content kind attributes aliases status familyId shared replaceConflicts','operation=merge/split/reject/learn/settings/history/rebuild/undo；普通编辑共享遗忘优先prepare_memory'),
 users:{...operation('查询用户','GET','users',''),admin:true},
 user_edit:{...operation('修改用户资料或停用','PATCH','users','id name avatar disabled','不能通过聊天设置密码'),admin:true},
 queue_settings:{...operation('查询队列配置','GET','queue-settings',''),admin:true},
 queue_update:{...operation('修改队列并发','PUT','queue-settings','concurrency','1到8'),admin:true},
 ai_settings:{...operation('查询记账模型配置','GET','ai-settings',''),admin:true},
 ai_update:{...operation('修改记账模型（保留密钥）','PUT','ai-settings','baseUrl model visionModel','保留现有密钥；首次配置在专用页面完成'),admin:true},
 ai_test:{...operation('测试记账模型连接','POST','ai-settings','','',{background:true}),admin:true},
 assistant_update:{...operation('修改助手模型（保留密钥）','PUT','assistant-ai-settings','baseUrl model visionModel','保留现有密钥'),admin:true},
 assistant_test:{...operation('测试助手模型连接','POST','assistant-ai-settings','','',{background:true}),admin:true},
 memory_models_update:{...operation('修改记忆模型（保留密钥）','PUT','memories','role base_url model dimensions','role=embedding/extraction/judgment；更换嵌入模型需要重建'),query:'admin=models',admin:true},
 assistant_settings:{...operation('查询助手模型配置','GET','assistant-ai-settings',''),admin:true},
 memory_models:{...operation('查询记忆模型配置','GET','memories','',''),query:'admin=models',admin:true},
};

export function resolveOperation(input:unknown,user:User){
 const p=z.object({operation:z.string(),params:z.record(z.unknown()).default({})}).strict().parse(input);
 const op=assistantOperations[p.operation];if(!op)throw new Failure('助手不支持此操作');
 if(op.admin&&!user.admin)throw new Failure('只有管理员可以操作',403);
 const names=[...op.path.matchAll(/:([A-Za-z]+)/g)].map(m=>m[1]);
 const allowed=new Set([...op.fields.split(' ').filter(Boolean),...names]);
 for(const key of Object.keys(p.params))if(!allowed.has(key))throw new Failure('不支持的操作字段：'+key);
 const path=op.path.split('/').map(part=>part.startsWith(':')?z.string().uuid().parse(p.params[part.slice(1)]):part);
 const body=Object.fromEntries(Object.entries(p.params).filter(([key])=>op.fields.split(' ').includes(key)));
 return {p,op,path,body:{...body,...op.fixed}};
}
export function operationCatalog(user:User){return Object.entries(assistantOperations).filter(([,op])=>!op.admin||user.admin).map(([id,op])=>({id,title:op.title,mode:op.method==='GET'?'read':'confirm',fields:[...op.path.matchAll(/:([A-Za-z]+)/g)].map(m=>m[1]).concat(op.fields.split(' ').filter(Boolean)),instructions:op.help}));}
export async function prepareOperation(input:unknown,user:User){
 const {p,op}=resolveOperation(input,user);let original:Record<string,any>|undefined;
 const sources:Record<string,string>={wallet_edit:'wallets',wallet_archive:'wallets',wallet_delete:'wallets',wallet_reconcile:'wallets',wallet_merge:'wallets',activity_edit:'activities',activity_archive:'activities',activity_delete:'activities',book_edit:'books',category_save:'categories',template_save:'templates',template_delete:'templates',schedule_update:'schedules',schedule_pause:'schedules',schedule_delete:'schedules',schedule_skip:'schedules',schedule_confirm:'schedules',profile_update:'profile',family_edit:'family_detail',family_delete:'family_detail'};
 const source=sources[p.operation];
 if(source){
  const params=source==='categories'||source==='templates'||source==='schedules'?{bookId:p.params.bookId}:source==='family_detail'?{familyId:p.params.familyId}:{};
  const values=await runOperation({operation:source,params},user);
  original=Array.isArray(values)?values.find((v:any)=>source==='categories'?v.name===p.params.name:v.id===(p.operation==='book_edit'?p.params.bookId:p.params.id)):values;
  if(!original&&p.operation!=='category_save')throw new Failure('目标不存在或无访问权限，请重新查询');
 }
 if(original){
  const editing=['wallet_edit','activity_edit','book_edit','category_save','template_save','schedule_update','profile_update','family_edit'].includes(p.operation);
  const defaults:Record<string,unknown>={};for(const key of op.fields.split(' '))if(original[key]!==undefined&&(editing||['id','version'].includes(key)))defaults[key]=original[key];
  if(op.fields.split(' ').includes('expectedBalance'))defaults.expectedBalance=original.balance;
  if(p.operation==='schedule_update')Object.assign(defaults,{nextDate:original.next_date,intervalCount:original.interval_count});
  const value=p.params.value;p.params={...defaults,...p.params};
  if(['template_save','schedule_update'].includes(p.operation))p.params.value={...original.value,...(value&&typeof value==='object'?value:{}),id:original.id,date:p.operation==='schedule_update'?p.params.nextDate:''};
 }
 return {...p,title:op.title,targetName:original?.name};
}
export async function runOperation(input:unknown,user:User,write=false){
 const {op,path,body}=resolveOperation(input,user);
 if(op.method!=='GET'&&!write)throw new Failure('此操作必须由用户确认卡片后执行');
 const origin=process.env.APP_ORIGIN||'http://localhost:3000',url=new URL('/api/'+path.join('/'),origin);
 if(op.query)url.search=new URLSearchParams(op.query).toString();
 if(op.method==='GET')for(const [key,value] of Object.entries(body))if(value!==undefined&&value!==null)url.searchParams.set(key,String(value));
 const {applicationApi}=await import('./application-api');
 const response=await applicationApi(new NextRequest(url,{method:op.method,headers:{origin,'content-type':'application/json'},...(op.method==='GET'?{}:{body:JSON.stringify(body)})}),{params:Promise.resolve({path})},user);
 if(response.ok&&response.headers.get('content-type')?.includes('text/csv'))return {downloadUrl:url.pathname+url.search,title:'下载账本 CSV'};
 const result=await response.json();if(!response.ok)throw new Failure(result.error||'操作未完成',response.status);return result;
}
