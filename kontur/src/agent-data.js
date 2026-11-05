import {requirePurchaseDate} from './dates.js';
export const dateRevision=t=>({occurredAt:t.occurredAt??null,occurredPrecision:t.occurredPrecision??null,updatedAt:t.updatedAt??null});
// Atomic, date-only patches. Other transaction fields are never accepted from an agent.
export function applyDateChanges(data,changes,at=new Date().toISOString()){
 if(!Array.isArray(changes)||!changes.length||changes.length>5000)throw Error('Нужно от 1 до 5000 исправлений дат');
 const next=structuredClone(data),seen=new Set();
 for(const change of changes){
  if(!change||typeof change.id!=='string'||seen.has(change.id))throw Error('Неверный или повторный идентификатор операции');seen.add(change.id);
  const tx=next.transactions.find(t=>t.id===change.id);if(!tx)throw Error('Операция удалена');
  const revision=dateRevision(tx);if(!change.before||Object.keys(revision).some(k=>revision[k]!==change.before[k]))throw Error('Операция изменилась. Загрузите историю заново');
  Object.assign(tx,requirePurchaseDate(change.occurredAt),{updatedAt:at});
 }
 return next;
}
export function agentSnapshot(data,today){return {version:2,today,categories:data.categories,entries:data.entries.map(e=>({id:e.id,rawText:e.rawText,status:e.status||'pending'})),transactions:data.transactions.map(t=>({...t,before:dateRevision(t)}))}}
