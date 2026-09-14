import test from 'node:test';import assert from 'node:assert/strict';import {createElement} from 'react';import {renderToStaticMarkup} from 'react-dom/server';
import {ThemeProvider} from '../src/components/ThemeProvider';import {SymbolIcon,StickerPicker} from '../src/components/VisualSelect';import {validTheme} from '../src/lib/themes';import stickers from '../src/lib/stickers.json';
test('minimal theme substitutes built-in bears without mutating saved icons',()=>{
 const icon='sticker:'+stickers[0];const render=(initial:'bear'|'minimal')=>renderToStaticMarkup(createElement(ThemeProvider,{initial,children:createElement(SymbolIcon,{icon})}));
 assert.ok(render('bear').includes('/stickers/'));assert.ok(!render('minimal').includes('/stickers/'));assert.ok(render('minimal').includes('<svg'));
 const picker=renderToStaticMarkup(createElement(ThemeProvider,{initial:'minimal',children:createElement(StickerPicker,{value:icon,onChange:()=>{}})}));assert.ok(!picker.includes('/stickers/'));assert.ok(!picker.includes('🧸'));
 assert.equal(validTheme('untrusted'),'bear');assert.equal(validTheme('minimal'),'minimal');
});
