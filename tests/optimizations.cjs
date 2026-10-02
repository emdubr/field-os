const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
const {JSDOM}=require('jsdom');const root=path.resolve(__dirname,'..');
function page(){
 const dom=new JSDOM('<!doctype html><body></body>',{url:'https://field.test/',runScripts:'outside-only',pretendToBeVisual:true});
 return {w:dom.window,run:name=>vm.runInContext(fs.readFileSync(path.join(root,name),'utf8'),dom.getInternalVMContext(),{filename:name}),close:()=>dom.window.close()};
}
(async()=>{
 const {w,run,close}=page();
 let watches=0,clears=0,lastFix=null,callbacks=new Map();
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{
  watchPosition(cb,err,options){const id=++watches;callbacks.set(id,{cb,options});return id;},
  clearWatch(id){clears++;callbacks.delete(id);}
 }});
 run('geo-hub.js');
 const hub=w.FIELD_GEO_HUB;let map=0,track=0;
 const a=hub.subscribe(()=>map++,()=>{},{role:'map'});
 const b=hub.subscribe(()=>track++,()=>{},{role:'track'});
 assert.equal(watches,1,'map+recorder should share a single native watcher');
 const first=callbacks.values().next().value;first.cb({coords:{latitude:44,longitude:-73}});
 assert.equal(map,1);assert.equal(track,1);
 hub.setPowerMode('low');assert.equal(watches,1,'active tracking retains high GPS accuracy');
 hub.unsubscribe(b);assert.equal(watches,2,'low-power mode takes effect after recorder stops');
 assert.equal(callbacks.values().next().value.options.enableHighAccuracy,false);
 hub.unsubscribe(a);assert.equal(callbacks.size,0);assert.equal(clears,2);
 close();
 console.log('PASS shared GPS subscriptions, raw fix fanout, low-power reconfiguration, watch cleanup');

 const fallback=page();const p=fallback.w;
 Object.defineProperty(p,'indexedDB',{value:undefined,configurable:true});
 p.localStorage.setItem('fieldos-v12-track',JSON.stringify([{lat:44.4,lon:-73.2,time:'2026-10-01T00:00:00.000Z'}]));
 fallback.run('track-store.js');
 const store=p.FIELD_TRACK_STORE,init=await store.hydrate();
 assert.equal(init.persistent,false);
 assert.equal(init.points.length,1,'legacy track survives private-browsing IDB failure');
 store.append({lat:44.41,lon:-73.19,time:'2026-10-01T00:00:05.000Z'});
 const rows=await store.all();assert.equal(rows.length,2,'small crash journal keeps a recent point without IndexedDB');
 await store.clear();assert.equal((await store.all()).length,0,'clear removes fallback and journal');
 fallback.close();
 console.log('PASS track fallback, legacy preservation, crash journal, and clear without IndexedDB');

 const sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),app=fs.readFileSync(path.join(root,'app.js'),'utf8');
 assert.match(sw,/addEventListener\('message'[\s\S]*SKIP_WAITING/);
 assert.ok(!sw.includes('}).then(()=>self.skipWaiting())'),'worker installation must not unilaterally activate');
 assert.ok(app.includes('if(approved){approved=false;location.reload();return}'),'reload only after approval');
 console.log('PASS PWA activation requires an explicit user-approved update');
})().catch(e=>{console.error(e);process.exitCode=1});
