// node scripts/stats-diff.mjs before.json after.json — list every aggregate that changed between two stats snapshots.
import {readFileSync} from 'node:fs';
const [a,b]=process.argv.slice(2).map(f=>JSON.parse(readFileSync(f,'utf8')));
const changes=[];
const walk=(x,y,path)=>{
 if(path==='generatedAt')return;
 if(x&&y&&typeof x==='object'&&typeof y==='object'){for(const k of new Set([...Object.keys(x),...Object.keys(y)]))walk(x[k],y[k],path?path+'.'+k:k);return;}
 if(typeof x==='number'&&typeof y==='number'&&Math.abs(x-y)<1e-6)return;
 if(x!==y)changes.push(`${path}: ${JSON.stringify(x)} → ${JSON.stringify(y)}`);
};
walk(a,b,'');
console.log(changes.length?changes.join('\n'):'无差异');
process.exit(changes.length?1:0);
