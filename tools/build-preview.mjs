import {mkdir,cp,rm} from 'node:fs/promises';
import {build} from 'esbuild';
await rm('dist',{recursive:true,force:true});
await mkdir('dist/client',{recursive:true});
await mkdir('dist/.openai',{recursive:true});
for(const file of ['index.html','css','js','icons','fonts','manifest.json','service-worker.js']) await cp(file,`dist/client/${file}`,{recursive:true});
await build({entryPoints:['server/index.mjs'],outfile:'dist/server/index.js',bundle:true,format:'esm',platform:'browser',target:'es2022'});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
