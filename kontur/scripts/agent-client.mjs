import {readFile} from 'node:fs/promises';
export async function agentCall(path,body){
 let config;try{config=JSON.parse(await readFile(new URL('../.agent-connection.json',import.meta.url),'utf8'))}catch{throw Error('Откройте и разблокируйте Контур, затем нажмите Буфер → Подключить локального агента')}
 const url=new URL(config.url);if(url.protocol!=='http:'||!['127.0.0.1','localhost','[::1]'].includes(url.hostname))throw Error('Bridge must use loopback HTTP');
 let r;try{r=await fetch(url.origin+'/api/agent/'+path,{method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(5000)})}catch{throw Error('Локальный мост недоступен. Запустите npm run dev и подключите агент в разблокированном приложении')}
 const value=await r.json();if(!r.ok)throw Error(value.error||'Bridge request failed');return value;
}
export async function agentJob(path,job){
 const {id}=await agentCall(path,job);
 for(let i=0;i<60;i++){
  await new Promise(r=>setTimeout(r,500));const result=await agentCall('result?id='+encodeURIComponent(id));
  if(!result.pending){if(!result.ok)throw Error(result.error||'Browser refused the job');return result}
 }
 throw Error('Задание ещё не подтверждено браузером. Не считайте его выполненным; перепроверьте историю');
}
