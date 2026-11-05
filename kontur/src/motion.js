// Animate live DOM only: no retained screenshots or clones of private records.
export function createMotionController({doc=globalThis.document,media=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')}={}){
 const running=new Set();let revision=0;
 const reduced=()=>media?.matches===true;
 function animate(element,frames,options){
  if(!element?.animate)return null;
  const animation=element.animate(frames,options);running.add(animation);
  animation.finished.then(()=>running.delete(animation),()=>running.delete(animation));return animation;
 }
 function stopAnimations(){for(const animation of running)animation.cancel();running.clear()}
 if(media?.addEventListener)media.addEventListener('change',stopAnimations);else media?.addListener?.(stopAnimations);
 function cancel(){revision++;stopAnimations()}
 async function transition(update){
  const current=++revision;stopAnimations();
  const exit=reduced()?null:animate(doc.querySelector('.content'),[{opacity:1,transform:'translateY(0)'},{opacity:0,transform:'translateY(-4px)'}],{duration:90,easing:'ease-in'});
  if(exit)await exit.finished.catch(()=>{});
  if(current===revision)update();
 }
 function enter(){
  const content=doc.querySelector('.content');if(!content)return;
  const children=[...content.children].slice(0,8);
  children.forEach((element,index)=>animate(element,reduced()?[{opacity:.5},{opacity:1}]:[{opacity:0,transform:'translateY(10px)'},{opacity:1,transform:'translateY(0)'}],{duration:reduced()?100:280,delay:reduced()?0:Math.min(index*25,125),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'}));
  if(reduced())return;
  content.querySelectorAll('.bar,.category-track>span').forEach((element,index)=>{
   const axis=element.classList.contains('bar')?'Y':'X';element.style.transformOrigin=axis==='Y'?'center bottom':'left center';
   animate(element,[{transform:`scale${axis}(0)`},{transform:`scale${axis}(1)`}],{duration:420,delay:80+Math.min(index*8,120),easing:'cubic-bezier(.16,1,.3,1)',fill:'backwards'});
  });
 }
 return {transition,enter,cancel};
}
