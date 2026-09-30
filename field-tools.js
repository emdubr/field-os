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
  function search(query){
    const q=String(query||'').trim().toLowerCase();
    const coord=q.match(/^(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)$/);
    if(coord){const p=normalize({name:'Coordinates',lat:coord[1],lon:coord[2],source:'ENTERED COORDINATES'});return p?[p]:[]}
    const terms=q.split(/\s+/).filter(Boolean);
    return collect().filter(p=>terms.every(t=>`${p.name} ${p.type} ${p.source}`.toLowerCase().includes(t))).sort((a,b)=>a.name.localeCompare(b.name)).slice(0,50);
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
  function renderSearch(){results=search(document.getElementById('offlinePlaceQuery')?.value||'');text('offlinePlaceCount',`${places.length} IMPORTED // ${collect().length} TOTAL LOCAL PLACES`);const list=document.getElementById('offlinePlaceResults');if(list)list.innerHTML=results.map((p,i)=>`<button type="button" class="offline-place-result" data-place-index="${i}"><b>${esc(p.name)}</b><span>${esc(p.type)} · ${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}</span><small>${esc(p.source)} · SHOW ON MAP</small></button>`).join('')||'<p class="muted">No local matches. Import places, save waypoints, or enter latitude, longitude.</p>'}
  document.getElementById('offlinePlaceQuery')?.addEventListener('input',renderSearch);
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
  async function copyCoords(){const p=window.FIELD_ROUTE_STATE?.current?.()||window.FIELD_CURRENT_POSITION;if(!p||!Number.isFinite(Number(p.lat))||!Number.isFinite(Number(p.lon)))return set('browserShareState','NO POSITION');const value=Number(p.lat).toFixed(6)+', '+Number(p.lon).toFixed(6);try{await navigator.clipboard.writeText(value);set('browserShareState','COORDINATES COPIED')}catch{set('browserShareState',value)}}
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();installPrompt=e;set('browserInstallState','INSTALL AVAILABLE')});
  el('browserInstall')?.addEventListener('click',async()=>{if(!installPrompt)return set('browserInstallState',matchMedia('(display-mode: standalone)').matches?'INSTALLED / STANDALONE':'USE BROWSER ADD-TO-HOME-SCREEN');installPrompt.prompt();const r=await installPrompt.userChoice;set('browserInstallState',String(r.outcome||'DONE').toUpperCase());installPrompt=null});
  el('browserPersist')?.addEventListener('click',persist);el('browserFullscreen')?.addEventListener('click',fullscreen);el('browserOrientationLock')?.addEventListener('click',orientation);el('browserShareMission')?.addEventListener('click',shareMission);el('browserCopyCoordinates')?.addEventListener('click',copyCoords);
  window.addEventListener('online',render);window.addEventListener('offline',render);document.addEventListener('visibilitychange',render);navigator.connection?.addEventListener?.('change',render);navigator.getBattery?.().then(b=>{battery=b;b.addEventListener('levelchange',render);b.addEventListener('chargingchange',render);render()}).catch(()=>{});setTimeout(render,300);
  window.FIELD_BROWSER_TOOLKIT={capability,status:render,persist,share:shareMission};
})();
