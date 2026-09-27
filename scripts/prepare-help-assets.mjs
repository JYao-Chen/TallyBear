import {mkdir,copyFile,readdir} from 'node:fs/promises';
const source=new URL('../docs/screenshots/v2/',import.meta.url),target=new URL('../public/help/v2/',import.meta.url);
await mkdir(target,{recursive:true});
for(const name of await readdir(source))if(/^(en|zh)-(desktop|mobile)-[a-z-]+\.webp$/.test(name))await copyFile(new URL(name,source),new URL(name,target));
