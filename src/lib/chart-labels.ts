import {getLocale} from './i18n';
export function shortChartLabel(value:unknown){const text=String(value??'');return /^\d{4}-\d{2}-\d{2}$/.test(text)?text.slice(5):text.length>6?text.slice(0,6)+'…':text;}
export function chartAmount(value:number){if(getLocale()==='en')return new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:1}).format(value);const abs=Math.abs(value);return abs>=100000000?(value/100000000).toFixed(1)+'亿':abs>=10000?(value/10000).toFixed(1)+'万':String(value);}
