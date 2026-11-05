// Date-only values are compared as calendar dates, never as UTC instants.
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromDay = s => new Date(s+'T12:00:00');
const addDays = (s,n) => { const d=fromDay(s); d.setDate(d.getDate()+n); return localDay(d); };
// Subtract calendar months and clamp month ends (31 March -> 28/29 February).
const shiftMonths=(day,delta)=>{const d=fromDay(day),target=new Date(d.getFullYear(),d.getMonth()+delta,1,12);return localDay(new Date(target.getFullYear(),target.getMonth(),Math.min(d.getDate(),new Date(target.getFullYear(),target.getMonth()+1,0,12).getDate()),12))};
const validDay=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&!value.startsWith('0000')&&localDay(fromDay(value))===value;
export function periodBounds(kind,today=localDay(),customStart='',customEnd=''){
 if(!validDay(today))return null;
 if(kind==='all')return {start:null,end:today,previousStart:null,previousEnd:null,monthMode:'overlap'};
 let start,end=today;
 if(kind==='day')start=today;
 else if(kind==='week')start=addDays(today,-7);
 else if(kind==='month')start=shiftMonths(today,-1);
 else if(kind==='quarter')start=shiftMonths(today,-3);
 else if(kind==='year')start=shiftMonths(today,-12);
 else if(kind==='custom'){start=customStart;end=customEnd}
 else return null;
 if(!validDay(start)||!validDay(end)||start>end)return null;
 const dayNumber=value=>Date.parse(value+'T12:00:00Z')/86400000;
 const length=Math.round(dayNumber(end)-dayNumber(start))+1,previousEnd=addDays(start,-1),previousStart=addDays(previousEnd,1-length);
 return {start,end,previousStart,previousEnd,...(['month','quarter','year'].includes(kind)?{monthMode:'overlap'}:{})};
}
export function inPeriod(t,start,end,monthMode='contained'){
 const date=t.occurredAt;if(!date||t.occurredPrecision==='unknown')return false;
 if(t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(date)){
   const month=date.slice(0,7),[year,m]=month.split('-').map(Number);
   const first=month+'-01',last=localDay(new Date(year,m,0,12));
   // Month-based summaries may include overlapping months, with boundary uncertainty reported separately.
   if(monthMode==='overlap')return (!start||month>=start.slice(0,7))&&(!end||month<=end.slice(0,7));
   // Never assign a month-only purchase to an arbitrary day or week.
   return (!start||start<=first)&&(!end||end>=last);
 }
 return (!start||date>=start)&&(!end||date<=end);
}

export function analyze(transactions,{currency='BYN',bounds,category=null}={}) {
  const eligible=transactions.filter(t=>t.currency===currency && (!category||t.category===category));

  const allTime=!bounds?.start&&!bounds?.end;
  const current=eligible.filter(t=>allTime||inPeriod(t,bounds?.start,bounds?.end,bounds?.monthMode));
  const previous=bounds?.previousStart?eligible.filter(t=>inPeriod(t,bounds.previousStart,bounds.previousEnd,bounds.monthMode)):[];
  const sum=(items,type)=>items.filter(t=>t.type===type).reduce((n,t)=>n+BigInt(t.amountMinor),0n);
  const expense=sum(current,'expense'), income=sum(current,'income'), refund=sum(current,'refund'), previousExpense=sum(previous,'expense');
  const categoryMap=new Map(),dayMap=new Map();
  for(const t of current) if(t.type==='expense'){const amount=BigInt(t.amountMinor);categoryMap.set(t.category||'Без категории',(categoryMap.get(t.category||'Без категории')||0n)+amount);if(t.occurredAt && t.occurredPrecision!=='unknown' && t.occurredPrecision!=='month' && /^\d{4}-\d{2}-\d{2}$/.test(t.occurredAt))dayMap.set(t.occurredAt,(dayMap.get(t.occurredAt)||0n)+amount)}
  const categories=[...categoryMap].map(([name,amount])=>({name,amount})).sort((a,b)=>a.amount===b.amount?a.name.localeCompare(b.name,'ru'):a.amount>b.amount?-1:1);
  const days=[...dayMap].sort(([a],[b])=>a.localeCompare(b)).map(([day,amount])=>({day,amount}));
  const unknown=eligible.filter(t=>!t.occurredAt||t.occurredPrecision==='unknown').length;
  const monthOnly=current.filter(t=>t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(t.occurredAt||'')).length;
  const monthDate=t=>t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(t.occurredAt||'');
  const boundaryMonthOnly=current.filter(t=>monthDate(t)&&!inPeriod(t,bounds?.start,bounds?.end)).length;
  const comparisonIncomplete=Boolean(bounds?.previousStart&&bounds.monthMode==='overlap'&&eligible.some(t=>t.type==='expense'&&monthDate(t)&&((inPeriod(t,bounds.start,bounds.end,'overlap')&&!inPeriod(t,bounds.start,bounds.end))||(inPeriod(t,bounds.previousStart,bounds.previousEnd,'overlap')&&!inPeriod(t,bounds.previousStart,bounds.previousEnd)))));
  return {current,expense,income,refund,previousExpense,categories,days,unknown,monthOnly,boundaryMonthOnly,comparisonIncomplete,netExpense:expense-refund,cashFlow:income+refund-expense};
}
export function percent(part,total){if(total===0n)return 0; return Number((part*1000n)/total)/10;}

export function selectPurchases(transactions,{currency,category=null,day=null,bounds}={}){
 return transactions.filter(t=>t.type==='expense'&&(!currency||t.currency===currency)&&(!category||(t.category||'Без категории')===category)&&(!bounds||(!bounds.start&&!bounds.end)||inPeriod(t,bounds.start,bounds.end,bounds.monthMode))&&(!day||(t.occurredAt===day&&t.occurredPrecision!=='unknown'&&t.occurredPrecision!=='month'))).slice().sort((a,b)=>(b.occurredAt||'').localeCompare(a.occurredAt||''));
}
