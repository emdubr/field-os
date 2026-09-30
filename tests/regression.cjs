const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dir=require('path').resolve(__dirname,'..');const errors=[],alerts=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/not implemented/i.test(e.message))errors.push(e.message)});
const dom=new JSDOM(fs.readFileSync(dir+'/index.html','utf8'),{url:'https://test.local/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
w.isSecureContext=true;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.alert=x=>alerts.push(x);w.confirm=()=>true;w.fetch=async()=>{throw new Error('Offline test')};w.ResizeObserver=class {observe(){} disconnect(){}};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.FIELD_MAP_ENGINE_EXTERNAL=true;
const ctx=dom.getInternalVMContext(),run=s=>vm.runInContext(s,ctx),click=id=>d.getElementById(id).click(),tick=()=>new Promise(r=>setTimeout(r,20));
for(const f of ['survival-data.js','route-state.js','app.js','workstation.js','map-engine.js'])vm.runInContext(fs.readFileSync(dir+'/'+f,'utf8'),ctx,{filename:f});
let mapClick;const chain=()=>({addTo(){return this},clearLayers(){},on(event,fn){if(event==='click')mapClick=fn;return this},setView(){return this},fitBounds(){},invalidateSize(){},bindTooltip(){return this},setOpacity(){}});
w.L={map:chain,tileLayer:chain,layerGroup:chain,polyline:chain,circleMarker:chain};
let planner=fs.readFileSync(dir+'/route-planner.js','utf8');planner=planner.replace('window.FIELD_ROUTE_PLANNER={','window.TEST_ROUTER={buildGraph,nearestNode,shortestPath,meters,samplePolyline,fetchElevationProfile,routeLeg,addAnchor,clearAll,displayTrailSections};window.FIELD_ROUTE_PLANNER={');vm.runInContext(planner,ctx,{filename:'route-planner.js'});
(async()=>{
 await tick();
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'duplicate HTML ids');
 for(const btn of d.querySelectorAll('.workstation-nav button')){btn.click();await tick();assert.equal(d.querySelector('.view.active').id,btn.dataset.open);if(btn.dataset.open!=='home')assert.ok(d.querySelector('.view.active .ws-card-body'),'module details initialized');}
 console.log('PASS all 16 modules initialize and navigation changes active view');
 for(const theme of ['amber','red','mono','green']){d.querySelector(`[data-theme-choice="${theme}"]`).click();await tick();assert.equal(d.body.dataset.theme,theme);assert.equal(w.localStorage.getItem('fieldos-v12-theme'),theme)}
 console.log('PASS four themes and preference persistence');
 d.getElementById('waypointName').value='QA Base';click('setBaseWaypoint');await tick();assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-waypoints'))[0].name,'QA Base');assert.match(d.getElementById('waypointList').textContent,/QA Base/);
 d.getElementById('tripName').value='QA Hike';click('saveTrip');assert.match(w.localStorage.getItem('fieldos-v12-trip'),/QA Hike/);
 console.log('PASS waypoint/base and trip persistence');
 d.querySelector('.workstation-nav [data-open="route"]').click();await tick();
 d.getElementById('routeSnapMode').value='direct';d.getElementById('routeSnapMode').dispatchEvent(new w.Event('change'));
 const r=w.TEST_ROUTER;r.addAnchor({lat:44.475,lon:-73.215});r.addAnchor({lat:44.48,lon:-73.21});await tick();
 assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);assert.ok(parseFloat(d.getElementById('routeDistance').textContent)>0);assert.match(d.getElementById('routeGainOut').textContent,/N\/A/);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,2);
 for(const id of ['homeRealMap','realMap']){assert.ok(d.querySelector('#'+id+' .planned-route-line'));assert.equal(d.querySelectorAll('#'+id+' .planned-route-marker').length,2)}
 const beforeRoute=d.querySelector('#homeRealMap .planned-route-line').getAttribute('points');
 click('reverseRoute');await tick();assert.notEqual(d.querySelector('#homeRealMap .planned-route-line').getAttribute('points'),beforeRoute);assert.equal(w.FIELD_ROUTE_STATE.getPoints()[0].lat,44.48);click('undoRoutePoint');await tick();assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,1);assert.equal(d.getElementById('reverseRoute').disabled,true);click('clearRoute');await tick();assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,0);
 assert.equal(d.querySelectorAll('.planned-route-line').length,0);
 console.log('PASS route overlays on both maps, reverse and clear synchronization');
 console.log('PASS direct routing, distance, missing elevation, reverse, undo, clear persistence');
 const g=r.buildGraph([{type:'way',id:1,nodes:[1,2,3],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.98},{lat:44.02,lon:-72.98}],tags:{highway:'path'}}]);
 const a=r.nearestNode(g,{lat:44.0001,lon:-72.995}),b=r.nearestNode(g,{lat:44.0001,lon:-72.99}),path=r.shortestPath(g,a.id,b.id);assert.ok(path.length===2);assert.ok(a.d<12&&b.d<12);assert.ok(r.meters(path[0],path[1])>390&&r.meters(path[0],path[1])<410);
 assert.equal(r.nearestNode(g,{lat:0,lon:0}),null);assert.equal(r.samplePolyline([{lat:44,lon:-73},{lat:44.01,lon:-73}],80)[0].distanceM,0);
 console.log('PASS trail-edge projection, same-segment route, distance, no-nearby-trail detection');
 w.fetch=async url=>({ok:true,json:async()=>url.includes('elevation')?{elevation:Array(new URL(url).searchParams.get('latitude').split(',').length).fill(100)}:{elements:[{type:'way',id:1,nodes:[1,2],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.98}],tags:{highway:'path'}}]}});
 d.getElementById('routeSnapMode').value='trail';r.addAnchor({lat:44.0001,lon:-72.995});r.addAnchor({lat:44.0001,lon:-72.99});await tick();await tick();
 assert.match(d.getElementById('routePlannerStatus').textContent,/SNAPPED TO OSM TRAILS/);assert.ok(w.FIELD_ROUTE_STATE.getPlan().elevationProfile.length>1);assert.match(d.getElementById('routeGainOut').textContent,/0 ft/);assert.ok(w.FIELD_ROUTE_STATE.getPlan().trailIntelligence);
 console.log('PASS snapped route with elevation success, saved profile, and post-enrichment trail intelligence');
 const merged=r.displayTrailSections([{result:{trailSections:[
   {label:'Long Trail',name:'Long Trail',surface:'wood',distanceM:1000},
   {label:'Long Trail',name:'Long Trail',surface:'grass',distanceM:500},
   {label:'Long Trail',name:'Long Trail',surface:'rock',distanceM:250}
 ]}}]);
 assert.equal(merged.length,1);assert.equal(merged[0].distanceM,1750);
 console.log('PASS named trail display merges surface changes into one total-distance row');
 const filtered=r.displayTrailSections([{result:{trailSections:[
   {label:'UNNAMED OSM PATH',name:null,ref:null,distanceM:80},
   {label:'UNNAMED OSM PATH',name:null,ref:null,distanceM:220},
   {label:'Long Trail',name:'Long Trail',ref:null,distanceM:20}
 ]}}]);
 assert.equal(filtered.length,2);assert.ok(filtered.some(x=>x.name==='Long Trail'));assert.ok(filtered.some(x=>!x.name&&x.distanceM>=160.9344));
 console.log('PASS short unnamed connector paths are hidden from the trail list');
 let extraRequests=0;w.fetch=async()=>{extraRequests++;throw new Error('Should reuse cached graph')};
 await r.routeLeg({lat:44.0001,lon:-72.994},{lat:44.0001,lon:-72.991});
 assert.equal(extraRequests,0);console.log('PASS nearby route edits reuse graph without network requests');
 const beforeReverse=w.FIELD_ROUTE_STATE.getPoints()[0];click('reverseRoute');
 assert.equal(extraRequests,0);assert.match(d.getElementById('routePlannerStatus').textContent,/NO DOWNLOAD NEEDED/);assert.notEqual(w.FIELD_ROUTE_STATE.getPoints()[0].lon,beforeReverse.lon);
 console.log('PASS instant reverse with no network or elevation lookup');
 // Abort a delayed route lookup; it must not restore cleared geometry or lock controls.
 w.fetch=(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('aborted'))));r.addAnchor({lat:44.04,lon:-73.01});await tick();assert.equal(d.getElementById('clearRoute').disabled,false);click('clearRoute');await tick();assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,0);assert.equal(d.getElementById('routeSnapMode').disabled,false);assert.equal(d.getElementById('undoRoutePoint').disabled,true);
 console.log('PASS cancellation while fetching; empty route and controls recover');
 const fileInput=d.getElementById('gpxImport');
 async function importGpx(text){Object.defineProperty(fileInput,'files',{configurable:true,value:[{name:'qa.gpx',size:text.length,text:async()=>text}]});fileInput.dispatchEvent(new w.Event('change'));await tick();}
 await importGpx('<gpx><trk><trkseg><trkpt lat="44" lon="-73"/><trkpt lat="44.01" lon="-73"/></trkseg></trk></gpx>');
 assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);assert.equal(w.FIELD_ROUTE_PLANNER.anchors[0].lat,44);
 assert.match(run('routeAsGPX()'),/lat="44.0000000"/);
 await importGpx('<gpx><trkpt lat="100" lon="-73"/></gpx>');assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);assert.ok(alerts.at(-1));
 console.log('PASS valid GPX import/export and rejected invalid GPX preserves route');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS no runtime exceptions');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
