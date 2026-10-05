'use strict';
/* Chromium with an ACTUAL service worker, actual first-party map bundles,
 * an IndexedDB vector PMTiles fixture and all network disabled after install.
 * This is a browser simulation, not physical-iPhone acceptance testing.
 */
const {chromium}=require('playwright'),fs=require('node:fs'),
 http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
 const type={'.js':'application/javascript','.css':'text/css','.html':'text/html',
  '.json':'application/json','.webmanifest':'application/manifest+json',
  '.svg':'image/svg+xml','.png':'image/png','.md':'text/plain'};
 res.setHeader('Content-Type',type[path.extname(file)]||'application/octet-stream');
 try{res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
function littleArchive(){
 // One z0/0/0 MVT vector tile with an empty but valid protobuf layer.
 const tile=Buffer.from([0x1a,0x0a,0x0a,0x03,0x66,0x6f,0x6f,0x28,0x80,0x20,0x78,0x02]);
 const directory=Buffer.from([1,0,1,tile.length,0]),meta=Buffer.from('{}');
 const header=Buffer.alloc(127);
 header.write('PMTiles',0,'ascii');header.writeUInt8(3,7);
 const put64=(pos,val)=>header.writeBigUInt64LE(BigInt(val),pos);
 const rootOffset=127,metadataOffset=rootOffset+directory.length,tileOffset=metadataOffset+meta.length;
 for(const [pos,val] of [[8,rootOffset],[16,directory.length],[24,metadataOffset],[32,meta.length],
  [40,tileOffset],[48,0],[56,tileOffset],[64,tile.length],[72,1],[80,1],[88,1]])put64(pos,val);
 header[96]=1;header[97]=1;header[98]=1;header[99]=1;header[100]=0;header[101]=0;
 header.writeInt32LE(-1800000000,102);header.writeInt32LE(-850000000,106);
 header.writeInt32LE(1800000000,110);header.writeInt32LE(850000000,114);
 header[118]=0;
 return Buffer.concat([header,directory,meta,tile]);
}
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'allow'});
  const page=await context.newPage(),origin='http://127.0.0.1:'+server.address().port;
  await page.route('https://**/*',route=>route.abort());
  await page.goto(origin+'/',{waitUntil:'load',timeout:20000});
  await page.waitForFunction(()=>!!navigator.serviceWorker?.controller,{timeout:15000});
  const online=await page.evaluate(async()=>{
   const cache=await caches.open('field-os-v3-85-trailcache1');
   const required=['vendor/leaflet/leaflet.js','vendor/leaflet/leaflet.css',
    'vendor/pmtiles/pmtiles.js','vendor/protomaps-leaflet/protomaps-leaflet.js'];
   return Promise.all(required.map(async file=>[file,!!await cache.match(new URL(file,location.href).href)]));
  });
  assert.ok(online.every(row=>row[1]),'offline worker must cache every local renderer: '+JSON.stringify(online));
  console.log('PASS installed worker cached all four same-origin mapping assets');
  const bytes=[...littleArchive()];
  await page.evaluate(async array=>{
   const file=new File([new Uint8Array(array)],'fixture-vector.pmtiles',{type:'application/octet-stream'});
   const db=await new Promise((resolve,reject)=>{
    const req=indexedDB.open('fieldos-offline-maps-v1',1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains('packs'))req.result.createObjectStore('packs',{keyPath:'id'})};
    req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
   });
   await new Promise((resolve,reject)=>{
    const tx=db.transaction('packs','readwrite');
    tx.objectStore('packs').put({id:'airplane-fixture',name:'fixture-vector.pmtiles',
     size:file.size,blob:file,created:new Date().toISOString(),source:'import',tileType:1,
     minZoom:0,maxZoom:0,bounds:[-180,-85,180,85],center:[0,0,0]});
    tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
   });
   db.close();
   localStorage.setItem('fieldos-v12-map-pack','airplane-fixture');
   localStorage.setItem('fieldos-v12-map-source','offline');
  },bytes);
  const external=[];
  page.on('request',r=>{if(r.url().startsWith('https://'))external.push(r.url())});
  await context.setOffline(true);
  await page.reload({waitUntil:'load',timeout:20000});
  await page.waitForFunction(()=>document.getElementById('boot')?.classList.contains('hidden'),{timeout:12000});
  const check=await page.evaluate(async()=>await FIELD_AIRPLANE_CHECK.run());
  assert.equal(check.ready,true,'real offline install + stored regional fixture must pass: '+JSON.stringify(check.rows));
  assert.equal(check.samples,1,'the browser must read an actual tile from IndexedDB through the local PMTiles library');
  assert.equal(check.rows.find(x=>x.name==='FIRST-PARTY OFFLINE FILES')?.ok,true);
  assert.equal(check.rows.find(x=>x.name==='OFFLINE MAP RENDERER')?.ok,true);
  assert.deepEqual(external,[],'reloading offline app and verifying a stored pack must not attempt CDN requests');
  console.log('PASS offline PWA reload with no network, browser IndexedDB vector tile and complete local renderer');
  // Raw tile reads are not enough: exercise the actual interactive Map view
  // while Chromium is offline and assert Leaflet has attached this local pack.
  await page.evaluate(()=>window.FIELD_OPEN_VIEW('map'));
  await page.waitForFunction(()=>
    window.FIELD_OFFLINE_MAPS?.displayed?.('realMap')?.kind==='offline:airplane-fixture',
    {timeout:10000});
  const mounted=await page.evaluate(()=>({
    source:window.FIELD_OFFLINE_MAPS.displayed('realMap')?.kind,
    visible:!document.getElementById('realMap').hidden,
    leaflet:!!document.querySelector('#realMap .leaflet-pane'),
    layers:document.querySelectorAll('#realMap .leaflet-layer').length
  }));
  assert.equal(mounted.visible,true,'interactive offline map must be visible, not a schematic placeholder');
  assert.equal(mounted.source,'offline:airplane-fixture');
  assert.ok(mounted.leaflet&&mounted.layers>0,'real offline PMTiles basemap must be mounted by Leaflet');
  assert.deepEqual(external,[],'offline interactive Map view must not contact online raster or CDN servers');
  console.log('PASS actual interactive offline map displays the selected IndexedDB PMTiles layer');

  await page.evaluate(()=>{localStorage.removeItem('fieldos-v12-map-pack')});
  await page.reload({waitUntil:'load',timeout:20000});
  const recovered=await page.evaluate(async()=>await FIELD_AIRPLANE_CHECK.run());
  assert.equal(recovered.ready,true,'the app should recover an intact saved archive when its selection is lost');
  console.log('PASS recovery from missing selection while a usable regional map survives in IndexedDB');
  // A real no-map scenario removes both the active selection and the stored
  // archive; an absent selection alone is not evidence that coverage is lost.
  await page.evaluate(async()=>{
    const db=await new Promise((resolve,reject)=>{
      const req=indexedDB.open('fieldos-offline-maps-v1',1);
      req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);
    });
    await new Promise((resolve,reject)=>{
      const tx=db.transaction('packs','readwrite');
      tx.objectStore('packs').delete('airplane-fixture');
      tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error);
    });
    db.close();
    localStorage.removeItem('fieldos-v12-map-pack');
  });
  await page.reload({waitUntil:'load',timeout:20000});
  const absent=await page.evaluate(async()=>await FIELD_AIRPLANE_CHECK.run());
  assert.equal(absent.ready,false,'missing archive must never report offline readiness');
  assert.equal(absent.rows.find(x=>x.name==='SAVED REGIONAL MAP')?.ok,false);
  console.log('PASS honest warning when neither a selected map nor a stored regional archive exists');
 }finally{await browser?.close();await new Promise(r=>server.close(r))}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
