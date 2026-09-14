import sharp from 'sharp';
import {Failure} from './access';
// Keep all pixels, normalize orientation and remove camera metadata.
export async function compressReceipt(input:string,output:string,photo=false){
 const meta=await sharp(input,{limitInputPixels:60000000}).metadata();
 if(!['png','jpeg','webp'].includes(meta.format||''))throw new Failure('请选择PNG、JPEG或WebP图片');
 const long=!photo&&Math.max(meta.width||0,meta.height||0)>16383;
 const image=sharp(input,{limitInputPixels:60000000}).rotate();
 if(photo)image.resize({width:3840,height:3840,fit:'inside',withoutEnlargement:true});
 const info=await (long?image.png({compressionLevel:9}):image.webp({quality:photo?85:90,effort:5,smartSubsample:true})).toFile(output);
 return {mime:long?'image/png':'image/webp',bytes:info.size,width:info.width,height:info.height};
}
