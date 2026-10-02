/* Offline geographic search, POI collection, layer presets and touch controls. */
(() => {
  'use strict';
  const prefix='fieldos-v12-', maxPlaces=5000;
  const read=(key,fallback)=>{try{return JSON.parse(localStorage.getItem(prefix+key))??fallback}catch{return fallback}};
  const write=(key,value)=>{try{localStorage.setItem(prefix+key,JSON.stringify(value));return true}catch{return false}};
  const valid=p=>p&&p.lat!=null&&p.lon!=null&&p.lat!==''&&p.lon!==''&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  const normalize=p=>valid(p)?{name:String(p.name||'Unnamed place').slice(0,120),type:String(p.type||'PLACE').slice(0,40),lat:Number(p.lat),lon:Number(p.lon),source:String(p.source||'IMPORTED').slice(0,120)}:null;
  const saved=read('places',[]);let places=Array.isArray(saved)?saved.map(normalize).filter(Boolean).slice(0,maxPlaces):[];
  const text=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const identity=p=>`${p.name.toLowerCase()}|${p.lat.toFixed(6)}|${p.lon.toFixed(6)}`;
  function collect(){
    const waypoints=read('waypoints',[]),water=window.FIELD_WATER?.state?.cache?.items||[];
    const all=[...places,...(Array.isArray(waypoints)?waypoints:[]).map(p=>({...p,source:'WAYPOINT'})),...(Array.isArray(water)?water:[])];
    const seen=new Set();return all.map(normalize).filter(p=>{if(!p)return false;const id=identity(p);if(seen.has(id))return false;seen.add(id);return true});
  }
  // Rebuild the sorted search index only when one of its sources changes.
  let index=null,indexPlaces=null,indexWaypoints=null,indexWater=null;
  function searchIndex(){
    let waypointKey='';try{waypointKey=localStorage.getItem(prefix+'waypoints')||''}catch{}
    const waterKey=JSON.stringify(window.FIELD_WATER?.state?.cache?.items||[]);
    if(!index||indexPlaces!==places||indexWaypoints!==waypointKey||indexWater!==waterKey){
      index=collect().sort((a,b)=>a.name.localeCompare(b.name)).map(p=>({point:p,text:`${p.name} ${p.type} ${p.source}`.toLowerCase()}));
      indexPlaces=places;indexWaypoints=waypointKey;indexWater=waterKey;
    }
    return index;
  }
  function search(query){
    const q=String(query||'').trim().toLowerCase();
    const coord=q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if(coord){const p=normalize({name:'Coordinates',lat:coord[1],lon:coord[2],source:'ENTERED COORDINATES'});return p?[p]:[]}
    const terms=q.split(/\s+/).filter(Boolean),matches=[];
    for(const entry of searchIndex()){
      if(terms.every(t=>entry.text.includes(t)))matches.push({...entry.point});
      if(matches.length===50)break;
    }
    return matches;
  }
  function importPlaces(data){
    const rows=Array.isArray(data)?data:data?.type==='FeatureCollection'&&Array.isArray(data.features)?data.features.filter(f=>f?.geometry?.type==='Point').map(f=>({...f.properties,lat:f.geometry.coordinates?.[1],lon:f.geometry.coordinates?.[0]})):null;
    if(!rows)throw new Error('Use a JSON array or GeoJSON FeatureCollection of points.');
    const next=new Map(places.map(p=>[identity(p),p]));let accepted=0;
    for(const row of rows){const p=normalize(row);if(!p)continue;next.set(identity(p),p);accepted++;if(next.size>maxPlaces)throw new Error('Maximum 5,000 saved places. Import a smaller region.');}
    if(!accepted)throw new Error('No valid point coordinates found. Existing places retained.');
    const updated=[...next.values()];if(!write('places',updated))throw new Error('Storage is full or unavailable. Existing places retained.');
    places=updated;renderSearch();return {accepted,total:places.length};
  }
  function exportPlaces(){return {type:'FeatureCollection',features:places.map(p=>({type:'Feature',properties:{name:p.name,type:p.type,source:p.source},geometry:{type:'Point',coordinates:[p.lon,p.lat]}}))}}
  let results=[];
  function renderSearch(){results=search(document.getElementById('offlinePlaceQuery')?.value||'');text('offlinePlaceCount',`${places.length} IMPORTED // ${searchIndex().length} TOTAL LOCAL PLACES`);const list=document.getElementById('offlinePlaceResults');if(list)list.innerHTML=results.map((p,i)=>`<button type="button" class="offline-place-result" data-place-index="${i}"><b>${esc(p.name)}</b><span>${esc(p.type)} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</span><small>${esc(p.source)} · SHOW ON MAP</small></button>`).join('')||'<p class="muted">No local matches. Import places, save waypoints, or enter latitude, longitude.</p>'}
  let searchFrame=0;
  function scheduleSearch(){
    if(searchFrame||document.hidden)return;
    searchFrame=requestAnimationFrame(()=>{searchFrame=0;renderSearch();});
  }
  document.getElementById('offlinePlaceQuery')?.addEventListener('input',scheduleSearch);
  window.addEventListener('storage',e=>{
    if(e.key===prefix+'places'||e.key===null){const next=read('places',[]);places=Array.isArray(next)?next.map(normalize).filter(Boolean).slice(0,maxPlaces):[];}
    if(e.key===null||e.key===prefix+'places'||e.key===prefix+'waypoints'){
      index=null;if(document.querySelector('#map.active'))scheduleSearch();
    }
  });
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(searchFrame);searchFrame=0;}
    else if(document.querySelector('#map.active'))scheduleSearch();
  });
  document.getElementById('offlinePlaceResults')?.addEventListener('click',e=>{const button=e.target.closest('[data-place-index]'),p=results[Number(button?.dataset.placeIndex)];if(!button||!p)return;window.FIELD_MAP_ENGINE?.setView('realMap',p,15);document.getElementById('realMap')?.scrollIntoView({block:'center',behavior:'smooth'});text('offlinePlaceStatus',`${p.name} — ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`)});
  document.getElementById('offlinePlaceFile')?.addEventListener('change',async e=>{const input=e.currentTarget,file=input.files?.[0];if(!file)return;try{if(file.size>5*1024*1024)throw new Error('Use a file smaller than 5 MB.');const r=importPlaces(JSON.parse(await file.text()));text('offlinePlaceStatus',`IMPORTED ${r.accepted} VALID POINTS // ${r.total} SAVED`)}catch(err){text('offlinePlaceStatus',err.message)}finally{input.value=''}});
  document.getElementById('offlinePlaceExport')?.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([JSON.stringify(exportPlaces(),null,2)],{type:'application/geo+json'}));const a=document.createElement('a');a.href=url;a.download='field-os-places.geojson';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000)});
  document.getElementById('offlinePlaceClear')?.addEventListener('click',()=>{if(!confirm('Remove imported places? Your waypoints and water cache are kept.'))return;if(!write('places',[])){text('offlinePlaceStatus','Storage unavailable; places retained.');return}places=[];renderSearch();text('offlinePlaceStatus','Imported places cleared.')});
  function setTouch(mode,on){if(!['glove','onehand'].includes(mode))return;document.body.classList.toggle('field-'+mode,!!on);write('touch-'+mode,!!on);document.getElementById(mode+'Toggle')?.setAttribute('aria-pressed',String(!!on))}
  for(const mode of ['glove','onehand']){setTouch(mode,read('touch-'+mode,false)===true);document.getElementById(mode+'Toggle')?.addEventListener('click',()=>setTouch(mode,!document.body.classList.contains('field-'+mode)))}
  const presets={hike:{mode:'topo',trails:true,terrain:false,grid:false},street:{mode:'osm',trails:false,terrain:false,grid:false},terrain:{mode:'satellite',trails:true,terrain:true,grid:true}};
  function preset(name){const p=presets[name],m=window.FIELD_MAP_ENGINE;if(!p||!m)return false;m.setLayers(p);text('mapPresetState',name.toUpperCase()+' PRESET APPLIED');return true}
  document.querySelectorAll('[data-layer-preset]').forEach(b=>b.addEventListener('click',()=>preset(b.dataset.layerPreset)));
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='map')renderSearch()});
  renderSearch();
  window.FIELD_PLACES={search,collect,import:importPlaces,export:exportPlaces,render:renderSearch};
  window.FIELD_TOUCH={set:setTouch};window.FIELD_PRESETS={apply:preset};
})();

