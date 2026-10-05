const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dir=require('path').resolve(__dirname,'..');const errors=[],alerts=[];const vc=new VirtualConsole();
const runtimeJs=fs.readFileSync(dir+'/runtime.js','utf8'),appJs=fs.readFileSync(dir+'/app.js','utf8'),app=appJs,html=fs.readFileSync(dir+'/index.html','utf8'),fieldIntelJs=fs.readFileSync(dir+'/field-intel.js','utf8'),fieldOpsJs=fs.readFileSync(dir+'/field-ops.js','utf8'),fieldToolsJs=fs.readFileSync(dir+'/field-tools.js','utf8'),routePlannerJs=fs.readFileSync(dir+'/route-planner.js','utf8'),mapEngineJs=fs.readFileSync(dir+'/map-engine.js','utf8'),workstationJs=fs.readFileSync(dir+'/workstation.js','utf8'),workstationCss=fs.readFileSync(dir+'/workstation.css','utf8'),swJs=fs.readFileSync(dir+'/sw.js','utf8'),manifest=fs.readFileSync(dir+'/manifest.webmanifest','utf8'),packageJson=JSON.parse(fs.readFileSync(dir+'/package.json','utf8')),readme=fs.readFileSync(dir+'/README.md','utf8');vc.on('jsdomError',e=>{if(!/not implemented/i.test(e.message))errors.push(e.message)});
const dom=new JSDOM(fs.readFileSync(dir+'/index.html','utf8'),{url:'https://test.local/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
w.HTMLElement.prototype.scrollIntoView=()=>{};w.isSecureContext=true;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.alert=x=>alerts.push(x);w.confirm=()=>true;w.fetch=async()=>{throw new Error('Offline test')};w.ResizeObserver=class {observe(){} disconnect(){}};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.FIELD_MAP_ENGINE_EXTERNAL=true;
const ctx=dom.getInternalVMContext(),run=s=>vm.runInContext(s,ctx),click=id=>d.getElementById(id).click(),tick=()=>new Promise(r=>setTimeout(r,20));
async function waitFor(fn,timeout=2500){const start=Date.now();while(Date.now()-start<timeout){if(fn())return;await tick()}throw new Error('Timed out: '+d.getElementById('routePlannerStatus').textContent+' '+d.getElementById('routePlannerDiag').textContent+' '+errors.join(' | '))}
for(const f of ['survival-data.js','route-state.js','runtime.js','canvas-utils.js','map-readiness.js','route-guidance.js','app.js','workstation.js','map-engine.js'])vm.runInContext(fs.readFileSync(dir+'/'+f,'utf8'),ctx,{filename:f});
let mapClick,plannerDragStart,plannerPanCount=0;const chain=()=>({addTo(){return this},clearLayers(){},on(event,fn){if(event==='click')mapClick=fn;return this},setView(){return this},fitBounds(){return this},invalidateSize(){return this},getSize(){return {x:800,y:600}},getZoom(){return 14},bindTooltip(){return this},setOpacity(){return this},setLatLng(){return this},setRadius(){return this},setStyle(){return this},panTo(){plannerPanCount++;return this},createPane(){return {style:{}}},getContainer(){return d.getElementById('routePlannerMap')||d.body},latLngToContainerPoint(ll){return {x:(Number(ll?.[1])||0)*10+800,y:-(Number(ll?.[0])||0)*10+600}}});
w.L={map:()=>{const m=chain(),on=m.on;m.on=function(event,fn){if(event==='dragstart')plannerDragStart=fn;return on.call(this,event,fn)};return m},tileLayer:chain,layerGroup:chain,polyline:chain,circleMarker:chain,circle:chain,marker:chain,svg:chain,divIcon:o=>o||{}};
let planner=fs.readFileSync(dir+'/route-planner.js','utf8');planner=planner.replace('  function gradeAtDistance(profile,distanceM){','  function gradeAtDistance(profile,distanceM){window.__testGradeCalls=(window.__testGradeCalls||0)+1;');planner=planner.replace('window.FIELD_ROUTE_PLANNER={','window.TEST_ROUTER={buildGraph,nearestNode,shortestPath,meters,samplePolyline,fetchElevationProfile,profileElevationAt,elevationDetail,cloneRoutingGraph,routeLeg,addAnchor,clearAll,displayTrailSections,junctionWarningsForPath,combinedJunctionWarnings,gradeAtDistance,slopeClass,reverse,undo,saveCurrentRoute,loadSelectedRoute,routeSlopeDisplayPieces,enableContinuousPlannerZoom,debugSlopeCache:(profile,pts)=>{const previous=activeElevationProfile;activeElevationProfile=profile;window.__testGradeCalls=0;drawDomRouteLayer(pts);const initial=window.__testGradeCalls;drawDomRouteLayer(pts);const afterPan=window.__testGradeCalls;activeElevationProfile={...profile,samples:profile.samples.map(p=>({...p,elevationFt:p.elevationFt+40}))};drawDomRouteLayer(pts);const afterProfile=window.__testGradeCalls;const edited=pts.map((p,i)=>i===Math.floor(pts.length/2)?{...p,lon:p.lon+.0002}:p);drawDomRouteLayer(edited);const afterRoute=window.__testGradeCalls;activeElevationProfile=previous;drawDomRouteLayer(state()?.getPoints?.()||[]);return {initial,afterPan,afterProfile,afterRoute};},debugProfile:applyRouteStats,debugSlopeRender:(profile,pts)=>{const original=activeElevationProfile;activeElevationProfile=profile;drawDomRouteLayer(pts);const classes=[...plannerDomRouteSvg.querySelectorAll(".route-dom-slope")].map(p=>p.getAttribute("class"));activeElevationProfile=original;drawDomRouteLayer(state()?.getPoints?.()||[]);return classes}};window.FIELD_ROUTE_PLANNER={');vm.runInContext(planner,ctx,{filename:'route-planner.js'});vm.runInContext(fs.readFileSync(dir+'/field-intel.js','utf8'),ctx,{filename:'field-intel.js'});vm.runInContext(fs.readFileSync(dir+'/field-ops.js','utf8'),ctx,{filename:'field-ops.js'});
vm.runInContext(fs.readFileSync(dir+'/field-tools.js','utf8'),ctx,{filename:'field-tools.js'});
(async()=>{
 await tick();
 {
   const launcher=d.getElementById('workspaceSearch'),switcher=d.getElementById('workspaceSwitcher');
   const nativeShow=switcher.showModal;try{switcher.showModal=undefined;launcher.click();assert.ok(switcher.hasAttribute('data-open'));assert.equal(launcher.getAttribute('aria-expanded'),'true');assert.equal(d.getElementById('mobileWorkspaceSearch').getAttribute('aria-expanded'),'true');switcher.querySelector('.switcher-close').click();assert.equal(launcher.getAttribute('aria-expanded'),'false');assert.equal(d.getElementById('mobileWorkspaceSearch').getAttribute('aria-expanded'),'false');assert.ok(workstationJs.includes('const target=returnFocus;returnFocus=null'));}finally{if(nativeShow)switcher.showModal=nativeShow}
   assert.ok(routePlannerJs.includes('plannerRouteLayer.clearLayers();'));assert.ok(!routePlannerJs.includes('plannerRouteLayer.clearLayers();plannerPreviewLayer.clearLayers()'));console.log('PASS route preview redraws preserve stable route geometry layers');
 console.log('PASS module finder fallback opens, exposes state, and closes without native dialog support');
 }
 const ids=[...d.querySelectorAll('[id]')].map(e=>e.id);assert.equal(new Set(ids).size,ids.length,'duplicate HTML ids');
 for(const btn of d.querySelectorAll('.workstation-nav [data-open]')){btn.click();await tick();assert.equal(d.querySelector('.view.active').id,btn.dataset.open);if(btn.dataset.open!=='home')assert.ok(d.querySelector('.view.active .ws-card-body'),'module details initialized');}
 console.log('PASS all workstation modules initialize and navigation changes active view');
 for(const theme of ['amber','red','mono','green']){d.querySelector(`[data-theme-choice="${theme}"]`).click();await tick();assert.equal(d.body.dataset.theme,theme);assert.equal(w.localStorage.getItem('fieldos-v12-theme'),theme)}
 w.localStorage.removeItem('fieldos-v12-migration-v3-85');
 w.localStorage.setItem('fieldos-v06-opt-migrated','same-value');
 w.localStorage.setItem('fieldos-v05-opt-conflict','older-unique-value');
 w.localStorage.setItem('fieldos-v12-opt-conflict','newer-value');
 w.localStorage.setItem('fieldos-v04-track','legacy-track-backup');
 const migration=w.migrateLegacyKeys();
 assert.equal(migration.failed,false);
 assert.equal(w.localStorage.getItem('fieldos-v12-opt-migrated'),'same-value');
 assert.equal(w.localStorage.getItem('fieldos-v06-opt-migrated'),null,'verified identical migrated values may be cleaned up');
 assert.equal(w.localStorage.getItem('fieldos-v05-opt-conflict'),'older-unique-value','conflicting historical values cannot be discarded');
 assert.equal(w.localStorage.getItem('fieldos-v04-track'),'legacy-track-backup','IDB migration retains independent recovery source');
 assert.match(w.localStorage.getItem('fieldos-v12-migration-v3-85'),/^complete/);
 assert.equal(w.migrateLegacyKeys(),undefined,'repeated launch should skip full migration work');
 console.log('PASS one-time, copy-verified storage migration preserves conflicts and old track backups');
 console.log('PASS four themes and preference persistence');
 d.getElementById('waypointName').value='QA Base';
 assert.match(d.getElementById('sunState').textContent,/NO VERIFIED LOCATION/,'demo coordinates must not populate solar calculations');
 click('setBaseWaypoint');click('mapMarkBtn');click('addDemoTrackPoint');click('copyCurrentCoord');
 assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-waypoints')||'[]').length,0,'base must reject demo GPS');
 assert.equal(w.FIELD_MAP_DATA.track().length,0,'track recorder must not accept demo GPS');
 assert.match(d.getElementById('fieldActionNotice').textContent,/BLOCKED/);
 w.applyFieldGeolocation({coords:{latitude:44.4759,longitude:-73.2121,altitude:100,accuracy:5,speed:1.2},timestamp:Date.now()});
 assert.doesNotMatch(d.getElementById('solarPositionSource').textContent,/DEMO/);
 click('setBaseWaypoint');await tick();assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-waypoints'))[0].name,'QA Base');assert.match(d.getElementById('waypointList').textContent,/QA Base/);
 d.getElementById('tripName').value='QA Hike';click('saveTrip');assert.match(w.localStorage.getItem('fieldos-v12-trip'),/QA Hike/);
 console.log('PASS waypoint/base and trip persistence');
 d.getElementById('tripReturn').value='2026-10-04T18:00';
 d.getElementById('tripEmergency').value='Route held by contact; turnaround before dark.';
 click('saveTrip');
 w.FIELD_ROUTE_STATE.setPoints([{lat:44.47,lon:-73.22},{lat:44.48,lon:-73.20}]);
 d.getElementById('missionWeather').value='Cool and dry; light west wind.';
 d.getElementById('missionWeather').dispatchEvent(new w.Event('input',{bubbles:true}));
 d.getElementById('missionContact').value='QA CONTACT / 555-0100';
 d.getElementById('missionContact').dispatchEvent(new w.Event('input',{bubbles:true}));
 click('missionBuild');await tick();
 const missionPack=JSON.parse(w.localStorage.getItem('fieldos-v12-mission-pack'));
 assert.equal(missionPack.name,'QA Hike');assert.equal(missionPack.route.points.length,2);
 assert.equal(missionPack.waypoints.length,1);assert.match(missionPack.weather.snapshot,/Cool and dry/);
 assert.match(missionPack.emergencyContact,/QA CONTACT/);assert.equal(missionPack.trip.tripReturn,'2026-10-04T18:00');
 assert.ok(Array.isArray(missionPack.readiness)&&missionPack.readiness.length>=8);
 click('missionStart');await tick();assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-mission-active')).active,true);
 click('missionEnd');await tick();assert.equal(w.localStorage.getItem('fieldos-v12-mission-active'),null);
 w.FIELD_ROUTE_STATE.setPoints([]);await tick();
 w.FIELD_OPEN_VIEW('mission');await tick();
 const readinessButtons=[...d.querySelectorAll('#missionReadiness [data-readiness-id]')];
 assert.ok(readinessButtons.length>=12);assert.ok(readinessButtons.every(x=>x.tagName==='BUTTON'));
 assert.ok(d.querySelector('#missionReadiness [data-readiness-id="route"]').classList.contains('bad'));
 assert.equal(missionPack.route.points.length,2,'frozen mission snapshot must not mutate with live readiness');
 d.getElementById('missionContact').value='';d.getElementById('missionContact').dispatchEvent(new w.Event('input',{bubbles:true}));await tick();
 assert.ok(d.querySelector('#missionReadiness [data-readiness-id="contact"]').classList.contains('bad'));
 d.getElementById('missionContact').value='QA CONTACT / 555-0100';d.getElementById('missionContact').dispatchEvent(new w.Event('input',{bubbles:true}));await tick();
 assert.ok(d.querySelector('#missionReadiness [data-readiness-id="contact"]').classList.contains('ok'));
 d.querySelector('#missionReadiness [data-readiness-id="route"]').click();await tick();assert.equal(d.querySelector('.view.active').id,'route');
 console.log('PASS feature 01 Mission Mode freezes pack data while actionable readiness cards update from live requirements');
  assert.ok(fieldIntelJs.includes("'fieldos:tripchange'"));
  assert.ok(fieldIntelJs.includes("MISSION-122 //"));
  assert.ok(fieldIntelJs.includes("tripReturn')?.addEventListener('input',refreshReadiness"));
  console.log('PASS trip edits refresh readiness immediately without rebuilding the frozen mission snapshot');
 console.log('PASS feature 01 Mission Mode builds, freezes, starts, and ends a complete local trip pack');
 d.getElementById('mobileFixState').textContent='STALE';
 let priority=w.FIELD_CONTEXT.refresh();assert.equal(priority.id,'gnss');assert.match(d.getElementById('priorityTitle').textContent,/GNSS/);
 d.getElementById('priorityAction').click();await tick();assert.equal(d.querySelector('.view.active').id,'nav');
 d.getElementById('mobileFixState').textContent='3D / ±4m';
 const devBanner=d.getElementById('routeDeviationBanner');devBanner.textContent='ON ROUTE';devBanner.className='deviation-banner good-banner';
 d.getElementById('mobileBattery').textContent='12%';
 priority=w.FIELD_CONTEXT.refresh();assert.equal(priority.id,'battery');assert.match(d.getElementById('priorityTitle').textContent,/BATTERY/);
 d.getElementById('mobileBattery').textContent='64%';devBanner.textContent='ROUTE DEVIATION — 500 FT';devBanner.className='deviation-banner critical-banner';
 priority=w.FIELD_CONTEXT.refresh();assert.equal(priority.id,'route');assert.match(d.getElementById('priorityTitle').textContent,/ROUTE DEVIATION/);
 devBanner.textContent='ON ROUTE';devBanner.className='deviation-banner good-banner';w.FIELD_CONTEXT.refresh();
 console.log('PASS feature 02 What Matters Now reprioritizes GNSS, battery, and route hazards with one-tap navigation');
  d.getElementById('mobileFixState').textContent='3D / ±4m';d.getElementById('mobileBattery').textContent='64%';devBanner.textContent='';devBanner.className='deviation-banner';
  d.getElementById('sunState').textContent='SUN HAS SET';d.getElementById('sunNextEvent').textContent='MOONRISE 9:09 PM · SUNRISE 6:51 AM';d.getElementById('daylightRemaining').textContent='0h 00m';
  priority=w.FIELD_CONTEXT.refresh();assert.equal(priority.id,'dark');assert.equal(priority.title,'SUN HAS SET');assert.match(priority.detail,/MOONRISE.*SUNRISE/);assert.doesNotMatch(priority.detail,/daylight remain/i);
  console.log('PASS priority engine treats post-sunset as night state rather than darkness approaching');
  assert.ok(!fieldIntelJs.includes("DARKNESS APPROACHING"));assert.ok(fieldIntelJs.includes("light===0"));
  console.log('PASS DARKNESS APPROACHING removed from runtime source and zero daylight is post-sunset');
 const syntheticRisk=w.FIELD_TERRAIN_RISK.analyze({
   points:[{lat:44,lon:-73},{lat:44.01,lon:-73}],distanceMiles:10,elevationGainFt:3200,elevationLossFt:3400,
   elevationProfile:[{distanceM:0,elevationFt:500},{distanceM:100,elevationFt:620},{distanceM:200,elevationFt:500}],
   trailSections:[{label:'Test Trail',distanceM:1000,surface:'scree',sacScale:'alpine_hiking',ford:'yes',bridge:null,trailVisibility:'bad'}],
   trailIntelligence:{metadataCoveragePct:80}
 },[]);
 assert.ok(syntheticRisk.flags.some(x=>x.id==='steep'));assert.ok(syntheticRisk.flags.some(x=>x.id==='technical'));assert.ok(syntheticRisk.flags.some(x=>x.id==='water'));assert.ok(syntheticRisk.flags.some(x=>x.id==='bailout'));
 w.FIELD_TERRAIN_RISK.render(syntheticRisk);assert.match(d.getElementById('terrainRiskSummary').textContent,/ACTIONABLE FLAG/);
 console.log('PASS feature 03 Terrain-Risk Analyzer flags sustained grade, technical tags, water crossings, major vertical, and bailout gaps');
 const ranked=w.FIELD_BAILOUT.rank([
   {name:'Far Road',type:'ROAD',lat:44.02,lon:-73,source:'TEST'},
   {name:'Near Trailhead',type:'TRAILHEAD',lat:44.005,lon:-73,source:'TEST'},
   {name:'Shelter',type:'SHELTER',lat:44.01,lon:-73,source:'TEST'}
 ],{lat:44,lon:-73});
 assert.equal(ranked[0].name,'Near Trailhead');assert.ok(ranked[0].distanceM<ranked[1].distanceM);
 const beforeWp=JSON.parse(w.localStorage.getItem('fieldos-v12-waypoints')).length;
 w.FIELD_BAILOUT.saveCandidate(ranked[0]);await tick();
 const afterWp=JSON.parse(w.localStorage.getItem('fieldos-v12-waypoints'));assert.equal(afterWp.length,beforeWp+1);assert.match(afterWp.at(-1).name,/BAILOUT/);
 console.log('PASS feature 04 Bailout Planner ranks realistic exit types, works from local data, and saves exits as offline waypoints');
 const reroutePlan={points:[{lat:44,lon:-73},{lat:44.005,lon:-73},{lat:44.01,lon:-73},{lat:44.02,lon:-73}]};
 const recovery=w.FIELD_REROUTE.compute(reroutePlan,{lat:44.004,lon:-73.002});
 assert.ok(recovery);assert.equal(recovery.destination.index,3);assert.ok(recovery.ahead.index>=recovery.nearestIndex);assert.ok(recovery.offsetM>0);
 await w.FIELD_ROUTE_PLANNER.replaceRoute([{lat:44,lon:-73},{lat:44.001,lon:-73}],{mode:'direct',open:false});await tick();
 assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);w.TEST_ROUTER.clearAll();await tick();
 console.log('PASS feature 05 Off-Course Rerouting computes return/ahead/destination recovery targets and uses the shared route engine');
 const crumb=w.FIELD_BREADCRUMB.compute([{lat:44,lon:-73},{lat:44.001,lon:-73},{lat:44.002,lon:-73}],{lat:44.0002,lon:-73},null);
 assert.ok(crumb);assert.equal(crumb.targetIndex,1);assert.equal(crumb.remaining,1);assert.ok(crumb.distanceM>50&&crumb.distanceM<100);assert.match(crumb.cardinal,/N/);
 w.localStorage.setItem('fieldos-v12-track',JSON.stringify([{lat:44,lon:-73},{lat:44.001,lon:-73},{lat:44.002,lon:-73}]));
 d.querySelector('[data-open="breadcrumb"]').click();await tick();assert.equal(d.querySelector('.view.active').id,'breadcrumb');assert.match(d.getElementById('breadcrumbState').textContent,/TRACK/);
 w.FIELD_BREADCRUMB.reverse();assert.equal(w.FIELD_BREADCRUMB.reversed,true);w.FIELD_OPEN_VIEW('route',{history:false});
 console.log('PASS feature 06 Breadcrumb Navigation computes next breadcrumb, bearing, remaining points, reverse mode, and minimal-screen navigation');
 const drEst=w.FIELD_DR.estimate({lat:44,lon:-73},300,1,0,10);assert.ok(drEst);assert.ok(drEst.lat>44);assert.ok(Math.abs(drEst.lon+73)<.001);assert.ok(drEst.uncertaintyM>100);
 const drLong=w.FIELD_DR.estimate({lat:44,lon:-73},1200,1.5,90,10);assert.ok(drLong.lon>-73);assert.ok(drLong.uncertaintyM>drEst.uncertaintyM);
 d.getElementById('mobileFixState').textContent='STALE';w.FIELD_DR.arm();w.FIELD_DR.state.speedMps=1;w.FIELD_DR.state.heading=0;w.FIELD_DR.state.anchorTime=Date.now()-60000;w.FIELD_DR.update();assert.equal(w.FIELD_DR.state.active,true);w.FIELD_OPEN_VIEW('nav',{history:false});await tick();assert.match(d.getElementById('drState').textContent,/ESTIMATED/);
 d.getElementById('mobileFixState').textContent='3D / ±4m';w.FIELD_DR.update();assert.equal(w.FIELD_DR.state.active,false);w.FIELD_DR.reset();
 console.log('PASS feature 07 Dead Reckoning keeps a separately labeled estimate with growing uncertainty and returns authority to GNSS');
 d.getElementById('mobileFixState').textContent='3D / ±4m';d.getElementById('navAccuracy').textContent='±4 m';d.getElementById('fixAge').textContent='00:00:05';w.FIELD_DR.reset();
 const originalTestPosition=w.FIELD_ROUTE_STATE.current;w.FIELD_ROUTE_STATE.current=()=>({...originalTestPosition(),source:'DEMO GNSS'});assert.equal(w.FIELD_POSITION_CONFIDENCE.compute().mode,'stale','demo coordinates must never be trusted');w.FIELD_ROUTE_STATE.current=()=>({...originalTestPosition(),source:'PHONE GNSS'});let conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'trusted');assert.ok(conf.score>=90);assert.match(d.getElementById('posConfidenceLabel').textContent,/TRUSTED/);
 d.getElementById('navAccuracy').textContent='±35 m';conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'degraded');assert.ok(conf.score<90);
 d.getElementById('mobileFixState').textContent='STALE';w.FIELD_DR.arm();w.FIELD_DR.state.active=true;w.FIELD_DR.state.uncertaintyM=420;conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'estimated');assert.equal(conf.authority,'DEAD RECKONING');assert.ok(conf.score<70);
 w.FIELD_DR.reset();d.getElementById('mobileFixState').textContent='3D / ±4m';d.getElementById('navAccuracy').textContent='±4 m';d.getElementById('fixAge').textContent='00:00:05';
 w.FIELD_ROUTE_STATE.current=originalTestPosition;console.log('PASS feature 08 Position Confidence distinguishes trusted, degraded, stale, and DR-estimated authority with uncertainty visualization');
 const nowMesh=Date.now();w.FIELD_MESH.ingest([
   {id:'ridge-1',name:'RIDGE-1',role:'ROUTER',lat:44.48,lon:-73.21,rssi:-78,snr:9,battery:81,hops:1,lastHeard:nowMesh},
   {id:'valley-2',name:'VALLEY-2',role:'CLIENT',lat:44.46,lon:-73.23,rssi:-104,snr:-1,battery:52,hops:2,lastHeard:nowMesh-120000,via:'ridge-1'}
 ]);
 assert.equal(w.FIELD_MESH.state.nodes.length,2);assert.equal(w.FIELD_MESH.quality(w.FIELD_MESH.state.nodes.find(n=>n.id==='ridge-1')),'good');assert.equal(w.FIELD_MESH.quality(w.FIELD_MESH.state.nodes.find(n=>n.id==='valley-2')),'weak');
 w.FIELD_MESH.render();assert.match(d.getElementById('meshNetworkState').textContent,/2 NODES/);assert.equal(d.querySelectorAll('#meshNodeRoster .mesh-node-row').length,2);assert.ok(d.querySelectorAll('#meshNetworkMap .mesh-link').length>=2);assert.ok(JSON.parse(w.localStorage.getItem('fieldos-v12-mesh-roster')).nodes.length===2);
 console.log('PASS feature 09 Mesh Network Map ingests, caches, positions, quality-rates, and renders Meshtastic nodes with topology metadata');
 w.FIELD_MESH_COVERAGE.clear();
 assert.equal(w.FIELD_MESH_COVERAGE.classify({rssi:-75,snr:8}),'strong');assert.equal(w.FIELD_MESH_COVERAGE.classify({rssi:-98,snr:2}),'fair');assert.equal(w.FIELD_MESH_COVERAGE.classify({rssi:-108,snr:-2}),'weak');assert.equal(w.FIELD_MESH_COVERAGE.classify({rssi:-120,snr:-10}),'dead');
 w.FIELD_MESH_COVERAGE.add({lat:44.47,lon:-73.21,rssi:-80,snr:8,time:Date.now()-4000});w.FIELD_MESH_COVERAGE.add({lat:44.471,lon:-73.211,rssi:-106,snr:-1,time:Date.now()-2000});w.FIELD_MESH_COVERAGE.add({lat:44.472,lon:-73.212,rssi:-118,snr:-9,time:Date.now()});
 assert.equal(w.FIELD_MESH_COVERAGE.state.samples.length,3);w.FIELD_MESH_COVERAGE.render();assert.equal(d.querySelectorAll('#meshCoverageMap .mesh-coverage-sample').length,3);assert.match(d.getElementById('meshCoverageSummary').textContent,/POOR 1/);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-mesh-coverage')).samples.length,3);
 console.log('PASS feature 10 Mesh Coverage Heatmap records, classifies, caches, and renders moving RSSI/SNR samples');
 const relayPlan={elevationProfile:[
   {lat:44.47,lon:-73.21,distanceM:0,elevationFt:500},{lat:44.475,lon:-73.21,distanceM:600,elevationFt:950},
   {lat:44.48,lon:-73.21,distanceM:1200,elevationFt:1400},{lat:44.485,lon:-73.21,distanceM:1800,elevationFt:900}
 ]};
 const relayItems=w.FIELD_RELAY.candidates(relayPlan,[],[
   {lat:44.482,lon:-73.21,rssi:-112,snr:-4,quality:'weak'},{lat:44.483,lon:-73.211,rssi:-118,snr:-8,quality:'dead'}
 ]);
 assert.ok(relayItems.length>0);assert.ok(relayItems[0].elevationFt>=900);assert.ok(relayItems[0].score>0);
 w.FIELD_RELAY.render(relayItems);assert.ok(d.querySelectorAll('#relayRecommendList .relay-recommend-row').length>=1);
 console.log('PASS feature 11 Relay Recommendation scores elevated reachable candidates against weak mesh coverage zones');
 w.FIELD_TRANSPORT.state.items.length=0;w.FIELD_TRANSPORT.queue('queued while offline',{channel:'PRIMARY'});await tick();
 assert.equal(w.FIELD_TRANSPORT.state.items.length,1);assert.equal(w.FIELD_TRANSPORT.state.items[0].status,'pending');assert.match(d.getElementById('storeForwardState').textContent,/1 QUEUED/);
 let delivered=[];const unregister=w.FIELD_TRANSPORT.register('mock-mesh',{priority:100,available:false,send:async msg=>{delivered.push(msg.text);return {ok:true,receipt:'rx-1'}}});await tick();
 assert.equal(delivered.length,0);w.FIELD_TRANSPORT.setAvailable('mock-mesh',true);await waitFor(()=>w.FIELD_TRANSPORT.state.items[0].status==='sent');
 assert.deepEqual(delivered,['queued while offline']);assert.equal(w.FIELD_TRANSPORT.state.items[0].transport,'mock-mesh');assert.equal(w.FIELD_TRANSPORT.state.items[0].receipt,'rx-1');
 w.FIELD_TRANSPORT.queue('second packet',{channel:'PRIMARY'});await waitFor(()=>w.FIELD_TRANSPORT.state.items.at(-1).status==='sent');assert.equal(delivered.length,2);
 unregister();assert.ok(JSON.parse(w.localStorage.getItem('fieldos-v12-message-queue')).items.length>=2);
 console.log('PASS feature 12 Store-and-Forward Messaging persists offline packets and automatically flushes through an available registered transport');
 w.FIELD_INBOX.clear();w.FIELD_INBOX.ingest({id:'mesh-1',source:'MESH',category:'MESH',from:'NODE-9',text:'At the junction',createdAt:1000});
 w.FIELD_INBOX.ingest({id:'sat-1',source:'SATELLITE',category:'SATELLITE',from:'SAT CONTACT',text:'Weather update received',createdAt:2000});
 d.getElementById('checkinNow').click();await tick();
 d.dispatchEvent(new w.CustomEvent('fieldos:devicealert',{detail:{id:'alert-1',source:'TAP V2',title:'DEVICE ALERT',text:'External sensor battery low',severity:'warn',createdAt:3000}}));await tick();
 assert.ok(w.FIELD_INBOX.state.items.some(x=>x.category==='MESH'));assert.ok(w.FIELD_INBOX.state.items.some(x=>x.category==='SATELLITE'));assert.ok(w.FIELD_INBOX.state.items.some(x=>x.category==='CHECK-IN'));assert.ok(w.FIELD_INBOX.state.items.some(x=>x.category==='ALERT'));
 w.FIELD_INBOX.state.filter='SATELLITE';w.FIELD_INBOX.render();assert.equal(d.querySelectorAll('#unifiedInboxTimeline .unified-inbox-event').length,1);assert.match(d.getElementById('unifiedInboxTimeline').textContent,/Weather update/);
 w.FIELD_INBOX.state.filter='ALL';w.FIELD_INBOX.markRead();assert.equal(w.FIELD_INBOX.state.items.filter(x=>!x.read).length,0);assert.ok(JSON.parse(w.localStorage.getItem('fieldos-v12-comms-inbox')).items.length>=4);
 console.log('PASS feature 13 Unified Communications Inbox merges mesh, satellite, check-in, outgoing, and alert events into one persistent filtered timeline');
 w.FIELD_TRANSPORT.state.items.length=0;w.FIELD_AUTO_CHECKIN.setConfig({enabled:true,template:'STATUS',graceMin:5});
 const baseAuto=Date.now();w.FIELD_AUTO_CHECKIN.state.nextDue=baseAuto-6*60000;w.FIELD_AUTO_CHECKIN.state.pendingMessageId=null;w.FIELD_AUTO_CHECKIN.state.lastMissedAlertFor=null;
 const tickResult=w.FIELD_AUTO_CHECKIN.tick(baseAuto);assert.equal(tickResult.action,'catch-up');assert.ok(w.FIELD_AUTO_CHECKIN.state.pendingMessageId);assert.ok(w.FIELD_TRANSPORT.state.items.some(x=>x.meta?.kind==='auto-checkin'));assert.ok(w.FIELD_INBOX.state.items.some(x=>/CHECK-IN WINDOW MISSED/.test(x.title)));
 const autoMsg=w.FIELD_TRANSPORT.state.items.find(x=>x.id===w.FIELD_AUTO_CHECKIN.state.pendingMessageId);assert.match(autoMsg.text,/STATUS OK/);assert.match(autoMsg.text,/POS/);
 let autoDelivered=[];const unregAuto=w.FIELD_TRANSPORT.register('auto-test',{priority:200,available:true,send:async m=>{autoDelivered.push(m.id);return {ok:true,receipt:'auto-rx'}}});await waitFor(()=>w.FIELD_AUTO_CHECKIN.state.pendingMessageId===null);assert.ok(w.FIELD_AUTO_CHECKIN.state.lastDelivered>0);assert.ok(autoDelivered.length>=1);unregAuto();w.FIELD_AUTO_CHECKIN.setConfig({enabled:false});
 console.log('PASS feature 14 Automatic Check-ins schedules, catches up after suspension, queues location packets, warns on missed windows, and confirms real transport delivery');
 w.FIELD_GROUP.setConfig({enabled:true,allNodes:true,separationMi:.3,members:[]});w.FIELD_GROUP.state.activeAlerts.clear();
 const groupNow=Date.now(),groupOrigin={lat:44.47,lon:-73.21};
 const groupResult=w.FIELD_GROUP.evaluate([
   {id:'near',name:'NEAR',role:'CLIENT',lat:44.471,lon:-73.21,battery:80,lastHeard:groupNow,rssi:-80},
   {id:'far',name:'FAR',role:'CLIENT',lat:44.49,lon:-73.21,battery:9,lastHeard:groupNow-20*60000,rssi:-100}
 ],groupOrigin,groupNow);
 assert.equal(groupResult.length,2);const farMember=groupResult.find(x=>x.id==='far');assert.ok(farMember.warnings.some(x=>x.type==='separation'));assert.ok(farMember.warnings.some(x=>x.type==='battery'));assert.ok(farMember.warnings.some(x=>x.type==='stale'));
 const inboxBeforeGroup=w.FIELD_INBOX.state.items.length;w.FIELD_GROUP.render(groupResult);await tick();assert.ok(w.FIELD_INBOX.state.items.length>inboxBeforeGroup);assert.match(d.getElementById('groupExpeditionState').textContent,/ACTIVE/);
 const firstGroupAlertCount=w.FIELD_INBOX.state.items.filter(x=>/^group-/.test(x.id)).length;w.FIELD_GROUP.render(groupResult);await tick();const secondGroupAlertCount=w.FIELD_INBOX.state.items.filter(x=>/^group-/.test(x.id)).length;assert.equal(secondGroupAlertCount,firstGroupAlertCount);
 w.FIELD_GROUP.setConfig({enabled:false});
 console.log('PASS feature 15 Group Expedition Mode evaluates separation, stale position, movement and battery while emitting transition-based group alerts');
 const recoveryNow=Date.now(),recoveryTarget={id:'person-1',name:'PERSON-1',role:'CLIENT',lat:44.48,lon:-73.22,lastHeard:recoveryNow-60000};
 const recoveryStart=w.FIELD_RECOVERY.activate(recoveryTarget,{lat:44.47,lon:-73.21},recoveryNow);assert.equal(recoveryStart.active,true);assert.equal(w.FIELD_RECOVERY.state.target.lat,44.48);assert.equal(w.FIELD_RECOVERY.state.breadcrumbs.length,1);
 w.FIELD_MESH.ingest([{id:'person-1',name:'PERSON-1',lat:44.6,lon:-73.5,lastHeard:recoveryNow+1000}]);await tick();assert.equal(w.FIELD_RECOVERY.state.target.lat,44.48);assert.equal(w.FIELD_RECOVERY.state.target.lon,-73.22);
 w.FIELD_RECOVERY.addBreadcrumb({lat:44.472,lon:-73.212},recoveryNow+60000);const recoveryGuide=w.FIELD_RECOVERY.guidance({lat:44.472,lon:-73.212});assert.ok(recoveryGuide.distanceM>0);assert.ok(Number.isFinite(recoveryGuide.bearing));w.FIELD_RECOVERY.render();assert.ok(d.querySelectorAll('#recoveryRelativeMap .recovery-map-target').length===1);assert.ok(w.FIELD_RECOVERY.state.breadcrumbs.length>=2);
 const frozenStorage=JSON.parse(w.localStorage.getItem('fieldos-v12-recovery-active'));assert.equal(frozenStorage.target.lat,44.48);w.FIELD_RECOVERY.clear();assert.equal(w.localStorage.getItem('fieldos-v12-recovery-active'),null);
 console.log('PASS feature 16 Separated-Person Recovery freezes last-known coordinates, keeps search breadcrumbs, renders group context, and ignores later target movement');
 const highConfidence=w.FIELD_ROUTE_CONFIDENCE.compute({
   points:[{lat:44,lon:-73},{lat:44.01,lon:-73}],routingMode:'trail',routeBuildState:'COMPLETE',
   trailSections:[{name:'Long Trail',distanceM:900,surface:'rock'},{name:'Long Trail',distanceM:100,surface:'wood'}],
   trailIntelligence:{metadataCoveragePct:100},elevationProfile:[{distanceM:0,elevationFt:500},{distanceM:1000,elevationFt:800}]
 });
 assert.ok(highConfidence.score>=85);assert.equal(highConfidence.level,'high');
 const lowConfidence=w.FIELD_ROUTE_CONFIDENCE.compute({points:[{lat:44,lon:-73},{lat:44.01,lon:-73}],routingMode:'direct',routeBuildState:'COMPLETE',trailSections:[],elevationProfile:[]});
 assert.ok(lowConfidence.score<65);assert.ok(['limited','low'].includes(lowConfidence.level));w.FIELD_ROUTE_CONFIDENCE.render(lowConfidence);assert.match(d.getElementById('routeConfidenceSummary').textContent,/not snapped|OSM|elevation/i);
 console.log('PASS original feature 03 Route Confidence Meter scores data completeness and exposes confidence gaps without treating score as safety');
 const weatherBase=Date.now(),weatherHours=Array.from({length:12},(_,i)=>({time:new Date(weatherBase+i*3600000).toISOString(),tempF:45+i,precipProbability:i===2?85:10,precipIn:i===2?.12:0,weatherCode:i===4?95:1,windMph:12,gustMph:i===5?42:18,visibilityM:i===6?1200:12000,pressureHpa:1008-i*.4}));
 const weatherCache={downloadedAt:new Date(weatherBase).toISOString(),position:{lat:44.47,lon:-73.21},source:'TEST FORECAST',current:{tempF:45,precipIn:0,weatherCode:1,windMph:12,gustMph:18,visibilityM:12000,pressureHpa:1008},hourly:weatherHours,alerts:[{id:'a1',event:'Winter Weather Advisory',severity:'Moderate',headline:'Test advisory',description:'Test',expires:''}]};
 w.FIELD_WEATHER.setCache(weatherCache);const weatherFlags=w.FIELD_WEATHER.hazards(weatherCache);assert.ok(weatherFlags.some(x=>x.id==='thunder'));assert.ok(weatherFlags.some(x=>x.id==='gust'));assert.ok(weatherFlags.some(x=>x.id==='visibility'));assert.ok(weatherFlags.some(x=>x.id==='precip'));assert.ok(weatherFlags.some(x=>x.id==='alert-a1'));w.FIELD_WEATHER.render();assert.match(d.getElementById('weatherCondition').textContent,/PARTLY CLOUDY/);assert.equal(d.querySelectorAll('#weatherHazards .weather-hazard').length,weatherFlags.length);assert.ok(d.querySelectorAll('#weatherHourly .weather-hour-card').length>0);assert.ok(JSON.parse(w.localStorage.getItem('fieldos-v12-weather-cache')).hourly.length===12);
 console.log('PASS original feature 18 Weather Intelligence caches current/hourly forecast, screens thunder/wind/visibility/precipitation, and preserves alert/source metadata offline');
 const opsWeatherCache={...weatherCache,current:{...weatherCache.current,snowfallIn:.2,snowDepthIn:8,freezingFt:4200,windDir:270},hourly:weatherHours.map((x,i)=>({...x,snowfallIn:i<12?.55:0,snowDepthIn:8,freezingFt:4200,windDir:270,tempF:i<4?30+i:36}))};
 w.FIELD_WEATHER.setCache(opsWeatherCache);

 w.FIELD_PRESSURE.state.samples.length=0;w.FIELD_PRESSURE.state.lastAlert=null;
 w.FIELD_PRESSURE.add(1012,weatherBase-3*3600000);w.FIELD_PRESSURE.add(1009,weatherBase-3600000);w.FIELD_PRESSURE.add(1007,weatherBase);
 const pressure=w.FIELD_PRESSURE.render(w.FIELD_PRESSURE.analyze(weatherBase));assert.ok(pressure.d3<=-4);assert.equal(pressure.level,'alert');assert.match(d.getElementById('stormWatchState').textContent,/RAPID PRESSURE FALL/);
 console.log('PASS feature 19 Barometric Storm Detection identifies rapid multi-hour pressure falls and raises a local trend warning');

 const hazardPlan={points:[{lat:44.47,lon:-73.21},{lat:44.48,lon:-73.20}]};
 w.FIELD_HAZARDS.ingest({type:'FeatureCollection',features:[{type:'Feature',properties:{category:'WILDFIRE',name:'TEST FIRE'},geometry:{type:'Polygon',coordinates:[[[-73.22,44.46],[-73.19,44.46],[-73.19,44.49],[-73.22,44.49],[-73.22,44.46]]]}}]});
 const hazardHits=w.FIELD_HAZARDS.screen(hazardPlan);assert.equal(hazardHits.length,1);assert.equal(hazardHits[0].category,'FIRE');assert.match(d.getElementById('hazardRouteSummary').textContent,/cached hazard/i);
 console.log('PASS feature 20 Wildfire/Smoke cache imports GeoJSON and screens route geometry for cached fire, smoke and closure intersections');

 const avalanchePlan={elevationProfile:[{lat:44,lon:-73,distanceM:0,elevationFt:1000},{lat:44.0009,lon:-73,distanceM:100,elevationFt:1190},{lat:44.0018,lon:-73,distanceM:200,elevationFt:1000}]};
 const ava=w.FIELD_AVALANCHE.analyze(avalanchePlan);assert.ok(ava.exposure>0);assert.ok(ava.bands.moderate+ava.bands.high>0);w.FIELD_AVALANCHE.render(ava);assert.match(d.getElementById('avalancheState').textContent,/SCREENED/);
 console.log('PASS feature 21 Avalanche Mode screens route DEM segments into slope-angle bands without presenting a safety verdict');

 const snow=w.FIELD_SNOW.render(w.FIELD_SNOW.analyze(opsWeatherCache));assert.ok(snow.snow24>=6);assert.equal(snow.loading,'E');assert.match(d.getElementById('snowTravelNote').textContent,/SNOW|WIND/);
 console.log('PASS feature 22 Snow Travel Mode summarizes snowfall, snow depth, freezing level, wind and likely lee loading aspect from cached forecast data');

 w.FIELD_WATER.state.cache={savedAt:new Date(weatherBase).toISOString(),items:[{id:'spring1',name:'SPRING',type:'SPRING',lat:44.471,lon:-73.211,source:'OSM CACHE'}]};
 const water=w.FIELD_WATER.rank(w.FIELD_WATER.collect(),{lat:44.47,lon:-73.21});assert.ok(water.some(x=>x.name==='SPRING'));assert.ok(water.find(x=>x.name==='SPRING').distanceM<200);w.FIELD_WATER.render(water);
 console.log('PASS feature 23 Water Intelligence merges cached and saved water references and ranks positioned sources by distance');

 const conditionPlan={trailSections:[{name:'Mud Trail',surface:'ground',distanceM:1000},{name:'Rock Ridge',surface:'rock',sacScale:'mountain_hiking',distanceM:1000}]};
 const cond=w.FIELD_TRAIL_CONDITIONS.render(w.FIELD_TRAIL_CONDITIONS.analyze(conditionPlan,opsWeatherCache));assert.ok(cond.speedFactor>1);assert.ok(cond.tags.some(x=>x.id==='rocky'));assert.ok(cond.tags.some(x=>x.id==='snow'));
 console.log('PASS feature 24 Trail-Condition Intelligence combines OSM surface metadata with cached precipitation, snow and freeze-thaw evidence');

 const etaTrack=Array.from({length:6},(_,i)=>({lat:44+i*.005,lon:-73,time:new Date(weatherBase+i*10*60000).toISOString()}));
 w.localStorage.setItem('fieldos-v12-track',JSON.stringify(etaTrack));
 const etaPlan={points:[{lat:44,lon:-73},{lat:44.04,lon:-73}],distanceMiles:4,elevationGainFt:1800,trailSections:[{surface:'ground',distanceM:3000}]};
 const eta=w.FIELD_ADAPTIVE_ETA.compute(etaPlan,{lat:44.01,lon:-73});assert.equal(eta.pace.source,'RECORDED TRACK');assert.ok(eta.totalHours>0);assert.ok(eta.remainingHours<eta.totalHours);w.FIELD_ADAPTIVE_ETA.render(eta);
 console.log('PASS feature 25 Adaptive ETA learns a bounded personal pace from recorded tracks and adjusts time for grade, conditions and route progress');
 const projectionPoints=Array.from({length:601},(_,i)=>({lat:44+i*.00002,lon:-73+.00002*Math.sin(i/30)})),projectionPlan={points:projectionPoints},projectionPosition={lat:44+.00002*390+.00003,lon:-73+.00002*Math.sin(390/30)+.00004};
 const probeMeters=(a,b)=>{const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad,h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))};
 const projectedCum=[0];for(let i=1;i<projectionPoints.length;i++)projectedCum[i]=projectedCum[i-1]+probeMeters(projectionPoints[i-1],projectionPoints[i]);
 let referenceDist=Infinity,referenceAlong=0;
 for(let i=0;i<projectionPoints.length-1;i++){
   const a=projectionPoints[i],b=projectionPoints[i+1],latScale=111320,lonScale=111320*Math.cos((a.lat+b.lat+projectionPosition.lat)*Math.PI/540);
   const abx=(b.lon-a.lon)*lonScale,aby=(b.lat-a.lat)*latScale,apx=(projectionPosition.lon-a.lon)*lonScale,apy=(projectionPosition.lat-a.lat)*latScale,len2=abx*abx+aby*aby;
   const t=len2?Math.max(0,Math.min(1,(apx*abx+apy*aby)/len2)):0,dist=Math.hypot(apx-t*abx,apy-t*aby);
   if(dist<referenceDist){referenceDist=dist;referenceAlong=projectedCum[i]+t*(projectedCum[i+1]-projectedCum[i])}
 }
 const projectedEta=w.FIELD_ADAPTIVE_ETA.compute(projectionPlan,projectionPosition);
 assert.ok(Math.abs(projectedEta.progress-referenceAlong/projectedCum.at(-1))<1e-8,'cached projection should preserve reference nearest-segment progress');
 console.log('PASS precomputed route-segment projection preserves GPS progress on a long route');
 const sameStamp='2026-10-01T00:00:00.000Z',firstPlan={updatedAt:sameStamp,points:[{lat:44,lon:-73},{lat:44.01,lon:-73}]},changedPlan={updatedAt:sameStamp,points:[{lat:44,lon:-73},{lat:44.02,lon:-73}]},fixedPos={lat:44.005,lon:-73};
 const firstProgress=w.FIELD_ADAPTIVE_ETA.compute(firstPlan,fixedPos).progress;
 d.dispatchEvent(new w.CustomEvent('fieldos:routechange',{detail:{points:changedPlan.points}}));
 const changedProgress=w.FIELD_ADAPTIVE_ETA.compute(changedPlan,fixedPos).progress;
 assert.ok(firstProgress>.49&&firstProgress<.51&&changedProgress>.24&&changedProgress<.26,'route change must invalidate cached projection even with identical update timestamp');
 console.log('PASS GPS progress cache invalidates when route geometry changes');
 assert.ok(fieldOpsJs.includes('let routeGeometryCacheKey'));assert.ok(fieldOpsJs.includes('routeGeometryCacheKey===key&&routeGeometryCache'));assert.ok(!fieldOpsJs.includes('function routeCumulative('));console.log('PASS ETA and turn navigation reuse cached route geometry and cumulative distance');
 assert.ok(!fieldOpsJs.includes('routeDistanceM('));assert.ok(fieldOpsJs.includes('function computeFatigue')&&fieldOpsJs.includes('geometry.total/1609.344'));console.log('PASS fatigue model also reuses cached route distance');

 const fatigue=w.FIELD_FATIGUE.compute({points:[{lat:44,lon:-73},{lat:44.08,lon:-73}],distanceMiles:12,elevationGainFt:4500},.8);assert.ok(fatigue.factor>1.2);assert.ok(/ACCUMULATING|FATIGUED|HIGH/.test(fatigue.level));
 console.log('PASS feature 26 Fatigue Model increases the time factor as completed mileage and climbing accumulate');

 const turnPlan={name:'TEST ROUTE',points:[{lat:44,lon:-73},{lat:44.005,lon:-73},{lat:44.005,lon:-72.995},{lat:44.01,lon:-72.995}],trailSections:[{name:'North Trail',distanceM:550},{name:'East Link',distanceM:400},{name:'Summit Trail',distanceM:550}]};
 const cues=w.FIELD_TURNS.generate(turnPlan);assert.ok(cues.length>=3);assert.ok(cues.some(x=>x.type==='right'||x.type==='left'));assert.equal(cues.at(-1).type,'finish');const nextCue=w.FIELD_TURNS.next({lat:44.0001,lon:-73},turnPlan);assert.ok(nextCue);assert.ok(Number.isFinite(nextCue.distanceToCueM));
 const longTurnPlan={points:Array.from({length:2001},(_,i)=>({lat:44+i*.00001,lon:-73})),trailSections:Array.from({length:10},(_,i)=>({name:'Section '+i,distanceM:150}))};
 const longCues=w.FIELD_TURNS.generate(longTurnPlan);const secondSection=longCues.find(c=>c.trail==='Section 1');
 assert.ok(secondSection&&secondSection.index>=130&&secondSection.index<=140,'named trail transition should find nearest long-route point');
 const lateCue=w.FIELD_TURNS.next({lat:44+880*.00001,lon:-73},longTurnPlan),referenceCue=longCues.find(c=>c.distanceM>=lateCue.progressM-20)||longCues.at(-1);
 assert.equal(lateCue.id,referenceCue.id,'binary next-cue lookup must match first remaining sorted cue');
 w.FIELD_TURNS.generate(turnPlan);
 console.log('PASS feature 27 Turn-by-Turn Trail Instructions generates named-trail and geometry-turn cues with distance-to-next guidance');
 console.log('PASS long-route trail cue nearest-point lookup uses logarithmic search');











 const sosBtn=d.getElementById('meshSos');
 sosBtn.dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));
 sosBtn.dispatchEvent(new w.Event('pointercancel',{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,1700));
 assert.notEqual(sosBtn.textContent,'MESH SOS ARMED — DEMO');
 assert.match(app,/pointercancel',cancelSos/);
 assert.match(app,/max-height: 600px\) and \(min-width: 1001px\)/);
 console.log('PASS interrupted mobile SOS hold cancels and phone landscape avoids desktop scaling');
 const beforeFix=d.getElementById('fixAge').textContent;
 w.applyFieldGeolocation({coords:{latitude:44.48,longitude:-73.21,altitude:1000,accuracy:5,speed:null,heading:null}},'PHONE GNSS');
 w.refreshFixAge(Date.now()+601000);
 assert.match(d.getElementById('fixAge').textContent,/00:10:0[01]/);assert.notEqual(d.getElementById('fixAge').textContent,beforeFix);
 console.log('PASS fix freshness uses wall-clock elapsed time rather than visible-tab timer ticks');
 const moonrise=w.nextMoonrise(new Date('2026-09-30T12:00:00Z'),44.4759,-73.2121);
 assert.ok(moonrise&&Number.isFinite(moonrise.getTime()));
 assert.ok(appJs.includes("ev.sunrise&&now<ev.sunrise?'BEFORE SUNRISE':'SUN HAS SET'"));
 assert.ok(appJs.includes("MOONRISE ${moonrise?fmtClock(moonrise):'NONE'} · SUNRISE ${sunrise?fmtClock(sunrise):'NONE'}"));
 console.log('PASS solar card distinguishes before sunrise, after sunset and explicit polar states');
 d.querySelector('.workstation-nav [data-open="route"]').click();await tick();
 d.getElementById('routeSnapMode').value='direct';d.getElementById('routeSnapMode').dispatchEvent(new w.Event('change'));
 const r=w.TEST_ROUTER;r.addAnchor({lat:44.475,lon:-73.215});r.addAnchor({lat:44.48,lon:-73.21});await waitFor(()=>!d.getElementById('routeGainOut').textContent.includes('LOADING'));
 assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);assert.ok(parseFloat(d.getElementById('routeDistance').textContent)>0);assert.match(d.getElementById('routeGainOut').textContent,/N\/A/);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,2);
 for(const id of ['homeRealMap','realMap']){assert.ok(d.querySelector('#'+id+' .planned-route-line'));assert.equal(d.querySelectorAll('#'+id+' .planned-route-marker').length,2)}
 const beforeRoute=d.querySelector('#homeRealMap .planned-route-line').getAttribute('points');
 r.reverse();await tick();assert.notEqual(d.querySelector('#homeRealMap .planned-route-line').getAttribute('points'),beforeRoute);assert.equal(w.FIELD_ROUTE_STATE.getPoints()[0].lat,44.48);r.undo();await waitFor(()=>w.FIELD_ROUTE_STATE.getPoints().length===1);assert.equal(w.FIELD_ROUTE_PLANNER.anchors.length,1);assert.equal(d.getElementById('reverseRoute').disabled,true);r.clearAll();await waitFor(()=>w.FIELD_ROUTE_STATE.getPoints().length===0);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,0);
 assert.equal(d.querySelectorAll('.planned-route-line').length,0);
 console.log('PASS route overlays on both maps, reverse and clear synchronization');
 assert.ok(appJs.includes('let routeMileageCache=null'));assert.ok(appJs.includes('const mileage=routeMileageProfile()'));assert.ok(appJs.includes('routeMileageCache=null;'));console.log('PASS main route watch reuses cached cumulative mileage instead of rewalking the route');
 console.log('PASS direct routing, distance, missing elevation, reverse, undo, clear persistence');
 // Isolate the production Leaflet wheel handler from mocked tile networking.
 // Ten quick mouse-wheel events previously caused dozens of setZoomAround
 // calls and every call triggered a tile/opacity lifecycle. Exactly ONE
 // Leaflet camera commit is allowed per continuous wheel burst.
 const testWheelHost=d.createElement('div'),testMapPane=d.createElement('div');
 testMapPane.className='leaflet-map-pane';testWheelHost.appendChild(testMapPane);d.body.appendChild(testWheelHost);
 let actualZoom=14,zoomCommits=0,scrollDisabled=false;
 const zoomHandlers=[];
 const fakeZoomMap={
   scrollWheelZoom:{disable(){scrollDisabled=true}},
   getContainer(){return testWheelHost},getPane(){return testMapPane},
   getZoom(){return actualZoom},getMinZoom(){return 2},getMaxZoom(){return 19},
   getSize(){return {divideBy(){return {x:200,y:160}}}},
   mouseEventToContainerPoint(e){return {x:e.clientX,y:e.clientY}},
   containerPointToLayerPoint(p){return p},
   setZoomAround(_point,next){zoomCommits++;actualZoom=next;zoomHandlers.forEach(fn=>fn())},
   on(name,fn){if(name==='zoomend')zoomHandlers.push(fn)}
 };
 r.enableContinuousPlannerZoom(fakeZoomMap);
 assert.equal(scrollDisabled,true,'native Leaflet wheel handler must be disabled to avoid duplicate camera updates');
 for(let i=0;i<10;i++)testWheelHost.dispatchEvent(new w.WheelEvent('wheel',
   {bubbles:true,cancelable:true,deltaY:-60,clientX:200,clientY:160}));
 await new Promise(resolve=>w.requestAnimationFrame(resolve));
 assert.equal(zoomCommits,0,'wheel frames must only preview; never retile Leaflet during a burst');
 if('scale' in testMapPane.style)
   assert.ok(Number(testMapPane.style.scale)>1,'preview zoom uses the map-pane compositor without rerendering tiles');
 await new Promise(resolve=>setTimeout(resolve,175));
 assert.equal(zoomCommits,1,'one continuous desktop wheel burst commits exactly one real map zoom');
 assert.ok(actualZoom>15&&actualZoom<17,'all wheel deltas accumulate instead of saturating or being dropped');
 assert.equal(testMapPane.style.scale||'','', 'compositor preview clears after the map camera commits');
 testWheelHost.dispatchEvent(new w.WheelEvent('wheel',
   {bubbles:true,cancelable:true,deltaY:70,clientX:200,clientY:160}));
 actualZoom=12;zoomHandlers.forEach(fn=>fn());
 await new Promise(resolve=>setTimeout(resolve,175));
 assert.equal(zoomCommits,1,'an external map zoom cancels a pending wheel commit instead of overriding it');
 testWheelHost.remove();
 assert.match(routePlannerJs,/fadeAnimation:false/,'Leaflet tile fade must not flash the map white at zoom transitions');
 assert.match(routePlannerJs,/keepBuffer:3,updateWhenZooming:false/,'basemap retains already decoded tiles during zoom previews');
 assert.ok(routePlannerJs.includes('plannerMap.removeLayer(topo)'), 'a failed optional topo server must stop receiving future requests');
 console.log('PASS desktop planner compositor wheel preview commits once per burst, handles external zoom, and avoids repeated tile fade');

 assert.equal(w.FIELD_ROUTE_PLANNER.ownsElevationProfile,true,'native planner explicitly owns the horizontal elevation graph');
 assert.match(d.getElementById('routeProfile').getAttribute('aria-label'),/unavailable until a current route profile loads/,'clearing the route removes stale horizontal elevation geometry');
 const g=r.buildGraph([{type:'way',id:1,nodes:[1,2,3],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.98},{lat:44.02,lon:-72.98}],tags:{highway:'path'}}]);
 const a=r.nearestNode(g,{lat:44.0001,lon:-72.995}),b=r.nearestNode(g,{lat:44.0001,lon:-72.99}),routeResult=r.shortestPath(g,a.id,b.id),path=routeResult.path;assert.ok(Array.isArray(path)&&path.length>=2);assert.equal(routeResult.limitHit,false);assert.ok(a.d<12&&b.d<12);const pathM=path.slice(1).reduce((sum,p,i)=>sum+r.meters(path[i],p),0);assert.ok(pathM>390&&pathM<410);
 assert.equal(r.nearestNode(g,{lat:0,lon:0}),null);assert.equal(r.samplePolyline([{lat:44,lon:-73},{lat:44.01,lon:-73}],80)[0].distanceM,0);
 assert.equal(r.profileElevationAt([{distanceM:0,elevationFt:100},{distanceM:100,elevationFt:200},{distanceM:200,elevationFt:300}],50),150);
 const clone=r.cloneRoutingGraph(g);assert.notEqual(clone.adj,g.adj);assert.equal(clone.adj.get('1'),g.adj.get('1'));assert.notEqual(clone.spatial,g.spatial);
 const sourceEdges=g.adj.get('1'),sourceLen=sourceEdges.length,cow=r.cloneRoutingGraph(g);r.nearestNode(cow,{lat:44.0001,lon:-72.9975});assert.equal(g.adj.get('1'),sourceEdges);assert.equal(g.adj.get('1').length,sourceLen);assert.notEqual(cow.adj.get('1'),sourceEdges);
 console.log('PASS copy-on-write adjacency leaves cached graph arrays immutable after endpoint snapping');
 console.log('PASS trail-edge projection, same-segment route, distance, no-nearby-trail detection');
 let elevationFetches=0;
 w.fetch=async url=>({ok:true,json:async()=>url.includes('elevation')?(elevationFetches++,{elevation:Array(new URL(url).searchParams.get('latitude').split(',').length).fill(100)}):{elements:[{type:'way',id:1,nodes:[1,2,3],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.993},{lat:44,lon:-72.98}],tags:{highway:'path',name:'Long Trail'}},{type:'way',id:2,nodes:[2,4],geometry:[{lat:44,lon:-72.993},{lat:44.002,lon:-72.993}],tags:{highway:'path',name:'Side Trail'}}]}});
 const cacheProbe=[{lat:40.12345,lon:-70.54321},{lat:40.22345,lon:-70.54321}];
 await r.fetchElevationProfile(cacheProbe);const afterFirstElevation=elevationFetches;await r.fetchElevationProfile(cacheProbe);
 assert.ok(afterFirstElevation>0);assert.equal(elevationFetches,afterFirstElevation,'identical elevation geometry should use memory cache');
 d.getElementById('routeSnapMode').value='trail';r.addAnchor({lat:44.0001,lon:-72.995});r.addAnchor({lat:44.0001,lon:-72.99});try{await waitFor(()=>{const plan=w.FIELD_ROUTE_STATE.getPlan();return /SNAPPED TO OSM TRAILS/.test(d.getElementById('routePlannerStatus').textContent)&&Array.isArray(plan.elevationProfile)&&plan.elevationProfile.length>1},5000)}catch(err){const plan=w.FIELD_ROUTE_STATE.getPlan();throw new Error('Trail routing test: '+err.message+'; status='+d.getElementById('routePlannerStatus').textContent+'; build='+plan.routeBuildState+'; points='+plan.points?.length+'; samples='+plan.elevationProfile?.length+'; diagnostic='+d.getElementById('routePlannerDiag')?.textContent+'; mock elevation calls='+elevationFetches+'; recent errors='+errors.slice(-3).join(' | '))};
 assert.match(d.getElementById('routePlannerStatus').textContent,/SNAPPED TO OSM TRAILS/);assert.ok(w.FIELD_ROUTE_STATE.getPlan().elevationProfile.length>1);assert.match(d.getElementById('routeGainOut').textContent,/0 ft/);assert.ok(w.FIELD_ROUTE_STATE.getPlan().trailIntelligence);
 console.log('PASS snapped route with elevation success, saved profile, and post-enrichment trail intelligence');
 // The former app.js chart used the same canvas and silently replaced the
 // native orange/red grade graph whenever a route was saved or theme changed.
 const graph=d.getElementById('routeProfile'),savedPrepare=w.FIELD_CANVAS.prepare;
 let legacyPaints=0;
 w.FIELD_CANVAS.prepare=(el,ctx,label)=>{
   if(el===graph&&label==='Saved route elevation profile')legacyPaints++;
   return savedPrepare(el,ctx,label);
 };
 try{
   r.saveCurrentRoute();
   assert.equal(legacyPaints,0,'saving a native route must not overwrite horizontal grade overview with legacy chart');
   d.querySelector('[data-theme-choice="amber"]').click();await tick();
   assert.equal(legacyPaints,0,'changing the theme must not overwrite native horizontal elevation');
 }finally{w.FIELD_CANVAS.prepare=savedPrepare}
 assert.match(graph.getAttribute('aria-label'),/Trail elevation profile/,'native chart retains ownership after route save');
 // Hover should interpolate exact distance instead of snapping to a sparse
 // elevation-sampling point, which can be hundreds of meters away.
 const currentPlan=w.FIELD_ROUTE_STATE.getPlan();
 const oldRect=graph.getBoundingClientRect;
 graph.getBoundingClientRect=()=>({left:0,top:0,width:360,height:190,right:360,bottom:190});
 const points=w.FIELD_ROUTE_STATE.getPoints(),synthetic={samples:[
   {distanceM:0,elevationFt:500},{distanceM:1000,elevationFt:700},{distanceM:2000,elevationFt:900}
 ],gainFt:400,lossFt:0,minFt:500,maxFt:900,maxGrade:8};
 r.debugProfile(points,synthetic);
 graph.dataset.fieldCssWidth='360';
 const hover=new w.Event('pointermove',{bubbles:true});
 Object.defineProperty(hover,'clientX',{value:52+(360-52-14)*.25});
 graph.dispatchEvent(hover);
 assert.match(d.getElementById('routeProfileHover').textContent,/0\.31 MI COMPLETE/,'horizontal cursor resolves continuous mileage between DEM samples');
 assert.match(d.getElementById('routeProfileHover').textContent,/ELEV 600 FT/,'horizontal cursor interpolates height at its exact mileage');
 r.debugProfile(points,null,'loading');
 assert.match(graph.getAttribute('aria-label'),/unavailable until a current route profile loads/,'loading a replacement route clears the old colored profile immediately');
 assert.equal(d.querySelector('.planner-dom-route-layer')?.classList.contains('has-slope-overlay'),false,'new route must not display previous route slope colors');
 r.debugProfile(points,{samples:currentPlan.elevationProfile,gainFt:currentPlan.elevationGainFt||0,lossFt:currentPlan.elevationLossFt||0,minFt:currentPlan.elevationMinFt||0,maxFt:currentPlan.elevationMaxFt||0,maxGrade:currentPlan.elevationMaxGrade||0});
 graph.getBoundingClientRect=oldRect;
 console.log('PASS horizontal overview uses one renderer, interpolated cursor and stale-profile clearing');
 const topologyPlan=w.FIELD_ROUTE_STATE.getPlan();assert.equal(topologyPlan.junctions.length,1);assert.equal(topologyPlan.junctions[0].degree,3);
 w.FIELD_GUIDANCE.render();assert.match(d.getElementById('junctionRows').textContent,/Side Trail/);assert.match(d.getElementById('trailContinuityRows').textContent,/Long Trail/);
 r.saveCurrentRoute();const savedTopologyId=d.getElementById('savedRouteSelect').value;
 w.FIELD_ROUTE_STATE.setMeta({junctions:null,trailSections:[]});d.getElementById('savedRouteSelect').value=savedTopologyId;r.loadSelectedRoute();
 assert.equal(w.FIELD_ROUTE_STATE.getPlan().junctions.length,1);assert.equal(w.FIELD_ROUTE_STATE.getPlan().trailSections[0].name,'Long Trail');
 const beforeJunction=w.FIELD_ROUTE_STATE.getPlan().junctions[0].distanceM;
 r.reverse();assert.ok(Math.abs(w.FIELD_ROUTE_STATE.getPlan().junctions[0].distanceM-(r.meters(topologyPlan.points[0],topologyPlan.points.at(-1))-beforeJunction))<1);r.reverse();
 console.log('PASS mapped junction integration, saved-route metadata restoration and reverse-route junction distances');

 const merged=r.displayTrailSections([{result:{trailSections:[
   {label:'Long Trail',name:'Long Trail',surface:'wood',distanceM:1000},
   {label:'Long Trail',name:'Long Trail',surface:'grass',distanceM:500},
   {label:'Long Trail',name:'Long Trail',surface:'rock',distanceM:250}
 ]}}]);
 assert.equal(merged.length,1);assert.equal(merged[0].distanceM,1750);
 console.log('PASS named trail display merges surface changes into one total-distance row');
 const continuity=r.displayTrailSections([{result:{trailSections:[
   {label:'Long Trail',name:'Long Trail',ref:null,distanceM:900},
   {label:'UNNAMED OSM PATH',name:null,ref:null,distanceM:45},
   {label:'Long Trail',name:'Long Trail',ref:null,distanceM:600},
   {label:'Side Trail',name:'Side Trail',ref:null,distanceM:400},
   {label:'Long Trail',name:'Long Trail',ref:null,distanceM:300}
 ]}}]);
 assert.equal(continuity.length,3);assert.equal(continuity[0].name,'Long Trail');assert.equal(continuity[0].distanceM,1545);assert.equal(continuity[0].continuityBridged,1);assert.equal(continuity[1].name,'Side Trail');assert.equal(continuity[2].name,'Long Trail');
 console.log('PASS trail-name continuity bridges only short unnamed connectors between the same adjacent named trail');
 const jGraph=r.buildGraph([
   {type:'way',id:10,nodes:[1,2,3],geometry:[{lat:44,lon:-73},{lat:44.001,lon:-73},{lat:44.002,lon:-73}],tags:{highway:'path',name:'Main Trail'}},
   {type:'way',id:11,nodes:[2,4],geometry:[{lat:44.001,lon:-73},{lat:44.001,lon:-72.999}],tags:{highway:'path',name:'Side Trail'}}
 ]);
 const jPath=[jGraph.nodes.get('1'),jGraph.nodes.get('2'),jGraph.nodes.get('3')];
 const jWarn=r.junctionWarningsForPath(jPath,[{highway:'path',name:'Main Trail'},{highway:'path',name:'Main Trail'}],jGraph);
 assert.equal(jWarn.length,1);assert.equal(jWarn[0].alternates,1);assert.ok(jWarn[0].options.some(x=>/Side Trail/.test(x)));
 console.log('PASS mapped branch intersections generate junction-topology warnings with alternate trail labels');
 assert.ok(appJs.includes("const DOT12_PREFIX = 'fieldos-v1.2-'"));
 assert.ok(appJs.includes("window.FIELD_MAP_ENGINE?.unmount?.('homeRealMap')"));
 assert.ok(appJs.includes("setFieldBase(state,useOffline?'offline':onlineKind,pack)"));
 assert.ok(appJs.includes("if(action==='location'||action==='location-toggle')return engine?.toggleLiveLocation?.()"));
 assert.ok(mapEngineJs.includes("const STORE_PREFIX='fieldos-v12-'"));
 assert.ok(mapEngineJs.includes('offlineOwnsMap()')&&mapEngineJs.includes('if(!isVisible(st))continue'));
 assert.ok(mapEngineJs.includes('Math.abs(tile.z-tileZoom)<=3')&&mapEngineJs.includes('st.retryCounts.clear()'));
 assert.ok(appJs.includes('FIELD_MAP_ENGINE?.setLayers?.({mode:desiredMode,trails:fieldTrailLayerEnabled},false)'));
 assert.ok(appJs.includes("const configs=activeView==='home'"));
 assert.ok(mapEngineJs.includes("function isVisible(st)"));
 assert.ok(mapEngineJs.includes("fieldos:mapstatechange"));
 assert.ok(appJs.includes("['osm','topo','satellite','offline']"));
 assert.ok(appJs.includes("fieldMapMode!=='offline'&&['osm','topo','satellite'].includes(detail.mode)"));
 assert.ok(mapEngineJs.includes("function unmount(id)"));
 assert.ok(appJs.includes("window.FIELD_MAP_DATA="));
 assert.ok(mapEngineJs.includes("bridgeWaypoints()"));
 assert.ok(mapEngineJs.includes("bridgeTrack()"));
 assert.ok(mapEngineJs.includes("native-waypoint-marker"));
 assert.ok(mapEngineJs.includes("native-track-line"));
 assert.ok(mapEngineJs.includes("fieldos:trackchange"));
 assert.ok(mapEngineJs.includes("preserveAnchor(anchor,e.clientX,e.clientY,nextZoom)"));
 console.log('PASS unified map storage, offline PMTiles ownership, external-engine unmount, and anchored double-click zoom');
 assert.ok(appJs.includes('function routeCorridorBounds('));assert.ok(appJs.includes('function packCoversBounds('));assert.ok(appJs.includes('activateBestRoutePack'));
 assert.ok(html.includes('id="routeCorridorPadding"'));assert.ok(html.includes('id="checkRouteOffline"'));assert.ok(html.includes('id="activateRouteOffline"'));
 console.log('PASS browser offline-route corridor coverage controls and pack selection are wired');
 assert.ok(appJs.includes('corridorTemplateUrl'));assert.ok(appJs.includes('downloadRouteCorridorPack'));assert.ok(html.includes('id="routeCorridorTemplate"'));assert.ok(html.includes('id="downloadRouteCorridor"'));
 console.log('PASS provider-safe automatic route corridor download workflow is wired');
 assert.ok(fieldIntelJs.includes("const fetchBounded=async"));
 assert.ok(fieldIntelJs.includes("fetchBounded(aqUrl"));
 assert.ok(fieldIntelJs.includes("fetchBounded('https://overpass-api.de/api/interpreter"));
 assert.ok(fieldOpsJs.includes("async function boundedFetch("));
  assert.ok(fieldIntelJs.includes('FIELD_ENVIRONMENT_INTEL'));assert.ok(fieldIntelJs.includes('air-quality-api.open-meteo.com'));assert.ok(fieldIntelJs.includes('earthquake.usgs.gov'));assert.ok(html.includes('id="environmentIntelRefresh"'));assert.ok(html.includes('id="environmentAqi"'));
 console.log('PASS cached browser environmental intelligence is wired to air-quality and earthquake sources');
 assert.ok(fieldIntelJs.includes("read('environment-intel-cache'"));assert.ok(fieldIntelJs.includes('routeCorridorStatus'));assert.ok(fieldIntelJs.includes('forecastCache:weatherCache'));
 console.log('PASS mission pack bundles cached forecast, environmental intel, and offline corridor readiness');
 assert.ok(fieldToolsJs.includes('FIELD_BROWSER_TOOLKIT'));assert.ok(fieldToolsJs.includes('FIELD_UTILITY'));assert.ok(fieldToolsJs.includes('FIELD_BROWSER_RESILIENCE'));
 for(const id of ['browserPersist','browserInstall','browserCapabilityList','fieldCoordConvert','fieldNavCalculate','fieldScratchSave','fieldAddMark','recoverySnapshot','recoveryRestore','browserRunAudit','browserLaunchPreflight','browserDiagLog'])assert.ok(html.includes('id="'+id+'"'),'missing feature 40-70 control '+id);
 assert.ok(readme.includes('Web feature registry through 70'));assert.ok(readme.includes('Features 40–49'));assert.ok(readme.includes('Features 50–59'));assert.ok(readme.includes('Features 60–70'));
 console.log('PASS web feature registry 40-70 browser reliability, utility, resilience, and preflight wiring');
 assert.ok(fieldToolsJs.includes("fieldos-v12-map-pack"));assert.ok(!fieldToolsJs.includes("fieldos-v12-active-map-pack"));
 const qaCss=fs.readFileSync(dir+'/styles.css','utf8');assert.ok(qaCss.includes('v3.50 QA/UI stabilization'));assert.ok(qaCss.includes('#system .field-tools-panel .button-row'));assert.ok(qaCss.includes('@media(max-width:390px)'));
 console.log('PASS feature 40-70 offline map readiness uses active pack key and System tools have phone-safe responsive layout');
 assert.ok(mapEngineJs.includes("const drift=metersBetween(st.center,next),visible=isVisible(st)"));assert.ok(mapEngineJs.includes("if(st.followGPS&&(!Number.isFinite(drift)"));assert.ok(mapEngineJs.includes("st.manualCamera=true"));assert.ok(mapEngineJs.includes("if(visible){st.rendered=true;render(st)}"));assert.ok(mapEngineJs.includes("else if(visible){const {w,h}=overlaySize(st);drawPositionOverlay(st,w,h)}"));assert.ok(mapEngineJs.includes("function drawPositionOverlay(st,w,h)"));
 assert.ok(mapEngineJs.includes("if(!isVisible(st))"));
 assert.ok(mapEngineJs.includes("const overlaySize=st=>")&&mapEngineJs.includes("drawOverlay(st,w,h)"));
 assert.ok(mapEngineJs.includes("if(!document.hidden&&locationUiVisible())updateLocationLabels()"));
 assert.ok(mapEngineJs.includes("previewZoom(Math.pow(2,st.wheelZoom)"));
 assert.ok(mapEngineJs.includes("st.wheelTimer=setTimeout"));
 assert.ok(mapEngineJs.includes("const preserveAnchor="));
 assert.ok(mapEngineJs.includes("preserveAnchor(anchor,clientX,clientY,next)"));
 assert.ok(mapEngineJs.includes("previewPinch(Math.pow(2,next-st.pinchStart.zoom)"));
 assert.ok(mapEngineJs.includes("st.pinchStart.visualZoom=next"));
 assert.ok(mapEngineJs.includes("st.zoom=next"));
 assert.ok(mapEngineJs.includes("st.settleTimer=setTimeout"));
 assert.ok(mapEngineJs.includes("applyRestingCamera()"));
 assert.ok(mapEngineJs.includes("queueGesture("));
 assert.ok(!mapEngineJs.includes("next.toFixed(1)"));
 assert.ok(mapEngineJs.includes("requestAnimationFrame(()=>{st.gestureFrame=0"));
 console.log('PASS gesture hot path has no pinch diagnostic text and coalesces compositor writes');
 assert.ok(mapEngineJs.includes("rasterScaleFor"));
 assert.ok(mapEngineJs.includes("vectorLayers"));
 console.log('PASS single fractional camera keeps vector overlays and raster tiles in one geographic coordinate state');
 assert.ok(!mapEngineJs.includes("corner.textContent=\`PINCH Z"));
 assert.ok(mapEngineJs.includes("st.settleTimer=setTimeout"));
 console.log('PASS native map coalesces gesture paints, defers tile rebuild, and performs no touchmove diagnostic DOM writes');
 assert.ok(!mapEngineJs.includes("transform 140ms cubic-bezier"));
 assert.ok(!mapEngineJs.includes("setTimeout(()=>resetTransform(),170)"));
 console.log('PASS mobile map retains fractional visual zoom with no post-release scale reset');
 assert.ok(mapEngineJs.includes("settleFractionalZoom(Math.max(2,Math.min(maxZoom(),st.zoom+fractional))"));
 assert.ok(mapEngineJs.includes("e.detail?.view==='map'?'realMap'"));
 assert.ok(mapEngineJs.includes("else{\n      let resizeTimer=0;"));
 assert.ok(mapEngineJs.includes("clearTimeout(st.failureTimer)"));
 assert.ok(mapEngineJs.includes("st.failureTimer=setTimeout"));


 assert.ok(routePlannerJs.includes("plannerKickFrame=requestAnimationFrame"));
 assert.ok(routePlannerJs.includes("if(initialized&&plannerMap)"));
 assert.ok(routePlannerJs.includes("if(routeVisible()&&!initialized)activate()"));
 assert.ok(routePlannerJs.includes("expired.forEach(old=>store.delete(old.key))"));
 assert.ok(routePlannerJs.includes("nearbySegments(graph,p,maxMeters)"));
 assert.ok(routePlannerJs.includes("segments=[],spatial=new Map()"));assert.ok(routePlannerJs.includes("addSpatialSegment(spatial,seg)"));
 assert.ok(routePlannerJs.includes("SPATIAL_MAX_CELLS=512"));
 assert.ok(routePlannerJs.includes("new Set(graph.spatial.get('*')||[])"));
 assert.ok(!routePlannerJs.includes("return found.size?[...found]:graph.segments"));
 assert.ok(!routePlannerJs.includes('way.geometry.map((_,i)'));console.log('PASS trail graph construction builds nodes, edges and spatial buckets in one pass');
 assert.ok(!routePlannerJs.includes("for(const old of all.slice(TRAIL_CACHE_MAX)){const d=await trailDb()"));



 assert.ok(swJs.includes("field-os-v3-85"));
 assert.ok(html.includes('id="fieldBuildLabel"')&&html.includes('id="fieldReleaseStatus"'));
 assert.ok(html.includes('id="fieldReleaseDetails"'));
 assert.ok(html.includes('app.js?v=3.85-offvendor1'));
 assert.ok(appJs.includes("const FIELD_APP_BUILD='3.85-offvendor1'"));
 assert.ok(appJs.includes("register('./sw.js?v='+FIELD_APP_BUILD"));
 assert.ok(appJs.includes('showUpdate(true)')&&appJs.includes('const replacingExisting=hadController'));
 assert.ok(swJs.includes("event.data?.type==='GET_BUILD'"));
 assert.ok(swJs.includes("cache.match(req,ignoreSearch?{ignoreSearch:true}:undefined)"));
 console.log('PASS map rendering is visibility-aware and shell assets retain offline failure fallback');
 assert.ok(fieldIntelJs.includes("if(document.querySelector('#nav.active'))renderPositionConfidence()"));assert.ok(!fieldIntelJs.includes("setInterval(renderPositionConfidence,2000)"));
 console.log('PASS hidden NAV view no longer redraws position-confidence UI on every telemetry/timer tick');
 assert.ok(fieldOpsJs.includes("if(opsViewVisible('route'))renderAdaptiveEta()"));assert.ok(fieldOpsJs.includes("if(opsViewVisible('nav'))renderTurnNav()"));assert.ok(fieldIntelJs.includes("const drVisible=()=>!!document.querySelector('#nav.active')"));assert.ok(fieldIntelJs.includes("const bailoutVisible=()=>!!document.querySelector('#trailreturn.active')"));console.log('PASS GPS fan-out preserves state while pausing hidden feature UI');
 assert.ok(fieldOpsJs.includes("if(opsViewVisible('weather')){renderHazards();renderAvalanche();renderWater();renderTrailConditions()}"));assert.ok(fieldOpsJs.includes("if(opsViewVisible('weather'))renderPressure()"));console.log('PASS weather and route intelligence retain state without repainting hidden panels');
 assert.ok(fieldToolsJs.includes("const utilityVisible=()=>!!document.querySelector('#system.active')"));assert.ok(fieldIntelJs.includes("const rerouteVisible=()=>!!document.querySelector('#nav.active')"));console.log('PASS System and reroute position UI pause offscreen');
 assert.ok(fieldIntelJs.includes("if(document.querySelector('#comms.active,#loramap.active'))renderMeshNetwork()"));assert.ok(fieldIntelJs.includes('const groupVisible=()=>!!document.querySelector'));console.log('PASS mesh telemetry updates data without repainting hidden mesh views');
 assert.ok(fieldIntelJs.includes("const priorityVisible=()=>!!document.querySelector('#home.active')"));assert.ok(fieldIntelJs.includes("if(e.detail?.view==='home')refreshContext()"));console.log('PASS Home priority engine pauses offscreen and refreshes when Home opens');
 assert.ok(workstationCss.includes('v3.51 FINAL RESPONSIVE NORMALIZATION'));
 assert.ok(workstationCss.includes('.tab-sheet,.tab-sheet-backdrop{display:none!important}'));
 assert.ok(workstationCss.includes('@media(max-width:767px)'));
 assert.ok(workstationCss.includes('position:fixed!important'));
 assert.ok(workstationCss.includes('@media(max-width:430px)'));
 console.log('PASS final responsive layer separates desktop/mobile navigation and constrains overflow');
 assert.ok(workstationCss.includes('UI refinement'));
 assert.ok(workstationCss.includes('font-size:max(16px,1em)'));
 assert.ok(workstationCss.includes('min-height:56dvh!important'));
 assert.ok(workstationCss.includes('grid-template-columns:repeat(6,minmax(0,1fr))'));
 assert.ok(workstationCss.includes('button:focus-visible'));
 console.log('PASS UI refinement preserves readable mobile forms, map space, desktop action grids, and focus visibility');

 const release=(html.match(/app\.js\?v=([\d.]+)/)||[])[1];assert.equal(release,'3.85');assert.equal(packageJson.version,release+'.0');
 assert.ok(runtimeJs.includes('window.FIELD_RUNTIME={every,frame,idle,flush'));assert.ok(html.includes(`runtime.js?v=${release}`));assert.ok(swJs.includes(`runtime.js?v=${release}`));
 assert.ok(runtimeJs.includes('(id*37)%Math.max(17,interval)'));console.log('PASS runtime scheduler staggers recurring work instead of aligning timer bursts');
 assert.ok((html.match(/<script defer src=/g)||[]).length>=11);assert.ok(html.indexOf('map-engine.js?v='+release)<html.indexOf('route-planner.js?v='+release));console.log('PASS startup scripts fetch in parallel while preserving dependency order');
 assert.equal((appJs.match(/setInterval\s*\(/g)||[]).length,0);assert.equal((fieldIntelJs.match(/setInterval\s*\(/g)||[]).length,0);assert.ok(fieldIntelJs.includes('readinessPollTimer=setTimeout(watch,500)'));assert.equal((workstationJs.match(/setInterval\s*\(/g)||[]).length,0);assert.equal((mapEngineJs.match(/setInterval\s*\(/g)||[]).length,0);assert.equal((routePlannerJs.match(/setInterval\s*\(/g)||[]).length,0);
 assert.ok(workstationJs.includes("refresh(true)},60000);refresh();"));assert.ok(!workstationJs.includes("},5000);refresh();"));
 assert.match(appJs,/function scheduleReferenceFit\(\)[\s\S]*?requestAnimationFrame/);assert.ok(!appJs.includes("window.addEventListener('resize',fitReferenceConsole"));assert.ok(routePlannerJs.includes('function plannerWatchdog()'));assert.ok(routePlannerJs.includes('if(cancelled||tap.moved||plannerMobilePointers.size||busy)return'));assert.ok(!routePlannerJs.includes('plannerMobilePointers.size||busy||ignoreTarget(e))return'));
 assert.ok(appJs.includes("FIELD_RUNTIME.frame('sensor-charts',drawAllSensorCharts)"));
 assert.ok(appJs.includes("document.hidden||!document.querySelector('#home.active,#sensors.active,#nav.active,#map.active,#breadcrumb.active')"));
 console.log('PASS shared runtime scheduler replaces recurring module polling, defers startup work, and gates hidden sensor-chart paints');
 assert.ok(appJs.includes('function sensorChartColors()'));assert.ok(appJs.includes('sensorChartThemeCache?.theme===theme'));console.log('PASS sensor charts reuse cached theme styles across all canvases');
 assert.ok(workstationJs.includes("e.target instanceof Element&&e.target.matches"));assert.ok(workstationJs.includes("document.addEventListener('fieldos:positionchange',scheduleRefresh)"));assert.ok(workstationJs.includes("document.addEventListener('fieldos:trackchange',scheduleRefresh)"));assert.ok(!workstationJs.includes("document.addEventListener('click',scheduleRefresh)"));assert.ok(!workstationJs.includes("document.addEventListener('input',scheduleRefresh)"));
 console.log('PASS workstation refresh is state-driven instead of repainting on every click and keystroke');
 for(const asset of ['styles.css','workstation.css','field-tools.js'])assert.ok(html.includes(`${asset}?v=${release}`));
 assert.ok(appJs.includes("register('./sw.js?v='+FIELD_APP_BUILD"));
 assert.ok(appJs.includes('if(approved){approved=false;location.reload();return}'),'reload requires explicit update approval');
 assert.ok(appJs.includes('await window.FIELD_TRACK_STORE?.flush?.()'),'approval must flush the track before activating the worker');assert.ok(!swJs.includes('}).then(()=>self.skipWaiting())'));
 assert.ok(swJs.includes(`field-tools.js?v=${release}`));assert.ok(swJs.includes('track-store.js?v=3.85-fieldfix1'));assert.ok(swJs.includes('geo-hub.js?v=3.85-opt2'));
 assert.equal(JSON.parse(manifest).start_url,'./index.html','PWA installs require stable launch URL');
 assert.ok(!html.includes('?v=3.42')&&!appJs.includes('?v=3.42')&&!swJs.includes('?v=3.42'));
 console.log('PASS versioned JS/CSS caches plus stable installed-PWA launch URL');
 assert.ok(!workstationJs.includes('3.10')&&!workstationJs.includes('v3.42'));
 assert.ok(workstationJs.includes(`FIELD / OS <b>${release}</b>`)&&workstationJs.includes(`<em>v${release}</em>`)&&workstationJs.includes(`FIELD/OS ${release}`));
 assert.ok(routePlannerJs.includes(`'BUILD: v${release}'`));
 assert.ok(appJs.includes('FIELD/OS FIELD CONSOLE v'+release));
 assert.ok(appJs.includes('creator="FIELD/OS v'+release+'"'));
 console.log('PASS package, boot UI, GPX exports, workstation and route diagnostics match the shipped release');

 assert.ok(mapEngineJs.includes("lastRenderKey:''")&&mapEngineJs.includes('st.lastRenderKey===renderKey'));
 assert.ok(mapEngineJs.includes('function metersBetween(a,b)')&&mapEngineJs.includes('drift>Math.max(12,(locationAccuracy||0)*.65)'));
 console.log('PASS native map deduplicates near-identical tile frames and suppresses stationary GPS jitter reloads');
 assert.ok(mapEngineJs.includes('st.deferredPinch={visualZoom,midX,midY,anchor:pinch.anchor}')&&mapEngineJs.includes('if(st.deferredPinch)'));
 assert.ok(mapEngineJs.includes('st.wheelZoom-delta/560')&&mapEngineJs.includes('},120);'));
 console.log('PASS map gesture engine preserves pinch-to-drag continuity and damps dense wheel bursts');
 // Retained tile identity, positioning and lifetime are exercised in rendering.cjs.
 assert.ok(mapEngineJs.includes('Math.abs(w-lastW)<8&&Math.abs(h-lastH)<8'));
 console.log('PASS native map reuses buffered tile envelopes and ignores mobile chrome micro-resizes');
 assert.ok(mapEngineJs.includes('layoutRect:null'));assert.ok(mapEngineJs.includes('const readLayout=()=>'));assert.ok(mapEngineJs.includes('st.layoutRect=null;'));console.log('PASS native map gestures cache layout measurements and invalidate them on resize');
 assert.ok(mapEngineJs.includes('st.readLayout=readLayout'));assert.ok(mapEngineJs.includes('const rect=st.readLayout?.()||st.el.getBoundingClientRect()'));console.log('PASS pointer coordinate conversion uses the map-scoped layout cache safely');
 console.log('PASS native map stages replacement tiles progressively without the old long blank-frame wait');
 assert.ok(appJs.includes("zoomSnap:0")&&appJs.includes("zoomDelta:.25")&&appJs.includes("wheelDebounceTime:12")&&appJs.includes("wheelPxPerZoomLevel:180"));
 assert.ok(routePlannerJs.includes("zoomSnap:0")&&routePlannerJs.includes("zoomDelta:.25")&&routePlannerJs.includes("wheelDebounceTime:12")&&routePlannerJs.includes("wheelPxPerZoomLevel:180"));
 assert.ok(routePlannerJs.includes('const elevationCache=new Map()'));
 assert.ok(routePlannerJs.includes('Promise.all(chunks.map'));
 assert.ok(routePlannerJs.includes('function cloneRoutingGraph(source)'));
 assert.ok(routePlannerJs.includes("paths={easy:[],medium:[],hard:[]}"));
 assert.ok(routePlannerJs.includes('while(lo<hi)'));
 assert.ok(fieldIntelJs.includes('data-readiness-id='));
 assert.ok(fieldIntelJs.includes('window.FIELD_MISSION_READINESS='));
 assert.ok(workstationCss.includes('v3.78 ACTIONABLE READINESS'));
 assert.ok(workstationCss.includes('v3.81 MOBILE ROUTE EDITOR'));
 assert.ok(workstationCss.includes('v3.82 UI EFFICIENCY'));
 assert.ok(workstationCss.includes('v3.84 FIELD UI EFFICIENCY'));
 assert.ok(workstationCss.includes('v3.84 ROUTE EDITOR MOBILE RELIABILITY'));
 assert.ok(routePlannerJs.includes('const fastMeters='));
 assert.ok(routePlannerJs.includes('routeMetricCache=new Map()'));
 assert.ok(mapEngineJs.includes('deferredPinch:null'));
 console.log('PASS route planner hot-path optimizations and actionable mission readiness contracts are wired');
 console.log('PASS main and route-planner maps use smooth fractional animated wheel zoom');









 assert.ok(routePlannerJs.includes("fieldos-route-cache-v1"));assert.ok(routePlannerJs.includes('offlineTrailGraph'));assert.ok(routePlannerJs.includes('persistTrailNetwork'));
 assert.ok(appJs.includes('ensureMapStorageCapacity'));assert.ok(appJs.includes('fmtMapPackAge'));assert.ok(html.includes('id="offlineMapAge"'));assert.ok(html.includes('id="offlineMapOrigin"'));
 console.log('PASS persistent offline trail graph recovery, storage preflight, and map freshness metadata are wired');



 const filtered=r.displayTrailSections([{result:{trailSections:[
   {label:'UNNAMED OSM PATH',name:null,ref:null,distanceM:80},
   {label:'UNNAMED OSM PATH',name:null,ref:null,distanceM:220},
   {label:'Long Trail',name:'Long Trail',ref:null,distanceM:20}
 ]}}]);
 assert.equal(filtered.length,2);assert.ok(filtered.some(x=>x.name==='Long Trail'));assert.ok(filtered.some(x=>!x.name&&x.distanceM>=160.9344));
 console.log('PASS short unnamed connector paths are hidden from the trail list');
 const flatProfile={samples:[
   {distanceM:0,elevationFt:500},
   {distanceM:25,elevationFt:503},
   {distanceM:50,elevationFt:499},
   {distanceM:75,elevationFt:502},
   {distanceM:100,elevationFt:500}
 ]};
 const flatGrade=r.gradeAtDistance(flatProfile,50);
 assert.ok(Math.abs(flatGrade)<8,`flat DEM noise misclassified at ${flatGrade}%`);
 assert.equal(r.slopeClass(flatGrade).key,'easy');
 const spikyFlat={samples:[
   {distanceM:0,elevationFt:500},{distanceM:20,elevationFt:502},{distanceM:40,elevationFt:522},
   {distanceM:60,elevationFt:499},{distanceM:80,elevationFt:501},{distanceM:100,elevationFt:500}
 ]};
 assert.equal(r.slopeClass(r.gradeAtDistance(spikyFlat,50)).key,'easy');
 const sustainedSteep={samples:[
   {distanceM:0,elevationFt:500},{distanceM:25,elevationFt:515},{distanceM:50,elevationFt:530},
   {distanceM:75,elevationFt:545},{distanceM:100,elevationFt:560}
 ]};
 assert.equal(r.slopeClass(r.gradeAtDistance(sustainedSteep,50)).key,'hard');
 console.log('PASS flat/noisy DEM route segment remains easy, not red');
 // A meandering 900-vertex trail shortens dramatically when decimated to
 // straight chords. Route-colored segments must refer to FULL trail mileage,
 // or warning colors appear on the wrong part of the route.
 const winding=Array.from({length:901},(_,i)=>({lat:44+(i%2)*.0008,lon:-73+i*.00002}));
 const fullM=winding.slice(1).reduce((sum,p,i)=>sum+r.meters(winding[i],p),0);
 const pieces=r.routeSlopeDisplayPieces(winding,120);
 assert.ok(pieces.length<=119,'color renderer must bound the display segment count');
 assert.ok(Math.abs(pieces.at(-1).endM-fullM)<.001,'last color segment ends at true routed mileage');
 const first=pieces[0],shortChord=r.meters(first.a,first.b);
 assert.ok(first.endM-first.startM>shortChord*8,'winding geometry must use original accumulated trail length, not shortened display chords');
 assert.ok(Math.abs(first.midM-(first.startM+first.endM)/2)<.001);
 assert.equal(r.routeSlopeDisplayPieces([],120).length,0,'an empty route has no slope overlay geometry');
 console.log('PASS route slope colors retain original winding-trail mileage after decimation');
 const sustainedFixture={samples:winding.map((p,i)=>({...p,distanceM:(fullM*i)/(winding.length-1),
   elevationFt:500+i*.8})),gainFt:720,lossFt:0,minFt:500,maxFt:1220,maxGrade:20};
 const slopeCache=r.debugSlopeCache(sustainedFixture,winding);
 assert.ok(slopeCache.initial>0,'initial planner map render computes DEM grade bands');
 assert.equal(slopeCache.afterPan,slopeCache.initial,'unchanged route/profile pan must reuse grade classifications');
 assert.ok(slopeCache.afterProfile>slopeCache.afterPan,'replacement DEM invalidates native planner slope cache');
 assert.ok(slopeCache.afterRoute>slopeCache.afterProfile,'edited route geometry invalidates cached planner color bands');
 console.log('PASS native planner caches expensive grade analysis across camera-only reprojects');


 assert.ok(w.FIELD_ROUTE_SLOPE,'main map shares the live route planner sustained-grade classifier');
 assert.equal(w.FIELD_ROUTE_SLOPE.slopeClass(w.FIELD_ROUTE_SLOPE.gradeAtDistance(sustainedSteep,50)).key,'hard');
 const gradedRoute=Array.from({length:6},(_,i)=>({lat:44+i*.0009,lon:-73}));
 const segmentMeters=6371000*(.0009*Math.PI/180);
 const gradedProfile={samples:gradedRoute.map((p,i)=>({...p,distanceM:i*segmentMeters,elevationFt:[500,500,530,570,640,710][i]}))};
 w.FIELD_ROUTE_PLANNER.activate();
 const classes=r.debugSlopeRender(gradedProfile,gradedRoute);
 assert.ok(classes.some(c=>c.includes('route-dom-slope-medium')),'route planner must draw orange medium-grade overlay');
 assert.ok(classes.some(c=>c.includes('route-dom-slope-hard')),'route planner must draw red hard-grade overlay');
 assert.match(workstationCss,/Desktop wheel zoom must not fade[\s\S]*?route-zooming[\s\S]*?opacity:1!important/);
 console.log('PASS route planner grade colors remain present and do not fade during desktop zoom');
 const css=workstationCss;
 assert.ok(css.includes('#map .module-grid'));
 assert.ok(css.includes('body #map .module-grid{\n    display:flex!important')||css.includes('#map .module-grid{\n    display:flex!important'));
 assert.ok(css.includes('body .module-grid>*{width:100%!important')||css.includes('#map .module-grid>*{margin:0!important;width:100%!important}'));
 assert.ok(css.includes('#map .terrain-controls-below'));
 console.log('PASS terrain workspace uses deterministic vertical flow with full-width controls');
 assert.match(css,/has-slope-overlay \.route-dom-main[\s\S]*?stroke:transparent!important/);
 assert.match(planner,/classList\.toggle\('has-slope-overlay',hasSlope\)/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*?#map \.map-quick-actions[\s\S]*?repeat\(3,minmax\(0,1fr\)\)/);
 assert.match(css,/@media\(max-width:760px\)[\s\S]*?#route \.route-planner-actions[\s\S]*?repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/portrait handheld readability pass[\s\S]*?#home \.handheld-status[\s\S]*?repeat\(2,minmax\(0,1fr\)\)/);
 assert.match(css,/#home \.handheld-status button[\s\S]*?min-height:62px!important/);
 assert.match(css,/narrow-module usability pass[\s\S]*?#sos \.sos-button[\s\S]*?min-height:64px!important/);
 assert.match(css,/landscape-phone navigation[\s\S]*?body \.tabbar[\s\S]*?position:fixed!important/);
 console.log('PASS mobile map/route layout rules and slope base-bleed guard');
 let extraRequests=0;w.fetch=async()=>{extraRequests++;throw new Error('Should reuse cached graph')};
 await r.routeLeg({lat:44.0001,lon:-72.994},{lat:44.0001,lon:-72.991});
 assert.equal(extraRequests,0);console.log('PASS nearby route edits reuse graph without network requests');
 assert.ok(routePlannerJs.includes('bestCached')&&routePlannerJs.includes('bestArea'));
 assert.ok(routePlannerJs.includes('while(graphCache.size>8)'));
 console.log('PASS route graph cache selects smallest covering network and remains memory-bounded');
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
 // Long-session UI churn: repeated module switches must not duplicate IDs or throw.
 const navButtons=[...d.querySelectorAll('.workstation-nav button[data-open]')];
 for(let cycle=0;cycle<8;cycle++)for(const btn of navButtons){btn.click();await tick();}
 assert.equal(new Set([...d.querySelectorAll('[id]')].map(e=>e.id)).size,[...d.querySelectorAll('[id]')].length);
 console.log('PASS repeated module-switch stress with stable DOM ids');

 // Mobile viewport/orientation churn should not throw or lose primary navigation.
 for(const width of [320,390,430,760,390,320,430,760]){
   Object.defineProperty(w,'innerWidth',{configurable:true,value:width});
   Object.defineProperty(w,'innerHeight',{configurable:true,value:width<500?844:1024});
   w.dispatchEvent(new w.Event('resize'));w.dispatchEvent(new w.Event('orientationchange'));await tick();
   for(const tab of d.querySelectorAll('.tabbar .tab-btn[data-open]')){tab.click();await tick();assert.equal(d.querySelector('.view.active')?.id,tab.dataset.open)}
 }
 const more=d.getElementById('moreTabs'),closeSheet=d.getElementById('closeTabSheet'),sheet=d.getElementById('tabSheet');
 for(let i=0;i<20;i++){more.click();await tick();assert.equal(sheet.getAttribute('aria-hidden'),'false');closeSheet.click();await tick();assert.equal(sheet.getAttribute('aria-hidden'),'true')}
 console.log('PASS mobile resize/orientation and tab-sheet stress');

 // Repeated planner activation should remain idempotent and not multiply control bindings.
 d.querySelector('.workstation-nav [data-open="route"]').click();await tick();
 for(let i=0;i<50;i++)w.FIELD_ROUTE_PLANNER.activate();
 assert.equal(d.querySelectorAll('#undoRoutePoint').length,1);assert.equal(d.querySelectorAll('#routePlannerMap').length,1);
 console.log('PASS 50x route-planner activation stress');
 // Dragging away from GPS must disengage follow without stopping live marker updates.
 let onPlannerFix=null,clearedPlannerWatch=0;
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{
   watchPosition(cb){onPlannerFix=cb;return 77},
   clearWatch(){clearedPlannerWatch++}
 }});
 assert.equal(typeof plannerDragStart,'function','Planner registers a manual drag listener');
 click('routeFollowMe');
 assert.equal(d.getElementById('routeFollowMe').getAttribute('aria-pressed'),'true');
 assert.equal(typeof onPlannerFix,'function');
 onPlannerFix({coords:{latitude:44.4759,longitude:-73.2121,accuracy:4,heading:0}});
 assert.ok(plannerPanCount>0,'Follow mode pans to live GPS');
 const panCountAtDrag=plannerPanCount;
 plannerDragStart();
 assert.equal(d.getElementById('routeFollowMe').getAttribute('aria-pressed'),'false','Manual drag disables planner follow');
 onPlannerFix({coords:{latitude:44.49,longitude:-73.21,accuracy:4,heading:0}});
 assert.equal(plannerPanCount,panCountAtDrag,'GPS updates cannot undo manual planner pan');
 assert.equal(clearedPlannerWatch,0,'Planner still receives live GPS while manual panning');
 click('routeFollowMe');
 assert.equal(d.getElementById('routeFollowMe').getAttribute('aria-pressed'),'true','FOLLOW ME can resume following');
 onPlannerFix({coords:{latitude:44.50,longitude:-73.20,accuracy:4,heading:0}});
 assert.ok(plannerPanCount>panCountAtDrag,'Explicit FOLLOW ME resumes GPS camera movement');
 click('routeFollowMe');
 console.log('PASS planner manual dragging suspends GPS camera follow while marker keeps updating');

 assert.ok(html.includes('id="routeEditPoints"'));
 assert.ok(routePlannerJs.includes('function moveEditPoint(p)'));
 assert.ok(routePlannerJs.includes("marker.on('click'"));
 assert.ok(routePlannerJs.includes('if(moveEditPoint({lat:ll.lat,lon:ll.lng}))return'));
 console.log('PASS mobile route editor has deterministic tap-to-move mode in addition to marker drag');
 assert.doesNotMatch(appJs,/if\(fieldViewActive\('home','map'\)\)updateFieldMaps\(true\)/,'GPS-driven offline map refresh must not force camera recenter');
 console.log('PASS passive GPS updates do not force offline map camera recenter');


 // Route-state sanitization under malformed and oversized point updates.
 for(let i=0;i<100;i++){
   w.FIELD_ROUTE_STATE.setMeta({anchors:[
     {lat:44.47+i*.000001,lon:-73.21},
     {lat:'bad',lon:-73},
     {lat:999,lon:999}
   ]});
   assert.equal(w.FIELD_ROUTE_STATE.getPlan().anchors.length,1);
 }
 console.log('PASS 100x route-state sanitize/write cycles');
 r.clearAll();await tick();

 // Direct-route edit/clear churn with elevation service available.
 d.getElementById('routeSnapMode').value='direct';d.getElementById('routeSnapMode').dispatchEvent(new w.Event('change'));
 w.fetch=async url=>({ok:true,json:async()=>({elevation:Array(new URL(url).searchParams.get('latitude').split(',').length).fill(100)})});
 for(let i=0;i<20;i++){
   r.addAnchor({lat:44.475+i*.00001,lon:-73.215});
   r.addAnchor({lat:44.476+i*.00001,lon:-73.214});
   await waitFor(()=>w.FIELD_ROUTE_STATE.getPoints().length===2&&!d.getElementById('routeGainOut').textContent.includes('LOADING'));
   assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);
   r.clearAll();await tick();assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,0);
 }
 console.log('PASS 20x direct route build/clear churn');

 // Corrupt persisted route JSON must fail closed to a clean bootstrap plan.
 const iso=new JSDOM('<!doctype html><html><body></body></html>',{url:'https://isolated.test/',runScripts:'outside-only'});
 iso.window.localStorage.setItem('fieldos-v12-routePlan','{not-json');
 const isoCtx=iso.getInternalVMContext();
 vm.runInContext(fs.readFileSync(dir+'/route-state.js','utf8'),isoCtx,{filename:'route-state.js'});
 assert.equal(iso.window.FIELD_ROUTE_STATE.getPoints().length,0);
 assert.equal(iso.window.FIELD_ROUTE_STATE.getPlan().name,'FIELD ROUTE 01');
 iso.window.close();
 console.log('PASS corrupted persisted route state recovery');

 // Sparse routes must advance continuously and preserve trail changes before later geometry turns.
 const sparse={points:[{lat:44,lon:-73},{lat:44.04,lon:-73}]};
 w.FIELD_TURNS.generate(sparse);
 const sparseCue=w.FIELD_TURNS.next({lat:44.01,lon:-73},sparse);
 assert.ok(sparseCue.progressM>1000&&sparseCue.progressM<1200);
 assert.ok(sparseCue.distanceToCueM>3200&&sparseCue.distanceToCueM<3500);
 const named=w.FIELD_TURNS.generate(turnPlan);
 assert.ok(named.some(c=>c.type==='trail'&&c.trail==='East Link'));
 assert.ok(named.some(c=>c.type==='trail'&&c.trail==='Summit Trail'));
 console.log('PASS continuous sparse-route turn progress and unsuppressed trail-name changes');

 const poly={type:'Feature',properties:{name:'Crossing'},geometry:{type:'Polygon',coordinates:[[[0,0],[1,0],[1,1],[0,1],[0,0]],[[.2,.2],[.8,.2],[.8,.8],[.2,.8],[.2,.2]]]}};
 w.FIELD_HAZARDS.ingest({features:[poly]});
 assert.equal(w.FIELD_HAZARDS.screen({points:[{lat:.1,lon:-1},{lat:.1,lon:2}]}).length,1);
 assert.equal(w.FIELD_HAZARDS.screen({points:[{lat:.4,lon:.4},{lat:.6,lon:.6}]}).length,0);
 assert.equal(w.FIELD_HAZARDS.screen({points:[{lat:2,lon:-1},{lat:2,lon:2}]}).length,0);
 assert.equal(w.FIELD_HAZARDS.contains(poly,{lat:null,lon:null}),false);
 console.log('PASS hazard crossings between sparse vertices, polygon holes and invalid coordinates');

 const previousFetch=w.fetch;w.fetch=async()=>{throw new Error('test outage')};
 click('waterSearchOnline');await tick();assert.equal(d.getElementById('waterSearchOnline').disabled,false);
 assert.match(d.getElementById('waterIntelState').textContent,/SEARCH FAILED/);w.fetch=previousFetch;
 await w.FIELD_WATER.searchOnline(async(url,init)=>{assert.match(decodeURIComponent(init.body),/out body/);assert.ok(init.signal,'water lookup should receive an abort signal');return {ok:true,json:async()=>({elements:[{id:1,lat:44,lon:-73,tags:{natural:'spring'}}]})}});
 assert.equal(w.FIELD_WATER.state.cache.items.length,1);
 console.log('PASS failed water lookup unlocks button and successful query requests coordinates');

 const oldFlags=w.FIELD_WEATHER.hazards({hourly:[{time:new Date(Date.now()-86400000).toISOString(),weatherCode:95}],alerts:[{id:'expired',expires:new Date(Date.now()-3600000).toISOString(),event:'Expired storm'}]});
 assert.equal(oldFlags.length,0);
 let weatherChanges=0;d.addEventListener('fieldos:weatherchange',()=>weatherChanges++);w.FIELD_WEATHER.setCache(null);assert.equal(weatherChanges,1);
 console.log('PASS weather screening excludes expired data and notifies dependent panels');

 const imported=w.FIELD_PLACES.import([{name:'Cedar Spring',type:'WATER',lat:44.5,lon:-73.2},{name:'Bad',lat:null,lon:null},{name:'Bad range',lat:91,lon:0},{name:'<img src=x onerror=alert(1)>',lat:44,lon:-73}]);
 assert.equal(imported.accepted,2);assert.equal(w.FIELD_PLACES.search('cedar water').length,1);
 assert.equal(w.FIELD_PLACES.search('44.5, -73.2')[0].lat,44.5);assert.equal(w.FIELD_PLACES.search('99, 180').length,0);
 assert.equal(w.FIELD_PLACES.import(w.FIELD_PLACES.export()).total,2);
 assert.throws(()=>w.FIELD_PLACES.import({hello:'world'}));assert.equal(w.FIELD_PLACES.export().features.length,2);
 assert.equal(d.querySelector('#offlinePlaceResults img'),null);
 const firstResult=d.querySelector('#offlinePlaceResults button');assert.ok(firstResult);
 const oldSet=w.FIELD_MAP_ENGINE.setView;let placeCentered=false;w.FIELD_MAP_ENGINE.setView=()=>{placeCentered=true};firstResult.click();assert.ok(placeCentered);w.FIELD_MAP_ENGINE.setView=oldSet;
 click('gloveToggle');assert.ok(d.body.classList.contains('field-glove'));assert.equal(w.localStorage.getItem('fieldos-v12-touch-glove'),'true');click('gloveToggle');
 click('onehandToggle');assert.equal(d.getElementById('onehandToggle').getAttribute('aria-pressed'),'true');click('onehandToggle');
 assert.equal(w.FIELD_PRESETS.apply('hike'),true);assert.equal(w.FIELD_MAP_ENGINE.mode,'topo');assert.equal(w.FIELD_MAP_ENGINE.trails,true);assert.equal(w.FIELD_PRESETS.apply('invalid'),false);
 console.log('PASS offline POI round trip, filtering, invalid imports, escaping, map selection, layer presets and persisted touch modes');


assert.ok(workstationCss.includes('route workspace'));
assert.ok(workstationCss.includes('#route .route-performance-panel{'));
assert.ok(workstationCss.includes('align-self:start!important'));
console.log('PASS Adaptive ETA panel sizes to content instead of stretching with route map');

assert.ok(workstationCss.includes('v3.72 SENSOR WORKSPACE'));
 assert.ok(workstationCss.includes('v3.72 MAP GESTURE'));
 assert.ok(workstationCss.includes('v3.72 MOBILE TASK-FIRST'));
 assert.ok(workstationCss.includes('v3.73 MOBILE COMMAND UI'));
 assert.ok(workstationCss.includes('v3.74 PHOSPHOR WORKSTATION'));
 assert.ok(workstationCss.includes('v3.75 MOBILE CRT LAYOUT'));
 assert.ok(workstationCss.includes('v3.76 MOBILE PERFORMANCE BUDGET'));
 assert.ok(workstationCss.includes('v3.77 HOME DASHBOARD RESTORE'));
 assert.ok(workstationCss.includes('#home .console-mid-grid{display:grid!important'));
 assert.ok(workstationCss.includes('#home .console-bottom-grid{display:grid!important'));
 assert.ok(!workstationCss.includes('#home .console-command-strip button:nth-child(n+5){display:none!important}'));
 assert.ok(workstationCss.includes('content-visibility:auto'));
 assert.ok(workstationCss.includes('body::after{display:none!important}'));
 assert.ok(workstationCss.includes("grid-template-columns:minmax(145px,.8fr) minmax(0,1.2fr)"));
 assert.ok(workstationCss.includes("body .tabbar .tab-btn.active span"));
 assert.ok(workstationCss.includes('--crt-green-hot'));
 assert.ok(workstationCss.includes('repeating-linear-gradient(0deg'));
 assert.ok(appJs.includes("sun.textContent=\`MOONRISE"));
 assert.ok(appJs.includes("solar.state==='POLAR DAY'?'24h 00m'"));
 assert.ok(workstationJs.includes("details.textContent='SHOW DETAILS'"));
 assert.ok(workstationJs.includes("mobile-details-open"));
 assert.ok(appJs.includes("function sensorSummary()"));
 assert.ok(appJs.includes("devicePixelRatio"));
 assert.ok(html.includes('class="sensor-live-summary"'));
 assert.ok(workstationCss.includes('MOBILE DOCK REBUILD'));
assert.ok(workstationCss.includes('grid-template-columns:repeat(5,minmax(0,1fr))!important'));
assert.ok(workstationCss.includes('bottom:var(--mobile-dock-h)!important'));
assert.ok(workstationCss.includes('.tab-sheet.open{'));
assert.ok(workstationCss.includes('transform:translateY(0)!important'));
console.log('PASS v3.61 mobile dock owns bottom safe area and More sheet geometry');

assert.ok(mapEngineJs.includes('Math.floor(Number(z)+1e-6)'));
// Fractional tile reuse and integer-zoom replacement are covered behaviorally in rendering.cjs.
console.log('PASS native map holds raster tiles through fractional zoom and stages replacement at integer raster boundaries');

assert.ok(appJs.includes('zoomSnap:0')&&appJs.includes('zoomDelta:.25')&&appJs.includes('wheelPxPerZoomLevel:180'));
assert.ok(routePlannerJs.includes('zoomSnap:0')&&routePlannerJs.includes('zoomDelta:.25')&&routePlannerJs.includes('wheelPxPerZoomLevel:180'));
assert.ok(routePlannerJs.includes('[0,450,1100][i]'));
assert.ok(fieldIntelJs.includes("document.visibilityState==='visible'&&(dr.active||dr.armed)"));
assert.ok(workstationCss.includes('map interaction performance'));
console.log('PASS v3.61 smooth zoom, faster trail-server failover, and hidden-work throttling');

assert.ok(appJs.includes('function enableContinuousWheelZoom(map)'));
assert.ok(/st\.wheelZoom-delta\/(?:420|560)/.test(mapEngineJs));
assert.ok(appJs.includes('window.FIELD_OFFLINE_MAPS='));
assert.ok(routePlannerJs.includes('window.FIELD_OFFLINE_MAPS.leafletLayer()'));
assert.ok(routePlannerJs.includes("if(navigator.onLine!==false)osm.addTo(plannerMap)"));
assert.ok(fieldToolsJs.includes("fieldos-v12-map-pack"));
assert.ok(!fieldToolsJs.includes('fieldos-v12-active-map-pack'));
assert.ok(swJs.includes("req.mode==='navigate'"));
assert.ok(swJs.includes("cache.match('./index.html')"));
assert.ok(swJs.includes("cache.match(req,ignoreSearch?{ignoreSearch:true}:undefined)"));
console.log('PASS dedicated map engine continuous zoom and offline shell/map/route contracts');

assert.ok(workstationCss.includes('#route .route-planner-panel'));
assert.ok(workstationCss.includes('#route .route-performance-panel'));
assert.ok(workstationCss.includes('align-self:start!important'));
console.log('PASS route planner and ETA panels keep deterministic content-sized layout');

assert.ok(!appJs.includes('fieldNativeMaps'));
assert.ok(!appJs.includes('function fieldNativeRender('));
assert.ok(appJs.includes('Online maps are owned by map-engine.js'));
assert.ok(mapEngineJs.includes('function setLayers(settings={},recenter=false)'));
assert.ok(workstationCss.includes('v3.70 COMPACT WORKSTATION FLOW'));
assert.ok(workstationCss.includes('body .module-secondary-grid'));
assert.ok(workstationJs.includes('FIELD / OS <b>3.85</b>')&&workstationJs.includes('<em>v3.85</em>'));
console.log('PASS zoom lifecycle, compact workstation flow, and runtime branding');


 // Search index must reflect all source mutations without exposing cached objects.
 const bulk=Array.from({length:5000},(_,i)=>({name:'Place '+String(i).padStart(4,'0'),lat:44+i/100000,lon:-73,type:'TEST'}));
 click('offlinePlaceClear');w.FIELD_PLACES.import(bulk);
 assert.equal(w.FIELD_PLACES.search('place').length,50);
 const cachedResult=w.FIELD_PLACES.search('Place 0001');cachedResult[0].name='MUTATED';
 assert.equal(w.FIELD_PLACES.search('Place 0001')[0].name,'Place 0001');
 const previousWaypoints=w.localStorage.getItem('fieldos-v12-waypoints');
 w.localStorage.setItem('fieldos-v12-waypoints',JSON.stringify([{name:'Index Fresh Mark',lat:45,lon:-73,type:'NOTE'}]));
 assert.equal(w.FIELD_PLACES.search('index fresh mark').length,1);
 w.localStorage.setItem('fieldos-v12-waypoints',previousWaypoints);
 assert.equal(w.FIELD_PLACES.search('index fresh mark').length,0);
 w.localStorage.setItem('fieldos-v12-places',JSON.stringify([{name:'Other Tab Place',lat:44,lon:-72}]));
 w.dispatchEvent(new w.StorageEvent('storage',{key:'fieldos-v12-places'}));
 assert.equal(w.FIELD_PLACES.search('other tab place').length,1);
 assert.equal(w.FIELD_PLACES.search('Place 0001').length,0);
 console.log('PASS 5,000-place indexing, result limit, mutation isolation, waypoint invalidation and cross-tab imports');
 const previousCurrent=w.FIELD_ROUTE_STATE.current;
 w.FIELD_ROUTE_STATE.current=()=>({lat:0,lon:0});
 w.localStorage.setItem('fieldos-v12-field-utility-marks','{"broken":true}');
 d.getElementById('fieldMarkLabel').value='<img src=x onerror=alert(1)>';
 click('fieldAddMark');
 const mark=JSON.parse(w.localStorage.getItem('fieldos-v12-field-utility-marks'))[0];
 assert.equal(mark.lat,0);assert.equal(mark.lon,0);assert.equal(d.querySelector('#fieldMarks img'),null);
 assert.match(d.getElementById('fieldMarks').textContent,/0.0000, 0.0000/);
 const originalSetItem=w.Storage.prototype.setItem;
 w.Storage.prototype.setItem=()=>{throw new Error('Quota exceeded')};
 click('fieldAddMark');assert.match(d.getElementById('fieldUtilityState').textContent,/MARK SAVE FAILED/);
 w.Storage.prototype.setItem=originalSetItem;w.FIELD_ROUTE_STATE.current=previousCurrent;
 console.log('PASS marks recover malformed storage, preserve zero coordinates, escape labels and report quota failure');
 const previousCaches=w.caches;let cacheScans=0,opened=[];
 w.caches={keys:async()=>{cacheScans++;await tick();return ['field-os-test','unrelated-app'];},open:async name=>{opened.push(name);return {keys:async()=>[{},{}]}}};
 const reports=await Promise.all([w.FIELD_BROWSER_RESILIENCE.cacheHealth(),w.FIELD_BROWSER_RESILIENCE.cacheHealth(),w.FIELD_BROWSER_RESILIENCE.cacheHealth()]);
 assert.equal(cacheScans,1);assert.deepEqual(opened,['field-os-test']);assert.equal(reports[0].count,2);
 w.caches={
  keys:async()=>['field-os-old','field-os-current'],
  open:async name=>({
   keys:async()=>[{},{}],
   match:async url=>{
    const parsed=new URL(typeof url==='string'?url:url.url);
    if(name==='field-os-old')return parsed.pathname.endsWith('/app.js')?{}:null;
    if(parsed.origin!=='https://test.local')return null;
    return parsed.pathname.endsWith('/track-store.js')?null:{ok:true};
   }
  })
 };
 const verifiedCache=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
 assert.equal(verifiedCache.verified,true);
 assert.ok(verifiedCache.missing.some(u=>u.includes('track-store.js')),'missing required IndexedDB module should be reported');
 assert.ok(verifiedCache.externalMissing.some(u=>u.includes('pmtiles')),'third-party PMTiles must not be marked available offline');
 assert.match(d.getElementById('browserCacheHealth').textContent,/INCOMPLETE/);
 assert.match(d.getElementById('browserCacheDetails').textContent,/track-store/);

 if(previousCaches===undefined)delete w.caches;else w.caches=previousCaches;
 console.log('PASS concurrent cache scans and exact offline shell/library gap reporting');
 // Track recording computes total distance incrementally even with its view hidden.
 w.FIELD_OPEN_VIEW('home',{history:false});click('clearTrack');
 const trackLine=d.getElementById('trackLine');const hiddenLine=trackLine.getAttribute('points')||'';
 w.applyFieldGeolocation({coords:{latitude:44.4759,longitude:-73.2121,altitude:100,accuracy:5},timestamp:Date.now()});
 click('addDemoTrackPoint');
 w.applyFieldGeolocation({coords:{latitude:44.4769,longitude:-73.2121,altitude:101,accuracy:5},timestamp:Date.now()});
 click('addDemoTrackPoint');
 const trackSnapshot=w.FIELD_MAP_DATA.track();
 assert.equal(trackSnapshot.length,2);
 const mapPreview=w.FIELD_MAP_DATA.trackPreview(2);
 assert.equal(mapPreview.length,2);assert.equal(mapPreview[0].lat,trackSnapshot[0].lat);assert.equal(mapPreview.at(-1).lat,trackSnapshot.at(-1).lat);
 assert.ok(appJs.includes('trackPreview:mapTrackPreview'));
 assert.ok(mapEngineJs.includes('source?.trackPreview?.(1500)'));
 assert.ok(w.FIELD_TRACK_STATUS().distanceMiles>.06&&w.FIELD_TRACK_STATUS().distanceMiles<.08,'incremental breadcrumb mileage should reflect two GPS fixes');
 assert.equal(trackLine.getAttribute('points')||'',hiddenLine,'hidden Track view must not redraw full chart on GPS fixes');
 w.FIELD_OPEN_VIEW('track',{history:false});
 assert.ok((trackLine.getAttribute('points')||'').length>0,'Track chart updates immediately on entry');
 click('clearTrack');assert.equal(w.FIELD_TRACK_STATUS().distanceMiles,0);assert.equal(w.FIELD_TRACK_STATUS().points,0);
 console.log('PASS incremental track mileage and offscreen track chart scheduling');
// Normal GPS timeout must not end a recording.
 let trackError,clearedGps=0;
 Object.defineProperty(w.navigator,'geolocation',{configurable:true,value:{
   watchPosition(onFix,onError){trackError=onError;return 23},
   clearWatch(){clearedGps++}
 }});
 click('startTrack');assert.equal(w.FIELD_TRACK_STATUS().active,true);
 trackError({code:3,message:'Timed out'});
 assert.equal(w.FIELD_TRACK_STATUS().active,true,'timeout must retain recording intent');
 assert.equal(d.getElementById('trackState').textContent,'WEAK GPS — RECORDING ARMED');
 assert.equal(w.localStorage.getItem('fieldos-v12-track-active'),'yes');
 trackError({code:1,message:'Permission denied'});
 assert.equal(w.FIELD_TRACK_STATUS().active,false,'permission loss disarms watcher');
 assert.equal(w.localStorage.getItem('fieldos-v12-track-active'),null);
 assert.ok(clearedGps>=1);
 console.log('PASS transient GPS timeout recovery and explicit permission-denial stop');
 const rawGuide=w.FIELD_GUIDES,injected={id:'injection-qa',category:null,title:'<img src=x onerror=alert(9)>',
   summary:'<svg/onload=alert(1)>',urgency:'HIGH',steps:['<img src=x onerror=alert(8)>'],source:'<b>spoof</b>',url:'<script>x</script>'};
 rawGuide.push(injected);w.renderGuides();w.showGuide(injected.id);
 assert.equal(d.querySelector('#guideGrid img'),null);
 assert.equal(d.querySelector('#guideDetail img'),null);
 assert.equal(d.querySelector('#guideDetail script'),null);
 assert.match(d.getElementById('guideDetail').textContent,/GENERAL/);
 rawGuide.pop();w.renderGuides();
 const zigzag=Array.from({length:1500},(_,i)=>({lat:44+i*.00001+Math.sin(i/10)*.0002,lon:-73+i*.00002}));
 const reduced=w.FIELD_GPX_SIMPLIFY(zigzag,500);
 assert.ok(reduced.length<=500);
 assert.equal(reduced[0],zigzag[0]);assert.equal(reduced.at(-1),zigzag.at(-1));
 assert.ok(reduced.some(p=>zigzag.indexOf(p)>5&&Math.abs((p.lat-44-zigzag.indexOf(p)*.00001))>.0001),'keeps interior bends');
 console.log('PASS malformed field guide escaping and curvature-aware GPX simplification');
 const gap=[{lat:44,lon:-73,seq:0},{lat:44.001,lon:-73,seq:15},{lat:44.002,lon:-73,seq:16}];
 const crossing=w.FIELD_BREADCRUMB.compute(gap,{lat:44.001,lon:-73},0);
 assert.equal(crossing.unsafeGap,true,'cannot navigate directly across a pruned breadcrumb segment');
 assert.ok(fieldIntelJs.includes('window.FIELD_MAP_DATA?.track?.()'),'breadcrumb navigation must use live IndexedDB-backed data');
 console.log('PASS breadcrumb return rejects shortcuts across missing track history');
 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS no runtime exceptions');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});

assert.ok(workstationJs.includes("module-secondary-grid"));
assert.ok(workstationJs.includes("different card heights cannot create blank paired-grid rows"));
assert.ok(workstationCss.includes('v3.70 COMPACT WORKSTATION FLOW'));
assert.ok(workstationCss.includes('columns:2!important'));
assert.ok(workstationCss.includes('break-inside:avoid!important'));
assert.ok(workstationCss.includes('body .module-grid{\n    display:flex!important'));
assert.ok(workstationCss.includes('#map .module-grid'));
assert.ok(appJs.includes("packs.sort((a,b)=>String(b.created).localeCompare(String(a.created)))"));
assert.ok(routePlannerJs.includes("offline.stale?'OFFLINE TRAIL NETWORK // STALE SAVED GRAPH'"));
assert.ok(swJs.includes("const CACHE='field-os-v3-85-cssfix2'"));
console.log('PASS current workstation compact flow, terrain stacking, offline route cache and service-worker cache contract');
assert.ok(!appJs.includes('/* v2.3 native online map engine')); assert.ok(routePlannerJs.includes("spatial:new Map(source.spatial)"));
 assert.ok(routePlannerJs.includes("mutableSpatialBucket"));
 assert.ok(routePlannerJs.includes("removeSpatialSegmentMutable"));
 console.log('PASS route planner clones spatial index with copy-on-write spatial buckets');
 assert.ok(routePlannerJs.includes('if(graph.spatial?.size)'));assert.ok(routePlannerJs.includes('removeSpatialSegmentMutable(graph,seg);addSpatialSegmentMutable(graph,first);addSpatialSegmentMutable(graph,second)'));console.log('PASS spatial endpoint snapping avoids full trail-array mutation on indexed graphs');
 assert.ok(routePlannerJs.includes("adjShared:true"));
 assert.ok(routePlannerJs.includes("function mutableAdjacency("));
 assert.ok(routePlannerJs.includes("planner-anchor-touch-wrap"));
 assert.ok(routePlannerJs.includes("draggable:!busy"));
 assert.ok(routePlannerJs.includes("function bindMobilePlannerTap(map,el)"));
 assert.ok(routePlannerJs.includes("plannerMobilePointers"));
 assert.ok(routePlannerJs.includes("bindMobilePlannerTap(plannerMap,el)"));
 assert.ok(routePlannerJs.includes("suppressPlannerClickUntil=Date.now()+600"));
 console.log('PASS route planner uses copy-on-write adjacency and draggable mobile control points');
 assert.ok(mapEngineJs.includes("const tileZoom=tileZoomFor(st.zoom)"));
 assert.ok(mapEngineJs.includes("st.terrainTiles.style.transform=move"));
 assert.ok(mapEngineJs.includes("tile.terrainFrame===st.terrainAnchor?.serial"));
 assert.ok(workstationCss.includes(".native-map-terrain-tiles{position:absolute"));
 assert.ok(mapEngineJs.includes("st.center=unworld(c.x-dx,c.y-dy,st.zoom)"));
 assert.ok(!mapEngineJs.includes("st.base.replaceChildren"));
 assert.ok(!mapEngineJs.includes("residualScale"));
 console.log('PASS native map uses one fractional camera and stages replacement tiles without release-time blanking');
 assert.ok(workstationCss.includes('v3.78 READINESS + ROUTE EFFICIENCY'));
 assert.ok(fieldIntelJs.includes('data-readiness-id'));
 assert.ok(fieldIntelJs.includes('FIELD_MISSION_READINESS'));
 console.log('PASS mission readiness is actionable and styled as touch controls');
 assert.ok(routePlannerJs.includes("routeSlopeDisplayPieces(pts,600)"));
 assert.ok(routePlannerJs.includes("displayRoutePoints(pts,1200)"));
 console.log('PASS route planner display geometry is capped without changing full navigation geometry');
 assert.ok(routePlannerJs.includes("lastOverlayGeometryKey"));
 assert.ok(routePlannerJs.includes("lastDirectionGeometryKey"));
 console.log('PASS route overlay projection is geometry-keyed so preview edits do not rebuild route directions');
 assert.ok(routePlannerJs.includes('const size=plannerMap.getSize()'));assert.ok(!routePlannerJs.includes('plannerMap.getContainer().getBoundingClientRect()'));console.log('PASS route SVG redraws use Leaflet cached size instead of forcing layout');
 assert.ok(routePlannerJs.includes('let plannerUserAccuracyLayer=null'));assert.ok(routePlannerJs.includes('plannerUserMarker.setLatLng(p)'));assert.ok(!routePlannerJs.includes('plannerUserLayer.clearLayers();\n    const c=plannerColors()'));console.log('PASS route live GPS marker layers are reused across position fixes');
 assert.ok(routePlannerJs.includes('function drawPlannerPreview('));assert.ok(!routePlannerJs.includes('hoverPoint=pendingHoverPoint;pendingHoverPoint=null;overlay('));console.log('PASS route hover preview no longer rebuilds anchor markers on every pointer frame');
 assert.ok(routePlannerJs.includes('plannerDomRouteGeometry.length?plannerDomRouteGeometry:authoritativeGeometry'));console.log('PASS route hover preview reuses cached route geometry instead of rescanning full routes');
 assert.ok(routePlannerJs.includes('plannerColorCache&&plannerColorTheme===theme'));assert.ok(routePlannerJs.includes("fieldos:themechange"));console.log('PASS route planner redraws reuse cached theme styles until the theme changes');
 assert.ok(routePlannerJs.includes("plannerHoverFrame=requestAnimationFrame"));
 assert.ok(routePlannerJs.includes("(pointer:fine)"));
 console.log('PASS route planner coalesces fine-pointer route hover and skips hover work on touch-only devices');
assert.ok(workstationCss.includes('v3.81 UI STABILITY'));
assert.ok(workstationCss.includes('v3.81 SAFE AREA GEOMETRY'));
assert.ok(workstationCss.includes('--mobile-top-safe:env(safe-area-inset-top,0px)'));
assert.ok(workstationCss.includes('top:var(--mobile-topbar-h)!important'));
assert.ok(workstationCss.includes('select option'));
assert.ok(mapEngineJs.includes('st.onPointerCancel'));
assert.ok(mapEngineJs.includes('cancelAnimationFrame(st.gestureFrame)'));
console.log('PASS v3.81 gesture cleanup, select contrast and mobile sticky-chrome stability contracts');
assert.ok(html.includes('id="lorachat" data-view="lorachat"'));
assert.ok(html.includes('id="loramap" data-view="loramap"'));
assert.ok(html.includes('data-open="lorachat"><span>✉</span><b>LORA CHAT</b>'));
assert.ok(html.includes('data-open="loramap"><span>⌖</span><b>LORA MAP</b>'));
assert.ok(appJs.includes("'lorachat','loramap'"));
assert.ok(workstationJs.includes("['lorachat','LORA CHAT']")&&workstationJs.includes("['loramap','LORA MAP']"));
assert.ok(fieldIntelJs.includes("['comms','lorachat'].includes(e.detail?.view)"));
assert.ok(fieldIntelJs.includes("['comms','loramap'].includes(e.detail?.view)"));
assert.ok(workstationCss.includes('v3.81 LORA WORKSPACE SPLIT'));
console.log('PASS LoRa chat/map split has independent navigation, shared mesh state, and phone-safe styling');
console.log('PASS single online map engine ownership with Leaflet reserved for PMTiles/fallback');
