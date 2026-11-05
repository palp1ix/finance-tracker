export function normalizePurchaseDate(value){
 if(!value)return {occurredAt:null,occurredPrecision:'unknown'};
 if(typeof value!=='string')throw Error('Проверьте дату');
 if(/^\d{4}-(0[1-9]|1[0-2])$/.test(value)&&!value.startsWith('0000'))return {occurredAt:value,occurredPrecision:'month'};
 if(!/^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/.test(value)||value.startsWith('0000')||new Date(value+'T12:00:00Z').toISOString().slice(0,10)!==value)throw Error('Проверьте дату');
 return {occurredAt:value,occurredPrecision:'day'};
}
export function requirePurchaseDate(value){
 const date=normalizePurchaseDate(value);if(!date.occurredAt)throw Error('Укажите дату покупки или хотя бы месяц и год');return date;
}
export const purchaseDateFromForm=f=>requirePurchaseDate(f.get('occurredAt')||f.get('occurredMonth')||null);
const months=['январь','февраль','март','апрель','май','июнь','июль','август','сентябрь','октябрь','ноябрь','декабрь'];
export function monthHeading(line,referenceDay){
 const text=line.trim().replace(/^[-—\s]+|[-—\s]+$/g,'').toLocaleLowerCase('ru');
 const i=months.findIndex(m=>new RegExp('^'+m+'(?:\\s+\\d{4})?$').test(text));
 if(i<0)return null;
 let year=Number(text.match(/\d{4}/)?.[0]||referenceDay.slice(0,4));
 if(!/\d{4}/.test(text)&&i+1>Number(referenceDay.slice(5,7)))year--;
 return `${year}-${String(i+1).padStart(2,'0')}`;
}
// Conservative repair for older agent imports: assign only months explicitly present in their source.
export function recoverSourceMonths(data){
 for(const entry of data.entries){
  const lines=entry.rawText.split(/\n/);let month=null,index=0;
  const reference=(entry.createdAt||data.createdAt||'').slice(0,10);if(!/^\d{4}-\d{2}-\d{2}$/.test(reference))continue;
  for(const line of lines){const heading=monthHeading(line,reference);if(heading){month=heading;continue}
   if(!line.trim()||/^\s*ТРАТЫ\s*$/i.test(line)||/в данный момент всего денег/i.test(line))continue;
   if(!/\d+(?:[.,]\d+)?/.test(line))continue;
   const t=data.transactions.find(t=>t.id===entry.id+':'+index&&t.sourceEntryId===entry.id);index++;
   // Require provenance from the old agent's explicit source-month note. Never map arbitrary manual imports by index.
   if(t&&!t.occurredAt&&month&&/В исходнике указан октябрь; год и точная дата не указаны\./.test(t.notes||'')&&month.endsWith('-10')){
    t.occurredAt=month;t.occurredPrecision='month';t.notes=t.notes.replace('В исходнике указан октябрь; год и точная дата не указаны.','Месяц восстановлен из заголовка исходника; год принят по дате создания заметки. Точный день неизвестен.');
   }
  }
 }
 return data;
}

export function bufferEntryDay(entry){
 if(entry.bufferedDay){try{const d=normalizePurchaseDate(entry.bufferedDay);if(d.occurredPrecision==='day')return d.occurredAt}catch{}}
 if(!entry.createdAt)return null;const d=new Date(entry.createdAt);if(Number.isNaN(d.getTime()))return null;
 return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}
export function defaultEntryDates(entry,drafts){
 if(entry.source==='transactions-import'||entry.rawText.split(/\r?\n/).filter(line=>line.trim()).length!==1)return drafts;
 const day=bufferEntryDay(entry);if(!day)return drafts;
 return drafts.map(d=>d.occurredAt?d:{...d,occurredAt:day,occurredPrecision:'day',dateSource:'buffer'});
}