/* Features 40–49 — browser/PWA field reliability toolkit. */
(() => {
  'use strict';
  const el=id=>document.getElementById(id), set=(id,v)=>{const e=el(id);if(e)e.textContent=v}; let installPrompt=null,battery=null;
  const capability=()=>({serviceWorker:'serviceWorker' in navigator,indexedDB:'indexedDB' in window,geolocation:'geolocation' in navigator,wakeLock:'wakeLock' in navigator,share:'share' in navigator,clipboard:!!navigator.clipboard,storagePersist:!!navigator.storage?.persist,fullscreen:!!document.documentElement.requestFullscreen,orientationLock:!!screen.orientation?.lock,connection:!!navigator.connection,battery:'getBattery' in navigator});
  async function render(){const c=capability(),conn=navigator.connection;set('browserOnlineState',navigator.onLine?'ONLINE':'OFFLINE');set('browserNetworkType',conn?.effectiveType?String(conn.effectiveType).toUpperCase():'UNAVAILABLE');set('browserDataSaver',conn?.saveData?'ON':'OFF / UNKNOWN');let persisted='UNAVAILABLE';try{if(navigator.storage?.persisted)persisted=(await navigator.storage.persisted())?'PERSISTENT':'BEST EFFORT'}catch{}set('browserStoragePersist',persisted);set('browserBattery',battery?(Math.round(battery.level*100)+'%'+(battery.charging?' / CHARGING':'')):'API UNAVAILABLE');set('browserVisibility',document.visibilityState.toUpperCase());const supported=Object.values(c).filter(Boolean).length;set('browserCapabilityScore',supported+'/'+Object.keys(c).length+' WEB CAPABILITIES');const list=el('browserCapabilityList');if(list)list.innerHTML=Object.entries(c).map(([k,v])=>'<div class="condition-row"><b>'+k.replace(/[A-Z]/g,m=>' '+m).toUpperCase()+'</b><span>'+(v?'SUPPORTED':'UNAVAILABLE')+'</span></div>').join('');return c}
  async function persist(){try{const ok=await navigator.storage?.persist?.();set('browserStoragePersist',ok?'PERSISTENT':'BEST EFFORT');return !!ok}catch{return false}}
  async function fullscreen(){try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen?.()}catch{}render()}
  async function orientation(){try{await screen.orientation?.lock?.('portrait');set('browserOrientation','PORTRAIT LOCKED')}catch{set('browserOrientation','LOCK UNAVAILABLE')}}
  async function shareMission(){const plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},pts=plan.points||[],a=pts[0],b=pts.at?.(-1),parts=['FIELD/OS // '+(plan.name||'FIELD ROUTE')];if(a)parts.push('START '+Number(a.lat).toFixed(5)+', '+Number(a.lon).toFixed(5));if(b)parts.push('END '+Number(b.lat).toFixed(5)+', '+Number(b.lon).toFixed(5));const value=parts.join('\n');try{if(navigator.share)await navigator.share({title:'FIELD/OS route',text:value});else await navigator.clipboard?.writeText(value);set('browserShareState',navigator.share?'SHARED':'COPIED')}catch{set('browserShareState','CANCELLED')}}
  async function copyCoords(){const p=window.FIELD_ROUTE_STATE?.current?.()||window.FIELD_CURRENT_POSITION||window.FIELD_LAST_POSITION;if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))return set('browserShareState','NO POSITION');const value=Number(p.lat).toFixed(6)+', '+Number(p.lon).toFixed(6);try{await navigator.clipboard.writeText(value);set('browserShareState','COORDINATES COPIED')}catch{set('browserShareState',value)}}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;set('browserInstallState','INSTALL AVAILABLE')});
  el('browserInstall')?.addEventListener('click',async()=>{if(!installPrompt)return set('browserInstallState',matchMedia('(display-mode: standalone)').matches?'INSTALLED / STANDALONE':'USE BROWSER ADD-TO-HOME-SCREEN');installPrompt.prompt();const r=await installPrompt.userChoice;set('browserInstallState',String(r.outcome||'DONE').toUpperCase());installPrompt=null});
  el('browserPersist')?.addEventListener('click',persist);el('browserFullscreen')?.addEventListener('click',fullscreen);el('browserOrientationLock')?.addEventListener('click',orientation);el('browserShareMission')?.addEventListener('click',shareMission);el('browserCopyCoordinates')?.addEventListener('click',copyCoords);
  window.addEventListener('online',render);window.addEventListener('offline',render);document.addEventListener('visibilitychange',render);navigator.connection?.addEventListener?.('change',render);navigator.getBattery?.().then(b=>{battery=b;b.addEventListener('levelchange',render);b.addEventListener('chargingchange',render);render()}).catch(()=>{});setTimeout(render,300);
  window.FIELD_BROWSER_TOOLKIT={capability,status:render,persist,share:shareMission};
})();

