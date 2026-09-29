const CACHE='field-os-v1-9';
const ASSETS=['./','./index.html','./styles.css','./app.js?v=1.9','./workstation.css?v=1.9','./workstation.js?v=1.9','./survival-data.js','./manifest.webmanifest','./icon.svg'];
const EXTERNAL_ASSETS=[
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js',
  'https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js'
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
  e.respondWith(fetch(e.request).then(r=>{if(r.ok){const copy=r.clone();e.waitUntil(caches.open(CACHE).then(c=>c.put(e.request,copy)));}return r;}).catch(()=>caches.match(e.request)));
});
