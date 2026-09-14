import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {mkdtemp,rm} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {compressReceipt} from '../src/server/receipt-compression';
test('receipt WebP preserves resolution and compresses a detailed receipt',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'receipt-compress-'));
 try{
  const svg=Buffer.from(`<svg width="1800" height="3000">${Array.from({length:60},(_,i)=>`<text x="50" y="${45+i*48}" font-size="32">Order 20260913 Item ${i} x 2 = 128.50</text>`).join('')}</svg>`);
  const input=path.join(dir,'input.png'),output=path.join(dir,'output');
  const original=await sharp({create:{width:1800,height:3000,channels:3,background:'white'}}).composite([{input:svg}]).png({compressionLevel:0}).toFile(input);
  const result=await compressReceipt(input,output);assert.equal(result.mime,'image/webp');assert.equal(result.width,1800);assert.equal(result.height,3000);assert.ok(result.bytes<original.size/5);
  assert.equal((await sharp(output).metadata()).format,'webp');
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('very long screenshots stay full height via PNG fallback',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'receipt-long-'));
 try{const input=path.join(dir,'input.png'),output=path.join(dir,'output');await sharp({create:{width:400,height:18000,channels:3,background:'white'}}).png().toFile(input);const result=await compressReceipt(input,output);assert.equal(result.mime,'image/png');assert.equal(result.height,18000);assert.equal(result.width,400);}finally{await rm(dir,{recursive:true,force:true});}
});
test('life photos retain up to 3840 pixels without enlarging smaller photos',async()=>{
 const dir=await mkdtemp(path.join(os.tmpdir(),'life-photo-'));
 try{for(const [width,height,wantW,wantH] of [[4800,2400,3840,1920],[800,600,800,600]]){const input=path.join(dir,'input.png'),output=path.join(dir,'output');await sharp({create:{width,height,channels:3,background:'#a4cfad'}}).png().toFile(input);const r=await compressReceipt(input,output,true);assert.equal(r.mime,'image/webp');assert.equal(r.width,wantW);assert.equal(r.height,wantH);}}finally{await rm(dir,{recursive:true,force:true});}
});
