import {getLocale,translate,type Language} from './i18n';
export const walletOwnership={shared:'家庭共有',personal:'个人持有',unspecified:'归属待确认'} as const;
export type WalletOwnership=keyof typeof walletOwnership;
export const accountTypes={wechat:'微信',alipay:'支付宝',bank:'银行卡',cash:'现金',credit:'信用卡',investment:'投资理财',other:'其他'} as const;
export type AccountType=keyof typeof accountTypes;
export type AccountIdentity={name:string;ownership?:WalletOwnership;type?:AccountType;holder?:string;institution?:string;suffix?:string};
export function accountLabel(a:AccountIdentity,locale:Language=getLocale()){const tr=(s:string)=>translate(s,locale);const type=a.type&&tr(accountTypes[a.type]);return [a.ownership?tr(walletOwnership[a.ownership]):'',type&&!a.name.includes(type)?type+' · '+a.name:a.name,a.holder,a.institution&&!a.name.includes(a.institution)?a.institution:'',a.suffix?(locale==='en'?'ending ':'尾号')+a.suffix:''].filter(Boolean).join(' · ');}
