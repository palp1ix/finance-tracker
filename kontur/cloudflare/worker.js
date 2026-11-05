// Personal vault API. Only encrypted envelopes are accepted; no master password reaches this service.
export async function handle(request,env){
 const url=new URL(request.url),origin=request.headers.get('Origin');
 const allowed=(env.ALLOWED_ORIGINS||'').split(',').map(s=>s.trim()).filter(Boolean);
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Vary':'Origin'};
 if(origin&&allowed.includes(origin))headers['Access-Control-Allow-Origin']=origin;
 const json=(status,value)=>new Response(JSON.stringify(value),{status,headers});
 if(url.pathname!=='/api/vault')return json(404,{error:'Not found'});
 if(origin&&!allowed.includes(origin))return json(403,{error:'Этот адрес сайта не разрешён'});
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{...headers,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type','Access-Control-Max-Age':'600'}});
 if(!['GET','POST'].includes(request.method))return json(405,{error:'Method not allowed'});
 if(!env.SYNC_TOKEN_HASH)return json(503,{error:'Синхронизация ещё не настроена'});
 const authorization=request.headers.get('Authorization')||'';
 if(!/^Bearer [a-f0-9]{64}$/.test(authorization))return json(401,{error:'Неверный файл подключения'});
 const hash=[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(authorization.slice(7))))].map(b=>b.toString(16).padStart(2,'0')).join('');
 let different=hash.length^env.SYNC_TOKEN_HASH.length;for(let i=0;i<hash.length;i++)different|=hash.charCodeAt(i)^(env.SYNC_TOKEN_HASH.charCodeAt(i)||0);
 if(different)return json(401,{error:'Неверный файл подключения'});
 try{
  if(request.method==='GET'){const row=await env.DB.prepare('SELECT envelope,revision FROM vaults WHERE id=?').bind('personal').first();return json(200,row?{envelope:JSON.parse(row.envelope),revision:row.revision}:{envelope:null,revision:0})}
  if(!origin)return json(403,{error:'Origin required'});
  if(Number(request.headers.get('content-length')||0)>10000000)return json(413,{error:'Слишком большой файл'});
  const reader=request.body?.getReader();if(!reader)return json(400,{error:'Пустой запрос'});
  const chunks=[];let length=0;for(;;){const {value,done}=await reader.read();if(done)break;length+=value.byteLength;if(length>10000000){await reader.cancel();return json(413,{error:'Слишком большой файл'})}chunks.push(value)}
  const bytes=new Uint8Array(length);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.byteLength}
  let body;try{body=JSON.parse(new TextDecoder().decode(bytes))}catch{return json(400,{error:'Неверный JSON'})}
  const {envelope,expectedRevision}=body;
  if(!Number.isSafeInteger(expectedRevision)||expectedRevision<0||expectedRevision>=Number.MAX_SAFE_INTEGER||envelope?.format!=='kontur-vault'||envelope.version!==1||envelope.kdf!=='PBKDF2-SHA256'||envelope.iterations!==600000||typeof envelope.salt!=='string'||typeof envelope.iv!=='string'||typeof envelope.ciphertext!=='string'||!envelope.ciphertext.length||envelope.ciphertext.length>9500000)return json(400,{error:'Неверное зашифрованное хранилище'});
  const revision=expectedRevision+1,at=new Date().toISOString();let row;
  if(expectedRevision===0)row=await env.DB.prepare('INSERT INTO vaults(id,envelope,revision,updated_at) VALUES(?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING revision').bind('personal',JSON.stringify(envelope),revision,at).first();
  else row=await env.DB.prepare('UPDATE vaults SET envelope=?,revision=?,updated_at=? WHERE id=? AND revision=? RETURNING revision').bind(JSON.stringify(envelope),revision,at,'personal',expectedRevision).first();
  return row?json(200,{revision}):json(409,{error:'Другое устройство сохранило изменения. Повторите синхронизацию'});
 }catch{return json(500,{error:'Облако недоступно. Локальные данные остаются на устройстве'})}
}
export default {fetch:handle};
