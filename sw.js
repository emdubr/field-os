const CACHE='field-os-v3-52';
const ASSETS=['./','./index.html','./styles.css?v=3.52','./app.js?v=3.52','./workstation.css?v=3.52','./workstation.js?v=3.52','./survival-data.js','./route-state.js?v=3.52','./map-engine.js?v=3.52','./route-planner.js?v=3.52','./field-intel.js?v=3.52','./field-ops.js?v=3.52','./field-tools.js?v=3.52','./manifest.webmanifest','./icon.svg'];
const EXTERNAL_ASSETS=[
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js'
];
self.addEventListener('install',e=>e.waitUntil(
  caches.open(CACHE).then(async c=>{
    await c.addAll(ASSETS);
    await Promise.all(EXTERNAL_ASSETS.map(url=>c.add(url).catch(()=>null)));
  }).then(()=>self.skipWaiting())
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
  const shellAsset=ASSETS.some(path=>new URL(path,self.location.href).href===url.href)&&url.pathname!==new URL('./',self.location.href).pathname&&!url.pathname.endsWith('/index.html');
  if(shellAsset){
    e.respondWith(caches.open(CACHE).then(async c=>{const hit=await c.match(e.request);if(hit)return hit;const r=await fetch(e.request);if(r.ok){const copy=r.clone();e.waitUntil(c.put(e.request,copy));}return r;}));
    return;
  }
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request)));
});

self.addEventListener('message',e=>{if(e.data?.type==='SKIP_WAITING')self.skipWaiting()});

