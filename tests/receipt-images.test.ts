import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import {receiptSlices,prepareReceiptImages,receiptImageBatches} from '../src/server/receipt-images';
test('long image slices cover every row with overlap, including footer',async()=>{
 const slices=receiptSlices(800,5000);assert.equal(slices[0].top,0);assert.equal(slices.at(-1)!.top+slices.at(-1)!.height,5000);
 for(let i=1;i<slices.length;i++)assert.equal(slices[i-1].top+slices[i-1].height-slices[i].top,200);
 const input=await sharp({create:{width:800,height:5000,channels:3,background:'white'}}).png().toBuffer();
 const result=await prepareReceiptImages(['data:image/png;base64,'+input.toString('base64')]);assert.equal(result.images.length,slices.length);assert.ok(result.labels[0].includes('原图1'));assert.ok(result.labels.at(-1)?.includes('5000'));
 for(let i=0;i<result.images.length;i++){const m=await sharp(Buffer.from(result.images[i].split(',')[1],'base64')).metadata();assert.equal(m.height,slices[i].height);assert.equal(m.width,800);}
});
test('ordinary images remain separate and invalid input is actionable',async()=>{
 assert.deepEqual(receiptSlices(1000,1800),[{top:0,height:1800}]);await assert.rejects(()=>prepareReceiptImages(['data:image/png;base64,invalid']),/第1张图片无法读取/);
 const signal=AbortSignal.abort();await assert.rejects(()=>prepareReceiptImages(['data:image/png;base64,invalid'],signal));
});
test('more than 24 fragments are accepted for downstream batching',async()=>{
 const input=await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toBuffer();
 const result=await prepareReceiptImages(Array(25).fill('data:image/png;base64,'+input.toString('base64')));assert.equal(result.images.length,25);assert.ok(result.labels[24].includes('原图25'));
});
test('image batches stay small and preserve one neighboring overlap',async()=>{
 const input=await sharp({create:{width:32,height:32,channels:3,background:'white'}}).png().toBuffer(),image='data:image/png;base64,'+input.toString('base64'),batches=[];
 for await(const batch of receiptImageBatches(Array(7).fill(image)))batches.push(batch);
 assert.deepEqual(batches.map(batch=>batch.images.length),[3,3,3]);
 assert.equal(batches[0].images.at(-1),batches[1].images[0]);
});
