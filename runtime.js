/* FIELD/OS shared runtime scheduler
   Coalesces recurring UI work and suspends visible-only polling while backgrounded. */
(()=>{
  if(window.FIELD_RUNTIME)return;
  const tasks=new Map(),frames=new Map();let taskId=0,timer=0;
  const now=()=>Date.now();
  function clearTimer(){if(timer){clearTimeout(timer);timer=0}}
  function runnable(){return [...tasks.values()].filter(task=>!task.visibleOnly||!document.hidden)}
  function arm(){clearTimer();const list=runnable();if(!list.length)return;const t=now(),next=Math.min(...list.map(task=>task.nextAt));timer=setTimeout(tick,Math.max(16,Math.min(60000,next-t)))}
  function tick(){timer=0;const t=now();for(const task of tasks.values()){if(task.visibleOnly&&document.hidden)continue;if(t<task.nextAt)continue;task.nextAt=t+task.interval;try{task.fn(t)}catch(err){setTimeout(()=>{throw err},0)}}arm()}
  function every(fn,interval,options={}){interval=Math.max(100,Number(interval)||1000);const id=++taskId;tasks.set(id,{id,fn,interval,visibleOnly:options.visibleOnly!==false,nextAt:now()+interval});arm();return ()=>{tasks.delete(id);arm()}}
  function frame(key,fn){key=String(key||fn);if(frames.has(key))return;const id=requestAnimationFrame(()=>{frames.delete(key);if(!document.hidden)fn()});frames.set(key,id)}
  function idle(fn,timeout=800){if('requestIdleCallback' in window)return requestIdleCallback(()=>fn(),{timeout});return setTimeout(fn,0)}
  function flush(){const t=now();for(const task of tasks.values())if(!(task.visibleOnly&&document.hidden))task.nextAt=Math.min(task.nextAt,t);tick()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)clearTimer();else flush()},{passive:true});
  window.FIELD_RUNTIME={every,frame,idle,flush,get size(){return tasks.size}};
})();
