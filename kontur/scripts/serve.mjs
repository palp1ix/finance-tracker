import http from 'node:http';
import {readFile,writeFile,realpath,unlink} from 'node:fs/promises';
import path from 'node:path';
import {createAgentBridge} from './agent-bridge.mjs';
const root=process.cwd(),port=Number(process.env.PORT||5173);
const bridge=createAgentBridge({writeConnection:token=>writeFile('.agent-connection.json',JSON.stringify({url:`http://127.0.0.1:${port}`,token}),{mode:0o600}),clearConnection:()=>unlink('.agent-connection.json').catch(()=>{})});
setInterval(()=>bridge.expire().catch(()=>{}),2000).unref();
const types={'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.webmanifest':'application/manifest+json'};
async function body(req){let text='';for await(const chunk of req){text+=chunk;if(text.length>1024*1024)throw Error('Body too large')}return text?JSON.parse(text):{}}
const server=http.createServer(async(req,res)=>{
 const json=(status,value)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(value))};
 try{
 if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return json(403,{error:'Loopback only'});const host=req.headers.host;if(![`localhost:${port}`,`127.0.0.1:${port}`,`[::1]:${port}`].includes(host))return json(403,{error:'Host not allowed'});
 const url=new URL(req.url,'http://'+host);
 if(url.pathname.startsWith('/api/')){
  if(req.headers.origin&&req.headers.origin!=='http://'+host)return json(403,{error:'Origin not allowed'});
  if(req.headers['sec-fetch-site']&&req.headers['sec-fetch-site']!=='same-origin')return json(403,{error:'Same origin required'});
  const result=await bridge.handle(req.method,url,req.headers,()=>body(req));return json(result.status,result.value);
 }
 if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Method not allowed'});
 const relative=decodeURIComponent(url.pathname);const allowed=relative==='/'||['/index.html','/sw.js','/icon.svg','/manifest.webmanifest'].includes(relative)||/^\/(src|icons)\/[\w./-]+$/.test(relative);
 if(!allowed)return json(404,{error:'Not found'});
 const p=await realpath(path.resolve(root,'.'+(relative==='/'?'/index.html':relative)));
 if(!p.startsWith(root+path.sep))return json(403,{error:'Forbidden'});
 res.setHeader('Content-Type',types[path.extname(p)]||'application/octet-stream');res.setHeader('Cache-Control','no-cache');res.setHeader('X-Content-Type-Options','nosniff');res.end(await readFile(p));
 }catch(e){json(400,{error:'Request failed'})}
});
server.listen(port,'127.0.0.1',()=>console.log(`http://localhost:${port}`));
