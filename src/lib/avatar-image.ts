/** Resize locally so phone originals never have to be uploaded as full-size avatars. */
export async function compressAvatar(file:File):Promise<string>{
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)&&!(file.type===''&&/\.(png|jpe?g|webp)$/i.test(file.name)))throw new Error('请选择PNG、JPG或WebP图片');
 const url=URL.createObjectURL(file),image=new Image();
 const canvas=document.createElement('canvas');
 try{
  await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error('无法读取这张图片，请重新选择'));image.src=url;});
  const context=canvas.getContext('2d');if(!context)throw new Error('当前浏览器无法处理图片');
  for(const edge of [512,384,256,192]){
   const scale=Math.min(1,edge/Math.max(image.naturalWidth,image.naturalHeight));
   canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));
   context.drawImage(image,0,0,canvas.width,canvas.height);
   for(const quality of [.86,.7,.5]){
    const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/webp',quality));
    if(blob&&blob.size<=250*1024)return await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(new Error('图片处理失败，请重试'));reader.readAsDataURL(blob);});
   }
  }
  throw new Error('图片压缩失败，请尝试另一张图片');
 }finally{URL.revokeObjectURL(url);canvas.width=canvas.height=0;}
}
