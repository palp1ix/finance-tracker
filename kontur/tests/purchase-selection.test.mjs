import {test} from 'node:test';
import assert from 'node:assert/strict';
import {selectPurchases,periodBounds} from '../src/analytics.js';
const tx=(id,extra={})=>({id,type:'expense',category:'Еда',currency:'BYN',amountMinor:'100',occurredAt:'2026-11-05',...extra});
test('category drilldown preserves period and currency and matches the expense category totals',()=>{
 const transactions=[tx('day'),tx('month',{occurredAt:'2026-11',occurredPrecision:'month'}),tx('other',{category:'Дом'}),tx('euro',{currency:'EUR'}),tx('income',{type:'income'}),tx('old',{occurredAt:'2026-10-05'})];
 assert.deepEqual(selectPurchases(transactions,{category:'Еда',currency:'BYN',bounds:periodBounds('month','2026-11-05')}).map(t=>t.id),['day','month']);
});
test('daily details show only expenses with that exact day, including legacy exact dates',()=>{
 const transactions=[tx('day'),tx('month',{occurredAt:'2026-11',occurredPrecision:'month'}),tx('unknown',{occurredPrecision:'unknown'}),tx('refund',{type:'refund'}),tx('transfer',{type:'transfer'}),tx('other',{occurredAt:'2026-11-04'})];
 assert.deepEqual(selectPurchases(transactions,{day:'2026-11-05',currency:'BYN'}).map(t=>t.id),['day']);
 assert.deepEqual(selectPurchases([tx('uncategorized',{category:null})],{category:'Без категории'}).map(t=>t.id),['uncategorized']);
});
