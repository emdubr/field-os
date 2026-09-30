/* FIELD/OS feature intelligence layer — feature 01 Mission Mode */
(() => {
  'use strict';
  const PREFIX='fieldos-v12-';
  const key=name=>PREFIX+name;
  const read=(name,fallback)=>{try{const raw=localStorage.getItem(key(name));return raw==null?fallback:(JSON.parse(raw)??fallback)}catch{return fallback}};
  const write=(name,value)=>{try{localStorage.setItem(key(name),JSON.stringify(value));return true}catch(err){console.warn('FIELD/OS mission storage failed',name,err);return false}};
  const text=id=>document.getElementById(id)?.textContent?.trim()||'—';
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validPoint=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  const cleanPoints=list=>(Array.isArray(list)?list:[]).filter(validPoint).slice(0,5000).map(p=>({lat:Number(p.lat),lon:Number(p.lon)}));
  const toRad=d=>d*Math.PI/180;
  const meters=(a,b)=>{const R=6371000,dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon),la1=toRad(a.lat),la2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))};
  const routeMeters=pts=>pts.slice(1).reduce((sum,p,i)=>sum+meters(pts[i],p),0);
  const getPosition=()=>{const p=window.FIELD_ROUTE_STATE?.current?.()||window.FIELD_CURRENT_POSITION||{};return validPoint(p)?{lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null,source:p.source||'POSITION'}:{lat:null,lon:null,alt:null,source:'NO POSITION'}};
  const parseBattery=()=>{for(const id of ['mobileBattery','powerPercent','deskBatteryPct']){const n=parseInt(text(id),10);if(Number.isFinite(n))return n}return null};
  const config=read('mission-config',{weather:'',contact:''});
  const weather=document.getElementById('missionWeather'),contact=document.getElementById('missionContact');
  if(weather)weather.value=String(config.weather||'');if(contact)contact.value=String(config.contact||'');
  const persistConfig=()=>write('mission-config',{weather:weather?.value||'',contact:contact?.value||''});
  weather?.addEventListener('input',persistConfig);contact?.addEventListener('input',persistConfig);

  function missionData(){
    const route=window.FIELD_ROUTE_STATE?.getPlan?.()||read('routePlan',{});
    const points=cleanPoints(route.points||[]);
    const trip=read('trip',{});
    const rawWaypoints=read('waypoints',[]);
    const waypoints=(Array.isArray(rawWaypoints)?rawWaypoints:[]).filter(validPoint).slice(0,500).map(w=>({id:String(w.id||''),name:String(w.name||'WAYPOINT'),type:String(w.type||'NOTE'),lat:Number(w.lat),lon:Number(w.lon),alt:w.alt??null,notes:String(w.notes||'')}));
    const essentials=read('essentials',{}),checked=Object.values(essentials||{}).filter(Boolean).length,checkin=read('checkin',{});
    const interval=Number(trip.checkinInterval??document.getElementById('checkinInterval')?.value??0)||0;
    const returnAt=String(trip.tripReturn||document.getElementById('tripReturn')?.value||'');
    const position=getPosition(),battery=parseBattery(),packId=localStorage.getItem(key('map-pack'))||'',mapSource=localStorage.getItem(key('map-source'))||text('offlineMapSource')||'UNKNOWN',offlineLabel=text('offlineMapMode');
    const hasOffline=!!packId||(/OFFLINE|SAVED|PMTILES/i.test(offlineLabel)&&!/ONLINE/i.test(offlineLabel));
    const weatherText=weather?.value.trim()||String(config.weather||'').trim(),contactText=contact?.value.trim()||String(config.contact||'').trim(),emergency=String(trip.tripEmergency||document.getElementById('tripEmergency')?.value||'').trim();
    const distanceM=routeMeters(points),now=Date.now(),due=interval&&checkin.last?Number(checkin.last)+interval*60000:null;
    const readiness=[
      {id:'route',label:'ROUTE',ok:points.length>=2,detail:points.length>=2?`${(distanceM/1609.344).toFixed(2)} mi / ${points.length} pts`:'No route loaded'},
      {id:'offline',label:'OFFLINE MAP',ok:hasOffline,detail:hasOffline?(text('offlineMapSource')||'Saved pack ready'):'No saved offline map pack'},
      {id:'waypoints',label:'WAYPOINTS',ok:waypoints.length>0,detail:`${waypoints.length} saved`},
      {id:'weather',label:'WEATHER',ok:!!weatherText,detail:weatherText||'Snapshot not entered'},
      {id:'contact',label:'CONTACT',ok:!!contactText,detail:contactText||'Emergency contact not entered'},
      {id:'return',label:'RETURN TIME',ok:!!returnAt,detail:returnAt?new Date(returnAt).toLocaleString():'Not set'},
      {id:'checkin',label:'CHECK-IN',ok:interval>0,level:interval>0?'ok':'warn',detail:interval>0?`Every ${interval} min`:'Manual only'},
      {id:'battery',label:'BATTERY',ok:battery!=null&&battery>=30,level:battery==null?'warn':battery<20?'bad':battery<30?'warn':'ok',detail:battery==null?'Unavailable':`${battery}%`},
      {id:'essentials',label:'ESSENTIALS',ok:checked===10,level:checked>=8?'warn':checked===10?'ok':'bad',detail:`${checked}/10 checked`},
      {id:'emergency',label:'EMERGENCY PLAN',ok:!!emergency,detail:emergency?'Saved':'Not entered'}
    ];
    return {schema:1,builtAt:new Date(now).toISOString(),name:String(trip.tripName||document.getElementById('tripName')?.value||'FIELD MISSION'),trip:{...trip,tripReturn:returnAt,checkinInterval:String(interval),emergency},route:{name:String(route.name||document.getElementById('routeName')?.value||'FIELD ROUTE'),points,distanceM,distanceMi:distanceM/1609.344,gainFt:Number(route.elevationProfile?.gainFt??route.gain??0)||0,estimatedHours:Number(route.estimatedHours||0)||null,terrain:String(route.terrain||''),routingMode:String(route.routingMode||'')},waypoints,weather:{snapshot:weatherText,capturedAt:new Date(now).toISOString()},emergencyContact:contactText,checkin:{intervalMinutes:interval,last:Number(checkin.last)||null,nextDue:due},offline:{hasOfflinePack:hasOffline,packId,mapSource,displaySource:text('offlineMapSource'),mode:offlineLabel},device:{position,accuracy:text('homeAccuracy'),gnss:text('mobileFixState'),satellites:text('satCount'),meshNodes:text('meshCount'),batteryPercent:battery,powerMode:localStorage.getItem(key('power'))||'normal'},essentials:{checked,total:10},readiness};
  }
  const rows=(target,items)=>{const el=document.getElementById(target);if(!el)return;el.innerHTML=items.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')};
  function render(pack=read('mission-pack',null)){
    const source=pack||missionData(),active=read('mission-active',null),ready=source.readiness||[],ok=ready.filter(x=>x.ok).length,grid=document.getElementById('missionReadiness');
    if(grid)grid.innerHTML=ready.map(item=>{const cls=item.ok?'ok':item.level==='warn'?'warn':'bad';return `<div class="mission-readiness-item ${cls}"><i></i><b>${esc(item.label)}</b><small>${esc(item.detail)}</small></div>`}).join('');
    const score=document.getElementById('missionReadinessScore');if(score)score.textContent=`${ok} / ${ready.length}`;
    const head=document.getElementById('missionHeadState');if(head){head.textContent=active?'ACTIVE':pack?'PACK BUILT':'NOT BUILT';head.classList.toggle('active',!!active)}
    rows('missionTripRoute',[['MISSION',source.name||'—'],['ROUTE',source.route?.name||'—'],['DISTANCE',Number.isFinite(source.route?.distanceMi)?`${source.route.distanceMi.toFixed(2)} mi`:'—'],['GAIN',Number.isFinite(source.route?.gainFt)?`${Math.round(source.route.gainFt)} ft`:'—'],['RETURN',source.trip?.tripReturn?new Date(source.trip.tripReturn).toLocaleString():'NOT SET'],['CHECK-IN',source.checkin?.intervalMinutes?`Every ${source.checkin.intervalMinutes} min`:'MANUAL']]);
    rows('missionOfflinePosition',[['MAP PACK',source.offline?.hasOfflinePack?'READY':'NOT SAVED'],['MAP SOURCE',source.offline?.displaySource||source.offline?.mapSource||'—'],['POSITION',source.device?.position?.lat!=null?`${source.device.position.lat.toFixed(5)}, ${source.device.position.lon.toFixed(5)}`:'NO FIX'],['SOURCE',source.device?.position?.source||'—'],['ACCURACY',source.device?.accuracy||'—'],['WEATHER',source.weather?.snapshot||'NOT ENTERED']]);
    rows('missionDevice',[['BATTERY',source.device?.batteryPercent==null?'—':`${source.device.batteryPercent}%`],['POWER MODE',source.device?.powerMode||'—'],['GNSS',source.device?.gnss||'—'],['SATELLITES',source.device?.satellites||'—'],['MESH NODES',source.device?.meshNodes||'—'],['CONTACT',source.emergencyContact||'NOT ENTERED']]);
    const wp=document.getElementById('missionWaypoints');if(wp)wp.innerHTML=(source.waypoints||[]).slice(0,12).map(w=>`<div class="mission-waypoint-row"><span><b>${esc(w.name)}</b><br><small>${esc(w.type)}</small></span><span>${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}</span></div>`).join('')||'<p class="muted">No saved waypoints.</p>';
    const es=document.getElementById('missionEssentials');if(es)es.textContent=`TEN ESSENTIALS: ${source.essentials?.checked||0}/${source.essentials?.total||10} checked.`;
  }
  function setStatus(message,state='ready'){const el=document.getElementById('missionStatus');if(!el)return;el.textContent=message;el.className=`route-planner-status ${state}`}
  function build(){persistConfig();const pack=missionData();write('mission-pack',pack);render(pack);setStatus(`MISSION-100 // PACK BUILT // ${pack.readiness.filter(x=>x.ok).length}/${pack.readiness.length} READY`,'ready');document.dispatchEvent(new CustomEvent('fieldos:missionbuilt',{detail:{builtAt:pack.builtAt,ready:pack.readiness.filter(x=>x.ok).length,total:pack.readiness.length}}));return pack}
  function start(){const pack=read('mission-pack',null)||build(),active={...pack,startedAt:new Date().toISOString(),active:true};write('mission-active',active);render(pack);setStatus(`MISSION-200 // ACTIVE // STARTED ${new Date(active.startedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`,'ready');document.body.classList.add('mission-active');document.dispatchEvent(new CustomEvent('fieldos:missionstart',{detail:{startedAt:active.startedAt,name:active.name}}));return active}
  function end(){const active=read('mission-active',null);try{localStorage.removeItem(key('mission-active'))}catch{}document.body.classList.remove('mission-active');render(read('mission-pack',null));setStatus(active?'MISSION-299 // ACTIVE MISSION ENDED':'MISSION-298 // NO ACTIVE MISSION','ready');document.dispatchEvent(new CustomEvent('fieldos:missionend',{detail:{endedAt:new Date().toISOString()}}))}
  function summary(pack=read('mission-active',null)||read('mission-pack',null)||missionData()){return ['FIELD/OS MISSION PACK',`MISSION: ${pack.name||'FIELD MISSION'}`,`BUILT: ${pack.builtAt||'—'}`,`ROUTE: ${pack.route?.name||'—'} / ${Number(pack.route?.distanceMi||0).toFixed(2)} mi`,`RETURN: ${pack.trip?.tripReturn||'NOT SET'}`,`CHECK-IN: ${pack.checkin?.intervalMinutes?`EVERY ${pack.checkin.intervalMinutes} MIN`:'MANUAL'}`,`OFFLINE MAP: ${pack.offline?.hasOfflinePack?'READY':'NOT SAVED'}`,`WAYPOINTS: ${pack.waypoints?.length||0}`,`BATTERY: ${pack.device?.batteryPercent??'—'}%`,`WEATHER: ${pack.weather?.snapshot||'NOT ENTERED'}`,`CONTACT: ${pack.emergencyContact||'NOT ENTERED'}`].join('\n')}
  async function copySummary(){const value=summary();try{await navigator.clipboard.writeText(value)}catch{const ta=document.createElement('textarea');ta.value=value;document.body.append(ta);ta.select();document.execCommand?.('copy');ta.remove()}setStatus('MISSION-110 // SUMMARY COPIED','ready')}
  function exportPack(){const pack=read('mission-active',null)||read('mission-pack',null)||build(),blob=new Blob([JSON.stringify(pack,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=`fieldos-mission-${String(pack.name||'mission').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'mission'}.json`;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),500)}
  document.getElementById('missionBuild')?.addEventListener('click',build);document.getElementById('missionStart')?.addEventListener('click',start);document.getElementById('missionEnd')?.addEventListener('click',end);document.getElementById('missionCopy')?.addEventListener('click',copySummary);document.getElementById('missionExport')?.addEventListener('click',exportPack);
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='mission')render(read('mission-pack',null))});
  if(read('mission-active',null))document.body.classList.add('mission-active');render(read('mission-pack',null));


  // Feature 03 — Terrain-Risk Analyzer. It only reports risks supported by route DEM/OSM/local waypoint data.
  const riskSeverityRank={info:0,watch:1,warn:2,high:3};
  function maxSustainedGrades(profile=[]){
    const s=(Array.isArray(profile)?profile:[]).filter(p=>Number.isFinite(Number(p.distanceM))&&Number.isFinite(Number(p.elevationFt))).sort((a,b)=>a.distanceM-b.distanceM);
    let up=0,down=0,abs=0;
    for(let i=0;i<s.length;i++){
      let j=i+1;
      while(j<s.length&&Number(s[j].distanceM)-Number(s[i].distanceM)<50)j++;
      if(j>=s.length)continue;
      const run=Math.max(1,Number(s[j].distanceM)-Number(s[i].distanceM)),grade=(Number(s[j].elevationFt)-Number(s[i].elevationFt))/(run*3.28084)*100;
      up=Math.max(up,grade);down=Math.min(down,grade);abs=Math.max(abs,Math.abs(grade));
    }
    return {up,down,abs};
  }
  function analyzeTerrainRisk(plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},savedWaypoints=read('waypoints',[])){
    const points=cleanPoints(plan.points||[]),sections=Array.isArray(plan.trailSections)?plan.trailSections:[],profile=Array.isArray(plan.elevationProfile)?plan.elevationProfile:[],grades=maxSustainedGrades(profile);
    const distanceMi=Number(plan.distanceMiles)||routeMeters(points)/1609.344,gainFt=Number(plan.elevationGainFt??plan.elevationProfile?.gainFt??plan.gain??0)||0,lossFt=Number(plan.elevationLossFt??0)||0;
    const flags=[],push=(id,severity,title,detail,evidence='')=>flags.push({id,severity,title,detail,evidence});
    if(grades.abs>=20)push('steep','high','VERY STEEP SUSTAINED GRADE',`DEM shows about ${grades.abs.toFixed(0)}% sustained grade over a 50 m+ window.`,'DEM');
    else if(grades.abs>=14)push('steep','warn','STEEP SUSTAINED GRADE',`DEM shows about ${grades.abs.toFixed(0)}% sustained grade over a 50 m+ window.`,'DEM');
    if(gainFt>=3000)push('climb','warn','MAJOR ASCENT',`Approximately ${Math.round(gainFt).toLocaleString()} ft of climbing is recorded for this route.`,'DEM');
    if(lossFt>=3000)push('descent','warn','MAJOR DESCENT',`Approximately ${Math.round(lossFt).toLocaleString()} ft of descent is recorded for this route.`,'DEM');
    const technical=sections.filter(s=>/alpine|demanding_mountain/i.test(String(s.sacScale||''))||/scree|boulder|rock/i.test(String(s.surface||''))||/very_bad|horrible|impassable/i.test(String(s.smoothness||'')));
    if(technical.length)push('technical','warn','ROUGH / TECHNICAL TRAIL TAGS',`${technical.length} route section${technical.length===1?'':'s'} include alpine, rocky, scree or poor-smoothness tags.`,'OSM');
    const crossings=sections.filter(s=>/^(yes|stepping_stones)$/i.test(String(s.ford||''))||String(s.highway||'').toLowerCase()==='ford'||(/stream|river/i.test(String(s.waterway||''))&&!/yes/i.test(String(s.bridge||''))));
    if(crossings.length)push('water','warn','TAGGED WATER CROSSING',`${crossings.length} route section${crossings.length===1?'':'s'} indicate a ford or unbridged water crossing. Verify current conditions.`,'OSM');
    const cliffs=sections.filter(s=>/cliff/i.test(String(s.natural||''))||/cliff|falling_rocks/i.test(String(s.hazard||'')));
    if(cliffs.length)push('cliff','high','CLIFF / FALLING-ROCK TAG',`${cliffs.length} section${cliffs.length===1?'':'s'} carry an explicit cliff or falling-rock tag.`,'OSM');
    const poorVis=sections.filter(s=>/^(bad|horrible|no|intermediate)$/i.test(String(s.trailVisibility||'')));
    if(poorVis.length)push('visibility','watch','POOR TRAIL VISIBILITY TAGS',`${poorVis.length} section${poorVis.length===1?'':'s'} have reduced trail-visibility metadata.`,'OSM');
    const bail=(Array.isArray(savedWaypoints)?savedWaypoints:[]).filter(w=>validPoint(w)&&/BASE|JUNCTION|CAMP|BAILOUT|TRAILHEAD/i.test(String(w.type||'')+' '+String(w.name||'')));
    if(distanceMi>=8&&bail.length<2)push('bailout',distanceMi>=12&&bail.length===0?'high':'warn','LIMITED SAVED BAILOUT REFERENCES',`Route is ${distanceMi.toFixed(1)} mi with ${bail.length} saved base/junction/camp/bailout reference${bail.length===1?'':'s'}.`,'LOCAL WAYPOINTS');
    if(crossings.length&&grades.down<=-15)push('trap','watch','TERRAIN-TRAP SCREENING NEEDED','A steep sustained descent and a tagged water crossing occur on this route. Inspect topo/drainage before travel; FIELD/OS cannot confirm a terrain trap from these data alone.','DEM + OSM');
    const taggedM=sections.filter(s=>s.surface||s.smoothness||s.sacScale||s.trailVisibility||s.ford||s.bridge||s.hazard).reduce((sum,s)=>sum+(Number(s.distanceM)||0),0),allM=sections.reduce((sum,s)=>sum+(Number(s.distanceM)||0),0);
    const metadataPct=Number(plan.trailIntelligence?.metadataCoveragePct)|| (allM?taggedM/allM*100:0),elevationReady=profile.length>=2;
    let confidence=(elevationReady?45:0)+(sections.length?25:0)+Math.min(25,metadataPct*.25)+(bail.length?5:0);confidence=Math.max(0,Math.min(100,confidence));
    if(!elevationReady)push('data-elevation','info','ELEVATION RISK DATA UNAVAILABLE','No usable DEM profile is stored; steep-grade screening is unavailable.','DATA GAP');
    if(!sections.length)push('data-osm','info','TRAIL-TAG RISK DATA UNAVAILABLE','No snapped OSM trail sections are stored; crossing/technical-tag screening is unavailable.','DATA GAP');
    if(!cliffs.length)push('cliff-note','info','CLIFF CHECK LIMITED','No explicit cliff tag was found on routed ways. Absence of a tag does not mean cliffs are absent.','LIMITATION');
    if(!flags.length)push('none','info','NO AUTOMATED FLAGS','No supported risk thresholds were triggered. This is not a declaration that terrain is safe.','SCREENING ONLY');
    flags.sort((a,b)=>(riskSeverityRank[b.severity]||0)-(riskSeverityRank[a.severity]||0));
    return {generatedAt:new Date().toISOString(),distanceMi,gainFt,lossFt,grades,metadataPct,confidence,flags};
  }
  function renderTerrainRisk(result=analyzeTerrainRisk()){
    const list=document.getElementById('terrainRiskList'),status=document.getElementById('terrainRiskStatus'),summary=document.getElementById('terrainRiskSummary'),conf=document.getElementById('terrainRiskConfidence');
    if(!list)return result;
    const actionable=result.flags.filter(f=>f.severity!=='info'),high=actionable.filter(f=>f.severity==='high').length,warn=actionable.filter(f=>f.severity==='warn').length;
    if(status)status.textContent=!result.distanceMi?'WAITING FOR ROUTE':high?`${high} HIGH FLAG${high===1?'':'S'}`:warn?`${warn} WARNING${warn===1?'':'S'}`:'SCREENED';
    if(summary)summary.textContent=!result.distanceMi?'NO ROUTE ANALYSIS YET':`${result.distanceMi.toFixed(2)} MI // MAX SUSTAINED ${result.grades.abs.toFixed(0)}% // ${actionable.length} ACTIONABLE FLAG${actionable.length===1?'':'S'}`;
    list.innerHTML=result.flags.map(f=>`<div class="terrain-risk-item risk-${f.severity}"><span>${esc(f.severity.toUpperCase())}</span><b>${esc(f.title)}</b><p>${esc(f.detail)}</p><small>${esc(f.evidence)}</small></div>`).join('');
    if(conf)conf.textContent=`DATA CONFIDENCE // ${Math.round(result.confidence)}% // OSM METADATA ${Math.round(result.metadataPct)}%`;
    return result;
  }
  document.addEventListener('fieldos:routechange',()=>setTimeout(()=>renderTerrainRisk(),0));document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='route')renderTerrainRisk()});
  setTimeout(()=>renderTerrainRisk(),100);
  window.FIELD_TERRAIN_RISK={analyze:analyzeTerrainRisk,render:renderTerrainRisk,maxSustainedGrades};

  // Feature 02 — contextual "What Matters Now" home priority.
  const contextState={pressure:[]};
  function daylightMinutes(){
    const raw=text('daylightRemaining');
    const h=Number((raw.match(/(\d+)h/)||[])[1]||0),m=Number((raw.match(/(\d+)m/)||[])[1]||0);
    if(!/\d/.test(raw))return null;
    return h*60+m;
  }
  function pressureDrop(){
    const cutoff=Date.now()-3*60*60*1000,pts=contextState.pressure.filter(p=>p.t>=cutoff&&Number.isFinite(p.v));
    if(pts.length<2)return null;
    return pts[0].v-pts.at(-1).v;
  }
  function contextCandidates(){
    const list=[],fix=text('mobileFixState'),banner=document.getElementById('routeDeviationBanner'),bannerText=banner?.textContent?.trim()||'',battery=parseBattery(),checkin=text('mobileCheckin'),light=daylightMinutes(),drop=pressureDrop();
    if(/STALE|NO FIX|AWAITING/i.test(fix))list.push({id:'gnss',score:100,level:'danger',title:'GNSS FIX LOST / STALE',detail:`Position status is ${fix}. Use last trusted fix, map and compass until position recovers.`,view:'nav',action:'OPEN NAV CORE'});
    if(/DEVIATION|OFF ROUTE/i.test(bannerText)){
      const severe=banner?.classList.contains('critical-banner')||/DEVIATION/i.test(bannerText);
      list.push({id:'route',score:severe?95:84,level:severe?'danger':'warn',title:'ROUTE DEVIATION',detail:bannerText||'You are outside the configured route corridor.',view:'trailreturn',action:'RETURN TO TRAIL'});
    }
    if(Number.isFinite(battery)&&battery<=15)list.push({id:'battery',score:90,level:'danger',title:'CRITICAL BATTERY',detail:`Phone battery is ${battery}%. Preserve navigation and communications power.`,view:'power',action:'POWER CONTROL'});
    else if(Number.isFinite(battery)&&battery<=25)list.push({id:'battery',score:72,level:'warn',title:'LOW BATTERY',detail:`Phone battery is ${battery}%. Consider low-power mode before reserve becomes critical.`,view:'power',action:'POWER CONTROL'});
    if(/OVERDUE/i.test(checkin))list.push({id:'checkin',score:88,level:'danger',title:'CHECK-IN OVERDUE',detail:'Your local check-in timer is overdue. Record or send a check-in when safe.',view:'trip',action:'CHECK IN'});
    else if(/DUE SOON/i.test(checkin))list.push({id:'checkin',score:68,level:'warn',title:'CHECK-IN DUE SOON',detail:'A planned check-in is approaching.',view:'trip',action:'TRIP / CHECK-IN'});
    if(Number.isFinite(drop)&&drop>=2)list.push({id:'pressure',score:82,level:'warn',title:'FAST PRESSURE FALL',detail:`Pressure fell ${drop.toFixed(1)} hPa in the recent 3-hour window. Recheck weather and exposure.`,view:'sensors',action:'SENSOR TREND'});
    if(Number.isFinite(light)&&light<=60)list.push({id:'dark',score:76,level:'warn',title:'DARKNESS APPROACHING',detail:`Approximately ${light} minutes of daylight remain. Recheck route, turnaround and lighting.`,view:'nav',action:'SUN / NAV'});
    else if(Number.isFinite(light)&&light<=120)list.push({id:'dark',score:58,level:'warn',title:'DAYLIGHT WINDOW CLOSING',detail:`Approximately ${light} minutes of daylight remain.`,view:'trip',action:'TRIP TIMING'});
    const active=read('mission-active',null),pack=read('mission-pack',null);
    if(!active&&!pack)list.push({id:'mission',score:35,level:'good',title:'BUILD MISSION PACK',detail:'No frozen pre-trip mission package is saved yet.',view:'mission',action:'MISSION MODE'});
    else if(!active&&pack)list.push({id:'mission',score:28,level:'good',title:'MISSION PACK READY',detail:'A pre-trip package is built but the mission has not been started.',view:'mission',action:'START MISSION'});
    if(!list.length)list.push({id:'nominal',score:1,level:'good',title:'FIELD STATUS NOMINAL',detail:'Monitoring route, position, daylight, battery, check-in and field conditions.',view:'mission',action:'MISSION STATUS'});
    return list.sort((a,b)=>b.score-a.score);
  }
  function refreshContext(){
    const list=contextCandidates(),top=list[0],box=document.getElementById('priorityNow'),level=document.getElementById('priorityLevel'),title=document.getElementById('priorityTitle'),detail=document.getElementById('priorityDetail'),action=document.getElementById('priorityAction'),stack=document.getElementById('priorityStack');
    if(!box)return top;
    box.classList.remove('priority-good','priority-warn','priority-danger');box.classList.add(`priority-${top.level}`);
    if(level)level.textContent=top.level==='danger'?'IMMEDIATE':top.level==='warn'?'ATTENTION':'NOMINAL';
    if(title)title.textContent=top.title;if(detail)detail.textContent=top.detail;
    if(action){action.textContent=top.action;action.dataset.contextOpen=top.view}
    if(stack)stack.innerHTML=list.slice(1,4).map(x=>`<span>${esc(x.title)}</span>`).join('');
    return top;
  }
  document.getElementById('priorityAction')?.addEventListener('click',e=>{const target=e.currentTarget.dataset.contextOpen||'mission';window.FIELD_OPEN_VIEW?.(target)});
  document.addEventListener('fieldos:positionchange',refreshContext);document.addEventListener('fieldos:routechange',refreshContext);document.addEventListener('fieldos:missionstart',refreshContext);document.addEventListener('fieldos:missionend',refreshContext);
  document.addEventListener('fieldos:telemetry',e=>{const p=Number(e.detail?.pressureHpa);if(Number.isFinite(p)){contextState.pressure.push({t:Date.now(),v:p});contextState.pressure=contextState.pressure.filter(x=>x.t>Date.now()-4*60*60*1000).slice(-120)}refreshContext()});
  setInterval(refreshContext,5000);setTimeout(refreshContext,60);
  window.FIELD_CONTEXT={refresh:refreshContext,candidates:contextCandidates,pushPressure:(v,t=Date.now())=>{v=Number(v);if(Number.isFinite(v)){contextState.pressure.push({t:Number(t)||Date.now(),v});contextState.pressure=contextState.pressure.slice(-120)}return refreshContext()},state:contextState};

  window.FIELD_MISSION={build,start,end,render,getPack:()=>read('mission-pack',null),getActive:()=>read('mission-active',null),summary,preview:missionData};
})();
