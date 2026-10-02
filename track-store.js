/* FIELD/OS track persistence v1 — transactional IndexedDB with a small crash journal.
 * Keep old localStorage data until the migration transaction commits. On IDB
 * failure the caller may continue using its existing localStorage fallback.
 */
(()=>{
  'use strict';
  if(window.FIELD_TRACK_STORE)return;
  const DB_NAME='fieldos-track-v1',VERSION=1,LEGACY='fieldos-v12-track';
  const JOURNAL='fieldos-v12-track-pending-',LIMIT=5000;
  const session=(crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
  const journalKey=JOURNAL+session;
  let db=null,available=false,flushing=null,timer=null,epoch=0,closed=false;
  let volatile=[];  // private mode / quota errors should not discard unsaved points
  const readable=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&
    Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  function normalize(p){
    if(!readable(p))return null;
    const time=Number.isFinite(Date.parse(p.time))?new Date(p.time).toISOString():new Date().toISOString();
    const lat=Number(p.lat),lon=Number(p.lon),alt=p.alt==null?null:Number(p.alt);
    return {id:time+'|'+lat.toFixed(7)+'|'+lon.toFixed(7),time,lat,lon,
      alt:Number.isFinite(alt)?alt:null,accuracy:p.accuracy==null?null:Number(p.accuracy),totalMiles:Number.isFinite(Number(p.totalMiles))&&p.totalMiles!=null?Number(p.totalMiles):null,seq:Number.isFinite(Number(p.seq))&&p.seq!=null?Number(p.seq):null};
  }
  function legacy(){
    try{const rows=JSON.parse(localStorage.getItem(LEGACY)||'[]');return Array.isArray(rows)?rows.map(normalize).filter(Boolean):[];}
    catch{return [];}
  }
  function journalKeys(){
    try{return Object.keys(localStorage).filter(k=>k.startsWith(JOURNAL));}
    catch{return [];}
  }
  function parseJournal(key){
    try{const v=JSON.parse(localStorage.getItem(key)||'[]');return Array.isArray(v)?v.map(normalize).filter(Boolean):[];}
    catch{return [];}
  }
  const done=tx=>new Promise((resolve,reject)=>{
    tx.oncomplete=()=>resolve();
    tx.onerror=()=>reject(tx.error||Error('Track transaction failed'));
    tx.onabort=()=>reject(tx.error||Error('Track transaction aborted'));
  });
  function openDB(){
    return new Promise((resolve,reject)=>{
      if(!window.indexedDB){reject(Error('IndexedDB unavailable'));return;}
      const request=indexedDB.open(DB_NAME,VERSION);
      request.onupgradeneeded=()=>{
        const next=request.result;
        if(!next.objectStoreNames.contains('points'))next.createObjectStore('points',{keyPath:'id'});
        if(!next.objectStoreNames.contains('backups'))next.createObjectStore('backups',{keyPath:'name'});
      };
      request.onsuccess=()=>resolve(request.result);
      request.onerror=()=>reject(request.error||Error('IndexedDB open failed'));
      request.onblocked=()=>reject(Error('IndexedDB blocked by another tab'));
    });
  }
  async function read(){
    if(!db)return legacy();
    const tx=db.transaction('points','readonly'),finished=done(tx),request=tx.objectStore('points').getAll();
    const rows=await new Promise((resolve,reject)=>{request.onsuccess=()=>resolve(request.result||[]);request.onerror=()=>reject(request.error)});
    await finished;
    return rows.length>LIMIT?[rows[0],...rows.slice(-(LIMIT-1))]:rows;
  }
  async function write(rows,replace=false){
    if(!db)throw Error('IndexedDB not available');
    const tx=db.transaction('points','readwrite'),store=tx.objectStore('points');
    if(replace)store.clear();
    rows.map(normalize).filter(Boolean).forEach(p=>store.put(p));
    await done(tx);
    // Trim only when above the cap, avoiding a full rewrite on every fix.
    const countTx=db.transaction('points','readonly'),countDone=done(countTx),countReq=countTx.objectStore('points').count();
    const count=await new Promise((resolve,reject)=>{countReq.onsuccess=()=>resolve(countReq.result);countReq.onerror=()=>reject(countReq.error)});
    await countDone;
    if(count>LIMIT){
      const excess=count-LIMIT,trim=db.transaction('points','readwrite'),store=trim.objectStore('points');
      const cur=store.openKeyCursor();let removed=0,first=true;
      // The first-ever recorded fix is the trailhead. Trim interior history,
      // never the first fix. Long-term distance is stored cumulatively.
      cur.onsuccess=()=>{const c=cur.result;if(!c)return;if(first){first=false;c.continue();return}if(removed<excess){store.delete(c.primaryKey);removed++;c.continue();}};
      await done(trim);
    }
  }
  function keepInJournal(point){
    volatile.push(point);
    try{
      const entries=parseJournal(journalKey);
      entries.push(point);
      localStorage.setItem(journalKey,JSON.stringify(entries.slice(-100)));
      // The journal is deliberately small: committed points live in IDB.
    }catch{} // volatile still retains points for this session
  }
  async function migrate(){
    try{
      db=await openDB();
      const legacyRaw=(()=>{try{return localStorage.getItem(LEGACY)}catch{return null}})();
      const imported=legacy();
      const sources=journalKeys().map(k=>({key:k,raw:(()=>{try{return localStorage.getItem(k)}catch{return null}})()}));
      const journal=sources.flatMap(s=>parseJournal(s.key));
      if(imported.length||journal.length)await write([...imported,...journal]);
      available=true;
      // Only clear sources that have not changed while the transaction ran.
      try{if(imported.length&&localStorage.getItem(LEGACY)===legacyRaw)localStorage.removeItem(LEGACY);}catch{}
      for(const source of sources)try{if(localStorage.getItem(source.key)===source.raw)localStorage.removeItem(source.key)}catch{}
      const rows=await read();
      if(volatile.length)await flush();
      return {points:rows,persistent:true};
    }catch(error){
      console.warn('FIELD/OS IndexedDB disabled; retaining local track fallback',error);
      available=false;return {points:legacy(),persistent:false,error:String(error)};
    }
  }
  const initialized=migrate();
  function append(raw){
    const point=normalize(raw);if(!point)return false;
    keepInJournal(point);
    if(available){
      if(volatile.length>=12)void flush();
      else{clearTimeout(timer);timer=setTimeout(()=>{void flush()},2400);}
    }
    return true;
  }
  async function flush(){
    if(flushing)return flushing;
    const current=epoch;
    flushing=(async()=>{
      const snapshot=volatile.slice(),jrn=parseJournal(journalKey),rows=[...jrn,...snapshot];
      const dedup=[...new Map(rows.map(p=>[p.id,p])).values()];
      if(!dedup.length)return true;
      if(!db||!available)return false;
      try{
        await write(dedup);
        if(current!==epoch)return false;
        const written=new Set(dedup.map(p=>p.id));
        volatile=volatile.filter(p=>!written.has(p.id));
        try{
          const remaining=parseJournal(journalKey).filter(p=>!written.has(p.id));
          if(remaining.length)localStorage.setItem(journalKey,JSON.stringify(remaining));
          else localStorage.removeItem(journalKey);
        }catch{}
        return true;
      }catch(error){
        console.warn('FIELD/OS track write not committed; journal retained',error);
        available=false;return false;
      }
    })().finally(()=>{flushing=null});
    return flushing;
  }
  async function all(){await initialized;await flush();let persisted=[];if(db)try{persisted=await read()}catch{}const combined=[...new Map([...persisted,...legacy(),...journalKeys().flatMap(parseJournal),...volatile].map(p=>[p.id,p])).values()].sort((a,b)=>a.id.localeCompare(b.id));
    return combined.length>LIMIT?[combined[0],...combined.slice(-(LIMIT-1))]:combined;}
  async function clear(){
    epoch++;clearTimeout(timer);
    if(flushing)try{await flushing}catch{}
    volatile=[];
    try{localStorage.removeItem(LEGACY);localStorage.removeItem(journalKey)}catch{}
    await initialized;
    if(db)await write([],true);
  }
  async function replace(points){
    epoch++;clearTimeout(timer);if(flushing)try{await flushing}catch{}
    volatile=[];
    try{localStorage.removeItem(journalKey)}catch{}
    await initialized;
    if(db){await write(points,true);try{localStorage.removeItem(LEGACY)}catch{}}
    else try{localStorage.setItem(LEGACY,JSON.stringify(points))}catch{}
  }
  async function snapshot(){
    const points=await all();
    if(!db)throw Error('IndexedDB unavailable: export track before relying on recovery snapshot');
    const tx=db.transaction('backups','readwrite');
    tx.objectStore('backups').put({name:'latest',createdAt:new Date().toISOString(),points});
    await done(tx);
    return points.length;
  }
  async function restore(){
    await initialized;
    if(!db)return null;
    const tx=db.transaction('backups','readonly'),finished=done(tx),req=tx.objectStore('backups').get('latest');
    const backup=await new Promise((resolve,reject)=>{req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error)});
    await finished;
    if(!backup)return null;
    await replace(backup.points||[]);
    return backup.points||[];
  }
  document.addEventListener('visibilitychange',()=>{if(document.hidden)void flush()},{passive:true});
  window.addEventListener('pagehide',()=>{void flush()},{passive:true});
  window.FIELD_TRACK_STORE={hydrate:()=>initialized,append,all,flush,clear,replace,snapshot,restore,
    get persistent(){return available},get pending(){return volatile.length}};
})();
