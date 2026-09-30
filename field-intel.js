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
  window.FIELD_MISSION={build,start,end,render,getPack:()=>read('mission-pack',null),getActive:()=>read('mission-active',null),summary,preview:missionData};
})();
