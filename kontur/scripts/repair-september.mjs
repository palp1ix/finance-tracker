// This one-off repair is explicitly authorized by the owner: all undated records are September 2026.
// No plaintext financial data is written to disk.
import {agentCall,agentJob} from './agent-client.mjs';
try{
 let history;
 for(let attempt=0;attempt<90;attempt++){
  try{history=await agentCall('history');break}catch(e){
   if(!attempt)console.error('Ожидаю подключение до 90 секунд. В Контуре: Cmd+Shift+R → разблокировать → Буфер → Подключить локального агента.');
   if(attempt===89)throw e;await new Promise(r=>setTimeout(r,1000));
  }
 }
 const changes=history.transactions.filter(t=>!t.occurredAt||t.occurredPrecision==='unknown').map(t=>({id:t.id,before:t.before,occurredAt:'2026-09'}));
 if(!changes.length){console.log(JSON.stringify({ok:true,changed:0,remainingUndated:0}));process.exit(0)}
 await agentJob('dates',{changes});
 const saved=await agentCall('history'),byId=new Map(saved.transactions.map(t=>[t.id,t]));
 if(changes.some(c=>byId.get(c.id)?.occurredAt!=='2026-09'||byId.get(c.id)?.occurredPrecision!=='month'))throw Error('Исправления не подтверждены повторным чтением истории');
 console.log(JSON.stringify({ok:true,changed:changes.length,remainingUndated:saved.transactions.filter(t=>!t.occurredAt||t.occurredPrecision==='unknown').length}));
}catch(e){console.error(e.message);process.exitCode=1}
