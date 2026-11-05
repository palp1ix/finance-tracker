import {test} from 'node:test';
import assert from 'node:assert/strict';
import {bindCashFlowCharts} from '../src/charts.js';
function fixture(){
 const node=()=>({events:{},dataset:{},style:{setProperty(k,v){this[k]=v}},classList:{add(){},remove(){},toggle(){}},addEventListener(name,cb,options){(this.events[name]||=[]).push({cb,signal:options?.signal})},emit(name,event={}){for(const {cb,signal} of this.events[name]||[])if(!signal?.aborted)cb(event)}});
 const bars=[node(),node()];
 const columns=[['Октябрь','1.00','0.00','0.00'],['Ноябрь','2.00','3.00','0.50']].map(([period,expense,income,refund],i)=>({...node(),dataset:{period,expense,income,refund},getAttribute:()=>i?'82':'41',querySelector:()=>bars[i],closest(){return this},focus(){plot.emit('focusin',{target:this})}}));
 const tabs=['expense','income','refund'].map((key,i)=>({...node(),dataset:{series:key,total:['3.00','3.00','0.50'][i]},pressed:i===0?'true':'false',getAttribute(){return this.pressed},setAttribute(_,v){this.pressed=v}}));
 const fields=Object.fromEntries(['[data-chart-value]','[data-chart-period]','[data-tooltip-period]','[data-tooltip-expense]','[data-tooltip-income]','[data-tooltip-refund]'].map(k=>[k,node()]));
 const tooltip={...node(),hidden:true,offsetWidth:198,querySelector:k=>fields[k]};
 const plot={...node(),querySelectorAll:()=>columns,getBoundingClientRect:()=>({left:0,width:300}),contains:x=>columns.includes(x),setPointerCapture(){}};
 const chart={...node(),dataset:{currency:'BYN'},contains:x=>x===plot||columns.includes(x),querySelector:k=>k==='.cash-plot'?plot:k==='.cash-surface'?{clientWidth:300}:k==='.cash-tooltip'?tooltip:fields[k],querySelectorAll:()=>tabs};
 const doc=node(),root={querySelectorAll:()=>[chart],ownerDocument:doc},dispose=bindCashFlowCharts(root);
 return {plot,tabs,columns,fields,tooltip,doc,dispose};
}
test('mouse scrubbing shows exact totals and keeps the tooltip inside the chart',()=>{
 const f=fixture();f.plot.emit('pointermove',{pointerType:'mouse',clientX:299});
 assert.equal(f.fields['[data-chart-value]'].textContent,'2.00');assert.equal(f.fields['[data-tooltip-income]'].textContent,'3.00 BYN');assert.equal(f.tooltip.hidden,false);
 assert.ok(parseFloat(f.tooltip.style.left)<=102);assert.ok(parseFloat(f.tooltip.style.left)>=0);
 f.plot.emit('pointerleave',{pointerType:'mouse'});assert.equal(f.tooltip.hidden,true);assert.equal(f.fields['[data-chart-value]'].textContent,'3.00');f.dispose();
});
test('touch drag, series switches, keyboard navigation and disposal work without changing records',()=>{
 const f=fixture();f.plot.emit('pointerdown',{pointerType:'touch',clientX:0,pointerId:1});f.plot.emit('pointermove',{pointerType:'touch',clientX:280});f.plot.emit('pointerup');
 assert.equal(f.fields['[data-chart-period]'].textContent,'Ноябрь');assert.equal(f.tooltip.hidden,false);
 f.tabs[1].emit('click');f.columns[1].focus();assert.equal(f.fields['[data-chart-value]'].textContent,'3.00');assert.equal(f.tabs[1].pressed,'true');
 f.plot.emit('keydown',{key:'ArrowLeft',target:f.columns[1],preventDefault(){}});assert.equal(f.fields['[data-chart-period]'].textContent,'Октябрь');assert.equal(f.fields['[data-chart-value]'].textContent,'0.00');
 f.doc.emit('pointerdown',{target:{}});assert.equal(f.tooltip.hidden,true);
 f.dispose();f.plot.emit('pointermove',{pointerType:'mouse',clientX:280});assert.equal(f.tooltip.hidden,true);
});
