export const currencies=['CNY','USD','EUR','GBP'] as const;
export type Currency=typeof currencies[number];
export type Deployment={language:'zh-CN'|'en';currency:Currency};
export function parseDeployment(env:Record<string,string|undefined>):Deployment{
 const language=env.APP_LANGUAGE||'zh-CN',currency=env.APP_CURRENCY||'CNY';
 if(language!=='zh-CN'&&language!=='en')throw new Error('APP_LANGUAGE must be zh-CN or en');
 if(!currencies.includes(currency as Currency))throw new Error('APP_CURRENCY must be CNY, USD, EUR or GBP');
 return {language,currency:currency as Currency};
}
export function deployment():Deployment{return parseDeployment(typeof document==='undefined'?process.env:{APP_LANGUAGE:document.documentElement.lang,APP_CURRENCY:document.documentElement.dataset.currency});}
export function formatMoney(minor:number,config:Deployment=deployment()){return new Intl.NumberFormat(config.language,{style:'currency',currency:config.currency}).format(minor/100);}
export function currencySymbol(config:Deployment=deployment()){return new Intl.NumberFormat(config.language,{style:'currency',currency:config.currency,currencyDisplay:'narrowSymbol'}).formatToParts(0).find(p=>p.type==='currency')?.value||config.currency;}
