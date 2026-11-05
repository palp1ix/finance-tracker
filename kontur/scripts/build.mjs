import {cp, mkdir, rm} from 'node:fs/promises';
await rm('dist',{recursive:true,force:true});await mkdir('dist',{recursive:true});for(const p of ['index.html','manifest.webmanifest','icon.svg','src','sw.js','icons'])await cp(p,`dist/${p}`,{recursive:true});console.log('Built static site in dist/');
