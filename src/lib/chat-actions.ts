export const actionNames={family:'家庭往来',entry:'记录账单',schedule:'周期订阅',template:'常用一笔',budget:'设置预算',allocation:'费用分摊',installment:'建立分期',repayment:'登记还款'} as const;
export type ChatActionKind=keyof typeof actionNames;
export type ChatAction={id:string;kind:ChatActionKind;bookId:string;title:string;status:'pending'|'confirmed'|'cancelled';data:Record<string,any>;missing:string[];warnings:string[];summary:{label:string;value:string;icon?:string;account?:string}[];result?:unknown;confirmedAt?:string};
