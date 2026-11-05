import {requirePurchaseDate,monthHeading,recoverSourceMonths} from './dates.js';
import {parseAmount} from './finance.js';
export function migrate(data) {
  if(data.version!==1) throw Error('Версия данных не поддерживается');
  return recoverSourceMonths({...data, settings:data.settings||{}, audit:data.audit||[], deleted:data.deleted||{entries:{},transactions:{}}});
}
export function validateDraft(d,categories) {
  if(!d || typeof d.description!=='string' || !d.description.trim() || d.description.length>500) throw Error('Укажите описание');
  if(!/^[1-9]\d*$/.test(d.amountMinor)||d.amountMinor.length>16) throw Error('Проверьте сумму');
  if(!['BYN','USD','EUR','RUB'].includes(d.currency)||!['expense','income','refund','transfer'].includes(d.type)) throw Error('Проверьте валюту и тип');
  if(!categories.includes(d.category)) throw Error('Выберите существующую категорию');
  const date=requirePurchaseDate(d.occurredAt);
  return {...d,description:d.description.trim(),...date,notes:String(d.notes||'').slice(0,2000)};
}
export function parseText(raw, categories, today) {
  let sectionMonth=null;return raw.split(/\n|;/).flatMap(line=>{const heading=monthHeading(line,today);if(heading){sectionMonth=heading;return []}if(!line.trim())return [];
    const date=line.match(/\b(\d{4}-\d{2}(?:-\d{2})?)\b/)?.[1];
    const clean=line.replace(/\b\d{4}-\d{2}(?:-\d{2})?\b/g,'');
    const match=clean.match(/\d+(?:[.,]\d{1,2})?/);
    const currency=/\$|usd|доллар/i.test(line)?'USD':/€|eur|евро/i.test(line)?'EUR':/rub|росс/i.test(line)?'RUB':'BYN';
    let occurredAt=date||(/сегодня/i.test(line)?today:sectionMonth);
    if(/вчера/i.test(line)){const d=new Date(today+'T12:00:00');d.setDate(d.getDate()-1);occurredAt=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
    let amountMinor='';try{if(match)amountMinor=parseAmount(match[0])}catch{}
    const category=categories.find(c=>line.toLowerCase().includes(c.toLowerCase()))||(/кофе|кафе|ресторан/i.test(line)?categories.find(c=>/Кафе/.test(c)):null)||(/продукт|магазин/i.test(line)?categories.find(c=>c==='Продукты'):null)||categories.at(-1)||'Прочее';
    return {description:clean.replace(match?.[0]||'','').replace(/BYN|USD|EUR|RUB|руб(?:лей|ля)?|р\b|\$|€/gi,'').replace(/^[\s—−-]+|[\s—−-]+$/g,'').trim()||line.trim(),amountMinor,currency,category,type:/зарплат|доход/i.test(line)?'income':/возврат/i.test(line)?'refund':/перевод/i.test(line)?'transfer':'expense',occurredAt,notes:''};
  });
}
export function commitEntry(data,entryId,drafts,rawText,at=new Date().toISOString()) {
  const next=migrate(structuredClone(data)),e=next.entries.find(e=>e.id===entryId);
  if(!e||e.status!=='pending') throw Error('Запись уже обработана или удалена');
  if(e.rawText!==rawText)throw Error('Запись изменилась. Разберите её заново');
  if(!Array.isArray(drafts)||!drafts.length||drafts.length>200)throw Error('Нужно от 1 до 200 операций');
  for(const [i,d] of drafts.entries())next.transactions.push({...validateDraft(d,next.categories),id:entryId+':'+i,sourceEntryId:entryId,createdAt:at,updatedAt:at});
  e.status='processed';e.processedAt=at;e.updatedAt=at;
  return next;
}
export function recordChanges(before,after,at=new Date().toISOString()) {
  const next=migrate(after);if(JSON.stringify(before.categories)!==JSON.stringify(next.categories))next.categoriesUpdatedAt=at;next.deleted=structuredClone(before.deleted||{entries:{},transactions:{}});
  next.audit=[...(before.audit||[])];
  for(const kind of ['entries','transactions']){
    const prev=new Map(before[kind].map(x=>[x.id,x])),cur=new Map(next[kind].map(x=>[x.id,x]));
    for(const [id,item] of cur) if(JSON.stringify(prev.get(id))!==JSON.stringify(item))next.audit.push({id:crypto.randomUUID(),at,kind,action:prev.has(id)?'update':'create',recordId:id,before:prev.get(id)||null,after:structuredClone(item)});
    for(const [id,item] of prev)if(!cur.has(id)){next.deleted[kind][id]=at;next.audit.push({id:crypto.randomUUID(),at,kind,action:'delete',recordId:id,before:item,after:null})}
  }
  return next;
}
// A concurrent edit to the same record is surfaced rather than silently discarded.
export function mergeVaults(local,remote) {
  local=migrate(local);remote=migrate(remote);const next=structuredClone(local);
  for(const e of local.entries.filter(e=>e.status==='processed')){
    if(remote.entries.some(r=>r.id===e.id&&r.status==='processed'&&r.processedAt!==e.processedAt)){
      const project=v=>v.transactions.filter(t=>t.sourceEntryId===e.id).map(({id,createdAt,updatedAt,...t})=>t).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)));
      if(JSON.stringify(project(local))!==JSON.stringify(project(remote)))throw Error('Одна заметка обработана по-разному на двух устройствах. Сохраните обе копии и устраните конфликт');
    }
  }
  for(const kind of ['entries','transactions']){
    const deleted={...local.deleted[kind],...remote.deleted[kind]};next.deleted[kind]=deleted;
    const map=new Map(local[kind].map(x=>[x.id,x]));
    for(const item of remote[kind]){const old=map.get(item.id);if(!old||JSON.stringify(old)===JSON.stringify(item))map.set(item.id,item);else if(old.updatedAt===item.updatedAt)throw Error('Конфликт изменений. Сохраните обе резервные копии перед объединением');else map.set(item.id,(old.updatedAt||old.createdAt)>(item.updatedAt||item.createdAt)?old:item)}
    next[kind]=[...map.values()].filter(x=>!deleted[x.id]||(x.updatedAt||x.createdAt)>deleted[x.id]);
  }
  next.categories=(remote.categoriesUpdatedAt||'')>(local.categoriesUpdatedAt||'')?remote.categories:local.categories;next.categoriesUpdatedAt=[local.categoriesUpdatedAt||'',remote.categoriesUpdatedAt||''].sort().at(-1);
  next.audit=[...new Map([...local.audit,...remote.audit].map(x=>[x.id,x])).values()].sort((a,b)=>a.at.localeCompare(b.at));
  return next;
}
