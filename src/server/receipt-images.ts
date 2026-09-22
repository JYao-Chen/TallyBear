import sharp from 'sharp';
import {Failure} from './access';
export function receiptSlices(width:number,height:number){
 if(height<=Math.max(2600,width*3))return [{top:0,height}];
 const size=Math.max(1600,Math.min(2400,Math.round(width*2.2))),overlap=200,parts=[];
 for(let top=0;top<height;top+=size-overlap){parts.push({top,height:Math.min(size,height-top)});if(top+size>=height)break;}
 return parts;
}
export async function prepareReceiptImages(images:string[],signal?:AbortSignal,resolve?:(s:string)=>Promise<string>){
 const output:string[]=[],labels:string[]=[];let bytes=0;
 for(let index=0;index<images.length;index++){
  signal?.throwIfAborted();
  try{
   const input=Buffer.from((resolve?await resolve(images[index]):images[index]).split(',')[1],'base64');
   const normalized=await sharp(input,{limitInputPixels:60000000}).rotate().resize({width:1600,withoutEnlargement:true}).png().toBuffer({resolveWithObject:true});
   const slices=receiptSlices(normalized.info.width,normalized.info.height);
   for(let part=0;part<slices.length;part++){
    signal?.throwIfAborted();const slice=slices[part];
    const data=await sharp(normalized.data).extract({left:0,top:slice.top,width:normalized.info.width,height:slice.height}).jpeg({quality:90}).toBuffer();
    output.push('data:image/jpeg;base64,'+data.toString('base64'));
    labels.push(`第${output.length}张模型输入 = 原图${index+1}，片段${part+1}/${slices.length}，纵向像素${slice.top}–${slice.top+slice.height}。${slices.length>1?'相邻片段有200像素重叠，重叠的同一行只提取一次。':''}`);
   }
  }catch(e){if(signal?.aborted)throw e;if(e instanceof Failure)throw e;throw new Failure(`第${index+1}张图片无法读取或超过6000万像素，请重新导出或拆分图片`);}
 }
 return {images:output,labels};
}

export async function* receiptImageBatches(images:string[],signal?:AbortSignal,resolve?:(s:string)=>Promise<string>){
 const batchSize=3;
 let data:string[]=[],labels:string[]=[],emitted=false;
 for(let i=0;i<images.length;i++){
  const prepared=await prepareReceiptImages([images[i]],signal,resolve);
  for(let j=0;j<prepared.images.length;j++){data.push(prepared.images[j]);labels.push(prepared.labels[j].replace('原图1，',`原图${i+1}，`));if(data.length===batchSize){yield {images:data,labels};emitted=true;data=data.slice(-1);labels=labels.slice(-1);}}
 }
 if(data.length>1||!emitted)yield {images:data,labels};
}
