const CACHE='field-os-v3-85-opt3';
const ASSETS=['./','./index.html','./styles.css?v=3.85-opt2','./app.js?v=3.85-opt2','./workstation.css?v=3.85','./workstation.js?v=3.85','./survival-data.js','./route-state.js?v=3.85','./runtime.js?v=3.85','./map-engine.js?v=3.85-terrain1','./route-planner.js?v=3.85','./field-intel.js?v=3.85','./field-ops.js?v=3.85','./route-guidance.js?v=3.85','./map-readiness.js?v=3.85','./field-tools.js?v=3.85-opt3','./safety-sync.js?v=3.85-hotfix1','./track-store.js?v=3.85-opt2','./geo-hub.js?v=3.85-opt2','./manifest.webmanifest','./icon.svg'];
const EXTERNAL_ASSETS=[
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js',
  'https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js'
];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(async c=>{
    await c.addAll(ASSETS);
    await Promise.all(EXTERNAL_ASSETS.map(url=>c.add(url).catch(()=>null)));
  })
));
self.addEventListener('activate',e=>e.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('field-os-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())
));
self.addEventListener('fetch',e=>{
  if(e.request.method!=='GET')return;
  const url=new URL(e.request.url);
  const same=url.origin===self.location.origin;
  const external=EXTERNAL_ASSETS.includes(url.href);
  if(!same&&!external)return;
  if(external){
    e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok||r.type==='opaque'){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;})));
    return;
  }
  if(e.request.mode==='navigate'){
    e.respondWith(fetch(e.request).then(r=>{
      if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put('./index.html',copy)));}
      return r;
    }).catch(async()=>{
      const cache=await caches.open(CACHE);
      return (await cache.match('./index.html'))||(await cache.match('./'))||Response.error();
    }));
    return;
  }
  const shellAsset=ASSETS.some(path=>new URL(path,self.location.href).href===url.href)&&url.pathname!==new URL('./',self.location.href).pathname&&!url.pathname.endsWith('/index.html');
  if(shellAsset){
    // Refresh application code/UI from the network while online. Cached shell
    // files remain the fallback for offline field use.
    e.respondWith(caches.open(CACHE).then(async c=>{
      try{
        const r=await fetch(e.request);
        if(r.ok){const copy=r.clone();e.waitUntil(c.put(e.request,copy))}
        return r;
      }catch{
        return (await c.match(e.request))||(await c.match(e.request,{ignoreSearch:true}))||Response.error();
      }
    }));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request)));
});

self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});

