import test from 'node:test';
import assert from 'node:assert/strict';
import {createElement as h} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {ProfileInsightBoard,ProfileOverviewSummary} from '../src/components/ProfileOverview';
import {LanguageProvider} from '../src/components/LanguageProvider';
import {ThemeProvider} from '../src/components/ThemeProvider';
import type {ProfileInsight} from '../src/lib/personal-profile';

test('overview respects minimal theme and renders a static companion before hydration',()=>{
 const view=h(ProfileOverviewSummary,{summary:{transactions:0,stable:0,changed:0,tentative:0},status:'',onStatus:()=>{}});
 const render=(theme:'bear'|'minimal')=>renderToStaticMarkup(h(LanguageProvider,{initial:'en',children:h(ThemeProvider,{initial:theme,children:view})}));
 assert.match(render('bear'),/bubu-yier-001.png/);
 assert.doesNotMatch(render('minimal'),/bubu-yier-/);
 assert.match(render('bear'),/It starts with your first entry/);
});

test('visual scene groups preserve evidence, changed choices and uncommon contexts',()=>{
 const item:ProfileInsight={key:'test',condition:{kind:'income',fields:{'scene.type':'general'},timeBand:'morning'},field:'accountId',status:'changed',previousValue:'Old wallet',lastSeen:'2026-10-01',count:9,choices:[{value:'New wallet',count:9,independent:9,weight:4,share:.85,recentCount:9,previousCount:0,sources:[]}]};
 const html=renderToStaticMarkup(h(LanguageProvider,{initial:'en',children:h(ProfileInsightBoard,{items:[item],selected:'test',onSelect:()=>{},field:()=> 'Wallet',label:v=>v,places:[]})}));
 for(const text of ['Everyday &amp; other contexts','Income','morning','Old wallet','New wallet','85%','View evidence','aria-pressed="true"'])assert.ok(html.includes(text),text);
 assert.doesNotMatch(html,/[\u3400-\u9fff]/);
});
