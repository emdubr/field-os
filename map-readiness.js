/* Browser storage estimates and truthful map-source/cache metadata. */
(() => {
  'use strict';
  const maxBytes=250*1024*1024;
  const finite=value=>typeof value==='number'&&Number.isFinite(value)&&value>=0;
  const bytes=n=>finite(n)?`${(n/1048576).toFixed(1)} MB`:'UNKNOWN';
  const text=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value};
  let estimate=null,selectedPack=null,checking=null;
  function assess(size,storage=estimate){
    if(!finite(size)||size===0)return {allowed:false,known:false,reason:'Map file size must be greater than zero.'};
    if(size>maxBytes)return {allowed:false,known:true,reason:'Map pack exceeds the 250 MB limit.'};
    const known=finite(storage?.quota)&&storage.quota>0&&finite(storage?.usage),free=known?Math.max(0,storage.quota-storage.usage):null;
    // Allow room for storage overhead and the other local app records.
    const needed=size+Math.max(5*1048576,size*.1);
    return {allowed:!known||free>=needed,known,free,needed,size,reason:known&&free<needed?`Not enough estimated browser storage. Need ${bytes(needed)} including headroom; ${bytes(free)} available.`:known?`Estimated space required: ${bytes(needed)} including headroom.`:'Browser quota is unavailable; capacity will be checked when saving.'};
  }
  async function refreshStorage(){
    if(checking)return checking;
    checking=(async()=>{try{estimate=await navigator.storage?.estimate?.()||null}catch{estimate=null}text('mapStorageAvailable',finite(estimate?.quota)&&estimate.quota>0&&finite(estimate?.usage)?bytes(Math.max(0,estimate.quota-estimate.usage)):'UNAVAILABLE');text('mapStorageUsage',bytes(estimate?.usage));let persistent=null;try{persistent=await navigator.storage?.persisted?.()}catch{}text('mapStoragePersistence',persistent===true?'PERSISTENT':persistent===false?'BROWSER MAY EVICT':'UNKNOWN');return estimate})().finally(()=>{checking=null});return checking;
  }
  async function preflight(size){const state=assess(size,await refreshStorage());text('mapStorageEstimate',state.reason);if(!state.allowed)throw new Error(state.reason);return state}
  function age(date,now=Date.now()){const t=Date.parse(date);if(!Number.isFinite(t)||t>now)return 'UNKNOWN';const hours=Math.floor((now-t)/3600000);return hours<1?'LESS THAN 1 HOUR':hours<24?`${hours} HOURS`:`${Math.floor(hours/24)} DAYS`}
  function packInfo(pack,now=Date.now()){
    if(!pack)return {name:'NONE SELECTED',savedAge:'—',source:'—',dataDate:'UNKNOWN',coverage:'—'};
    const b=pack.bounds,valid=Array.isArray(b)&&b.length===4&&b.every(Number.isFinite)&&b[0]<=b[2]&&b[1]<=b[3];
    return {name:String(pack.name||'Saved map'),savedAge:age(pack.created,now),source:pack.source==='download'?'DOWNLOADED PMTILES':pack.source==='import'?'IMPORTED PMTILES':String(pack.source||'UNKNOWN'),dataDate:'UNKNOWN',coverage:valid?`${b[1].toFixed(3)}, ${b[0].toFixed(3)} → ${b[3].toFixed(3)}, ${b[2].toFixed(3)}`:'UNKNOWN'};
  }
  function showPack(pack){selectedPack=pack||null;const info=packInfo(selectedPack);for(const [field,id] of [['name','mapPackInfoName'],['savedAge','mapPackSavedAge'],['source','mapPackOrigin'],['dataDate','mapPackDataDate'],['coverage','mapPackBounds']])text(id,info[field]);return info}
  function sourceInfo(){const shown=window.FIELD_OFFLINE_MAPS?.displayed?.();if(shown?.kind?.startsWith('offline:')){text('mapDisplayedSource',shown.name||'OFFLINE PMTILES');text('mapDisplayedLayers','SAVED PACK');text('mapDataAge','SOURCE DATA DATE UNKNOWN');text('mapNetworkState','OFFLINE PACK DISPLAYED');return}const m=window.FIELD_MAP_ENGINE;if(!m)return;const providers={osm:'OpenStreetMap',topo:'OpenTopoMap + OpenStreetMap',satellite:'Esri imagery + OpenStreetMap'};text('mapDisplayedSource',providers[m.mode]||'UNKNOWN');text('mapDisplayedLayers',[m.trails?'Waymarked Trails':null,m.terrain?'Esri hillshade':null,m.grid?'Coordinate grid':null].filter(Boolean).join(' / ')||'BASE ONLY');text('mapDataAge','PROVIDER DATA DATE NOT AVAILABLE');text('mapNetworkState',navigator.onLine===false?'OFFLINE — ONLINE TILES MAY BE UNAVAILABLE':'ONLINE TILE SOURCE');}
  document.getElementById('mapStorageCheck')?.addEventListener('click',async()=>{const input=document.getElementById('mapEstimateMB'),mb=Number(input?.value);await refreshStorage();text('mapStorageEstimate',assess(mb*1048576).reason)});
  document.getElementById('mapStoragePersist')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{const ok=await navigator.storage?.persist?.();text('mapStorageEstimate',ok?'Persistent storage granted.':'Persistent storage was not granted by this browser.')}catch{ text('mapStorageEstimate','Persistent storage is unavailable.')}finally{await refreshStorage();button.disabled=false}});
  document.addEventListener('fieldos:mapstatechange',sourceInfo);
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='map'){refreshStorage();sourceInfo();showPack(selectedPack)}});
  window.addEventListener('online',sourceInfo);window.addEventListener('offline',sourceInfo);
  window.FIELD_MAP_READINESS={assess,preflight,refreshStorage,packInfo,showPack,sourceInfo,age};
})();
