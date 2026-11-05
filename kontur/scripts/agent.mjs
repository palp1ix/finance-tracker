// Credentials are loaded internally and never printed. No master password is needed.
import {readFile} from 'node:fs/promises';
import {agentCall,agentJob} from './agent-client.mjs';
try{
 const [command,file]=process.argv.slice(2);
 if(command==='buffer'||command==='history')console.log(JSON.stringify(await agentCall(command),null,2));
 else if(command==='commit'||command==='dates')console.log(JSON.stringify(await agentJob(command,JSON.parse(await readFile(file,'utf8')))));
 else throw Error('Usage: node scripts/agent.mjs buffer | history | commit /tmp/job.json | dates /tmp/date-changes.json');
}catch(e){console.error(e.message);process.exitCode=1}
