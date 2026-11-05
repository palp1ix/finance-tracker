import {test} from 'node:test';import assert from 'node:assert/strict';import {periodBounds,analyze,percent} from '../src/analytics.js';
test('month summaries end today and compare an adjacent equal-length period',()=>{assert.deepEqual(periodBounds('month','2026-11-04'),{start:'2026-10-04',end:'2026-11-04',previousStart:'2026-09-02',previousEnd:'2026-10-03',monthMode:'overlap'})});
test('keeps currencies, transfers and unknown dates out of dated sums',()=>{const base={currency:'BYN',category:'Еда',occurredPrecision:'day'};const a=analyze([{...base,type:'expense',amountMinor:'798',occurredAt:'2026-11-03'},{...base,type:'refund',amountMinor:'100',occurredAt:'2026-11-04'},{...base,type:'income',amountMinor:'2000',occurredAt:'2026-11-04'},{...base,type:'transfer',amountMinor:'999',occurredAt:'2026-11-04'},{...base,currency:'EUR',type:'expense',amountMinor:'999',occurredAt:'2026-11-03'},{...base,type:'expense',amountMinor:'500',occurredAt:null},{...base,type:'expense',amountMinor:'400',occurredAt:'2026-09-30'}],{currency:'BYN',bounds:periodBounds('month','2026-11-04')});assert.equal(a.expense,798n);assert.equal(a.refund,100n);assert.equal(a.netExpense,698n);assert.equal(a.cashFlow,1302n);assert.equal(a.previousExpense,400n);assert.equal(a.unknown,1);assert.equal(a.days.length,1);assert.equal(percent(1n,4n),25)});
test('unknown precision is not put into a calendar day',()=>{const a=analyze([{currency:'BYN',type:'expense',amountMinor:'100',occurredAt:'2026-11',occurredPrecision:'month'}],{bounds:periodBounds('all')});assert.equal(a.expense,100n);assert.equal(a.days.length,0);assert.equal(a.unknown,0);assert.equal(a.monthOnly,1)});
test('month-only purchases remain in rolling month summaries without inventing purchase days',()=>{
 const transactions=[{currency:'BYN',category:'Продукты',type:'expense',amountMinor:'1000',occurredAt:'2026-10',occurredPrecision:'month'},{currency:'BYN',category:'Продукты',type:'expense',amountMinor:'2000',occurredAt:'2026-11',occurredPrecision:'month'},{currency:'BYN',category:'Продукты',type:'expense',amountMinor:'300',occurredAt:'2026-11-04',occurredPrecision:'day'}];
 const month=analyze(transactions,{bounds:periodBounds('month','2026-11-05')});assert.equal(month.expense,3300n);assert.equal(month.previousExpense,1000n);assert.equal(month.categories[0].amount,3300n);assert.equal(month.days.length,1);assert.equal(month.monthOnly,2);assert.equal(month.boundaryMonthOnly,2);assert.equal(month.comparisonIncomplete,true);assert.equal(month.unknown,0);
 assert.equal(analyze(transactions,{bounds:periodBounds('quarter','2026-11-05')}).expense,3300n);
 assert.equal(analyze(transactions,{bounds:periodBounds('year','2026-11-05')}).expense,3300n);
 assert.equal(analyze(transactions,{bounds:periodBounds('day','2026-11-04')}).expense,300n);
 assert.equal(analyze(transactions,{bounds:periodBounds('week','2026-11-05')}).expense,300n);
 assert.equal(analyze(transactions,{bounds:periodBounds('custom','2026-11-05','2026-10-01','2026-10-31')}).expense,1000n);
 assert.equal(analyze(transactions,{bounds:periodBounds('custom','2026-11-05','2026-10-15','2026-10-31')}).expense,0n);
});

test('automatic periods subtract their span from today and never extend into the future',()=>{
 for(const [kind,start] of [['day','2026-11-05'],['week','2026-10-29'],['month','2026-10-05'],['quarter','2026-08-05'],['year','2025-11-05']]){
  const bounds=periodBounds(kind,'2026-11-05');assert.equal(bounds.start,start);assert.equal(bounds.end,'2026-11-05');
  assert.equal(new Date(bounds.previousEnd+'T12:00:00Z').getTime()+86400000,new Date(bounds.start+'T12:00:00Z').getTime());
  assert.equal(Date.parse(bounds.end)-Date.parse(bounds.start),Date.parse(bounds.previousEnd)-Date.parse(bounds.previousStart));
 }
 const all=periodBounds('all','2026-11-05');assert.equal(all.start,null);assert.equal(all.end,'2026-11-05');assert.equal(all.previousStart,null);
});
test('rolling month and year dates clamp correctly at month ends and leap days',()=>{
 assert.equal(periodBounds('month','2026-03-31').start,'2026-02-28');
 assert.equal(periodBounds('month','2024-03-31').start,'2024-02-29');
 assert.equal(periodBounds('quarter','2026-05-31').start,'2026-02-28');
 assert.equal(periodBounds('year','2024-02-29').start,'2023-02-28');
 assert.equal(periodBounds('week','2026-01-02').start,'2025-12-26');
 assert.equal(periodBounds('year','2026-02-30'),null);
 assert.equal(periodBounds('custom','2026-11-05','2026-02-30','2026-03-02'),null);
 assert.equal(periodBounds('custom','2026-11-05','2026-11-06','2026-11-05'),null);
});
test('future precise dates and future months are excluded even for all-time analytics',()=>{
 const rows=[{id:'today',currency:'BYN',type:'expense',amountMinor:'100',occurredAt:'2026-11-05'},{id:'future-day',currency:'BYN',type:'expense',amountMinor:'200',occurredAt:'2026-11-06'},{id:'future-month',currency:'BYN',type:'expense',amountMinor:'300',occurredAt:'2026-12',occurredPrecision:'month'}];
 for(const kind of ['day','week','month','quarter','year','all'])assert.deepEqual(analyze(rows,{bounds:periodBounds(kind,'2026-11-05')}).current.map(t=>t.id),['today']);
});
test('DST and browser time zones do not change calendar period boundaries',async()=>{
 const {spawnSync}=await import('node:child_process');
 const code="import {periodBounds} from './src/analytics.js'; console.log(JSON.stringify(periodBounds('week','2026-03-31')));";
 const results=['UTC','Europe/Minsk','Europe/Berlin','America/New_York'].map(TZ=>{const r=spawnSync(process.execPath,['--input-type=module','-e',code],{cwd:new URL('..',import.meta.url),env:{...process.env,TZ},encoding:'utf8'});assert.equal(r.status,0);return JSON.parse(r.stdout)});
 for(const result of results){assert.deepEqual(result,results[0]);assert.equal(result.start,'2026-03-24');assert.equal(result.end,'2026-03-31')}
});

test('uncertainty in the preceding period also disables a misleading comparison',()=>{
 const rows=[{currency:'BYN',type:'expense',amountMinor:'100',occurredAt:'2026-11-05'},{currency:'BYN',type:'expense',amountMinor:'500',occurredAt:'2026-09',occurredPrecision:'month'}];
 const a=analyze(rows,{bounds:periodBounds('month','2026-11-05')});assert.equal(a.boundaryMonthOnly,0);assert.equal(a.comparisonIncomplete,true);
});
