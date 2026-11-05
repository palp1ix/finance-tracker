import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../cloudflare/worker.js';
import {seal,openVault} from '../src/storage.js';
import {mergeVaults,migrate} from '../src/workflow.js';
import {validateConnection,setCloudConnection,clearCloudSession,cloud,configured} from '../src/cloud.js';
const token='a'.repeat(64),origin='https://palp1ix.github.io';
const hash=async value=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))].map(b=>b.toString(16).padStart(2,'0')).join('');
const request=(method='GET',body,headers={})=>new Request('https://kontur-sync.example.workers.dev/api/vault',{method,headers:{Origin:origin,Authorization:'Bearer '+token,...headers},...(body?{body:JSON.stringify(body)}:{})});
test('independent Cloudflare API requires a private token and restricts browser origins',async()=>{
 const env={SYNC_TOKEN_HASH:await hash(token),ALLOWED_ORIGINS:origin};
 assert.equal((await handle(request('GET',null,{Authorization:''}),env)).status,401);
 assert.equal((await handle(request('GET',null,{Authorization:'Bearer '+'b'.repeat(64)}),env)).status,401);
 assert.equal((await handle(request('GET',null,{Origin:'https://evil.example'}),env)).status,403);
 const preflight=await handle(request('OPTIONS',null,{Authorization:''}),env);assert.equal(preflight.status,204);assert.equal(preflight.headers.get('Access-Control-Allow-Origin'),origin);
 const invalid=await handle(request('POST',{expectedRevision:0,envelope:{plaintext:'private'}}),env);assert.equal(invalid.status,400);
});
test('two devices sync encrypted snapshots via standalone D1 API with CAS protection',async()=>{
 const sql=new DatabaseSync(':memory:');sql.exec('CREATE TABLE vaults(id TEXT PRIMARY KEY,envelope TEXT NOT NULL,revision INTEGER NOT NULL,updated_at TEXT NOT NULL)');
 const env={SYNC_TOKEN_HASH:await hash(token),ALLOWED_ORIGINS:origin,DB:{prepare:q=>({bind:(...args)=>({first:async()=>sql.prepare(q).get(...args)||null})})}};
 const api=async body=>{const response=await handle(request(body?'POST':'GET',body),env);return {status:response.status,...await response.json()}};
 const a=migrate({version:1,entries:[{id:'one',rawText:'synthetic',status:'pending'}],transactions:[],categories:['Прочее'],settings:{}});
 const first=await api({expectedRevision:0,envelope:await seal(a,'test-password')});assert.equal(first.status,200);
 const b=structuredClone(a);b.entries.push({id:'two',rawText:'synthetic',status:'pending'});
 const current=await api(),merged=mergeVaults(b,await openVault(current.envelope,'test-password'));
 assert.equal((await api({expectedRevision:current.revision,envelope:await seal(merged,'test-password')})).status,200);
 assert.equal((await api({expectedRevision:current.revision,envelope:await seal(a,'test-password')})).status,409);
 const final=await api();assert.equal((await openVault(final.envelope,'test-password')).entries.length,2);assert.ok(!sql.prepare('SELECT envelope FROM vaults').get().envelope.includes('synthetic'));sql.close();
});
test('connection credentials accept only HTTPS Worker origins and are cleared on lock',()=>{
 const connection={format:'kontur-sync-connection',version:1,endpoint:'https://kontur-sync.example.workers.dev',token};
 assert.deepEqual(validateConnection(connection),connection);for(const endpoint of ['http://localhost','https://evil.example','https://kontur-sync.example.workers.dev/api','https://user:secret@kontur-sync.example.workers.dev'])assert.throws(()=>validateConnection({...connection,endpoint}));
 setCloudConnection(connection);assert.equal(configured(),true);clearCloudSession();assert.equal(configured(),false);assert.equal(cloud.session,null);
});
