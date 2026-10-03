/* FIELD/OS installed-app cache. User data/maps live outside this disposable shell cache. */
const CACHE='field-os-v3-85-plwheel1';
const ASSETS=['./','./index.html','./styles.css?v=3.85-fieldfix1','./canvas-utils.js?v=3.85-optcanvas2','./app.js?v=3.85-plwheel1','./workstation.css?v=3.85-gradeview1','./workstation.js?v=3.85-gradeview1','./survival-data.js','./route-state.js?v=3.85','./runtime.js?v=3.85-fieldfix1','./map-engine.js?v=3.85-desktop1','./route-planner.js?v=3.85-plwheel1','./field-intel.js?v=3.85-fieldfix1','./field-ops.js?v=3.85','./route-guidance.js?v=3.85','./map-readiness.js?v=3.85','./field-tools.js?v=3.85-opt3','./safety-sync.js?v=3.85-hotfix1','./track-store.js?v=3.85-fieldfix1','./geo-hub.js?v=3.85-opt2','./manifest.webmanifest','./icon.svg'];
const EXTERNAL_ASSETS=[
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js',
  'https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js',
  'https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-icon-2x.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/marker-shadow.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/layers.png',
  'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/images/layers-2x.png'
];
const FALLBACK_ASSETS=[
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  'https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js',
  'https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js'
];
const EXTERNAL_ALLOWED=new Set([...EXTERNAL_ASSETS,...FALLBACK_ASSETS]);
const CRITICAL=ASSETS.filter(path=>!['./','./manifest.webmanifest','./icon.svg'].includes(path));
const OFFLINE_TIMEOUT_MS=3500;
const shellCacheName=k=>/^field-os-v\d+(?:-\d+)*(?:-(?:opt|safety|fieldfix|gpsfix|wheel|mobile|horizon|gradeview|arrow|gcache|desktop|plwheel)[A-Za-z0-9_-]+)?$/.test(k);
const offlineResponse=()=>typeof Response==='function'
  ?new Response('FIELD/OS resource unavailable offline',{status:503,statusText:'Offline',headers:{'Content-Type':'text/plain; charset=utf-8'}})
  :Response.error();
// A fetch that cannot connect must not hang the app shell forever on weak cellular.
async function limitedFetch(req,ms=OFFLINE_TIMEOUT_MS){
  const controller=typeof AbortController==='function'?new AbortController():null;
  let timer;
  const pending=Promise.resolve().then(()=>fetch(req,controller?{signal:controller.signal}:undefined))
    .catch(()=>null);
  const timeout=new Promise(resolve=>{
    timer=setTimeout(()=>{controller?.abort();resolve(null)},ms);
  });
  try{return await Promise.race([pending,timeout])}
  finally{clearTimeout(timer)}
}
self.addEventListener('install',event=>event.waitUntil(
  caches.open(CACHE).then(async cache=>{
    // Critical core stays transactional. Optional icons, shell index alias and
    // externally hosted map libraries cannot prevent a functional app update.
    await cache.addAll(CRITICAL);
    await Promise.all(ASSETS.filter(x=>!CRITICAL.includes(x)).map(url=>cache.add(url).catch(()=>null)));
    await Promise.all(EXTERNAL_ASSETS.map(url=>cache.add(url).catch(()=>null)));
  })
));
self.addEventListener('activate',event=>event.waitUntil(
  caches.keys().then(keys=>Promise.all(keys.filter(k=>shellCacheName(k)&&k!==CACHE).map(k=>caches.delete(k))))
    .then(()=>self.clients.claim())
));
self.addEventListener('fetch',event=>{
  const req=event.request;
  if(req.method!=='GET')return;
  const url=new URL(req.url),same=url.origin===self.location.origin,external=EXTERNAL_ALLOWED.has(url.href);
  if(!same&&!external)return;
  if(external){
    event.respondWith((async()=>{
      const cached=await caches.match(req);
      if(cached)return cached;
      try{
        const response=await limitedFetch(req);
        if(response&&(response.ok||response.type==='opaque')){
          event.waitUntil(caches.open(CACHE).then(cache=>cache.put(req,response.clone())));
          return response;
        }
      }catch{}
      return offlineResponse();
    })());
    return;
  }
  const fallback=async(req,ignoreSearch=false)=>{
    const cache=await caches.open(CACHE);
    return await cache.match(req,ignoreSearch?{ignoreSearch:true}:undefined)||offlineResponse();
  };
  if(req.mode==='navigate'){
    event.respondWith((async()=>{
      const response=await limitedFetch(req);
      if(response?.ok){
        // Do not mix arbitrary deep links with shell precache; store canonical index.
        event.waitUntil(caches.open(CACHE).then(c=>c.put('./index.html',response.clone())));
        return response;
      }
      const cache=await caches.open(CACHE);
      return await cache.match('./index.html')||await cache.match('./')||offlineResponse();
    })());
    return;
  }
  const isShell=ASSETS.some(path=>new URL(path,self.location.href).href===url.href)
    &&url.pathname!==new URL('./',self.location.href).pathname&&!url.pathname.endsWith('/index.html');
  if(isShell){
    event.respondWith((async()=>{
      const response=await limitedFetch(req);
      if(response?.ok){
        event.waitUntil(caches.open(CACHE).then(c=>c.put(req,response.clone())));
        return response;
      }
      return fallback(req,true);
    })());
    return;
  }
  event.respondWith((async()=>{
    const response=await limitedFetch(req);
    if(response?.ok){
      event.waitUntil(caches.open(CACHE).then(c=>c.put(req,response.clone())));
      return response;
    }
    return await caches.match(req)||offlineResponse();
  })());
});
self.addEventListener('message',event=>{
  if(event.data?.type==='GET_BUILD')event.ports?.[0]?.postMessage({build:CACHE});
  if(event.data?.type==='SKIP_WAITING')self.skipWaiting();
});
