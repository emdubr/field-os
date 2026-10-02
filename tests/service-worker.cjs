const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const handlers={},cached={shell:true},location={origin:'https://field.test',href:'https://field.test/field-os/sw.js'};
 let network=0,offline=false,exactShell=true,hang=false,added=[],deleted=[];
 const cache={
   match:async(req,opts={})=>{
     const href=typeof req==='string'?req:req?.url||'';
     if(href==='./index.html'||href==='./'||href.endsWith('/index.html'))return cached;
     if(href.includes('field-tools.js'))return exactShell||opts.ignoreSearch?cached:null;
     return null;
   },
   put:async()=>{},addAll:async(paths)=>{added.push(...paths)},add:async url=>{if(url.includes('marker-icon.png'))throw Error('Optional CDN unavailable');added.push(url)}
 };
 const ctx={
   URL,Promise,setTimeout,clearTimeout,Response:{error:()=>({error:true})},
   self:{location,addEventListener:(name,fn)=>handlers[name]=fn,clients:{claim:async()=>{}},skipWaiting:()=>{}},
   caches:{open:async()=>cache,match:(req,opts)=>cache.match(req,opts),keys:async()=>['field-os-v3-84-safety1','field-os-map-pack-northeast','field-os-v3-85-fieldfix1','field-os-v3-85-wheel2','field-os-v3-85-mobile1','field-os-v3-85-arrow1'],delete:async key=>{deleted.push(key);return true}},
   fetch:async()=>{network++;if(hang)return new Promise(()=>{});if(offline)throw Error('Offline');return {ok:true,network:true,clone(){return this}}}
 };
 const swText=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8'),html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 vm.runInNewContext(swText.replace('const OFFLINE_TIMEOUT_MS=3500;','const OFFLINE_TIMEOUT_MS=30;'),ctx);
 let installation;handlers.install({waitUntil:p=>installation=p});await installation;
 assert.ok(added.some(u=>u.includes('app.js')),'critical application assets precached');
 let activation;handlers.activate({waitUntil:p=>activation=p});await activation;
 assert.deepEqual(deleted,['field-os-v3-84-safety1','field-os-v3-85-fieldfix1','field-os-v3-85-wheel2','field-os-v3-85-mobile1','field-os-v3-85-arrow1'],'activation must remove only old app shells, never map packs');
 const version=(html.match(/app\.js\?v=([\d.]+)/)||[])[1];assert.ok(version,'index asset version missing');
 let activeCache=null;handlers.message({data:{type:'GET_BUILD'},ports:[{postMessage:msg=>activeCache=msg.build}]});
 assert.equal(activeCache,'field-os-v3-85-gcache1','worker reports actual installed shell cache');
 assert.match(html,/id="fieldBuildLabel"/,'page exposes loaded client build');
 assert.ok(swText.includes('app.js?v=3.85-gcache1'),'new worker caches updated application logic');
 assert.ok(swText.includes('https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'));
 assert.ok(swText.includes('https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js'));
 assert.ok(swText.includes('https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js'));
 for(const asset of ['styles.css','workstation.css','route-state.js','runtime.js','app.js','workstation.js','map-engine.js','route-planner.js','field-intel.js','field-ops.js','route-guidance.js','map-readiness.js','field-tools.js'])assert.ok(swText.includes(`${asset}?v=${version}`),`service worker version drift: ${asset}`);
 const request=async(path,mode='same-origin')=>{let promise;handlers.fetch({request:{method:'GET',mode,url:new URL(path,location.href).href},respondWith:p=>promise=p,waitUntil(){}});return await promise};

 const fresh=await request(`./field-tools.js?v=${version}-opt3`);assert.equal(fresh.network,true);assert.equal(network,1);
 exactShell=false;offline=true;
 assert.equal(await request(`./field-tools.js?v=${version}-opt3`),cached,'versioned shell should recover via ignoreSearch cache match');assert.equal(network,2);
 offline=false;
 const page=await request('./','navigate');assert.equal(page.network,true);assert.equal(network,3);
 offline=true;assert.equal(await request('./','navigate'),cached);
 hang=true;offline=false;const began=Date.now();
 const slow=await request(`./field-tools.js?v=${version}-opt3`);
 assert.equal(slow,cached,'slow mobile network must recover from cached app');
 assert.ok(Date.now()-began<250,'slow network must not hang startup');
 hang=false;offline=true;
 const missing=await request('./unavailable-resource.json');
 assert.equal(missing.error,true,'unavailable resource must resolve to a real offline error');
 console.log('PASS optional precache failures, protected map data, bounded weak-network fallback, offline error responses');
})().catch(e=>{console.error(e);process.exitCode=1});
