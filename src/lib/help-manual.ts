import {guideChapters,type HelpTarget} from './help-guide';
import {type Language} from './i18n';

export type HelpLink={target:HelpTarget;label:string};
export type HelpSection={id:string;title:string;paragraphs:string[];steps:{title:string;text:string;action?:HelpLink}[];figures:{key:string;caption:string}[];example?:string;note?:string;questions:{q:string;a:string}[];action?:HelpLink};
export type HelpArticle={id:string;group:string;title:string;intro:string;sections:HelpSection[];steps:string[];notes:string[];image:string};
export function helpArticles(locale:Language):HelpArticle[]{
 const n=locale==='en'?1:0;
 const groups=[...new Set(guideChapters.map(c=>c.group[0]))];
 return [...guideChapters].sort((a,b)=>groups.indexOf(a.group[0])-groups.indexOf(b.group[0])).map(c=>{
  const localLink=(a:{target:HelpTarget;label:[string,string]}|undefined)=>a?{target:a.target,label:a.label[n]}:undefined;
  const sections=c.sections.map(s=>({id:s.id,title:s.title[n],paragraphs:(s.paragraphs||[]).map(p=>p[n]),steps:(s.steps||[]).map(p=>({title:p.title[n],text:p.text[n],action:localLink(p.action)})),figures:(s.figures||[]).map(f=>({key:f.key,caption:f.caption[n]})),example:s.example?.[n],note:s.note?.[n],questions:(s.questions||[]).map(q=>({q:q.q[n],a:q.a[n]})),action:localLink(s.action)}));
  return {id:c.id,group:c.group[n],title:c.title[n],intro:c.intro[n],sections,steps:sections.flatMap(s=>s.steps.map(p=>`${p.title}: ${p.text}`)),notes:sections.flatMap(s=>[s.title,...s.paragraphs,...s.figures.map(f=>f.caption),s.example,s.note,...s.questions.flatMap(q=>[q.q,q.a])].filter((p):p is string=>!!p)),image:sections.flatMap(s=>s.figures)[0]?.key||'overview'};
 });
}
export function helpText(a:HelpArticle){return [a.title,a.intro,...a.steps,...a.notes].join('\n');}
export function helpTerms(query:string){const text=query.toLocaleLowerCase().trim();const words=text.split(/\s+/).filter(Boolean);if(/[\u3400-\u9fff]/.test(text))for(const part of new Intl.Segmenter('zh-CN',{granularity:'word'}).segment(text))if(part.isWordLike&&part.segment.length>=2&&!['怎么','如何','什么','可以','进行','需要','一个','这个'].includes(part.segment))words.push(part.segment);return [...new Set(words)];}
export function helpKeywordScore(a:HelpArticle,query:string){return helpTerms(query).reduce((n,w)=>n+(a.title.toLocaleLowerCase().includes(w)?4:0)+(helpText(a).toLocaleLowerCase().includes(w)?1:0),0);}
export function cosineSimilarity(a:number[],b:number[]){if(a.length!==b.length||!a.length)return 0;let dot=0,aa=0,bb=0;for(let i=0;i<a.length;i++){dot+=a[i]*b[i];aa+=a[i]*a[i];bb+=b[i]*b[i];}return aa&&bb?dot/Math.sqrt(aa*bb):0;}
