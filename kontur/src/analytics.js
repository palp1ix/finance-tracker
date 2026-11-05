// Date-only values are compared as calendar dates, never as UTC instants.
export const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const fromDay = s => { const [y,m,d]=s.split('-').map(Number); return new Date(y,m-1,d,12); };
const addDays = (s,n) => { const d=fromDay(s); d.setDate(d.getDate()+n); return localDay(d); };
export function periodBounds(kind, today=localDay(), customStart='', customEnd='') {
  const d=fromDay(today), y=d.getFullYear(), m=d.getMonth(); let start, end=today;
  if(kind==='day') start=today;
  else if(kind==='week') start=addDays(today,-((d.getDay()+6)%7));
  else if(kind==='month') start=localDay(new Date(y,m,1));
  else if(kind==='quarter') start=localDay(new Date(y,Math.floor(m/3)*3,1));
  else if(kind==='year') start=localDay(new Date(y,0,1));
  else if(kind==='custom') {start=customStart;end=customEnd;}
  else return {start:null,end:null,previousStart:null,previousEnd:null};
  if(!/^\d{4}-\d{2}-\d{2}$/.test(start)||!/^\d{4}-\d{2}-\d{2}$/.test(end)||start>end) return null;
  // Calendar summaries include whole months when the day is unknown.
  if(['month','quarter','year'].includes(kind)){
    const first=fromDay(start),span=kind==='month'?1:kind==='quarter'?3:12;
    end=localDay(new Date(first.getFullYear(),first.getMonth()+span,0,12));
    const previousStart=localDay(new Date(first.getFullYear(),first.getMonth()-span,1,12));
    const previousEnd=addDays(start,-1);return {start,end,previousStart,previousEnd};
  }
  const days=Math.round((Date.UTC(...end.split('-').map((v,i)=>Number(v)-(i===1?1:0)))-Date.UTC(...start.split('-').map((v,i)=>Number(v)-(i===1?1:0))))/86400000)+1;
  const previousEnd=addDays(start,-1),previousStart=addDays(previousEnd,1-days);
  return {start,end,previousStart,previousEnd};
}
export function inPeriod(t,start,end){
 const date=t.occurredAt;if(!date||t.occurredPrecision==='unknown')return false;
 if(t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(date)){
   const month=date.slice(0,7),[year,m]=month.split('-').map(Number);
   const first=month+'-01',last=localDay(new Date(year,m,0,12));
   // Never assign a month-only purchase to an arbitrary day or week.
   return (!start||start<=first)&&(!end||end>=last);
 }
 return (!start||date>=start)&&(!end||date<=end);
}

export function analyze(transactions,{currency='BYN',bounds,category=null}={}) {
  const eligible=transactions.filter(t=>t.currency===currency && (!category||t.category===category));

  const allTime=!bounds?.start&&!bounds?.end;
  const current=eligible.filter(t=>allTime||inPeriod(t,bounds?.start,bounds?.end));
  const previous=bounds?.previousStart?eligible.filter(t=>inPeriod(t,bounds.previousStart,bounds.previousEnd)):[];
  const sum=(items,type)=>items.filter(t=>t.type===type).reduce((n,t)=>n+BigInt(t.amountMinor),0n);
  const expense=sum(current,'expense'), income=sum(current,'income'), refund=sum(current,'refund'), previousExpense=sum(previous,'expense');
  const categoryMap=new Map(),dayMap=new Map();
  for(const t of current) if(t.type==='expense'){const amount=BigInt(t.amountMinor);categoryMap.set(t.category||'Без категории',(categoryMap.get(t.category||'Без категории')||0n)+amount);if(t.occurredAt && t.occurredPrecision!=='unknown' && t.occurredPrecision!=='month' && /^\d{4}-\d{2}-\d{2}$/.test(t.occurredAt))dayMap.set(t.occurredAt,(dayMap.get(t.occurredAt)||0n)+amount)}
  const categories=[...categoryMap].map(([name,amount])=>({name,amount})).sort((a,b)=>a.amount===b.amount?a.name.localeCompare(b.name,'ru'):a.amount>b.amount?-1:1);
  const days=[...dayMap].sort(([a],[b])=>a.localeCompare(b)).map(([day,amount])=>({day,amount}));
  const unknown=eligible.filter(t=>!t.occurredAt||t.occurredPrecision==='unknown').length;
  const monthOnly=current.filter(t=>t.occurredPrecision==='month'||/^\d{4}-\d{2}$/.test(t.occurredAt||'')).length;
  return {current,expense,income,refund,previousExpense,categories,days,unknown,monthOnly,netExpense:expense-refund,cashFlow:income+refund-expense};
}
export function percent(part,total){if(total===0n)return 0; return Number((part*1000n)/total)/10;}
