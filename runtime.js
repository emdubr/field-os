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
  function every(fn,interval,options={}){
    interval=Math.max(100,Number(interval)||1000);
    const id=++taskId,t=now(),phase=Math.min(interval-16,Math.max(0,(id*37)%Math.max(17,interval)));
    tasks.set(id,{id,fn,interval,visibleOnly:options.visibleOnly!==false,nextAt:t+interval+phase});
    arm();
    return ()=>{tasks.delete(id);arm()};
  }
  function frame(key,fn){key=String(key||fn);if(frames.has(key))return;const id=requestAnimationFrame(()=>{frames.delete(key);if(!document.hidden)fn()});frames.set(key,id)}
  function idle(fn,timeout=800){if('requestIdleCallback' in window)return requestIdleCallback(()=>fn(),{timeout});return setTimeout(fn,0)}
  function flush(){const t=now();for(const task of tasks.values())if(!(task.visibleOnly&&document.hidden))task.nextAt=Math.min(task.nextAt,t);tick()}
  document.addEventListener('visibilitychange',()=>{if(document.hidden)arm();else flush()},{passive:true});
  // Reconcile trusted, escaped application templates without replacing stable
  // controls. Focus, pointer targets and local scroll positions survive live data.
  const markup=new WeakMap();
  const nodeKey=node=>node.nodeType===1?(node.id||node.getAttribute('data-readiness-id')||node.getAttribute('data-open')||''):'';
  function reconcile(parent,next){
    let cursor=parent.firstChild;
    for(const incoming of [...next.childNodes]){
      const key=nodeKey(incoming);
      let current=cursor;
      if(key&&nodeKey(current||{})!==key){
        current=[...parent.childNodes].find(node=>nodeKey(node)===key)||null;
        if(current)parent.insertBefore(current,cursor);
      }
      const compatible=current&&current.nodeType===incoming.nodeType&&current.nodeName===incoming.nodeName&&nodeKey(current)===key;
      if(!compatible){
        const added=incoming.cloneNode(true);parent.insertBefore(added,cursor);continue;
      }
      if(current.nodeType===1){
        for(const attr of [...current.attributes])if(!incoming.hasAttribute(attr.name))current.removeAttribute(attr.name);
        for(const attr of [...incoming.attributes])if(current.getAttribute(attr.name)!==attr.value)current.setAttribute(attr.name,attr.value);
        reconcile(current,incoming);
      }else if(current.nodeValue!==incoming.nodeValue)current.nodeValue=incoming.nodeValue;
      cursor=current.nextSibling;
    }
    while(cursor){const next=cursor.nextSibling;cursor.remove();cursor=next;}
  }
  function patch(el,html){
    if(!el||markup.get(el)===html)return;
    const template=document.createElement('template');template.innerHTML=html;
    reconcile(el,template.content);markup.set(el,html);
  }
  window.FIELD_RUNTIME={every,frame,idle,flush,patch,get size(){return tasks.size}};
})();
