import {test} from 'node:test';import assert from 'node:assert/strict';
import {normalizePurchaseDate,purchaseDateFromForm,monthHeading,recoverSourceMonths} from '../src/dates.js';
import {commitEntry,parseText} from '../src/workflow.js';
import {validate,seal,openVault} from '../src/storage.js';
test('month precision survives agent validation, form submission, commit and encrypted roundtrip',async()=>{
 const d={description:'Покупка',amountMinor:'100',currency:'BYN',type:'expense',category:'Прочее',...purchaseDateFromForm(new Map([['occurredAt',''],['occurredMonth','2026-10']]))};
 const base={version:1,entries:[{id:'e',rawText:'ОКТЯБРЬ\n1р покупка',status:'pending'}],categories:['Прочее'],transactions:[],settings:{}};
 const next=commitEntry(base,'e',[d],base.entries[0].rawText);validate(next);const restored=await openVault(await seal(next,'password123'),'password123');assert.equal(restored.transactions[0].occurredAt,'2026-10');assert.equal(restored.transactions[0].occurredPrecision,'month');
});
test('month validation rejects impossible dates and parser inherits each heading independently',()=>{
 for(const value of ['2026-00','2026-13','0000-01','2026-02-30'])assert.throws(()=>normalizePurchaseDate(value));
 const rows=parseText('ОКТЯБРЬ\n10р продукты\nНОЯБРЬ\n20р еда',['Прочее'],'2026-11-05');assert.equal(rows.length,2);assert.equal(rows[0].occurredAt,'2026-10');assert.equal(rows[1].occurredAt,'2026-11');assert.equal(monthHeading('---ДЕКАБРЬ---','2026-01-05'),'2025-12');
});
test('legacy recovery only repairs proven explicit source-month rows and is idempotent',()=>{
 const data={entries:[{id:'e',rawText:'ТРАТЫ\n1р покупка\n---ОКТЯБРЬ---\n2р покупка',createdAt:'2026-11-05T12:00:00Z'}],transactions:[{id:'e:0',sourceEntryId:'e',occurredAt:null,notes:'Дата неизвестна'},{id:'e:1',sourceEntryId:'e',occurredAt:null,notes:'В исходнике указан октябрь; год и точная дата не указаны.'}]};
 recoverSourceMonths(data);assert.equal(data.transactions[0].occurredAt,null);assert.equal(data.transactions[1].occurredAt,'2026-10');const copy=structuredClone(data);recoverSourceMonths(data);assert.deepEqual(data,copy);
});
