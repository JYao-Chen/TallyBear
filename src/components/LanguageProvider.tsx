'use client';
import {deployment,formatMoney,currencySymbol} from '@/lib/deployment';
import {createContext,useContext,type ReactNode} from 'react';
import {translate,type Language} from '@/lib/i18n';
import {type Currency} from '@/lib/deployment';
const LanguageContext=createContext<{locale:Language;currency:Currency}>({locale:'zh-CN',currency:deployment().currency});
export function LanguageProvider({initial,currency='CNY',children}:{initial:Language;currency?:Currency;children:ReactNode}){
 return <LanguageContext.Provider value={{locale:initial,currency}}>{children}</LanguageContext.Provider>;
}
export function useI18n(){const {locale,currency}=useContext(LanguageContext);return {locale,currency,t:(value:string|number|null|undefined,values?:unknown[])=>translate(String(value??''),locale,values,currency)};}