/* Features 50–59 — offline field utility console. */
(() => {
 'use strict'; const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v},K='fieldos-v12-field-utility-';
 const rad=d=>d*Math.PI/180,deg=r=>r*180/Math.PI;
 function parseCoord(v){const m=String(v||'').trim().match(/^\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*$/);if(!m)return null;const p={lat:Number(m[1]),lon:Number(m[2])};return Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180?p:null}
 function dms(n,pos,neg){const s=n<0?neg:pos,a=Math.abs(n),d=Math.floor(a),mf=(a-d)*60,m=Math.floor(mf),sec=(mf-m)*60;return d+'° '+m+'′ '+sec.toFixed(1)+'″ '+s}
 function convert(){const p=parseCoord($('fieldCoordInput')?.value);if(!p)return set('fieldCoordOutput','ENTER DECIMAL LAT, LON');set('fieldCoordOutput',dms(p.lat,'N','S')+' // '+dms(p.lon,'E','W'))}
 function navcalc(){const a=parseCoord($('fieldPointA')?.value),b=parseCoord($('fieldPointB')?.value);if(!a||!b)return set('fieldNavCalc','ENTER TWO VALID POINTS');const R=6371000,dla=rad(b.lat-a.lat),dlo=rad(b.lon-a.lon),la1=rad(a.lat),la2=rad(b.lat),h=Math.sin(dla/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dlo/2)**2,d=2*R*Math.asin(Math.min(1,Math.sqrt(h))),y=Math.sin(dlo)*Math.cos(la2),x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dlo),br=(deg(Math.atan2(y,x))+360)%360;set('fieldNavCalc',(d/1609.344).toFixed(2)+' MI // '+Math.round(br)+'° TRUE')}
 function saveNote(){try{localStorage.setItem(K+'note',$('fieldScratch')?.value||'');set('fieldUtilityState','NOTE SAVED LOCALLY')}catch{set('fieldUtilityState','NOTE SAVE FAILED')}}
 function readMarks(){
   try{const raw=JSON.parse(localStorage.getItem(K+'marks')||'[]');return Array.isArray(raw)?raw.filter(x=>x&&typeof x==='object').slice(0,100):[]}catch{return []}
 }
 const validMarkCoord=(v,max)=>v!==null&&v!==undefined&&v!==''&&Number.isFinite(Number(v))&&Math.abs(Number(v))<=max;
 function mark(){
   const p=window.FIELD_ROUTE_STATE?.current?.()||window.FIELD_CURRENT_POSITION,items=readMarks();
   const valid=validMarkCoord(p?.lat,90)&&validMarkCoord(p?.lon,180);
   items.unshift({time:new Date().toISOString(),lat:valid?Number(p.lat):null,lon:valid?Number(p.lon):null,label:String($('fieldMarkLabel')?.value||'FIELD MARK').slice(0,80)});
   try{localStorage.setItem(K+'marks',JSON.stringify(items.slice(0,100)));renderMarks();set('fieldUtilityState','TIMESTAMP MARK SAVED')}catch{set('fieldUtilityState','MARK SAVE FAILED — STORAGE UNAVAILABLE')}
 }
 function renderMarks(){
   const e=$('fieldMarks');if(!e)return;
   const items=readMarks().slice(0,8);e.replaceChildren();
   for(const x of items){
     const row=document.createElement('div');row.className='condition-row';
     const label=document.createElement('b');label.textContent=String(x.label||'FIELD MARK');
     const time=document.createElement('span');const date=new Date(x.time);time.textContent=Number.isFinite(date.getTime())?date.toLocaleString():'UNKNOWN TIME';
     const coords=document.createElement('em');coords.textContent=validMarkCoord(x.lat,90)&&validMarkCoord(x.lon,180)?Number(x.lat).toFixed(4)+', '+Number(x.lon).toFixed(4):'NO FIX';
     row.append(label,time,coords);e.append(row);
   }
   if(!items.length){const empty=document.createElement('p');empty.className='muted';empty.textContent='No timestamp marks.';e.append(empty);}
 }
 async function storage(){try{const q=await navigator.storage?.estimate?.();if(!q)return set('fieldStorageUsage','UNAVAILABLE');const u=Number(q.usage||0),m=Number(q.quota||0);set('fieldStorageUsage',(u/1048576).toFixed(1)+' / '+(m/1048576).toFixed(0)+' MB // '+(m?Math.round(u/m*100):0)+'%')}catch{set('fieldStorageUsage','UNAVAILABLE')}}
 function readiness(){const checks=[navigator.onLine,!!window.FIELD_ROUTE_STATE?.getPlan?.()?.points?.length,!!localStorage.getItem('fieldos-v12-map-pack'),!!localStorage.getItem('fieldos-v12-weather-cache'),!!localStorage.getItem('fieldos-v12-environment-intel-cache'),!!navigator.serviceWorker?.controller];const n=checks.filter(Boolean).length;set('fieldOfflineReadiness',n+'/6 // '+(n>=5?'FIELD READY':n>=3?'PARTIAL':'PREP NEEDED'));return n}
 function locationCard(){const p=window.FIELD_ROUTE_STATE?.current?.()||window.FIELD_CURRENT_POSITION,plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{};const value=['FIELD/OS LOCATION CARD','TIME '+new Date().toISOString(),p&&Number.isFinite(Number(p.lat))?'POSITION '+Number(p.lat).toFixed(6)+', '+Number(p.lon).toFixed(6):'POSITION NO FIX','ROUTE '+(plan.name||'NONE')].join('\n');set('fieldLocationCard',value);return value}
 async function copyCard(){const v=locationCard();try{await navigator.clipboard.writeText(v);set('fieldUtilityState','LOCATION CARD COPIED')}catch{set('fieldUtilityState','COPY UNAVAILABLE')}}
 $('fieldCoordConvert')?.addEventListener('click',convert);$('fieldNavCalculate')?.addEventListener('click',navcalc);$('fieldScratchSave')?.addEventListener('click',saveNote);$('fieldAddMark')?.addEventListener('click',mark);$('fieldCopyLocationCard')?.addEventListener('click',copyCard);
 const utilityVisible=()=>!!document.querySelector('#system.active');
 try{if($('fieldScratch'))$('fieldScratch').value=localStorage.getItem(K+'note')||''}catch{} renderMarks();storage();readiness();if(utilityVisible())locationCard();window.addEventListener('online',readiness);window.addEventListener('offline',readiness);document.addEventListener('fieldos:routechange',()=>{readiness();if(utilityVisible())locationCard()});document.addEventListener('fieldos:positionchange',()=>{if(utilityVisible())locationCard()});document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='system')locationCard()});
 window.FIELD_UTILITY={parseCoord,convert,navcalc,readiness,locationCard,storage};
})();

