import {test} from 'node:test';
import assert from 'node:assert/strict';
globalThis.matchMedia=()=>({matches:false,addEventListener(){}});
globalThis.document={querySelectorAll:()=>[]};
const {runEntryAI,isAIParsing,aiProgress,clearAI}=await import('../src/features.js');
const entry={id:'loading-entry',rawText:'Покупка 1',status:'pending',createdAt:'2026-11-05T12:00:00Z'};
test('AI parsing exposes persistent loading, prevents duplicates and discards responses after locking',async()=>{
 let complete,calls=0,signal;const flashes=[];const ctx={get:()=>({entries:[entry]}),flash:(...args)=>flashes.push(args)};
 const parse=(_entry,_data,s)=>{calls++;signal=s;return new Promise(resolve=>{complete=resolve})};
 const pending=runEntryAI(entry,ctx,parse);assert.equal(isAIParsing(entry.id),true);assert.match(aiProgress(entry.id),/role="status"/);assert.match(aiProgress(entry.id),/Отменить/);
 await runEntryAI(entry,ctx,parse);assert.equal(calls,1);clearAI();assert.equal(signal.aborted,true);assert.equal(isAIParsing(entry.id),false);complete([]);await pending;assert.deepEqual(flashes,[]);
});
test('AI failures leave the entry intact and allow a retry',async()=>{
 const flashes=[],ctx={get:()=>({entries:[entry]}),flash:(...args)=>flashes.push(args)};
 const parse=async()=>{throw Error('Network unavailable')};
 await runEntryAI(entry,ctx,parse);assert.equal(isAIParsing(entry.id),false);assert.equal(entry.status,'pending');assert.deepEqual(flashes,[['Network unavailable',true]]);
 await runEntryAI(entry,ctx,parse);assert.equal(flashes.length,2);clearAI();
});
