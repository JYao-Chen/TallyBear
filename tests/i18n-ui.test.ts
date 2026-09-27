import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import ts from 'typescript';
import en from '../src/lib/locales/en.json';
import {translate} from '../src/lib/i18n';
import {helpSections} from '../src/lib/help-content';
import {LanguageProvider} from '../src/components/LanguageProvider';
import {MemoryCenter} from '../src/components/MemoryCenter';
import {MemoryHistory} from '../src/components/MemoryHistory';
import {MemorySuggestions} from '../src/components/MemorySuggestions';
import {ReportPeriodPicker} from '../src/components/ReportPeriodPicker';
import {FamilyActionEditor} from '../src/components/FamilyActionEditor';
import {FamilyFinance} from '../src/components/FamilyFinance';
import {HelpPage} from '../src/components/HelpPage';

const han=/[\u3400-\u9fff]/;
test('English catalog has unique keys',()=>{
 const source=ts.parseJsonText('en.json',readFileSync('src/lib/locales/en.json','utf8'));
 const seen=new Set<string>();
 function walk(n:ts.Node){if(ts.isPropertyAssignment(n)&&ts.isStringLiteral(n.name)){assert.ok(!seen.has(n.name.text),n.name.text);seen.add(n.name.text);}ts.forEachChild(n,walk);}
 walk(source);
});
test('translation keeps placeholders for existing deferred replacement callers',()=>{
 assert.equal(translate('每 {0} {1}','en'),'Every {0} {1}');
 assert.equal(translate('每 {0} {1}','en',[2,'weeks']),'Every 2 weeks');
 assert.equal(translate('每 {0} {1}','en',[0]),'Every 0 {1}');
 assert.match(translate('已添加 {0} 张图片，发送时会一并提交','en').replace('{0}','3'),/3/);
 assert.equal(translate('小悠的中文商品','en'),'小悠的中文商品');
});

test('static component copy and literal translation keys are localized',()=>{
 const failures:string[]=[];
 for(const file of readdirSync('src/components').filter(f=>f.endsWith('.tsx'))){
  const ast=ts.createSourceFile(file,readFileSync('src/components/'+file,'utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX);
  function walk(n:ts.Node){
   if(ts.isJsxText(n)&&han.test(n.text))failures.push(file+': '+n.text.trim());
   if(ts.isJsxAttribute(n)&&n.initializer&&ts.isStringLiteral(n.initializer)&&han.test(n.initializer.text))failures.push(file+': '+n.getText(ast));
   if(ts.isCallExpression(n)&&['tr','t'].includes(n.expression.getText(ast))&&n.arguments[0]&&ts.isStringLiteral(n.arguments[0])){
    const key=n.arguments[0].text;if(han.test(key)&&!Object.hasOwn(en,key)&&!Object.hasOwn(en,key.trim()))failures.push(file+': missing '+key);
   }
   ts.forEachChild(n,walk);
  }
  walk(ast);
 }
 assert.deepEqual(failures,[]);
});

test('all help topics and paragraphs have English copy',()=>{
 for(const section of helpSections)for(const text of [section.title,...section.paragraphs])assert.equal(han.test(translate(text,'en')),false,text);
});

test('memory, family, reporting and help render in English and retain Chinese locale',()=>{
 const nodes=[
  h(MemoryCenter,{embedded:true}),h(MemoryHistory),
  h(MemorySuggestions,{name:'Milk',suggestions:[{id:'m',title:'Milk',status:'matched',reason:'Confirmed alias',fields:{product:'Milk'},sources:[],conflicts:[]} as any],onChange:()=>{}}),
  h(ReportPeriodPicker,{value:{from:'2026-09-01',to:'2026-09-30'},onChange:()=>{}}),
  h(FamilyFinance,{family:'f',userId:'u',onChanged:async()=>{}}),
  h(FamilyActionEditor,{action:{data:{operation:'create'},warnings:[]} as any,onSave:async()=>{},onCancel:()=>{}}),
  h(HelpPage)
 ];
 for(const node of nodes){
  const english=renderToStaticMarkup(h(LanguageProvider,{initial:'en',currency:'USD',children:node}));
  assert.equal(han.test(english),false,english.match(/.{0,40}[\u3400-\u9fff].{0,40}/)?.[0]);
 }
 const chinese=renderToStaticMarkup(h(LanguageProvider,{initial:'zh-CN',children:h(MemoryCenter,{embedded:true})}));
 assert.match(chinese,/记忆中心/);
});