/* Features 60–70 — browser data resilience, diagnostics and launch preflight. */
(() => {
 'use strict';const $=id=>document.getElementById(id),set=(id,v)=>{const e=$(id);if(e)e.textContent=v},P='fieldos-v12-',DK=P+'diagnostic-events',SK=P+'recovery-snapshot';
 function diag(type,detail=''){let a=[];try{a=JSON.parse(localStorage.getItem(DK)||'[]')}catch{}a.unshift({time:new Date().toISOString(),type:String(type).slice(0,40),detail:String(detail).slice(0,180)});try{localStorage.setItem(DK,JSON.stringify(a.slice(0,100)))}catch{}renderDiag()}
 function renderDiag(){let a=[];try{a=JSON.parse(localStorage.getItem(DK)||'[]')}catch{}const e=$('browserDiagLog');if(e)e.innerHTML=a.slice(0,10).map(x=>'<div class="condition-row"><b>'+x.type.replace(/[<>]/g,'')+'</b><span>'+new Date(x.time).toLocaleTimeString()+'</span><em>'+x.detail.replace(/[<>]/g,'')+'</em></div>').join('')||'<p class="muted">No diagnostic events.</p>'}
 async function snapshot({includeTrack=true}={}){
 const keys=['routePlan','trip','waypoints','track','mission-pack','weather-cache','environment-intel-cache','map-pack','map-source'];
 const data={schema:2,created:new Date().toISOString(),items:{},trackStorage:'legacy'};
 try{
  for(const k of keys)data.items[k]=localStorage.getItem(P+k);
  if(includeTrack&&window.FIELD_TRACK_STORE?.persistent){
   await window.FIELD_TRACK_STORE.snapshot();data.trackStorage='indexeddb';data.items.track=null;
  }else if(!includeTrack&&window.FIELD_TRACK_STORE?.persistent){data.trackStorage='unchanged';data.items.track=null;}
  localStorage.setItem(SK,JSON.stringify(data));
  set('recoverySnapshotState','SAVED '+new Date(data.created).toLocaleTimeString()+
   (data.trackStorage==='unchanged'?' (TRACK UNCHANGED)':''));
  diag('SNAPSHOT','Recovery state saved'+(data.trackStorage==='indexeddb'?' with track backup':''));
  return data;
 }catch(error){set('recoverySnapshotState','SAVE FAILED — '+String(error.message||error).slice(0,60));diag('SNAPSHOT FAILED',String(error.message||error));return null;}
}
async function restore(){
 let state;try{state=JSON.parse(localStorage.getItem(SK)||'null')}catch{}
 if(!state?.items){set('recoverySnapshotState','NO SNAPSHOT');return;}
 try{
  if(state.trackStorage==='indexeddb'){
   const recovered=await window.FIELD_TRACK_STORE?.restore?.();
   if(!recovered)throw Error('IndexedDB track backup missing; restore cancelled');
  }else if(state.items.track!=null&&window.FIELD_TRACK_STORE?.persistent){
   const old=JSON.parse(state.items.track);if(!Array.isArray(old))throw Error('Invalid legacy track backup');
   await window.FIELD_TRACK_STORE.replace(old);
  }
  for(const [k,v] of Object.entries(state.items)){
   if(k==='track'&&window.FIELD_TRACK_STORE?.persistent)continue;
   if(state.trackStorage==='unchanged'&&k==='track')continue;
   if(v==null)localStorage.removeItem(P+k);else localStorage.setItem(P+k,v);
  }
  set('recoverySnapshotState','RESTORED — RELOAD REQUIRED');diag('RESTORE','Recovery snapshot restored; reload to synchronize active memory');
 }catch(error){set('recoverySnapshotState','RESTORE FAILED — '+String(error.message||error).slice(0,50));diag('RESTORE FAILED',String(error.message||error));}
}
async function permissions(){const names=['geolocation','notifications'];const out=[];for(const name of names){try{const r=await navigator.permissions?.query?.({name});out.push(name.toUpperCase()+': '+String(r?.state||'UNKNOWN').toUpperCase())}catch{out.push(name.toUpperCase()+': BROWSER MANAGED')}}set('browserPermissionAudit',out.join(' // '));return out}
 async function swHealth(){let state='UNAVAILABLE';try{if('serviceWorker' in navigator){const reg=await navigator.serviceWorker.getRegistration();state=reg?(navigator.serviceWorker.controller?'CONTROLLED':'REGISTERED / RELOAD NEEDED'):'NOT REGISTERED'}}catch{state='ERROR'}set('browserSwHealth',state);return state}
 let cacheScan=null;
 function cacheHealth(){
   if(cacheScan)return cacheScan;
   cacheScan=(async()=>{
     let count=0,names=[];
     try{if('caches' in window){names=(await caches.keys()).filter(n=>n.startsWith('field-os-'));for(const n of names){const cache=await caches.open(n);count+=(await cache.keys()).length}}}catch{}
     set('browserCacheHealth',names.length+' APP CACHES // '+count+' RESPONSES');return {names,count};
   })().finally(()=>{cacheScan=null});
   return cacheScan;
 }
 function stale(){const rows=[];for(const [key,label,maxH] of [['weather-cache','WEATHER',12],['environment-intel-cache','ENVIRONMENT',24]]){let d=null;try{d=JSON.parse(localStorage.getItem(P+key)||'null')}catch{}const t=Date.parse(d?.downloadedAt||d?.fetchedAt||'');const h=Number.isFinite(t)?(Date.now()-t)/3600000:Infinity;rows.push(label+': '+(h<=maxH?'FRESH':h<Infinity?Math.floor(h)+'H OLD':'MISSING'))}set('browserStaleData',rows.join(' // '));return rows}
 async function launch(){const results=[];results.push(['ONLINE',navigator.onLine]);results.push(['SERVICE WORKER',(await swHealth())!=='UNAVAILABLE']);results.push(['ROUTE',!!window.FIELD_ROUTE_STATE?.getPlan?.()?.points?.length]);results.push(['POSITION',window.FIELD_SAFETY?.position?.().trusted===true]);results.push(['OFFLINE MAP',!!localStorage.getItem(P+'map-pack')]);results.push(['WEATHER',!!localStorage.getItem(P+'weather-cache')]);results.push(['ENVIRONMENT',!!localStorage.getItem(P+'environment-intel-cache')]);const ok=results.filter(x=>x[1]).length;set('browserLaunchCheck',ok+'/'+results.length+' READY // '+(ok>=6?'GO':ok>=4?'PARTIAL':'PREP'));const e=$('browserLaunchList');if(e)e.innerHTML=results.map(x=>'<div class="condition-row"><b>'+x[0]+'</b><span>'+(x[1]?'READY':'MISSING')+'</span></div>').join('');diag('PREFLIGHT',ok+'/'+results.length+' ready');return results}
 function softReset(){for(const k of ['touch-glove','touch-onehand'])try{localStorage.removeItem(P+k)}catch{}document.body.classList.remove('field-glove','field-onehand');set('browserRecoveryState','UI FIELD MODES RESET');diag('SAFE UI RESET','Touch modes reset only')}
 $('recoverySnapshot')?.addEventListener('click',()=>{void snapshot()});$('recoveryRestore')?.addEventListener('click',()=>{void restore()});$('browserRunAudit')?.addEventListener('click',async()=>{await permissions();await swHealth();await cacheHealth();stale();diag('AUDIT','Browser health audit complete')});$('browserLaunchPreflight')?.addEventListener('click',launch);$('browserSoftReset')?.addEventListener('click',softReset);
 window.addEventListener('error',e=>diag('JS ERROR',e.message||'Unknown error'));window.addEventListener('unhandledrejection',e=>diag('PROMISE ERROR',String(e.reason?.message||e.reason||'Unknown rejection')));
 renderDiag();permissions();swHealth();stale();
 let cacheChecked=false;
 const inspectCacheWhenVisible=()=>{if(!cacheChecked&&!document.hidden&&document.querySelector('#system.active')){cacheChecked=true;cacheHealth();}};
 document.addEventListener('fieldos:viewchange',inspectCacheWhenVisible);
 document.addEventListener('visibilitychange',inspectCacheWhenVisible);
 inspectCacheWhenVisible();setTimeout(()=>{if(window.FIELD_ROUTE_STATE?.getPlan?.()?.points?.length)void snapshot({includeTrack:false})},1500);
 
 async function copyDiagnosticReport(){
  let events=[];try{events=JSON.parse(localStorage.getItem(DK)||'[]')}catch{}
  const report=['FIELD/OS LOCAL DIAGNOSTIC REPORT',new Date().toISOString(),
   'App version: '+(document.querySelector('.version')?.textContent||'unknown'),
   'Browser: '+navigator.userAgent,'Review for locations/private details before sharing.',
   ...events.slice(0,50).map(x=>[x.time,x.type,x.detail].join(' // '))].join('\n');
  try{await navigator.clipboard.writeText(report);diag('REPORT','Diagnostic report copied locally');}
  catch{set('browserRecoveryState','COPY FAILED — check clipboard permission');}
 }
 $('browserCopyDiagnostic')?.addEventListener('click',()=>{void copyDiagnosticReport()});
window.FIELD_BROWSER_RESILIENCE={diag,snapshot,restore,permissions,swHealth,cacheHealth,stale,launch,copyDiagnosticReport};
})();
