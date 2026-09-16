import assert from 'node:assert/strict';
import {lockModalScroll} from '../src/lib/modal-scroll';
const root={style:{overflow:''}};
Object.assign(globalThis,{document:{documentElement:root}});
for(const parentFirst of [true,false]){root.style.overflow='auto';const parent=lockModalScroll(),child=lockModalScroll();assert.equal(root.style.overflow,'hidden');(parentFirst?parent:child)();assert.equal(root.style.overflow,'hidden');(parentFirst?child:parent)();assert.equal(root.style.overflow,'auto');parent();child();assert.equal(root.style.overflow,'auto');}
console.log('PASS: parent-first and child-first cleanup restore scrolling only after the final dialog');
