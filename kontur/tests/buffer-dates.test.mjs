import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bufferEntryDay,defaultEntryDates} from '../src/dates.js';
import {commitEntry} from '../src/workflow.js';
const draft={description:'Продукты',amountMinor:'100',currency:'BYN',category:'Прочее',type:'expense',occurredAt:null};
test('a one-line note uses its added calendar day, not the processing day or UTC day',()=>{
 const entry={id:'e',rawText:'Продукты 1',status:'pending',createdAt:new Date(2026,10,5,0,30).toISOString()};
 assert.equal(bufferEntryDay(entry),'2026-11-05');const result=defaultEntryDates(entry,[draft]);assert.equal(result[0].occurredAt,'2026-11-05');assert.equal(result[0].occurredPrecision,'day');assert.equal(draft.occurredAt,null);
 const data={version:1,entries:[entry],transactions:[],categories:['Прочее'],settings:{}};
 assert.equal(commitEntry(data,'e',[draft],entry.rawText,'2026-12-01T12:00:00Z').transactions[0].occurredAt,'2026-11-05');
});
test('explicit dates survive fallback and multiline lists or transaction imports require their own dates',()=>{
 const entry={rawText:'Покупка 1',createdAt:'2026-11-05T12:00:00Z',bufferedDay:'2026-11-04'};
 assert.equal(defaultEntryDates(entry,[draft])[0].occurredAt,'2026-11-04');
 for(const occurredAt of ['2026-09','2026-10-01'])assert.equal(defaultEntryDates(entry,[{...draft,occurredAt}])[0].occurredAt,occurredAt);
 assert.equal(defaultEntryDates({...entry,rawText:'Покупка 1\nПокупка 2'},[draft])[0].occurredAt,null);
 assert.equal(defaultEntryDates({...entry,source:'transactions-import'},[draft])[0].occurredAt,null);
 assert.equal(defaultEntryDates({rawText:'Покупка 1',createdAt:'broken'},[draft])[0].occurredAt,null);
});
