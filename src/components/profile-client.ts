import type {PreferenceField} from '@/lib/preference-learning';
export const profileFields:Record<PreferenceField,[string,string]>={category:['分类','Category'],accountId:['付款钱包','Payment wallet'],payee:['商家','Merchant'],platform:['平台','Platform'],'scene.type':['消费场景','Context'],'scene.transport':['交通方式','Transport'],'scene.origin':['出发地','Origin'],'scene.destination':['目的地','Destination'],'scene.merchant':['商家简称','Merchant name'],'scene.branch':['门店','Branch'],'scene.meal':['用餐类型','Meal'],'scene.diningMode':['用餐方式','Dining mode']};
export const profileValues:Record<string,[string,string]>={general:['其他场景','Other'],transport:['交通','Transport'],dining:['餐饮','Dining'],shopping:['购物','Shopping'],groceries:['买菜','Groceries'],delivery:['外卖','Delivery'],dine_in:['堂食','Dine in'],takeaway:['自取','Takeaway'],unknown:['未指定','Unspecified'],weekday:['工作日','Weekdays'],weekend:['周末','Weekends'],overnight:['凌晨 00–06','Night 00–06'],morning:['早间 06–11','Morning 06–11'],midday:['午间 11–14','Midday 11–14'],afternoon:['下午 14–18','Afternoon 14–18'],evening:['晚间 18–24','Evening 18–24'],stable:['习惯稳定','Established'],tentative:['仍在观察','Learning'],changed:['近期有变化','Recently changed'],stale:['较久未发生','Not recent'],confirmed:['明确规则','Explicit rule'],rejected:['不再建议','Excluded'],disabled:['已停用','Disabled']};
export async function profileApi(query='',body?:unknown){
 const r=await fetch('/api/personal-profile'+query,{method:body?'POST':'GET',headers:{'Content-Type':'application/json'},body:body?JSON.stringify(body):undefined});
 const data=await r.json();if(!r.ok)throw new Error(data.error||'Request failed');return data;
}
export function profileError(message:string,english:boolean){
 const labels:Record<string,string>={
  'Rule changed; refresh and try again':'规则已被修改，请刷新后重试。',
  'An explicit rule already exists for this context; confirm replacement':'这个场景已有不同规则，请勾选替换旧规则后保存。',
  'Wallet not available':'这个钱包不可用，请重新选择。','Category not available':'这个分类不可用，请重新选择。',
  'Invalid preference value':'偏好取值不符合字段格式，请重新填写。','Place not found':'这个区域已不可用，请重新选择。',
  'Profile insight no longer available':'相关记录已变化，请重新打开画像。','This change cannot be undone':'这项变更不能撤销。',
  'A newer change exists':'已有更新的变更，不能撤销这项历史操作。','Place changed; refresh and try again':'区域已被修改，请刷新后重试。',
  'Location assistance is disabled':'请先开启位置辅助。','Enable location assistance before retaining named places':'请先开启位置辅助，再保留消费区域关联。',
  'Both coordinates are required':'位置信息不完整，请重新定位。','Invalid time zone':'时区无效，请检查设备的时区设置。',
  'Request failed':'请求失败，请重试。','Failed to fetch':'网络连接失败，请重试。',
 };
 return english?message:labels[message]||message;
}
export function downloadProfile(value:unknown,name:string){const url=URL.createObjectURL(new Blob([JSON.stringify(value,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
