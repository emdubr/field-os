'use strict';
const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const sw=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8');
const CDN='https://cdn.jsdelivr.net/npm/',BACKUP='https://unpkg.com/';
const leaflet='leaflet@1.9.4/dist/leaflet.js',pmtiles='pmtiles@4.5.0/dist/pmtiles.js';
const leafletCss='leaflet@1.9.4/dist/leaflet.css';
const resource=source=>({ok:true,type:'cors',source,clone(){return resource(source)}});
function worker({saved=[],network={},failedAdds=[]}={}){
  const handlers={},store=new Map(saved.map(([url,data])=>[url,resource(data)]));
  const requests=[],writes=[],deleted=[],waits=[],adds=[];
  const key=req=>typeof req==='string'?req:req.url;
  const cache={
    match:async req=>store.get(key(req))||null,
    put:async(req,response)=>{writes.push(key(req));store.set(key(req),response)},
    addAll:async urls=>{adds.push(...urls)},
    add:async url=>{if(failedAdds.includes(url))throw Error('CDN down');store.set(url,resource('install '+url))}
  };
  const ctx={
    URL,Promise,setTimeout,clearTimeout,
    Response:{error:()=>({error:true,status:503})},
    fetch:async req=>{const url=key(req);requests.push(url);if(!network[url])throw Error('offline');return resource(network[url])},
    self:{
      location:{origin:'https://field.test',href:'https://field.test/field-os/sw.js'},
      addEventListener:(name,fn)=>handlers[name]=fn,
      clients:{claim:async()=>{}},skipWaiting(){}
    },
    caches:{
      open:async()=>cache,
      keys:async()=>['field-os-v3-85-cssfix2','field-os-map-pack-northeast'],
      delete:async name=>{deleted.push(name);return true},
      match:async()=>{throw Error('Old unrelated cache must not satisfy pinned vendor requests')}
    }
  };
  vm.runInNewContext(sw.replace('const OFFLINE_TIMEOUT_MS=3500;','const OFFLINE_TIMEOUT_MS=20;'),ctx);
  const run=async type=>{
    let promise;
    handlers[type]({waitUntil:p=>promise=p});
    await promise;
  };
  const request=async url=>{
    let result;
    handlers.fetch({request:{method:'GET',mode:'no-cors',url},
      respondWith:p=>result=p,waitUntil:p=>waits.push(p)});
    const reply=await result;await Promise.all(waits.splice(0));return reply;
  };
  return {run,request,store,requests,writes,deleted,adds};
}
(async()=>{
  assert.match(sw,/leaflet@1\\.9\\.4/,'only pinned Leaflet may be substituted');
  assert.match(sw,/protomaps-leaflet@5\\.1\\.0/);
  {
    const w=worker({saved:[[BACKUP+pmtiles,'cached backup PMTiles']]});
    const first=await w.request(CDN+pmtiles);
    assert.equal(first.source,'cached backup PMTiles');
    assert.deepEqual(w.requests,[],'offline request must use an already-cached exact backup, not cellular');
    assert.equal(w.store.get(CDN+pmtiles)?.source,'cached backup PMTiles','alias primary after backup hit');
    const reverse=await w.request(BACKUP+pmtiles);
    assert.equal(reverse.source,'cached backup PMTiles');
    console.log('PASS offline pinned CDN fallback from existing backup and automatic alias');
  }
  {
    const w=worker({network:{[BACKUP+leaflet]:'live backup Leaflet'}});
    const first=await w.request(CDN+leaflet);
    assert.equal(first.source,'live backup Leaflet');
    assert.deepEqual(w.requests,[CDN+leaflet,BACKUP+leaflet],'try exact alternate only when primary fails');
    assert.equal(w.store.get(CDN+leaflet)?.source,'live backup Leaflet');
    await w.request(CDN+leaflet);
    assert.equal(w.requests.length,2,'successful backup should be reusable offline without a new request');
    console.log('PASS pinned network fallback, response alias and zero repeat requests');
  }
  {
    const w=worker({saved:[[BACKUP+leaflet,'javascript must not satisfy stylesheet']]});
    const css=await w.request(CDN+leafletCss);
    assert.equal(css.error,true,'a different asset type is not an acceptable offline fallback');
    assert.ok(!w.store.has(CDN+leafletCss),'missing styles must not be silently cached as scripts');
    console.log('PASS incorrect vendor type rejected and explicit offline failure retained');
  }
  {
    const w=worker({failedAdds:[CDN+leaflet],network:{[BACKUP+leaflet]:'backup install Leaflet'}});
    await w.run('install');
    assert.ok(w.adds.some(x=>x.includes('app.js')),'critical shell still installs');
    assert.equal(w.store.get(CDN+leaflet)?.source,'backup install Leaflet',
      'primary CDN pre-cache failure must recover using pinned alternate');
    await w.run('activate');
    assert.deepEqual(w.deleted,['field-os-v3-85-cssfix2'],
      'activation prunes only obsolete shell cache and never offline map packs');
    console.log('PASS install-time backup, intact core shell and protected saved map packs');
  }
})().catch(e=>{console.error(e);process.exitCode=1});
