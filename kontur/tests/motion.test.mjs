import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createMotionController} from '../src/motion.js';
function fixture(reduced=false){
 const animations=[],listeners=[];
 const element=()=>({animate(frames,options){let finish,reject;const finished=new Promise((a,b)=>{finish=a;reject=b});const animation={frames,options,finished,finish,cancel:()=>reject(Error('cancelled'))};animations.push(animation);return animation}});
 const content={...element(),children:[element(),element()],querySelectorAll:()=>[]};
 const media={matches:reduced,addEventListener:(_,cb)=>listeners.push(cb)};
 return {animations,media,listeners,controller:createMotionController({doc:{querySelector:()=>content},media})};
}
test('navigation switches after the exit; rapid navigation keeps only the latest destination',async()=>{
 const f=fixture(),visited=[];const first=f.controller.transition(()=>visited.push('history'));assert.deepEqual(visited,[]);
 const second=f.controller.transition(()=>visited.push('chart'));f.animations[1].finish();await Promise.all([first,second]);assert.deepEqual(visited,['chart']);
});
test('locking cancels pending navigation so private content cannot remount',async()=>{
 const f=fixture();let updated=false;const pending=f.controller.transition(()=>{updated=true});f.controller.cancel();await pending;assert.equal(updated,false);
});
test('reduced motion navigates immediately and entrances use opacity only',async()=>{
 const f=fixture(true);let updated=false;await f.controller.transition(()=>{updated=true});assert.equal(updated,true);assert.equal(f.animations.length,0);
 f.controller.enter();assert.equal(f.animations.length,2);assert.ok(f.animations.every(a=>a.frames.every(frame=>!('transform' in frame))));assert.ok(f.animations.every(a=>a.options.delay===0));
});
test('changing the OS motion preference cancels movement without losing navigation',async()=>{
 const f=fixture();let updated=false;const pending=f.controller.transition(()=>{updated=true});f.media.matches=true;f.listeners[0]();await pending;assert.equal(updated,true);
});
test('navigation works in browsers without the animation API',async()=>{
 let updated=false;const controller=createMotionController({doc:{querySelector:()=>({})},media:{matches:false}});await controller.transition(()=>{updated=true});assert.equal(updated,true);
});
