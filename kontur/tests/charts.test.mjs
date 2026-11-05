import {test} from 'node:test';
import assert from 'node:assert/strict';
import {timeline,cashFlowChart,categoryDonut,chartIndex} from '../src/charts.js';
const tx=(occurredAt,type,amountMinor,extra={})=>({occurredAt,type,amountMinor,currency:'BYN',...extra});
test('timeline fills missing days and separates income, expenses, refunds and transfers exactly',()=>{
 const result=timeline([tx('2026-11-01','expense','9007199254740993'),tx('2026-11-01','expense','7'),tx('2026-11-03','income','500'),tx('2026-11-03','refund','100'),tx('2026-11-03','transfer','999'),tx(null,'expense','999'),tx('2026-11-02','expense','900',{occurredPrecision:'unknown'})],{start:'2026-11-01',end:'2026-11-03'});
 assert.equal(result.unit,'day');assert.deepEqual(result.buckets,[{key:'2026-11-01',expense:9007199254741000n,income:0n,refund:0n},{key:'2026-11-02',expense:0n,income:0n,refund:0n},{key:'2026-11-03',expense:0n,income:500n,refund:100n}]);
});
test('month-only purchases switch chart to months without inventing a day',()=>{
 const result=timeline([tx('2026-10','expense','1000',{occurredPrecision:'month'}),tx('2026-11-05','expense','798'),tx('2026-11','income','3000',{occurredPrecision:'month'})],{start:'2026-10-01',end:'2026-12-31'});
 assert.equal(result.unit,'month');assert.deepEqual(result.buckets,[{key:'2026-10',expense:1000n,income:0n,refund:0n},{key:'2026-11',expense:798n,income:3000n,refund:0n},{key:'2026-12',expense:0n,income:0n,refund:0n}]);
});
test('all-time chart includes final month and long histories aggregate by year',()=>{
 const monthly=timeline([tx('2026-11','expense','500')]);assert.equal(monthly.buckets[0].expense,500n);
 const long=timeline([tx('2020-01-01','expense','100'),tx('2026-11','income','200')]);assert.equal(long.unit,'year');assert.equal(long.buckets.length,7);assert.equal(long.buckets.at(-1).income,200n);
});
test('charts handle empty data and escape category labels',()=>{
 assert.deepEqual(timeline([]).buckets,[]);assert.match(cashFlowChart([], 'BYN',{}),/Добавьте операции/);
 assert.equal(categoryDonut([],0n,'BYN'),'');assert.match(categoryDonut([{name:'<script>',amount:100n}],100n,'BYN'),/&lt;script&gt;/);
 const chart=cashFlowChart([tx('2026-11-01','income','100')],'BYN',{start:'2026-11-01',end:'2026-11-01'});assert.doesNotMatch(chart,/NaN|Infinity/);assert.match(chart,/Значения графика/);
});

test('rounded chart shows a single month without a fictitious line and keeps exact tooltip values',()=>{
 const chart=cashFlowChart([tx('2026-11','expense','29375'),tx('2026-11','refund','102')],'BYN',{});
 assert.doesNotMatch(chart,/<svg|<path|<circle|chart-gridline/);
 assert.match(chart,/data-expense="293.75"/);assert.match(chart,/data-refund="1.02"/);
 assert.equal((chart.match(/class="cash-column"/g)||[]).length,1);
 assert.match(chart,/data-series="expense"[^>]*aria-pressed="true"/);
 assert.match(chart,/data-tooltip-income/);assert.match(chart,/cash-touch-hint/);
});
test('income-only chart selects income and preserves zero expenses',()=>{
 const chart=cashFlowChart([tx('2026-11','income','10000')],'BYN',{});
 assert.match(chart,/data-series="income"[^>]*aria-pressed="true"/);assert.match(chart,/data-expense="0.00"/);
 assert.doesNotMatch(chart,/NaN|Infinity/);
});
test('pointer selection covers the entire chart and clamps captured drags at its edges',()=>{
 assert.equal(chartIndex(100,100,300,3),0);assert.equal(chartIndex(249,100,300,3),1);assert.equal(chartIndex(399,100,300,3),2);
 assert.equal(chartIndex(-100,100,300,3),0);assert.equal(chartIndex(900,100,300,3),2);assert.equal(chartIndex(250,100,300,1),0);
});
