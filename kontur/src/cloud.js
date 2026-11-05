import {openVault,seal} from './storage.js';
import {mergeVaults} from './workflow.js';
export const cloud={session:null,status:'Локально',running:false};
let connection=null;
export function validateConnection(value){
 if(value?.format!=='kontur-sync-connection'||value.version!==1||!/^https:\/\/[a-z0-9-]+\.[a-z0-9-]+\.workers\.dev$/.test(value.endpoint)||!/^[a-f0-9]{64}$/.test(value.token))throw Error('Неверный файл подключения к облаку');
 return {format:value.format,version:1,endpoint:value.endpoint,token:value.token};
}
export function setCloudConnection(value){connection=validateConnection(value);cloud.session={connected:true};cloud.status='Готово к синхронизации'}
export function clearCloudSession(){connection=null;cloud.session=null;cloud.status='Локально'}
export function restoreCloudConnection(value){if(value){try{setCloudConnection(value)}catch{clearCloudSession()}}else clearCloudSession()}
export function exportConnection(){if(!connection)throw Error('Сначала подключите облако');return {...connection}}
export function configured(){return Boolean(connection)}
async function request(body){
 if(!connection)throw Error('Выберите файл подключения к облаку');
 const config=connection,r=await fetch(config.endpoint+'/api/vault',{method:body?'POST':'GET',headers:{Authorization:'Bearer '+config.token,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 if(connection!==config)throw Error('Подключение к облаку изменилось');
 let result;try{result=await r.json()}catch{throw Error('Не удалось связаться с облаком')}
 if(!r.ok)throw Error(result.error||'Ошибка облака');return result;
}
export async function acceptLogin(){}
export async function pullVault(){const row=await request();if(!row.envelope)throw Error('В облаке пока нет хранилища');return row.envelope}
export async function checkConnection(){await request()}
export async function syncVault(local,password){
 if(!connection)return local;
 const row=await request();let merged=local;
 if(row.envelope){let remote;try{remote=await openVault(row.envelope,password)}catch{throw Error('В облаке другой мастер-пароль. Используйте пароль облачного хранилища')};merged=mergeVaults(local,remote)}
 await request({expectedRevision:row.revision,envelope:await seal(merged,password)});
 cloud.status='Синхронизировано '+new Date().toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});return merged;
}
export async function rotateVault(local,oldPassword,newPassword){
 if(!connection)return local;
 const row=await request();const merged=row.envelope?mergeVaults(local,await openVault(row.envelope,oldPassword)):local;
 await request({expectedRevision:row.revision,envelope:await seal(merged,newPassword)});return merged;
}
