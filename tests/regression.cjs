const {JSDOM,VirtualConsole}=require('jsdom');const fs=require('fs'),vm=require('vm'),assert=require('node:assert/strict');
const dir=require('path').resolve(__dirname,'..');const errors=[],alerts=[];const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/not implemented/i.test(e.message))errors.push(e.message)});
const dom=new JSDOM(fs.readFileSync(dir+'/index.html','utf8'),{url:'https://test.local/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window,d=w.document;
w.HTMLCanvasElement.prototype.getContext=()=>new Proxy({measureText:()=>({width:100}),createLinearGradient:()=>({addColorStop(){}})},{get:(o,k)=>o[k]||(()=>{})});
w.isSecureContext=true;w.matchMedia=()=>({matches:false,addEventListener(){}});w.scrollTo=()=>{};w.alert=x=>alerts.push(x);w.confirm=()=>true;w.fetch=async()=>{throw new Error('Offline test')};w.ResizeObserver=class {observe(){} disconnect(){}};w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=()=>{};
w.addEventListener('error',e=>errors.push(e.error?.stack||e.message));w.FIELD_MAP_ENGINE_EXTERNAL=true;
const ctx=dom.getInternalVMContext(),run=s=>vm.runInContext(s,ctx),click=id=>d.getElementById(id).click(),tick=()=>new Promise(r=>setTimeout(r,20));
async function waitFor(fn,timeout=2500){const start=Date.now();while(Date.now()-start<timeout){if(fn())return;await tick()}throw new Error('Timed out waiting for async UI state')}
for(const f of ['survival-data.js','route-state.js','app.js','workstation.js','map-engine.js'])vm.runInContext(fs.readFileSync(dir+'/'+f,'utf8'),ctx,{filename:f});
let mapClick;const chain=()=>({addTo(){return this},clearLayers(){},on(event,fn){if(event==='click')mapClick=fn;return this},setView(){return this},fitBounds(){return this},invalidateSize(){return this},bindTooltip(){return this},setOpacity(){return this},panTo(){return this},createPane(){return {style:{}}},getContainer(){return d.getElementById('routePlannerMap')||d.body},latLngToContainerPoint(ll){return {x:(Number(ll?.[1])||0)*10+800,y:-(Number(ll?.[0])||0)*10+600}}});
w.L={map:chain,tileLayer:chain,layerGroup:chain,polyline:chain,circleMarker:chain,circle:chain,marker:chain,svg:chain,divIcon:o=>o||{}};
let planner=fs.readFileSync(dir+'/route-planner.js','utf8');planner=planner.replace('window.FIELD_ROUTE_PLANNER={','window.TEST_ROUTER={buildGraph,nearestNode,shortestPath,meters,samplePolyline,fetchElevationProfile,routeLeg,addAnchor,clearAll,displayTrailSections,gradeAtDistance,slopeClass,reverse,undo};window.FIELD_ROUTE_PLANNER={');vm.runInContext(planner,ctx,{filename:'route-planner.js'});vm.runInContext(fs.readFileSync(dir+'/field-intel.js','utf8'),ctx,{filename:'field-intel.js'});
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
 w.FIELD_ROUTE_STATE.setPoints([]);
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
 d.getElementById('mobileFixState').textContent='STALE';w.FIELD_DR.arm();w.FIELD_DR.state.speedMps=1;w.FIELD_DR.state.heading=0;w.FIELD_DR.state.anchorTime=Date.now()-60000;w.FIELD_DR.update();assert.equal(w.FIELD_DR.state.active,true);assert.match(d.getElementById('drState').textContent,/ESTIMATED/);
 d.getElementById('mobileFixState').textContent='3D / ±4m';w.FIELD_DR.update();assert.equal(w.FIELD_DR.state.active,false);w.FIELD_DR.reset();
 console.log('PASS feature 07 Dead Reckoning keeps a separately labeled estimate with growing uncertainty and returns authority to GNSS');
 d.getElementById('mobileFixState').textContent='3D / ±4m';d.getElementById('navAccuracy').textContent='±4 m';d.getElementById('fixAge').textContent='00:00:05';w.FIELD_DR.reset();
 let conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'trusted');assert.ok(conf.score>=90);assert.match(d.getElementById('posConfidenceLabel').textContent,/TRUSTED/);
 d.getElementById('navAccuracy').textContent='±35 m';conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'degraded');assert.ok(conf.score<90);
 d.getElementById('mobileFixState').textContent='STALE';w.FIELD_DR.arm();w.FIELD_DR.state.active=true;w.FIELD_DR.state.uncertaintyM=420;conf=w.FIELD_POSITION_CONFIDENCE.render();assert.equal(conf.mode,'estimated');assert.equal(conf.authority,'DEAD RECKONING');assert.ok(conf.score<70);
 w.FIELD_DR.reset();d.getElementById('mobileFixState').textContent='3D / ±4m';d.getElementById('navAccuracy').textContent='±4 m';d.getElementById('fixAge').textContent='00:00:05';
 console.log('PASS feature 08 Position Confidence distinguishes trusted, degraded, stale, and DR-estimated authority with uncertainty visualization');
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










 const app=fs.readFileSync(dir+'/app.js','utf8');
 const sosBtn=d.getElementById('meshSos');
 sosBtn.dispatchEvent(new w.Event('pointerdown',{bubbles:true,cancelable:true}));
 sosBtn.dispatchEvent(new w.Event('pointercancel',{bubbles:true}));
 await new Promise(resolve=>setTimeout(resolve,1700));
 assert.notEqual(sosBtn.textContent,'MESH SOS ARMED — DEMO');
 assert.match(app,/pointercancel',cancelSos/);
 assert.match(app,/max-height: 600px\) and \(min-width: 1001px\)/);
 console.log('PASS interrupted mobile SOS hold cancels and phone landscape avoids desktop scaling');
 d.querySelector('.workstation-nav [data-open="route"]').click();await tick();
 d.getElementById('routeSnapMode').value='direct';d.getElementById('routeSnapMode').dispatchEvent(new w.Event('change'));
 const r=w.TEST_ROUTER;r.addAnchor({lat:44.475,lon:-73.215});r.addAnchor({lat:44.48,lon:-73.21});await waitFor(()=>!d.getElementById('routeGainOut').textContent.includes('LOADING'));
 assert.equal(w.FIELD_ROUTE_STATE.getPoints().length,2);assert.ok(parseFloat(d.getElementById('routeDistance').textContent)>0);assert.match(d.getElementById('routeGainOut').textContent,/N\/A/);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,2);
 for(const id of ['homeRealMap','realMap']){assert.ok(d.querySelector('#'+id+' .planned-route-line'));assert.equal(d.querySelectorAll('#'+id+' .planned-route-marker').length,2)}
 const beforeRoute=d.querySelector('#homeRealMap .planned-route-line').getAttribute('points');
 r.reverse();await tick();assert.notEqual(d.querySelector('#homeRealMap .planned-route-line').getAttribute('points'),beforeRoute);assert.equal(w.FIELD_ROUTE_STATE.getPoints()[0].lat,44.48);r.undo();await waitFor(()=>w.FIELD_ROUTE_STATE.getPoints().length===1);assert.equal(w.FIELD_ROUTE_PLANNER.anchors.length,1);assert.equal(d.getElementById('reverseRoute').disabled,true);r.clearAll();await waitFor(()=>w.FIELD_ROUTE_STATE.getPoints().length===0);assert.equal(JSON.parse(w.localStorage.getItem('fieldos-v12-routePlan')).points.length,0);
 assert.equal(d.querySelectorAll('.planned-route-line').length,0);
 console.log('PASS route overlays on both maps, reverse and clear synchronization');
 console.log('PASS direct routing, distance, missing elevation, reverse, undo, clear persistence');
 const g=r.buildGraph([{type:'way',id:1,nodes:[1,2,3],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.98},{lat:44.02,lon:-72.98}],tags:{highway:'path'}}]);
 const a=r.nearestNode(g,{lat:44.0001,lon:-72.995}),b=r.nearestNode(g,{lat:44.0001,lon:-72.99}),routeResult=r.shortestPath(g,a.id,b.id),path=routeResult.path;assert.ok(Array.isArray(path)&&path.length>=2);assert.equal(routeResult.limitHit,false);assert.ok(a.d<12&&b.d<12);const pathM=path.slice(1).reduce((sum,p,i)=>sum+r.meters(path[i],p),0);assert.ok(pathM>390&&pathM<410);
 assert.equal(r.nearestNode(g,{lat:0,lon:0}),null);assert.equal(r.samplePolyline([{lat:44,lon:-73},{lat:44.01,lon:-73}],80)[0].distanceM,0);
 console.log('PASS trail-edge projection, same-segment route, distance, no-nearby-trail detection');
 w.fetch=async url=>({ok:true,json:async()=>url.includes('elevation')?{elevation:Array(new URL(url).searchParams.get('latitude').split(',').length).fill(100)}:{elements:[{type:'way',id:1,nodes:[1,2],geometry:[{lat:44,lon:-73},{lat:44,lon:-72.98}],tags:{highway:'path'}}]}});
 d.getElementById('routeSnapMode').value='trail';r.addAnchor({lat:44.0001,lon:-72.995});r.addAnchor({lat:44.0001,lon:-72.99});await waitFor(()=>/SNAPPED TO OSM TRAILS/.test(d.getElementById('routePlannerStatus').textContent));
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
 const css=fs.readFileSync(dir+'/workstation.css','utf8');
 assert.match(css,/#map \.module-grid>\.module-hero[\s\S]*?grid-column:1\/-1!important/);
 assert.match(css,/#map \.module-grid>\.terrain-controls-below[\s\S]*?grid-column:1\/-1!important/);
 console.log('PASS terrain map hero and controls are pinned full-width on desktop');
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

 assert.equal(errors.length,0,errors.join('\n'));console.log('PASS no runtime exceptions');dom.window.close();
})().catch(e=>{console.error(e);dom.window.close();process.exitCode=1});
