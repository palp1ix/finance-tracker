import {randomBytes,randomUUID} from 'node:crypto';
export function createAgentBridge({writeConnection,clearConnection,clock=Date.now,ttl=10000}){
 let token=null,snapshot=null,heartbeat=0,jobs=[],results=new Map();
 async function clear(){token=null;snapshot=null;heartbeat=0;jobs=[];results.clear();await clearConnection()}
 async function expire(){if(token&&clock()-heartbeat>ttl)await clear()}
 const validSnapshot=s=>s&&Array.isArray(s.entries)&&Array.isArray(s.categories)&&Array.isArray(s.transactions);
 async function handle(method,url,headers,readBody){
  await expire();const respond=(status,value)=>({status,value});
  if(url.pathname==='/api/agent/session'&&method==='GET'&&headers['x-kontur-client']==='1'&&headers['sec-fetch-site']==='same-origin'){
   await clear();token=randomBytes(32).toString('hex');heartbeat=clock();await writeConnection(token);return respond(200,{token});
  }
  if(!token||headers.authorization!=='Bearer '+token)return respond(401,{error:'Open and unlock Kontur, then connect the local agent in Buffer'});
  const requestToken=token;const read=async()=>{const value=await readBody();if(token!==requestToken||clock()-heartbeat>ttl)throw Error('Agent session expired');return value};
  if(url.pathname==='/api/agent/disconnect'&&method==='POST'){await clear();return respond(200,{ok:true})}
  if(url.pathname==='/api/agent/state'&&method==='POST'){
   const state=await read();if(!validSnapshot(state))return respond(400,{error:'Reload Kontur to use the history bridge'});
   snapshot=state;heartbeat=clock();return respond(200,{job:jobs[0]||null});
  }
  if(!snapshot)return respond(409,{error:'Wait for the unlocked browser to connect'});
  if(url.pathname==='/api/agent/buffer'&&method==='GET')return respond(200,{today:snapshot.today,categories:snapshot.categories,entries:snapshot.entries.filter(e=>e.status==='pending')});
  if(url.pathname==='/api/agent/history'&&method==='GET')return respond(200,{version:2,today:snapshot.today,categories:snapshot.categories,transactions:snapshot.transactions});
  if(url.pathname==='/api/agent/commit'&&method==='POST'){
   const job=await read();if(!snapshot.entries.some(e=>e.status==='pending'&&e.id===job.entryId&&e.rawText===job.rawText))return respond(409,{error:'Entry changed or already processed'});
   const id=randomUUID();jobs.push({kind:'buffer',entryId:job.entryId,rawText:job.rawText,transactions:job.transactions,id});return respond(202,{id});
  }
  if(url.pathname==='/api/agent/dates'&&method==='POST'){
   const {changes}=await read();if(!Array.isArray(changes)||!changes.length||changes.length>5000)return respond(400,{error:'Expected 1–5000 date changes'});
   const id=randomUUID();jobs.push({kind:'dates',changes,id});return respond(202,{id});
  }
  if(url.pathname==='/api/agent/result'&&method==='POST'){
   const r=await read();if(!jobs.some(j=>j.id===r.id))return respond(409,{error:'Unknown job'});
   if(r.ok&&!validSnapshot(r.snapshot))return respond(400,{error:'Saved snapshot required'});
   if(r.ok){snapshot=r.snapshot;heartbeat=clock()}
   results.set(r.id,{id:r.id,ok:r.ok===true,...(r.error?{error:String(r.error)}:{})});jobs=jobs.filter(j=>j.id!==r.id);
   if(results.size>100)results.delete(results.keys().next().value);
   return respond(200,{ok:true});
  }
  if(url.pathname==='/api/agent/result'&&method==='GET')return respond(200,results.get(url.searchParams.get('id'))||{pending:true});
  return respond(404,{error:'Unknown endpoint'});
 }
 return {handle,expire};
}
