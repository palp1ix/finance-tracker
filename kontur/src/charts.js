import {localDay} from './analytics.js';
import {formatAmount} from './finance.js';
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const monthOnly=t=>t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(t.occurredAt||'');
const series=[['expense','Расходы'],['income','Доходы'],['refund','Возвраты']];
// Input is already filtered by period and currency. All aggregation stays in minor units.
export function timeline(transactions,bounds={}){
 const dated=transactions.filter(t=>t.occurredAt&&t.occurredPrecision!=='unknown'&&series.some(([key])=>key===t.type));
 if(!dated.length)return {unit:'day',buckets:[]};
 const dates=dated.map(t=>t.occurredAt).sort();
 const start=bounds?.start||dates[0].slice(0,7)+'-01';
 const last=dates.at(-1),[ly,lm]=last.split('-').map(Number);
 const end=bounds?.end||(last.length===7?localDay(new Date(ly,lm,0,12)):last);
 const days=(Date.parse(end+'T12:00:00Z')-Date.parse(start+'T12:00:00Z'))/86400000+1;
 const monthSpan=(Number(end.slice(0,4))-Number(start.slice(0,4)))*12+Number(end.slice(5,7))-Number(start.slice(5,7))+1;
 const unit=monthSpan>60?'year':days>62||dated.some(monthOnly)?'month':'day';
 const size=unit==='day'?10:unit==='month'?7:4,map=new Map();
 const cursor=new Date(start+'T12:00:00');if(unit==='month')cursor.setDate(1);if(unit==='year'){cursor.setMonth(0,1)}
 while(localDay(cursor).slice(0,size)<=end.slice(0,size)){
  const key=localDay(cursor).slice(0,size);map.set(key,{key,expense:0n,income:0n,refund:0n});
  if(unit==='day')cursor.setDate(cursor.getDate()+1);else if(unit==='month')cursor.setMonth(cursor.getMonth()+1);else cursor.setFullYear(cursor.getFullYear()+1);
 }
 for(const t of dated){const bucket=map.get(t.occurredAt.slice(0,size));if(bucket)bucket[t.type]+=BigInt(t.amountMinor)}
 return {unit,buckets:[...map.values()]};
}
const label=(key,unit)=>unit==='year'?key:unit==='month'?new Intl.DateTimeFormat('ru-RU',{month:'short',year:'numeric'}).format(new Date(key+'-01T12:00:00')):key.slice(8)+'.'+key.slice(5,7);
export function cashFlowChart(transactions,currency,bounds){
 const {unit,buckets}=timeline(transactions,bounds);
 const heading='<div class="block-heading"><div><span class="eyebrow">Движение денег</span><h2>Доходы и расходы</h2></div><span class="subtle">'+esc(currency)+'</span></div>';
 if(!buckets.length)return '<section class="panel analytics-block">'+heading+'<p class="chart-empty">Добавьте операции с датой или месяцем, чтобы увидеть динамику.</p></section>';
 const totals=Object.fromEntries(series.map(([key])=>[key,buckets.reduce((n,b)=>n+b[key],0n)]));
 const maxima=Object.fromEntries(series.map(([key])=>[key,buckets.reduce((n,b)=>b[key]>n?b[key]:n,0n)||1n]));
 const active=series.find(([key])=>totals[key]>0n)?.[0]||'expense';
 const columns=buckets.map((b,i)=>{
  const values=series.map(([key])=>`data-${key}="${formatAmount(b[key])}" data-height-${key}="${Number(b[key]*8200n/maxima[key])/100}"`).join(' ');
  return `<button type="button" class="cash-column" data-index="${i}" data-period="${esc(label(b.key,unit))}" ${values} aria-label="${esc(label(b.key,unit))}: ${series.map(([key,title])=>title+' '+formatAmount(b[key])+' '+esc(currency)).join(', ')}"><span class="cash-bar${b[active]===0n?' is-zero':''}" style="--bar-height:${Number(b[active]*8200n/maxima[active])/100}%;--bar-delay:${Math.min(i*12,160)}ms"></span></button>`;
 }).join('');
 const labelCount=Math.min(buckets.length,5),indices=[...new Set(Array.from({length:labelCount},(_,i)=>labelCount===1?0:Math.round(i*(buckets.length-1)/(labelCount-1))))];
 const labels=indices.map(i=>`<span style="left:${(i+.5)/buckets.length*100}%">${esc(label(buckets[i].key,unit))}</span>`).join('');
 return `<section class="panel analytics-block cash-flow" data-cash-flow data-currency="${esc(currency)}">${heading}<div class="cash-tabs" role="group" aria-label="Показатель графика">${series.map(([key,title])=>`<button type="button" data-series="${key}" data-total="${formatAmount(totals[key])}" aria-pressed="${key===active}">${title}</button>`).join('')}</div><div class="cash-readout"><strong><span data-chart-value>${formatAmount(totals[active])}</span> <small>${esc(currency)}</small></strong><span data-chart-period>Всего за период</span></div><div class="cash-surface"><div class="cash-plot" role="group" aria-label="График по ${unit==='day'?'дням':unit==='month'?'месяцам':'годам'}. Используйте стрелки для выбора периода">${columns}</div><div class="cash-tooltip" role="status" aria-live="polite" aria-atomic="true" hidden><strong data-tooltip-period></strong>${series.map(([key,title])=>`<div><span>${title}</span><b data-tooltip-${key}></b></div>`).join('')}</div></div><div class="cash-axis" aria-hidden="true">${labels}</div><p class="chart-note">${unit==='month'?'По месяцам · ':unit==='year'?'По годам · ':''}<span class="cash-desktop-hint">Ведите курсором, чтобы увидеть суммы</span><span class="cash-touch-hint">Коснитесь графика и ведите пальцем</span></p><details class="chart-data"><summary>Значения графика</summary><div class="chart-table-scroll"><table><thead><tr><th>Период</th>${series.map(([,title])=>`<th>${title}, ${esc(currency)}</th>`).join('')}</tr></thead><tbody>${buckets.map(b=>`<tr><th>${esc(label(b.key,unit))}</th>${series.map(([key])=>`<td>${formatAmount(b[key])}</td>`).join('')}</tr>`).join('')}</tbody></table></div></details></section>`;
}
export function chartIndex(clientX,left,width,count){return Math.max(0,Math.min(count-1,Math.floor((clientX-left)/Math.max(1,width)*count)))}
export function bindCashFlowCharts(root=document){
 const controller=new AbortController(),options={signal:controller.signal};
 for(const chart of root.querySelectorAll('[data-cash-flow]')){
  const plot=chart.querySelector('.cash-plot'),surface=chart.querySelector('.cash-surface'),tooltip=chart.querySelector('.cash-tooltip');
  const columns=[...plot.querySelectorAll('.cash-column')],tabs=[...chart.querySelectorAll('[data-series]')];
  let selectedSeries=tabs.find(t=>t.getAttribute('aria-pressed')==='true').dataset.series,selected=-1,touching=false;
  const value=chart.querySelector('[data-chart-value]'),period=chart.querySelector('[data-chart-period]');
  function hide(){tooltip.hidden=true;columns[selected]?.classList.remove('is-active');selected=-1;value.textContent=tabs.find(t=>t.dataset.series===selectedSeries).dataset.total;period.textContent='Всего за период'}
  function show(index){
   if(index===selected&&!tooltip.hidden)return;
   columns[selected]?.classList.remove('is-active');selected=index;const column=columns[index];column.classList.add('is-active');
   value.textContent=column.dataset[selectedSeries];period.textContent=column.dataset.period;
   tooltip.querySelector('[data-tooltip-period]').textContent=column.dataset.period;
   for(const [key] of series)tooltip.querySelector(`[data-tooltip-${key}]`).textContent=column.dataset[key]+' '+chart.dataset.currency;
   tooltip.hidden=false;
   const available=surface.clientWidth,tooltipWidth=tooltip.offsetWidth,anchor=(index+.5)/columns.length*available;
   tooltip.style.left=Math.max(0,Math.min(available-tooltipWidth,anchor-tooltipWidth/2))+'px';
  }
  function point(e){const rect=plot.getBoundingClientRect();show(chartIndex(e.clientX,rect.left,rect.width,columns.length))}
  plot.addEventListener('pointerdown',e=>{touching=e.pointerType!=='mouse';point(e);if(touching)plot.setPointerCapture?.(e.pointerId)},options);
  plot.addEventListener('pointermove',e=>{if(e.pointerType==='mouse'||touching)point(e)},options);
  plot.addEventListener('pointerup',()=>{touching=false},options);
  plot.addEventListener('pointercancel',()=>{touching=false;hide()},options);
  plot.addEventListener('pointerleave',e=>{if(e.pointerType==='mouse')hide()},options);
  plot.addEventListener('focusin',e=>{const i=columns.indexOf(e.target.closest('.cash-column'));if(i>=0)show(i)},options);
  plot.addEventListener('focusout',e=>{if(!plot.contains(e.relatedTarget))hide()},options);
  plot.addEventListener('keydown',e=>{
   if(e.key==='Escape'){hide();return}
   const i=columns.indexOf(e.target.closest('.cash-column'));if(i<0)return;
   const next=e.key==='ArrowRight'?Math.min(i+1,columns.length-1):e.key==='ArrowLeft'?Math.max(0,i-1):e.key==='Home'?0:e.key==='End'?columns.length-1:null;
   if(next!==null){e.preventDefault();columns[next].focus()}
  },options);
  for(const tab of tabs)tab.addEventListener('click',()=>{
   selectedSeries=tab.dataset.series;for(const button of tabs)button.setAttribute('aria-pressed',String(button===tab));hide();
   for(const column of columns){const bar=column.querySelector('.cash-bar');const height=column.getAttribute('data-height-'+selectedSeries);bar.style.setProperty('--bar-height',height+'%');bar.classList.toggle('is-zero',Number(height)===0)}
  },options);
  root.ownerDocument?.addEventListener('pointerdown',e=>{if(!chart.contains(e.target))hide()},options);
 }
 return ()=>controller.abort();
}
export function categoryDonut(categories,total,currency){
 if(!categories.length||total===0n)return '';
 let offset=0;
 const segments=categories.map((c,i)=>{const share=Number(c.amount*100000n/total)/1000,start=offset;offset+=share;const shade=categories.length===1?75:35+55*i/(categories.length-1);return `<circle r="15.9155" cx="22" cy="22" pathLength="100" fill="none" stroke="hsl(0 0% ${shade}%)" stroke-width="6" stroke-dasharray="${share} ${100-share}" stroke-dashoffset="${-start}" transform="rotate(-90 22 22)"><title>${esc(c.name)}: ${formatAmount(c.amount)} ${esc(currency)} (${share.toFixed(1)}%)</title></circle>`}).join('');
 return `<div class="category-overview"><svg class="category-donut" viewBox="0 0 44 44" role="img" aria-label="Доли расходов по категориям">${segments}<text x="22" y="22" text-anchor="middle" dominant-baseline="middle">${categories.length}</text></svg><div><span class="subtle">Всего расходов</span><strong>${formatAmount(total)} <span>${esc(currency)}</span></strong><p>Нажмите на категорию ниже, чтобы открыть операции.</p></div></div>`;
}
