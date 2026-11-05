const CACHE='kontur-v14';
const FILES=['./','./index.html','./src/app.js?v=14','./src/style.css?v=14','./src/finance.js','./src/analytics.js','./src/charts.js','./src/agent-data.js','./src/motion.js','./src/storage.js','./src/workflow.js','./src/features.js','./src/cloud.js','./src/insights.js','./src/rates.js','./src/dates.js','./manifest.webmanifest','./icon.svg','./icons/icon-192.png','./icons/icon-512.png'];
self.addEventListener('install',e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(FILES)).then(()=>self.skipWaiting())));
self.addEventListener('activate',e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('kontur-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',e=>{
 const url=new URL(e.request.url);
 if(e.request.method!=='GET'||url.origin!==location.origin||url.pathname.startsWith('/api/')||url.pathname.includes('chatgpt'))return;
 if(e.request.mode==='navigate')e.respondWith(fetch(e.request).then(async r=>{if(r.ok&&!r.redirected){const c=await caches.open(CACHE);await c.put('./index.html',r.clone())}return r}).catch(()=>caches.match('./index.html')));
 else e.respondWith(caches.match(e.request).then(cached=>cached||fetch(e.request)));
});
