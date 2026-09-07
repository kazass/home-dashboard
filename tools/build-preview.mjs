import {mkdir,cp,rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});
await mkdir('dist',{recursive:true});
for(const file of ['index.html','css','js','icons','manifest.json','service-worker.js']) await cp(file,`dist/${file}`,{recursive:true});
