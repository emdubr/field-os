/* Offline go/no-go check for iPhone. Never infer readiness from a saved ID alone.
 * This verifies one current app shell, first-party renderer bundles and actual
 * tile reads from a locally stored MVT archive; users must still test airplane
 * mode on their own device before relying on a trip pack.
 */
(() => {
 'use strict';
 const EXPECTED='field-os-v3-85-airplane1';
 const ESSENTIAL=[
   './index.html','./styles.css?v=3.85-cssfix2','./workstation.css?v=3.85-cssfix2',
   './app.js?v=3.85-airplane1','./route-planner.js?v=3.85-plwheel1',
   './vendor/leaflet/leaflet.css','./vendor/leaflet/leaflet.js',
   './vendor/pmtiles/pmtiles.js','./vendor/protomaps-leaflet/protomaps-leaflet.js'
 ];
 const VENDOR=['./vendor/leaflet/leaflet.js','./vendor/pmtiles/pmtiles.js','./vendor/protomaps-leaflet/protomaps-leaflet.js'];
 const label=(id,value)=>{const node=document.getElementById(id);if(node)node.textContent=value};
 const bound=(p,b)=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&
   Number(p.lon)>=b.minLon&&Number(p.lon)<=b.maxLon&&
   Number(p.lat)>=b.minLat&&Number(p.lat)<=b.maxLat;
 function archiveHeader(header){
   if(!header||Number(header.tileType)!==1)return {ok:false,reason:'Map is not MVT vector PMTiles.'};
   const n=['minLon','minLat','maxLon','maxLat','minZoom','maxZoom'];
   if(!n.every(k=>Number.isFinite(header[k]))||header.minLon>=header.maxLon||
      header.minLat>=header.maxLat||header.minZoom>header.maxZoom)
     return {ok:false,reason:'Map header has invalid extent or zoom.'};
   return {ok:true,reason:'Valid MVT vector header.'};
 }
 function mapTileXY(p,z){
   const lat=Math.max(-85.051129,Math.min(85.051129,Number(p.lat))),lon=Number(p.lon);
   const n=2**z,r=lat*Math.PI/180;
   return {x:Math.max(0,Math.min(n-1,Math.floor((lon+180)/360*n))),
     y:Math.max(0,Math.min(n-1,Math.floor((1-Math.log(Math.tan(r)+1/Math.cos(r))/Math.PI)/2*n)))};
 }
 async function samplePoint(archive,header,p){
   if(!bound(p,header))return {ok:false,reason:'Position is outside the pack bounds.'};
   // Sparse PMTiles legitimately omit some cells (e.g. oceans). This is a
   // sample, never a claim that every tile along a route was inspected.
   const z0=Math.min(Math.max(0,Math.floor(header.maxZoom)),12);
   for(let z=z0;z>=Math.max(0,Math.floor(header.minZoom));z--){
     const {x,y}=mapTileXY(p,z);
     try{
       const tile=await archive.getZxy(z,x,y);
       if(tile?.data?.byteLength>0)return {ok:true,zoom:z};
     }catch{}
   }
   return {ok:false,reason:'Could not read a map tile at the sampled position.'};
 }
 let inflight=null;
 async function inspect(){
   const rows=[],add=(name,ok,detail)=>{rows.push({name,ok,detail});return ok};
   const worker=navigator.serviceWorker?.controller;
   const sw=add('ACTIVE APP WORKER',!!worker,worker?'Controlling this page.':'Open FIELD/OS online once, then reopen.');
   let shell=false;
   if(sw&&'caches' in window)try{
     const cache=await caches.open(EXPECTED),missing=[];
     for(const url of ESSENTIAL){
       const absolute=new URL(url,location.href).href;
       if(!await cache.match(absolute)&&!await cache.match(url))missing.push(url);
     }
     shell=add('FIRST-PARTY OFFLINE FILES',missing.length===0,
       missing.length?'Missing '+missing.join(', '):'App shell and three local map engines cached.');
   }catch(error){add('FIRST-PARTY OFFLINE FILES',false,'Cache check failed: '+String(error?.message||error))}
   else if(!sw)add('FIRST-PARTY OFFLINE FILES',false,'Cannot verify before the worker controls this page.');
   let pack=null;
   try{pack=await window.FIELD_OFFLINE_MAPS?.active?.()}catch{}
   const saved=add('SAVED REGIONAL MAP',!!pack?.blob?.size,
     pack?.blob?.size?'Saved in this browser: '+String(pack.name||'map'):'No saved archive. Import or download one while online.');
   let renderer=false,header=null,archive=null;
   if(saved){
     // A locally installed vendor bundle is required. No remote CDN is
     // consulted by this check, even if navigator.onLine incorrectly says true.
     const needed=[['pmtiles','./vendor/pmtiles/pmtiles.js'],['protomapsL','./vendor/protomaps-leaflet/protomaps-leaflet.js']];
     for(const [globalName,path] of needed){
       if(window[globalName])continue;
       if(!shell)break;
       try{await new Promise((resolve,reject)=>{
         const script=document.createElement('script');script.src=path;
         script.onload=resolve;script.onerror=()=>reject(Error('Local vendor library missing: '+path));
         document.head.appendChild(script);
       })}catch{}
     }
     renderer=!!(window.L&&window.pmtiles?.PMTiles&&window.pmtiles?.FileSource&&window.protomapsL?.leafletLayer);
     add('OFFLINE MAP RENDERER',renderer,renderer?'Leaflet, PMTiles and Protomaps loaded locally.':'A required offline map library did not load.');
   }else add('OFFLINE MAP RENDERER',false,'A saved map is required before renderer verification.');
   let headerOk=false;
   if(saved&&renderer){
     try{
       const file=pack.blob instanceof File?pack.blob:new File([pack.blob],pack.name||'offline.pmtiles');
       archive=new window.pmtiles.PMTiles(new window.pmtiles.FileSource(file));
       header=await archive.getHeader();
       const test=archiveHeader(header);headerOk=test.ok;
       add('ACTUAL ARCHIVE HEADER',headerOk,test.reason);
     }catch(error){add('ACTUAL ARCHIVE HEADER',false,'Stored map could not be read: '+String(error?.message||error))}
   }else add('ACTUAL ARCHIVE HEADER',false,'Archive cannot be opened until the renderer and saved file are available.');
   const route=window.FIELD_ROUTE_STATE?.getPoints?.()||[];
   const samples=route.length>=2?[route[0],route[Math.floor(route.length/2)],route.at(-1)]:
     header?[{lat:header.centerLat,lon:header.centerLon}]:[];
   let readCount=0;
   if(headerOk){
     const probes=await Promise.all(samples.map(p=>samplePoint(archive,header,p)));
     readCount=probes.filter(x=>x.ok).length;
     add('ACTUAL LOCAL MAP TILES',readCount===samples.length&&samples.length>0,
       samples.length?readCount+'/'+samples.length+' sampled '+(route.length>=2?'route locations':'pack center')+
         ' have readable offline tiles.': 'No route or valid map center to sample.');
   }else add('ACTUAL LOCAL MAP TILES',false,'No local tile samples could be read.');
   let persisted=null;
   try{persisted=await navigator.storage?.persisted?.()}catch{}
   add('STORAGE RETENTION',persisted===true,
     persisted===true?'Browser granted persistent storage.':
       'Storage may be evicted. Keep a backup and check iPhone free space.');
   const critical=rows.filter(x=>!['STORAGE RETENTION'].includes(x.name));
   return {ready:critical.every(x=>x.ok),rows,pack:pack?.name||'',samples:readCount,
     samplingOnly:true,persistent:persisted===true,vendor:VENDOR};
 }
 function paint(result){
   label('offlineFlightStatus',result.ready?'BROWSER CHECKS PASS — AIRPLANE TEST REQUIRED':'NOT READY FOR OFFLINE TRAVEL');
   const list=document.getElementById('offlineFlightDetails');
   if(list){list.replaceChildren();for(const item of result.rows){
     const row=document.createElement('p'),bold=document.createElement('b');
     bold.textContent=(item.ok?'PASS — ':'CHECK — ')+item.name+': ';
     row.append(bold,document.createTextNode(item.detail));list.append(row);
   }}
 }
 async function run(){
   if(inflight)return inflight;
   label('offlineFlightStatus','CHECKING LOCAL FILES + ARCHIVE…');
   const btn=document.getElementById('runOfflineFlightCheck');
   if(btn)btn.disabled=true;
   inflight=inspect().then(result=>{paint(result);return result})
     .catch(error=>{label('offlineFlightStatus','CHECK FAILED — '+String(error?.message||error));throw error})
     .finally(()=>{if(btn)btn.disabled=false;inflight=null});
   return inflight;
 }
 document.getElementById('runOfflineFlightCheck')?.addEventListener('click',()=>{void run().catch(()=>{})});
 window.FIELD_AIRPLANE_CHECK={run,inspect,archiveHeader,mapTileXY,samplePoint,requiredFiles:ESSENTIAL};
})();
