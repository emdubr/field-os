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













  // Feature 14 — Automatic Check-ins.
  const autoCheckinConfig={enabled:false,template:'OK',graceMin:10,...(read('auto-checkin-config',{})||{})};
  const autoCheckinState={armedAt:0,nextDue:0,lastGenerated:0,lastDelivered:0,pendingMessageId:null,lastMissedAlertFor:null,...(read('auto-checkin-state',{})||{})};
  function checkinIntervalMinutes(){
    const trip=read('trip',{}),raw=trip.checkinInterval??document.getElementById('checkinInterval')?.value??0;
    return Math.max(0,Number(raw)||0);
  }
  function persistAutoCheckin(){
    write('auto-checkin-config',autoCheckinConfig);write('auto-checkin-state',autoCheckinState);
  }
  function formatAutoCheckin(now=Date.now()){
    const p=getPosition(),battery=parseBattery(),plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},mission=read('mission-active',null)||read('mission-pack',null),stamp=new Date(now).toISOString();
    const pos=validPoint(p)?`${p.lat.toFixed(5)}, ${p.lon.toFixed(5)}`:'NO VALID POSITION';
    if(autoCheckinConfig.template==='STATUS')return `FIELD/OS AUTO CHECK-IN // ${stamp} // STATUS OK // POS ${pos} // SOURCE ${p.source||'UNKNOWN'} // BAT ${battery==null?'—':battery+'%'}`;
    if(autoCheckinConfig.template==='MISSION')return `FIELD/OS MISSION CHECK-IN // ${stamp} // ${mission?.name||'FIELD MISSION'} // POS ${pos} // ROUTE ${plan.name||'FIELD ROUTE'} // STATUS OK`;
    return `FIELD/OS AUTO CHECK-IN // ${stamp} // OK // POS ${pos} // SOURCE ${p.source||'UNKNOWN'}`;
  }
  function armAutoCheckin(now=Date.now()){
    const interval=checkinIntervalMinutes();autoCheckinState.armedAt=now;autoCheckinState.nextDue=interval?now+interval*60000:0;autoCheckinState.lastMissedAlertFor=null;persistAutoCheckin();renderAutoCheckin();return autoCheckinState.nextDue;
  }
  function generateAutoCheckin(now=Date.now(),reason='scheduled'){
    const message=formatAutoCheckin(now),item=window.FIELD_TRANSPORT?.queue?.(message,{channel:'CHECK-IN',meta:{kind:'auto-checkin',reason,generatedAt:now}});
    autoCheckinState.lastGenerated=now;autoCheckinState.pendingMessageId=item?.id||null;
    const interval=checkinIntervalMinutes();autoCheckinState.nextDue=interval?now+interval*60000:0;persistAutoCheckin();
    document.dispatchEvent(new CustomEvent('fieldos:checkin',{detail:{text:message,position:getPosition(),source:getPosition().source||'POSITION',createdAt:now,auto:true,reason,transportQueued:true,messageId:item?.id||null}}));
    renderAutoCheckin();return item;
  }
  function autoCheckinTick(now=Date.now()){
    const interval=checkinIntervalMinutes();if(!autoCheckinConfig.enabled||!interval){renderAutoCheckin();return {action:'disabled'}};
    if(!autoCheckinState.nextDue){armAutoCheckin(now);return {action:'armed'}};
    const lateness=now-autoCheckinState.nextDue,grace=autoCheckinConfig.graceMin*60000;
    if(lateness>=0){
      const missed=lateness>grace;
      if(missed&&autoCheckinState.lastMissedAlertFor!==autoCheckinState.nextDue){
        autoCheckinState.lastMissedAlertFor=autoCheckinState.nextDue;
        document.dispatchEvent(new CustomEvent('fieldos:devicealert',{detail:{id:`auto-checkin-missed-${autoCheckinState.nextDue}`,createdAt:now,source:'CHECK-IN SCHEDULER',title:'CHECK-IN WINDOW MISSED',text:`FIELD/OS resumed ${Math.round(lateness/60000)} min after the scheduled check-in. A catch-up packet was generated; background timers are not guaranteed.`,severity:'warn'}}));
      }
      const item=generateAutoCheckin(now,missed?'catch-up':'scheduled');return {action:missed?'catch-up':'generated',item};
    }
    if(autoCheckinState.pendingMessageId&&autoCheckinState.lastGenerated&&now-autoCheckinState.lastGenerated>grace&&autoCheckinState.lastMissedAlertFor!==autoCheckinState.pendingMessageId){
      autoCheckinState.lastMissedAlertFor=autoCheckinState.pendingMessageId;
      document.dispatchEvent(new CustomEvent('fieldos:devicealert',{detail:{id:`auto-checkin-undelivered-${autoCheckinState.pendingMessageId}`,createdAt:now,source:'CHECK-IN SCHEDULER',title:'CHECK-IN NOT DELIVERED',text:`The last automatic check-in has remained queued for more than ${autoCheckinConfig.graceMin} minutes. Verify a communications link.`,severity:'warn'}}));
      persistAutoCheckin();
    }
    renderAutoCheckin();return {action:'waiting'};
  }
  function setAutoCheckinConfig(patch={}){
    if('enabled' in patch)autoCheckinConfig.enabled=!!patch.enabled;
    if('template' in patch&&['OK','STATUS','MISSION'].includes(String(patch.template)))autoCheckinConfig.template=String(patch.template);
    if('graceMin' in patch)autoCheckinConfig.graceMin=Math.max(1,Math.min(120,Number(patch.graceMin)||10));
    persistAutoCheckin();if(autoCheckinConfig.enabled&&!autoCheckinState.nextDue)armAutoCheckin();renderAutoCheckin();return {...autoCheckinConfig};
  }
  function renderAutoCheckin(){
    const panel=document.querySelector('.auto-checkin-panel'),set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v},enabled=document.getElementById('autoCheckinEnabled'),templ=document.getElementById('autoCheckinTemplate'),grace=document.getElementById('autoCheckinGrace');
    if(enabled)enabled.checked=!!autoCheckinConfig.enabled;if(templ)templ.value=autoCheckinConfig.template;if(grace)grace.value=String(autoCheckinConfig.graceMin);
    const pending=autoCheckinState.pendingMessageId&&window.FIELD_TRANSPORT?.state?.items?.find(x=>x.id===autoCheckinState.pendingMessageId),interval=checkinIntervalMinutes(),now=Date.now();
    let status=!autoCheckinConfig.enabled?'DISABLED':!interval?'MANUAL INTERVAL':pending&&pending.status!=='sent'?'QUEUED / WAITING LINK':'ARMED';
    if(autoCheckinConfig.enabled&&autoCheckinState.nextDue&&now>autoCheckinState.nextDue+autoCheckinConfig.graceMin*60000)status='OVERDUE / CATCH-UP';
    set('autoCheckinState',status);set('autoCheckinNext',autoCheckinState.nextDue?new Date(autoCheckinState.nextDue).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—');set('autoCheckinGenerated',autoCheckinState.lastGenerated?new Date(autoCheckinState.lastGenerated).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—');set('autoCheckinDelivered',autoCheckinState.lastDelivered?new Date(autoCheckinState.lastDelivered).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'—');set('autoCheckinQueue',pending?`${pending.status.toUpperCase()} // ${pending.transport||'NO LINK'}`:'CLEAR');
    panel?.classList.toggle('status-overdue',status.startsWith('OVERDUE'));panel?.classList.toggle('status-pending',status.startsWith('QUEUED'));return status;
  }
  document.getElementById('autoCheckinEnabled')?.addEventListener('change',e=>{setAutoCheckinConfig({enabled:e.currentTarget.checked});if(e.currentTarget.checked)armAutoCheckin()});
  document.getElementById('autoCheckinTemplate')?.addEventListener('change',e=>setAutoCheckinConfig({template:e.currentTarget.value}));
  document.getElementById('autoCheckinGrace')?.addEventListener('change',e=>setAutoCheckinConfig({graceMin:e.currentTarget.value}));
  document.getElementById('autoCheckinSendNow')?.addEventListener('click',()=>generateAutoCheckin(Date.now(),'manual-generate'));document.getElementById('autoCheckinArm')?.addEventListener('click',()=>armAutoCheckin());
  document.addEventListener('fieldos:messagesent',e=>{if(e.detail?.id&&e.detail.id===autoCheckinState.pendingMessageId){autoCheckinState.lastDelivered=Date.now();autoCheckinState.pendingMessageId=null;persistAutoCheckin();renderAutoCheckin()}});
  document.addEventListener('fieldos:checkin',e=>{const d=e.detail||{};if(d.auto)return;const interval=checkinIntervalMinutes();autoCheckinState.lastGenerated=Number(d.createdAt)||Date.now();autoCheckinState.nextDue=interval?autoCheckinState.lastGenerated+interval*60000:0;if(!d.transportQueued&&window.FIELD_TRANSPORT?.queue){const item=window.FIELD_TRANSPORT.queue(d.text||'FIELD/OS CHECK-IN',{channel:'CHECK-IN',meta:{kind:'manual-checkin'}});autoCheckinState.pendingMessageId=item?.id||null}persistAutoCheckin();renderAutoCheckin()});
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible')autoCheckinTick(Date.now())});document.getElementById('checkinInterval')?.addEventListener('change',()=>{if(autoCheckinConfig.enabled)armAutoCheckin()});
  setInterval(()=>autoCheckinTick(Date.now()),15000);setTimeout(()=>renderAutoCheckin(),320);
  window.FIELD_AUTO_CHECKIN={config:autoCheckinConfig,state:autoCheckinState,setConfig:setAutoCheckinConfig,arm:armAutoCheckin,tick:autoCheckinTick,generate:generateAutoCheckin,format:formatAutoCheckin,render:renderAutoCheckin};

  // Feature 13 — Unified Communications Inbox.
  const inboxState={items:[],filter:'ALL'};
  function normalizeInboxItem(raw={}){
    const textValue=String(raw.text??raw.message??'').trim();if(!textValue)return null;
    const createdAt=Number(raw.createdAt??raw.time)||Date.now(),source=String(raw.source??raw.transport??raw.channel??'SYSTEM').toUpperCase();
    const category=String(raw.category??(source.includes('SAT')?'SATELLITE':source.includes('MESH')?'MESH':'ALERT')).toUpperCase();
    return {id:String(raw.id||`evt-${createdAt}-${Math.random().toString(36).slice(2,7)}`),createdAt,source,category,text:textValue,title:String(raw.title||raw.from||source),direction:String(raw.direction||'IN').toUpperCase(),severity:String(raw.severity||'info').toLowerCase(),status:String(raw.status||''),read:raw.read===true,meta:raw.meta||{}};
  }
  function persistInbox(){write('comms-inbox',{savedAt:new Date().toISOString(),items:inboxState.items.slice(-300)})}
  function ingestInbox(raw={}){
    const item=normalizeInboxItem(raw);if(!item)return null;
    const idx=inboxState.items.findIndex(x=>x.id===item.id);if(idx>=0)inboxState.items[idx]={...inboxState.items[idx],...item};else inboxState.items.push(item);
    if(inboxState.items.length>300)inboxState.items.splice(0,inboxState.items.length-300);
    persistInbox();renderInbox();document.dispatchEvent(new CustomEvent('fieldos:inboxchange',{detail:{count:inboxState.items.length,id:item.id}}));return item;
  }
  function updateInboxMessage(id,patch={}){
    const item=inboxState.items.find(x=>x.id===id||x.meta?.messageId===id);if(!item)return null;Object.assign(item,patch);persistInbox();renderInbox();return item;
  }
  function inboxMatches(item,filter){
    if(filter==='ALL')return true;if(filter==='ALERT')return item.category==='ALERT'||['warn','high','danger'].includes(item.severity);
    if(filter==='OUTGOING')return item.direction==='OUT';return item.category===filter;
  }
  function renderInbox(){
    const list=document.getElementById('unifiedInboxTimeline'),state=document.getElementById('unifiedInboxState'),filter=document.getElementById('unifiedInboxFilter');if(!list)return inboxState.items;
    if(filter&&filter.value!==inboxState.filter)filter.value=inboxState.filter;
    const shown=inboxState.items.filter(x=>inboxMatches(x,inboxState.filter)).slice().sort((a,b)=>b.createdAt-a.createdAt),unread=inboxState.items.filter(x=>!x.read).length;
    if(state)state.textContent=`${inboxState.items.length} EVENTS // ${unread} UNREAD`;
    list.innerHTML=shown.length?shown.map(x=>`<div class="unified-inbox-event ${x.read?'':'unread'} ${esc(x.severity)}"><span class="unified-inbox-badge">${esc(x.category)}</span><div class="unified-inbox-copy"><b>${esc(x.direction==='OUT'?'↑ '+x.title:'↓ '+x.title)}</b><p>${esc(x.text)}</p></div><span class="unified-inbox-meta">${new Date(x.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}${x.status?' // '+esc(x.status.toUpperCase()):''}</span></div>`).join(''):'<p class="muted">No events match this filter.</p>';
    return shown;
  }
  function markInboxRead(){for(const x of inboxState.items)x.read=true;persistInbox();renderInbox()}
  function clearInbox(){inboxState.items=[];persistInbox();renderInbox()}
  const savedInbox=read('comms-inbox',null);if(Array.isArray(savedInbox?.items))inboxState.items=savedInbox.items.map(normalizeInboxItem).filter(Boolean);
  document.addEventListener('fieldos:incomingmessage',e=>{const d=e.detail||{};ingestInbox({id:d.id,createdAt:d.createdAt,source:d.source||d.transport||'MESH',category:d.category,text:d.text||d.message,title:d.from||d.source||'INCOMING',direction:'IN',severity:d.severity||'info',status:'received',meta:d})});
  document.addEventListener('fieldos:messagequeued',e=>{const d=e.detail||{};ingestInbox({id:`queue-${d.id}`,createdAt:d.createdAt,source:'LOCAL QUEUE',category:'OUTGOING',text:d.text||'Queued packet',title:d.channel||'PRIMARY',direction:'OUT',severity:'info',status:'queued',meta:{messageId:d.id}})});
  document.addEventListener('fieldos:messagesent',e=>{const d=e.detail||{};updateInboxMessage(d.id,{source:String(d.transport||'TRANSPORT').toUpperCase(),category:'OUTGOING',status:'sent',read:true})});
  document.addEventListener('fieldos:checkin',e=>{const d=e.detail||{};ingestInbox({id:`checkin-${d.createdAt||Date.now()}`,createdAt:d.createdAt,source:'LOCAL',category:'CHECK-IN',text:d.text||'Local check-in recorded',title:'CHECK-IN',direction:'OUT',severity:'info',status:'recorded',meta:d})});
  document.addEventListener('fieldos:devicealert',e=>{const d=e.detail||{};ingestInbox({id:d.id,createdAt:d.createdAt,source:d.source||'DEVICE',category:'ALERT',text:d.text||d.message,title:d.title||'DEVICE ALERT',direction:'IN',severity:d.severity||'warn',status:'alert',meta:d})});
  document.addEventListener('fieldos:sensoralert',e=>{const d=e.detail||{};ingestInbox({id:d.id,createdAt:d.createdAt,source:d.source||'SENSOR',category:'ALERT',text:d.text||d.message,title:d.title||'SENSOR ALERT',direction:'IN',severity:d.severity||'warn',status:'alert',meta:d})});
  document.getElementById('unifiedInboxFilter')?.addEventListener('change',e=>{inboxState.filter=e.currentTarget.value;renderInbox()});document.getElementById('unifiedInboxMarkRead')?.addEventListener('click',markInboxRead);document.getElementById('unifiedInboxClear')?.addEventListener('click',clearInbox);
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='comms')renderInbox()});renderInbox();
  window.FIELD_INBOX={ingest:ingestInbox,update:updateInboxMessage,render:renderInbox,markRead:markInboxRead,clear:clearInbox,state:inboxState};

  // Feature 12 — Store-and-Forward Messaging.
  const transportRegistry=new Map();
  const messageQueueState={items:[]};
  function loadMessageQueue(){
    const saved=read('message-queue',null),items=Array.isArray(saved?.items)?saved.items:[];
    messageQueueState.items=items.filter(x=>x&&x.id&&x.text).slice(-250).map(x=>({...x,status:['pending','sending','sent','failed'].includes(x.status)?x.status:'pending'}));
    for(const item of messageQueueState.items)if(item.status==='sending')item.status='pending';
    return messageQueueState.items;
  }
  function persistMessageQueue(){write('message-queue',{savedAt:new Date().toISOString(),items:messageQueueState.items.slice(-250)})}
  function activeTransports(){
    return [...transportRegistry.entries()].map(([name,t])=>({name,t})).filter(({t})=>{try{return t.enabled!==false&&(typeof t.available==='function'?!!t.available():!!t.available)}catch{return false}}).sort((a,b)=>(b.t.priority||0)-(a.t.priority||0));
  }
  function renderMessageQueue(){
    const list=document.getElementById('storeForwardQueue'),state=document.getElementById('storeForwardState'),transport=document.getElementById('storeForwardTransport');if(!list)return messageQueueState.items;
    const pending=messageQueueState.items.filter(x=>x.status==='pending'||x.status==='failed').length,available=activeTransports();
    if(state)state.textContent=`${pending} QUEUED`;if(transport)transport.textContent=`TRANSPORT // ${available.length?available.map(x=>x.name.toUpperCase()).join(' + '):'NONE'}`;
    const visible=messageQueueState.items.slice(-40).reverse();
    list.innerHTML=visible.length?visible.map(x=>`<div class="store-forward-row ${x.status}"><i>${esc(x.status.toUpperCase())}</i><div class="store-forward-copy"><b>${esc(x.text)}</b><small>CH ${esc(x.channel||'PRIMARY')} // ${esc(x.transport||'UNASSIGNED')}${x.error?' // '+esc(x.error):''}</small></div><span class="store-forward-time">${new Date(x.createdAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div>`).join(''):'<p class="muted">No queued messages.</p>';
    return messageQueueState.items;
  }
  function queueMessage(textValue,{channel='PRIMARY',meta={}}={}){
    const textValueClean=String(textValue||'').trim().slice(0,1000);if(!textValueClean)return null;
    const item={id:`msg-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,text:textValueClean,channel:String(channel||'PRIMARY'),createdAt:Date.now(),updatedAt:Date.now(),status:'pending',attempts:0,transport:null,error:null,meta};
    messageQueueState.items.push(item);if(messageQueueState.items.length>250)messageQueueState.items.splice(0,messageQueueState.items.length-250);persistMessageQueue();renderMessageQueue();document.dispatchEvent(new CustomEvent('fieldos:messagequeued',{detail:{id:item.id,channel:item.channel,text:item.text,createdAt:item.createdAt}}));flushMessageQueue();return item;
  }
  async function sendQueueItem(item,entry){
    item.status='sending';item.updatedAt=Date.now();item.transport=entry.name;item.attempts=(item.attempts||0)+1;item.error=null;persistMessageQueue();renderMessageQueue();
    try{
      const result=await entry.t.send({...item});
      if(result===false||result?.ok===false)throw new Error(result?.error||'Transport rejected message');
      item.status='sent';item.sentAt=Date.now();item.updatedAt=item.sentAt;item.receipt=result?.receipt||result?.id||null;item.error=null;
      document.dispatchEvent(new CustomEvent('fieldos:messagesent',{detail:{id:item.id,transport:entry.name,receipt:item.receipt}}));return true;
    }catch(err){
      item.status='failed';item.updatedAt=Date.now();item.error=String(err?.message||err||'Send failed').slice(0,180);return false;
    }finally{persistMessageQueue();renderMessageQueue()}
  }
  let flushing=false;
  async function flushMessageQueue(){
    if(flushing)return false;const transports=activeTransports();if(!transports.length){renderMessageQueue();return false}
    flushing=true;let sent=0;
    try{
      for(const item of messageQueueState.items){
        if(!['pending','failed'].includes(item.status))continue;
        let delivered=false;
        for(const entry of transports){if(await sendQueueItem(item,entry)){sent++;delivered=true;break}}
        if(!delivered)item.status='failed';
      }
      const el=document.getElementById('storeForwardLastFlush');if(el)el.textContent=`LAST FLUSH // ${new Date().toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} // ${sent} SENT`;
      persistMessageQueue();renderMessageQueue();return sent>0;
    }finally{flushing=false}
  }
  function registerTransport(name,adapter={}){
    if(!name||typeof adapter.send!=='function')throw new Error('Transport requires a name and send(message) function.');
    transportRegistry.set(String(name),{priority:0,available:false,...adapter});renderMessageQueue();queueMicrotask(flushMessageQueue);return ()=>{transportRegistry.delete(String(name));renderMessageQueue()};
  }
  function setTransportAvailability(name,available){
    const t=transportRegistry.get(String(name));if(!t)return false;t.available=!!available;renderMessageQueue();if(available)flushMessageQueue();return true;
  }
  function clearSentMessages(){messageQueueState.items=messageQueueState.items.filter(x=>x.status!=='sent');persistMessageQueue();renderMessageQueue()}
  document.addEventListener('fieldos:outgoingmessage',e=>{const item=queueMessage(e.detail?.text,{channel:e.detail?.channel||'PRIMARY',meta:e.detail?.meta||{}});if(item)e.preventDefault()});
  document.addEventListener('fieldos:transportchange',e=>{if(e.detail?.name)setTransportAvailability(e.detail.name,e.detail.available)});
  window.addEventListener('online',flushMessageQueue);document.getElementById('storeForwardRetry')?.addEventListener('click',flushMessageQueue);document.getElementById('storeForwardClearSent')?.addEventListener('click',clearSentMessages);
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='comms')renderMessageQueue()});
  loadMessageQueue();renderMessageQueue();
  window.FIELD_TRANSPORT={register:registerTransport,setAvailable:setTransportAvailability,flush:flushMessageQueue,queue:queueMessage,clearSent:clearSentMessages,active:activeTransports,state:messageQueueState};

  // Feature 11 — Relay Placement Recommendation.
  function weakCoverageCentroid(samples=[]){
    const weak=(Array.isArray(samples)?samples:[]).filter(s=>validPoint(s)&&['weak','dead'].includes(s.quality||classifyMeshCoverage(s)));
    if(!weak.length)return null;
    const lat=weak.reduce((sum,s)=>sum+Number(s.lat),0)/weak.length,lon=weak.reduce((sum,s)=>sum+Number(s.lon),0)/weak.length;
    return {lat,lon,count:weak.length};
  }
  function relayCandidates(plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},waypoints=read('waypoints',[]),coverage=meshCoverage.samples){
    const out=[],profile=Array.isArray(plan.elevationProfile)?plan.elevationProfile:[],pos=getPosition(),weakCenter=weakCoverageCentroid(coverage);
    if(profile.length){
      for(let i=0;i<profile.length;i++){
        const p=profile[i];if(!validPoint(p)||!Number.isFinite(Number(p.elevationFt)))continue;
        const prev=Number(profile[Math.max(0,i-2)]?.elevationFt),next=Number(profile[Math.min(profile.length-1,i+2)]?.elevationFt),e=Number(p.elevationFt);
        const localHigh=(!Number.isFinite(prev)||e>=prev)&&(!Number.isFinite(next)||e>=next);
        if(localHigh)out.push({name:`ROUTE HIGH POINT ${i+1}`,type:'ROUTE_HIGH',lat:Number(p.lat),lon:Number(p.lon),elevationFt:e,source:'ROUTE DEM',distanceM:Number(p.distanceM)||0});
      }
    }
    for(const w of Array.isArray(waypoints)?waypoints:[]){
      if(!validPoint(w))continue;
      const alt=Number(w.alt??w.elevationFt);
      if(Number.isFinite(alt)||/RIDGE|SUMMIT|PEAK|LOOKOUT|JUNCTION|BASE|CAMP/i.test(String(w.name||'')+' '+String(w.type||'')))out.push({name:String(w.name||'WAYPOINT'),type:'WAYPOINT',lat:Number(w.lat),lon:Number(w.lon),elevationFt:Number.isFinite(alt)?alt:null,source:'WAYPOINT'});
    }
    if(!out.length)return [];
    const elevs=out.map(x=>x.elevationFt).filter(Number.isFinite),minE=elevs.length?Math.min(...elevs):0,maxE=elevs.length?Math.max(...elevs):1,range=Math.max(1,maxE-minE);
    for(const c of out){
      const elevScore=Number.isFinite(c.elevationFt)?((c.elevationFt-minE)/range)*45:12;
      const accessM=validPoint(pos)?meters(pos,c):2000,accessScore=Math.max(0,25-Math.min(25,accessM/200));
      const needM=weakCenter?meters(weakCenter,c):null,needScore=weakCenter?Math.max(0,25-Math.min(25,needM/250)):10;
      const waypointBonus=c.type==='WAYPOINT'?5:0;
      c.accessM=accessM;c.weakDistanceM=needM;c.score=Math.round(Math.max(0,Math.min(100,elevScore+accessScore+needScore+waypointBonus)));
      c.reason=`${Number.isFinite(c.elevationFt)?Math.round(c.elevationFt).toLocaleString()+' ft elevation':'elevation unknown'} // ${(accessM/1609.344).toFixed(2)} mi from current${needM!=null?' // '+(needM/1609.344).toFixed(2)+' mi from weak-zone center':''}`;
    }
    const dedup=[];
    for(const c of out.sort((a,b)=>b.score-a.score)){if(dedup.some(x=>meters(x,c)<80))continue;dedup.push(c);if(dedup.length>=6)break}
    return dedup;
  }
  function renderRelayRecommendations(items=relayCandidates()){
    const list=document.getElementById('relayRecommendList'),state=document.getElementById('relayRecommendState');if(!list)return items;
    if(state)state.textContent=items.length?`${items.length} CANDIDATE${items.length===1?'':'S'}`:'NO CANDIDATES';
    list.innerHTML=items.length?items.map((x,i)=>`<div class="relay-recommend-row"><i>${String(i+1).padStart(2,'0')}</i><div class="relay-recommend-main"><b>${esc(x.name)}</b><small>${esc(x.reason)} // ${esc(x.source)}</small></div><div class="relay-recommend-score"><b>${x.score}</b><small>REL SCORE</small></div><button class="relay-recommend-save" type="button" data-relay-save="${i}">SAVE RELAY</button></div>`).join(''):'<div class="terrain-risk-empty">ADD ROUTE ELEVATION OR ELEVATED WAYPOINTS TO SCORE RELAY LOCATIONS</div>';
    window.FIELD_RELAY._rendered=items;return items;
  }
  function saveRelayCandidate(item){
    if(!item||!validPoint(item))return false;
    document.dispatchEvent(new CustomEvent('fieldos:addwaypoint',{detail:{name:`RELAY — ${item.name}`,type:'JUNCTION',lat:item.lat,lon:item.lon,alt:item.elevationFt??null,notes:`Relay candidate score ${item.score}/100 from FIELD/OS; verify line of sight and access before use.`}}));return true;
  }
  document.getElementById('relayRecommendRefresh')?.addEventListener('click',()=>renderRelayRecommendations());document.addEventListener('click',e=>{const b=e.target.closest('[data-relay-save]');if(!b)return;const item=window.FIELD_RELAY?._rendered?.[Number(b.dataset.relaySave)];if(item){saveRelayCandidate(item);b.textContent='SAVED';b.disabled=true}});
  document.addEventListener('fieldos:routechange',()=>renderRelayRecommendations());document.addEventListener('fieldos:waypointschange',()=>renderRelayRecommendations());document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='comms')renderRelayRecommendations()});setTimeout(()=>renderRelayRecommendations(),300);
  window.FIELD_RELAY={candidates:relayCandidates,render:renderRelayRecommendations,save:saveRelayCandidate,weakCentroid:weakCoverageCentroid,_rendered:[]};

  // Feature 10 — Mesh Coverage Heatmap.
  const meshCoverage={samples:[]};
  function classifyMeshCoverage(sample={}){
    const rssi=Number(sample.rssi),snr=Number(sample.snr);
    if((Number.isFinite(rssi)&&rssi<-115)||(Number.isFinite(snr)&&snr<-8))return 'dead';
    if((Number.isFinite(rssi)&&rssi<-103)||(Number.isFinite(snr)&&snr<0))return 'weak';
    if((Number.isFinite(rssi)&&rssi<-90)||(Number.isFinite(snr)&&snr<5))return 'fair';
    return 'strong';
  }
  function normalizeCoverageSample(raw={}){
    const lat=Number(raw.lat),lon=Number(raw.lon),rssi=Number(raw.rssi),snr=Number(raw.snr);
    if(!Number.isFinite(lat)||!Number.isFinite(lon)||Math.abs(lat)>90||Math.abs(lon)>180)return null;
    if(!Number.isFinite(rssi)&&!Number.isFinite(snr))return null;
    return {lat,lon,rssi:Number.isFinite(rssi)?rssi:null,snr:Number.isFinite(snr)?snr:null,time:Number(raw.time)||Date.now(),quality:classifyMeshCoverage({rssi,snr})};
  }
  function addCoverageSample(raw={}){
    const s=normalizeCoverageSample(raw);if(!s)return null;
    const last=meshCoverage.samples.at(-1);
    if(last&&meters(last,s)<8&&Math.abs((s.time||0)-(last.time||0))<30000){meshCoverage.samples[meshCoverage.samples.length-1]=s}
    else meshCoverage.samples.push(s);
    if(meshCoverage.samples.length>1200)meshCoverage.samples.splice(0,meshCoverage.samples.length-1200);
    write('mesh-coverage',{savedAt:new Date().toISOString(),samples:meshCoverage.samples});
    renderMeshCoverage();return s;
  }
  function renderMeshCoverage(){
    const svg=document.getElementById('meshCoverageMap'),state=document.getElementById('meshCoverageState'),summary=document.getElementById('meshCoverageSummary');if(!svg)return meshCoverage.samples;
    const samples=meshCoverage.samples.slice(-800),origin=getPosition(),validOrigin=validPoint(origin);
    if(!samples.length){svg.innerHTML='<text x="400" y="180" text-anchor="middle" fill="currentColor" opacity=".45" font-size="12">NO COVERAGE SAMPLES</text>';if(state)state.textContent='NO SAMPLES';if(summary)summary.textContent='SAMPLES // 0';return samples}
    const ref=validOrigin?origin:samples.at(-1),pts=samples.map(s=>({s,p:meshPoint(s,ref)})).filter(x=>x.p),maxD=Math.max(150,...pts.map(x=>x.p.distanceM)),scale=145/maxD,cx=400,cy=180;
    const parts=['<g class="mesh-coverage-grid"><path d="M100 0V360M200 0V360M300 0V360M400 0V360M500 0V360M600 0V360M700 0V360M0 60H800M0 120H800M0 180H800M0 240H800M0 300H800"/></g>'];
    for(const {s,p} of pts){const x=cx+p.x*scale,y=cy-p.y*scale,r=s.quality==='dead'?18:s.quality==='weak'?16:s.quality==='fair'?14:12;parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" class="mesh-coverage-sample ${s.quality}"><title>${s.quality.toUpperCase()} / ${Number.isFinite(s.rssi)?Math.round(s.rssi)+' dBm':'RSSI —'} / ${Number.isFinite(s.snr)?s.snr.toFixed(1)+' dB':'SNR —'}</title></circle>`)}
    parts.push(`<circle cx="${cx}" cy="${cy}" r="7" class="mesh-coverage-center"/>`);
    svg.innerHTML=parts.join('');
    const counts={strong:0,fair:0,weak:0,dead:0};for(const s of samples)counts[s.quality]=(counts[s.quality]||0)+1;
    if(state)state.textContent=`${samples.length} SAMPLE${samples.length===1?'':'S'}`;if(summary)summary.textContent=`STRONG ${counts.strong} // FAIR ${counts.fair} // WEAK ${counts.weak} // POOR ${counts.dead} // CACHE LOCAL`;
    return samples;
  }
  function clearMeshCoverage(){meshCoverage.samples=[];try{localStorage.removeItem(key('mesh-coverage'))}catch{}renderMeshCoverage()}
  const savedCoverage=read('mesh-coverage',null);if(Array.isArray(savedCoverage?.samples))meshCoverage.samples=savedCoverage.samples.map(normalizeCoverageSample).filter(Boolean);
  document.addEventListener('fieldos:telemetry',e=>{const d=e.detail||{},m=d.mesh||{},rssi=Number(m.rssi??d.rssi),snr=Number(m.snr??d.snr),pos=getPosition();if(validPoint(pos)&&(Number.isFinite(rssi)||Number.isFinite(snr)))addCoverageSample({lat:pos.lat,lon:pos.lon,rssi,snr,time:Date.now()})});
  document.addEventListener('fieldos:positionchange',()=>{if(document.querySelector('#comms.active'))renderMeshCoverage()});document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='comms')renderMeshCoverage()});document.getElementById('meshCoverageClear')?.addEventListener('click',clearMeshCoverage);setTimeout(renderMeshCoverage,260);
  window.FIELD_MESH_COVERAGE={add:addCoverageSample,render:renderMeshCoverage,clear:clearMeshCoverage,classify:classifyMeshCoverage,state:meshCoverage};

  // Feature 09 — Mesh Network Map / topology cache.
  const meshState={nodes:[]};
  function normalizeMeshNode(raw={}){
    const id=String(raw.id??raw.num??raw.nodeId??raw.name??'').trim();if(!id)return null;
    const lat=Number(raw.lat??raw.latitude),lon=Number(raw.lon??raw.longitude),battery=Number(raw.battery??raw.batteryPercent),rssi=Number(raw.rssi),snr=Number(raw.snr),hops=Number(raw.hops??raw.hopCount);
    const lastRaw=raw.lastHeard??raw.lastSeen??raw.time??Date.now(),lastHeard=typeof lastRaw==='number'?(lastRaw<1e12?lastRaw*1000:lastRaw):Date.parse(lastRaw)||Date.now();
    return {id,name:String(raw.name??raw.shortName??id),role:String(raw.role??'CLIENT'),lat:Number.isFinite(lat)?lat:null,lon:Number.isFinite(lon)?lon:null,battery:Number.isFinite(battery)?battery:null,rssi:Number.isFinite(rssi)?rssi:null,snr:Number.isFinite(snr)?snr:null,hops:Number.isFinite(hops)?hops:null,lastHeard,via:raw.via==null?null:String(raw.via),source:String(raw.source||'MESH')};
  }
  function mergeMeshNodes(list=[]){
    const map=new Map(meshState.nodes.map(n=>[n.id,n]));
    for(const raw of Array.isArray(list)?list:[]){const n=normalizeMeshNode(raw);if(!n)continue;map.set(n.id,{...(map.get(n.id)||{}),...n})}
    meshState.nodes=[...map.values()].sort((a,b)=>b.lastHeard-a.lastHeard).slice(0,250);
    write('mesh-roster',{savedAt:new Date().toISOString(),nodes:meshState.nodes});
    return meshState.nodes;
  }
  function meshAgeLabel(ms){
    const s=Math.max(0,Math.floor((Date.now()-ms)/1000));if(s<60)return `${s}s`;if(s<3600)return `${Math.floor(s/60)}m`;if(s<86400)return `${Math.floor(s/3600)}h`;return `${Math.floor(s/86400)}d`;
  }
  function meshQuality(node){
    if(Date.now()-node.lastHeard>30*60*1000)return 'bad';
    if(Number.isFinite(node.rssi)&&node.rssi<-110)return 'bad';
    if(Number.isFinite(node.rssi)&&node.rssi<-95)return 'weak';
    if(Number.isFinite(node.snr)&&node.snr<0)return 'weak';
    return 'good';
  }
  function meshPoint(node,origin){
    if(!validPoint(origin)||!Number.isFinite(node.lat)||!Number.isFinite(node.lon))return null;
    const dy=(node.lat-origin.lat)*111320,dx=(node.lon-origin.lon)*111320*Math.cos(origin.lat*Math.PI/180);
    return {x:dx,y:dy,distanceM:Math.hypot(dx,dy)};
  }
  function renderMeshNetwork(){
    const svg=document.getElementById('meshNetworkMap'),roster=document.getElementById('meshNodeRoster'),state=document.getElementById('meshNetworkState'),fresh=document.getElementById('meshNetworkFreshness'),cov=document.getElementById('meshNetworkCoverage');if(!svg||!roster)return meshState.nodes;
    const origin=getPosition(),nodes=meshState.nodes.slice(0,40),positioned=nodes.map(n=>({n,p:meshPoint(n,origin)})).filter(x=>x.p),maxD=Math.max(300,...positioned.map(x=>x.p.distanceM)),scale=165/maxD,cx=400,cy=210;
    const byId=new Map(nodes.map(n=>[n.id,n])),parts=[];
    parts.push('<g class="mesh-grid"><circle cx="400" cy="210" r="55" fill="none" stroke="currentColor" opacity=".08"/><circle cx="400" cy="210" r="110" fill="none" stroke="currentColor" opacity=".08"/><circle cx="400" cy="210" r="165" fill="none" stroke="currentColor" opacity=".08"/><path d="M400 20V400M20 210H780" stroke="currentColor" opacity=".06"/></g>');
    const coords=new Map();
    for(const {n,p} of positioned){coords.set(n.id,{x:cx+p.x*scale,y:cy-p.y*scale})}
    for(const {n} of positioned){
      const a=coords.get(n.id),parent=n.via&&coords.get(n.via),q=meshQuality(n),from=parent||{x:cx,y:cy};
      parts.push(`<line x1="${from.x.toFixed(1)}" y1="${from.y.toFixed(1)}" x2="${a.x.toFixed(1)}" y2="${a.y.toFixed(1)}" class="mesh-link ${q}"><title>${esc(n.name)} / ${Number.isFinite(n.hops)?n.hops+' hops':'link'}</title></line>`);
    }
    parts.push(`<g class="mesh-you"><circle cx="${cx}" cy="${cy}" r="9"/><text x="${cx+13}" y="${cy-2}">YOU</text><text class="sub" x="${cx+13}" y="${cy+11}">${esc(origin.source||'POSITION')}</text></g>`);
    for(const {n} of positioned){const a=coords.get(n.id),q=meshQuality(n);parts.push(`<g class="mesh-node ${q}"><circle cx="${a.x.toFixed(1)}" cy="${a.y.toFixed(1)}" r="7"/><text x="${(a.x+11).toFixed(1)}" y="${(a.y-2).toFixed(1)}">${esc(n.name)}</text><text class="sub" x="${(a.x+11).toFixed(1)}" y="${(a.y+10).toFixed(1)}">${Number.isFinite(n.rssi)?Math.round(n.rssi)+'dBm':'RSSI —'} · ${meshAgeLabel(n.lastHeard)}</text></g>`)}
    svg.innerHTML=parts.join('');
    roster.innerHTML=nodes.length?nodes.map(n=>{const q=meshQuality(n),p=meshPoint(n,origin);return `<div class="mesh-node-row ${q}"><b>${esc(n.name)} <small>${esc(n.role)}</small></b><span>${meshAgeLabel(n.lastHeard)} AGO</span><small>ID ${esc(n.id)} // ${Number.isFinite(n.rssi)?'RSSI '+Math.round(n.rssi)+' dBm':'RSSI —'} // ${Number.isFinite(n.snr)?'SNR '+n.snr.toFixed(1)+' dB':'SNR —'} // ${Number.isFinite(n.battery)?'BAT '+Math.round(n.battery)+'%':'BAT —'} // ${Number.isFinite(n.hops)?n.hops+' HOP'+(n.hops===1?'':'S'):'HOPS —'}${p?' // '+(p.distanceM/1609.344).toFixed(2)+' mi':''}${n.via?' // VIA '+esc(n.via):''}</small></div>`}).join(''):'<p class="muted">Waiting for Meshtastic node telemetry.</p>';
    if(state)state.textContent=`${nodes.length} NODE${nodes.length===1?'':'S'} // ${positioned.length} POSITIONED`;
    const cache=read('mesh-roster',null);if(fresh)fresh.textContent=`CACHE // ${cache?.savedAt?new Date(cache.savedAt).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'EMPTY'}`;if(cov)cov.textContent=`POSITIONED ${positioned.length} / ${nodes.length}`;
    return nodes;
  }
  function ingestMeshNodes(list=[]){mergeMeshNodes(list);renderMeshNetwork();document.dispatchEvent(new CustomEvent('fieldos:meshroster',{detail:{count:meshState.nodes.length}}));return meshState.nodes}
  const savedMesh=read('mesh-roster',null);if(Array.isArray(savedMesh?.nodes))meshState.nodes=savedMesh.nodes.map(normalizeMeshNode).filter(Boolean);
  document.addEventListener('fieldos:telemetry',e=>{const d=e.detail||{},nodes=Array.isArray(d.mesh?.nodeList)?d.mesh.nodeList:Array.isArray(d.mesh?.nodes)?d.mesh.nodes:Array.isArray(d.nodes)?d.nodes:null;if(nodes)ingestMeshNodes(nodes)});
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='comms')renderMeshNetwork()});document.addEventListener('fieldos:positionchange',()=>{if(document.querySelector('#comms.active'))renderMeshNetwork()});setInterval(()=>{if(document.querySelector('#comms.active'))renderMeshNetwork()},5000);setTimeout(renderMeshNetwork,220);
  window.FIELD_MESH={ingest:ingestMeshNodes,render:renderMeshNetwork,normalize:normalizeMeshNode,quality:meshQuality,point:meshPoint,state:meshState};

  // Feature 08 — Position Confidence.
  function numericFromText(id){
    const raw=text(id),m=raw.match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;
  }
  function computePositionConfidence(){
    const fix=text('mobileFixState'),source=(window.FIELD_ROUTE_STATE?.current?.()?.source||text('navPositionSource')||'UNKNOWN').toUpperCase();
    const ageRaw=text('fixAge'),ageParts=(ageRaw.match(/(\d+):(\d+):(\d+)/)||[]),ageSec=ageParts.length?Number(ageParts[1])*3600+Number(ageParts[2])*60+Number(ageParts[3]):0;
    const statedAcc=numericFromText('navAccuracy')??numericFromText('homeAccuracy')??15;
    const drActive=!!window.FIELD_DR?.state?.active,drUncertainty=Number(window.FIELD_DR?.state?.uncertaintyM);
    let mode='trusted',authority='GNSS',uncertainty=statedAcc,score=100;
    if(drActive){mode='estimated';authority='DEAD RECKONING';uncertainty=Number.isFinite(drUncertainty)?drUncertainty:Math.max(50,statedAcc);score=58}
    else if(/STALE|NO FIX|AWAITING|UNAVAILABLE/i.test(fix)||ageSec>180){mode='stale';authority='LAST TRUSTED FIX';score=20;uncertainty=Math.max(statedAcc,100)}
    else{
      score-=Math.min(45,Math.max(0,statedAcc-3)*2.2);
      score-=Math.min(35,ageSec/4);
      if(statedAcc>25||ageSec>45){mode='degraded';authority='GNSS';}
    }
    if(mode==='estimated'){
      score-=Math.min(38,Math.max(0,uncertainty-25)/15);
    }
    score=Math.round(Math.max(0,Math.min(100,score)));
    const label=mode==='trusted'?'TRUSTED GNSS':mode==='degraded'?'DEGRADED GNSS':mode==='estimated'?'DEAD-RECKONING ESTIMATE':'STALE / LAST FIX';
    const detail=mode==='trusted'?`Recent GNSS fix with stated accuracy about ±${Math.round(uncertainty)} m.`:
      mode==='degraded'?`GNSS remains authoritative, but fix age or stated accuracy reduces confidence.`:
      mode==='estimated'?`GNSS is unavailable; position is estimated and uncertainty expands with time and travel.`:
      `No fresh GNSS authority. Treat this as a stale last-known position until a trusted fix returns.`;
    return {score,mode,label,detail,authority,source,ageSec,uncertaintyM:uncertainty};
  }
  function renderPositionConfidence(result=computePositionConfidence()){
    const panel=document.querySelector('.position-confidence-panel'),set=(id,v)=>{const el=document.getElementById(id);if(el)el.textContent=v};
    if(panel){panel.classList.remove('conf-trusted','conf-degraded','conf-estimated','conf-stale');panel.classList.add(`conf-${result.mode}`)}
    set('posConfidenceState',result.mode.toUpperCase());set('posConfidenceScore',String(result.score));set('posConfidenceLabel',result.label);set('posConfidenceDetail',result.detail);set('posConfidenceSource',result.source);set('posConfidenceAge',`${Math.floor(result.ageSec/60)}m ${result.ageSec%60}s`);set('posConfidenceUncertainty',result.uncertaintyM>=1000?`±${(result.uncertaintyM/1000).toFixed(1)} km`:`±${Math.round(result.uncertaintyM)} m`);set('posConfidenceAuthority',result.authority);
    const bar=document.getElementById('posConfidenceBar');if(bar)bar.style.width=`${result.score}%`;
    const ring=document.getElementById('posConfidenceRing');if(ring)ring.setAttribute('aria-label',`Position confidence ${result.score} percent, ${result.label}`);
    return result;
  }
  document.addEventListener('fieldos:positionchange',renderPositionConfidence);document.addEventListener('fieldos:telemetry',renderPositionConfidence);document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='nav')renderPositionConfidence()});setInterval(renderPositionConfidence,2000);setTimeout(renderPositionConfidence,180);
  window.FIELD_POSITION_CONFIDENCE={compute:computePositionConfidence,render:renderPositionConfidence};

  // Feature 07 — dead-reckoning backup. Estimate remains separate from GNSS.
  const dr={armed:false,active:false,anchor:null,anchorTime:0,lastFixTime:0,heading:null,speedMps:0,estimated:null,uncertaintyM:null};
  const projectPoint=(p,distanceM,headingDeg)=>{
    const R=6371000,br=toRad(headingDeg),lat1=toRad(p.lat),lon1=toRad(p.lon),ang=distanceM/R;
    const lat2=Math.asin(Math.sin(lat1)*Math.cos(ang)+Math.cos(lat1)*Math.sin(ang)*Math.cos(br));
    const lon2=lon1+Math.atan2(Math.sin(br)*Math.sin(ang)*Math.cos(lat1),Math.cos(ang)-Math.sin(lat1)*Math.sin(lat2));
    return {lat:lat2*180/Math.PI,lon:((lon2*180/Math.PI+540)%360)-180};
  };
  function estimateDr(anchor,elapsedSec,speedMps,headingDeg,baseUncertainty=15){
    if(!validPoint(anchor)||!Number.isFinite(Number(elapsedSec))||!Number.isFinite(Number(speedMps))||!Number.isFinite(Number(headingDeg)))return null;
    const sec=Math.max(0,Math.min(7200,Number(elapsedSec))),spd=Math.max(0,Math.min(15,Number(speedMps))),distance=sec*spd,pos=projectPoint(anchor,distance,Number(headingDeg));
    // Conservative growth: fixed anchor error + time drift + distance/heading uncertainty.
    const uncertainty=Math.min(10000,Math.max(Number(baseUncertainty)||15,Number(baseUncertainty)||15)+sec*.35+distance*.12);
    return {...pos,distanceM:distance,elapsedSec:sec,uncertaintyM:uncertainty,heading:Number(headingDeg),speedMps:spd};
  }
  function parseHeading(){
    const raw=text('navHeading'),m=raw.match(/-?\d+(?:\.\d+)?/);return m?Number(m[0]):null;
  }
  function armDr(){
    const p=getPosition();if(!validPoint(p))return null;
    dr.armed=true;dr.anchor={lat:p.lat,lon:p.lon,alt:p.alt??null,source:p.source||'LAST FIX'};dr.anchorTime=Date.now();dr.lastFixTime=Date.now();dr.heading=Number.isFinite(parseHeading())?parseHeading():0;
    const mph=parseFloat(text('speed'));dr.speedMps=Number.isFinite(mph)?mph*.44704:0;dr.active=false;dr.estimated={...dr.anchor};dr.uncertaintyM=15;renderDr();return {...dr};
  }
  function resetDr(){dr.armed=false;dr.active=false;dr.anchor=null;dr.estimated=null;dr.uncertaintyM=null;renderDr()}
  function updateDr(now=Date.now()){
    const fix=text('mobileFixState'),stale=/STALE|NO FIX|AWAITING|UNAVAILABLE/i.test(fix);
    if(!dr.armed&&stale)armDr();
    if(!dr.armed){renderDr();return null}
    if(!stale){dr.active=false;dr.lastFixTime=now;const p=getPosition();if(validPoint(p)){dr.anchor={lat:p.lat,lon:p.lon,alt:p.alt??null,source:p.source||'GNSS'};dr.anchorTime=now;dr.estimated={...dr.anchor};dr.uncertaintyM=15}renderDr();return dr.estimated}
    dr.active=true;
    const heading=Number.isFinite(dr.heading)?dr.heading:(parseHeading()??0),elapsed=(now-dr.anchorTime)/1000,est=estimateDr(dr.anchor,elapsed,dr.speedMps,heading,15);
    if(est){dr.estimated={lat:est.lat,lon:est.lon,alt:dr.anchor?.alt??null,source:'DEAD RECKONING ESTIMATE'};dr.uncertaintyM=est.uncertaintyM}
    renderDr(now);return dr.estimated;
  }
  function renderDr(now=Date.now()){
    const panel=document.querySelector('.dr-panel'),state=document.getElementById('drState'),warning=document.getElementById('drWarning'),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    if(panel){panel.classList.toggle('dr-active',dr.active);panel.classList.toggle('dr-critical',dr.active&&Number(dr.uncertaintyM)>500)}
    if(state)state.textContent=!dr.armed?'STANDBY':dr.active?'ESTIMATED / GNSS LOST':'ARMED / GNSS PRIMARY';
    if(warning)warning.textContent=dr.active?'ESTIMATED POSITION ONLY — uncertainty grows with time and travel. Verify against terrain, compass and last trusted fix.':'GNSS remains authoritative while available. Dead reckoning is an estimate only.';
    set('drPosition',dr.estimated&&validPoint(dr.estimated)?`${dr.estimated.lat.toFixed(5)}, ${dr.estimated.lon.toFixed(5)}`:'---');
    set('drUncertainty',dr.uncertaintyM==null?'---':dr.uncertaintyM<1000?`±${Math.round(dr.uncertaintyM)} m`:`±${(dr.uncertaintyM/1000).toFixed(1)} km`);
    set('drHeading',Number.isFinite(dr.heading)?`${Math.round(dr.heading)}°`:'---');set('drSpeed',Number.isFinite(dr.speedMps)?`${(dr.speedMps*2.23694).toFixed(1)} mph`:'---');
    set('drElapsed',dr.anchorTime?`${Math.max(0,Math.floor((now-dr.anchorTime)/1000))} s`:'---');set('drAnchorAge',dr.anchorTime?new Date(dr.anchorTime).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit',second:'2-digit'}):'---');
  }
  document.getElementById('drArm')?.addEventListener('click',armDr);document.getElementById('drReset')?.addEventListener('click',resetDr);
  document.addEventListener('fieldos:positionchange',e=>{const p=e.detail;if(validPoint(p)){dr.anchor={lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null,source:p.source||'GNSS'};dr.anchorTime=Date.now();dr.lastFixTime=Date.now();dr.estimated={...dr.anchor};dr.uncertaintyM=Number(p.accuracy)||15;dr.active=false;if(dr.armed)renderDr()}});
  document.addEventListener('fieldos:telemetry',e=>{const h=Number(e.detail?.heading),s=Number(e.detail?.speedMps);if(Number.isFinite(h))dr.heading=h;if(Number.isFinite(s))dr.speedMps=Math.max(0,s)});
  setInterval(updateDr,1000);setTimeout(renderDr,160);
  window.FIELD_DR={estimate:estimateDr,project:projectPoint,arm:armDr,reset:resetDr,update:updateDr,state:dr};

  // Feature 06 — stripped-down breadcrumb navigation.
  let breadcrumbIndex=null,breadcrumbReversed=false;
  const bearing=(a,b)=>{const r=Math.PI/180,y=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r),x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r);return (Math.atan2(y,x)*180/Math.PI+360)%360};
  const cardinal=deg=>['N','NE','E','SE','S','SW','W','NW'][Math.round(((deg%360)+360)%360/45)%8];
  function breadcrumbTrack(){
    const raw=read('track',[]),clean=(Array.isArray(raw)?raw:[]).filter(validPoint).map(p=>({lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null,time:p.time||null}));
    return breadcrumbReversed?[...clean].reverse():clean;
  }
  function computeBreadcrumb(track=breadcrumbTrack(),position=getPosition(),index=breadcrumbIndex){
    const pts=(Array.isArray(track)?track:[]).filter(validPoint);if(!pts.length||!validPoint(position))return null;
    let nearest=0,best=Infinity;for(let i=0;i<pts.length;i++){const d=meters(position,pts[i]);if(d<best){best=d;nearest=i}}
    let targetIndex=index==null?Math.min(pts.length-1,nearest+1):Math.max(0,Math.min(pts.length-1,Number(index)||0));
    if(targetIndex===nearest&&targetIndex<pts.length-1)targetIndex++;
    const target=pts[targetIndex],distanceM=meters(position,target),deg=bearing(position,target);
    return {nearestIndex:nearest,targetIndex,target,distanceM,bearing:deg,cardinal:cardinal(deg),remaining:Math.max(0,pts.length-1-targetIndex),total:pts.length};
  }
  function renderBreadcrumb(){
    const calc=computeBreadcrumb();const state=document.getElementById('breadcrumbState'),arrow=document.getElementById('breadcrumbArrow'),brg=document.getElementById('breadcrumbBearing'),dist=document.getElementById('breadcrumbDistance'),target=document.getElementById('breadcrumbTarget');
    if(!calc){if(state)state.textContent='NO RECORDED TRACK';if(brg)brg.innerHTML='---° <small>---</small>';if(dist)dist.textContent='---';if(target)target.textContent='RECORD A TRACK OR ADD BREADCRUMBS';return null}
    breadcrumbIndex=calc.targetIndex;
    if(state)state.textContent=`TRACK ${breadcrumbReversed?'REVERSED / RETURN':'FORWARD'} // TARGET ${calc.targetIndex+1} OF ${calc.total}`;
    if(arrow)arrow.style.transform=`rotate(${calc.bearing}deg)`;
    if(brg)brg.innerHTML=`${Math.round(calc.bearing).toString().padStart(3,'0')}° <small>${calc.cardinal}</small>`;
    if(dist)dist.textContent=calc.distanceM<160.934?`${Math.round(calc.distanceM*3.28084)} ft`:`${(calc.distanceM/1609.344).toFixed(2)} mi`;
    if(target)target.textContent=`BREADCRUMB ${calc.targetIndex+1} / ${calc.total}`;
    const pos=getPosition(),battery=parseBattery();const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};
    set('breadcrumbElevation',pos.alt==null?'—':`${Math.round(pos.alt)} ft`);set('breadcrumbGps',text('mobileFixState'));set('breadcrumbBattery',battery==null?'—':`${battery}%`);set('breadcrumbRemaining',String(calc.remaining));
    return calc;
  }
  function breadcrumbStep(delta){const pts=breadcrumbTrack();if(!pts.length)return null;const base=breadcrumbIndex==null?(computeBreadcrumb()?.targetIndex||0):breadcrumbIndex;breadcrumbIndex=Math.max(0,Math.min(pts.length-1,base+delta));return renderBreadcrumb()}
  function breadcrumbNearest(){breadcrumbIndex=null;return renderBreadcrumb()}
  function breadcrumbReverse(){breadcrumbReversed=!breadcrumbReversed;breadcrumbIndex=null;return renderBreadcrumb()}
  document.getElementById('breadcrumbPrev')?.addEventListener('click',()=>breadcrumbStep(-1));document.getElementById('breadcrumbNext')?.addEventListener('click',()=>breadcrumbStep(1));document.getElementById('breadcrumbNearest')?.addEventListener('click',breadcrumbNearest);document.getElementById('breadcrumbReverse')?.addEventListener('click',breadcrumbReverse);
  document.addEventListener('fieldos:positionchange',()=>{if(document.querySelector('#breadcrumb.active'))renderBreadcrumb()});document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='breadcrumb')renderBreadcrumb()});
  setInterval(()=>{if(document.querySelector('#breadcrumb.active'))renderBreadcrumb()},1500);
  window.FIELD_BREADCRUMB={compute:computeBreadcrumb,render:renderBreadcrumb,step:breadcrumbStep,nearest:breadcrumbNearest,reverse:breadcrumbReverse,get reversed(){return breadcrumbReversed}};

  // Feature 05 — Off-course rerouting.
  function computeReroute(plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},position=getPosition()){
    const pts=cleanPoints(plan.points||[]);if(pts.length<2||!validPoint(position))return null;
    let nearest=0,best=Infinity;
    for(let i=0;i<pts.length;i++){const d=meters(position,pts[i]);if(d<best){best=d;nearest=i}}
    const returnIndex=Math.max(0,nearest-1),returnPoint=pts[returnIndex];
    let aheadIndex=nearest,aheadM=0;
    while(aheadIndex<pts.length-1&&aheadM<805){aheadM+=meters(pts[aheadIndex],pts[aheadIndex+1]);aheadIndex++}
    aheadIndex=Math.max(nearest,Math.min(pts.length-1,aheadIndex));
    return {offsetM:best,nearestIndex:nearest,return:{index:returnIndex,target:returnPoint,label:'RETURN TO ROUTE'},ahead:{index:aheadIndex,target:pts[aheadIndex],distanceAheadM:aheadM,label:'INTERCEPT AHEAD'},destination:{index:pts.length-1,target:pts.at(-1),label:'ALTERNATE TO DESTINATION'}};
  }
  function safePlanClone(plan){try{return JSON.parse(JSON.stringify(plan))}catch{return {points:cleanPoints(plan?.points||[]),anchors:cleanPoints(plan?.anchors||[]),routingMode:plan?.routingMode||'trail',name:plan?.name||'ORIGINAL ROUTE'}}}
  function saveOriginalForReroute(){if(read('reroute-original',null))return read('reroute-original',null);const plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{};if(cleanPoints(plan.points||[]).length<2)return null;const saved={savedAt:new Date().toISOString(),plan:safePlanClone(plan)};write('reroute-original',saved);return saved}
  async function applyReroute(kind){
    const plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},pos=getPosition(),options=computeReroute(plan,pos);if(!options||!options[kind])throw new Error('No valid recovery target.');
    saveOriginalForReroute();const target=options[kind].target,status=document.getElementById('rerouteStatus');if(status)status.textContent='BUILDING…';
    try{const result=await window.FIELD_ROUTE_PLANNER?.replaceRoute?.([pos,target],{mode:'trail',open:true});if(status)status.textContent='RECOVERY ROUTE READY';return result}
    catch(err){if(status)status.textContent='REROUTE FAILED';console.warn('FIELD/OS reroute failed',err);throw err}
  }
  function restoreOriginalRoute(){
    const saved=read('reroute-original',null),plan=saved?.plan;if(!plan)return false;
    const state=window.FIELD_ROUTE_STATE;if(!state)return false;
    state.setMeta?.(plan);state.setPoints?.(cleanPoints(plan.points||[]));state.setMeta?.(plan);state.save?.();
    try{localStorage.removeItem(key('reroute-original'))}catch{}
    document.dispatchEvent(new CustomEvent('fieldos:rerouterestore',{detail:{restoredAt:new Date().toISOString()}}));
    window.FIELD_OPEN_VIEW?.('nav');refreshReroute();return true;
  }
  function refreshReroute(){
    const panel=document.getElementById('reroutePanel'),detail=document.getElementById('rerouteDetail'),status=document.getElementById('rerouteStatus');if(!panel)return null;
    const plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},calc=computeReroute(plan),banner=text('routeDeviationBanner'),off=/DEVIATION|OFF ROUTE/i.test(banner),hasOriginal=!!read('reroute-original',null);
    panel.hidden=!off&&!hasOriginal;
    if(calc&&detail)detail.textContent=`Current offset screening: ${Math.round(calc.offsetM*3.28084)} ft. Return targets route point ${calc.return.index+1}; ahead intercept is about ${(calc.ahead.distanceAheadM/1609.344).toFixed(2)} mi farther along the route.`;
    if(status)status.textContent=hasOriginal?'RECOVERY ACTIVE / ORIGINAL SAVED':off?'RECOVERY OPTIONS READY':'ON ROUTE';
    const restore=document.getElementById('restoreOriginalRoute');if(restore)restore.disabled=!hasOriginal;
    return calc;
  }
  document.addEventListener('click',e=>{const b=e.target.closest('[data-reroute]');if(!b)return;b.disabled=true;applyReroute(b.dataset.reroute).catch(()=>{}).finally(()=>b.disabled=false)});
  document.getElementById('restoreOriginalRoute')?.addEventListener('click',restoreOriginalRoute);
  document.addEventListener('fieldos:positionchange',refreshReroute);document.addEventListener('fieldos:routechange',()=>setTimeout(refreshReroute,0));document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='nav')refreshReroute()});
  setInterval(()=>{if(document.querySelector('#nav.active'))refreshReroute()},3000);setTimeout(refreshReroute,150);
  window.FIELD_REROUTE={compute:computeReroute,apply:applyReroute,restore:restoreOriginalRoute,refresh:refreshReroute,saveOriginal:saveOriginalForReroute};

  // Feature 04 — Escape / Bailout Planner.
  const bailoutTypeWeight={TRAILHEAD:.86,PARKING:.88,BASE:.90,SHELTER:.96,HUT:.98,CAMP:1.04,ROUTE_END:1.05,ROUTE_START:1.08,VILLAGE:1.10,TOWN:1.08,ROAD:1.18,JUNCTION:1.15};
  function bailoutType(raw=''){
    const s=String(raw).toUpperCase();
    if(/TRAILHEAD/.test(s))return 'TRAILHEAD';if(/PARK/.test(s))return 'PARKING';if(/BASE|VEHICLE/.test(s))return 'BASE';if(/SHELTER/.test(s))return 'SHELTER';if(/HUT/.test(s))return 'HUT';if(/CAMP/.test(s))return 'CAMP';if(/VILLAGE|HAMLET/.test(s))return 'VILLAGE';if(/TOWN|CITY/.test(s))return 'TOWN';if(/ROAD/.test(s))return 'ROAD';if(/JUNCTION|BAILOUT/.test(s))return 'JUNCTION';return s||'EXIT';
  }
  function rankBailouts(candidates=[],position=getPosition()){
    if(!validPoint(position))return [];
    const seen=[];
    for(const raw of Array.isArray(candidates)?candidates:[]){
      if(!validPoint(raw))continue;
      const type=bailoutType(raw.type||raw.category||''),distanceM=meters(position,{lat:Number(raw.lat),lon:Number(raw.lon)}),weight=bailoutTypeWeight[type]||1.12,score=distanceM*weight;
      const item={...raw,lat:Number(raw.lat),lon:Number(raw.lon),type,name:String(raw.name||type.replaceAll('_',' ')),distanceM,score,source:String(raw.source||'LOCAL')};
      if(seen.some(x=>meters(x,item)<35&&x.type===item.type))continue;
      seen.push(item);
    }
    return seen.sort((a,b)=>a.score-b.score||a.distanceM-b.distanceM).slice(0,12);
  }
  function localBailoutCandidates(){
    const out=[],plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},pts=cleanPoints(plan.points||[]),wps=read('waypoints',[]);
    if(pts.length){out.push({name:'ROUTE START',type:'ROUTE_START',lat:pts[0].lat,lon:pts[0].lon,source:'ROUTE'});if(pts.length>1)out.push({name:'ROUTE END',type:'ROUTE_END',lat:pts.at(-1).lat,lon:pts.at(-1).lon,source:'ROUTE'})}
    for(const w of Array.isArray(wps)?wps:[])if(validPoint(w)&&/BASE|CAMP|JUNCTION|BAILOUT|TRAILHEAD/i.test(String(w.type||'')+' '+String(w.name||'')))out.push({name:w.name,type:w.type,lat:w.lat,lon:w.lon,source:'WAYPOINT',notes:w.notes||''});
    const cache=read('bailout-cache',null),pos=getPosition();
    if(cache&&Array.isArray(cache.items)&&validPoint(cache.center)&&validPoint(pos)&&meters(cache.center,pos)<30000)out.push(...cache.items.map(x=>({...x,source:'OSM CACHE'})));
    return out;
  }
  function renderBailouts(items=rankBailouts(localBailoutCandidates())){
    const list=document.getElementById('bailoutList'),status=document.getElementById('bailoutStatus'),note=document.getElementById('bailoutSourceNote');if(!list)return items;
    if(status)status.textContent=`${items.length} CANDIDATE${items.length===1?'':'S'}`;
    list.innerHTML=items.length?items.map((x,i)=>`<div class="bailout-row"><i>${String(i+1).padStart(2,'0')}</i><div class="bailout-row-main"><b>${esc(x.name)}</b><small>${esc(x.type.replaceAll('_',' '))} // ${esc(x.source)}${x.notes?' // '+esc(x.notes):''}</small></div><div class="bailout-distance"><b>${(x.distanceM/1609.344).toFixed(2)} mi</b><small>STRAIGHT LINE</small></div><button class="bailout-save" type="button" data-bailout-save="${i}">SAVE EXIT</button></div>`).join(''):'<div class="terrain-risk-empty">NO LOCAL OR CACHED BAILOUT CANDIDATES</div>';
    if(note){const cache=read('bailout-cache',null);note.textContent=`SOURCE // ROUTE + WAYPOINTS${cache?.retrievedAt?' + OSM CACHE '+new Date(cache.retrievedAt).toLocaleString():''} // RANK IS SCREENING ONLY`}
    window.FIELD_BAILOUT._rendered=items;return items;
  }
  function normalizeOsmExit(el){
    const t=el.tags||{},center=el.type==='node'?el:el.center;if(!center||!validPoint(center))return null;
    let type='EXIT';
    if(t.information==='trailhead')type='TRAILHEAD';else if(t.amenity==='shelter')type='SHELTER';else if(/hut/.test(t.tourism||''))type='HUT';else if(t.tourism==='camp_site')type='CAMP';else if(t.amenity==='parking')type='PARKING';else if(/town|city/.test(t.place||''))type='TOWN';else if(/village|hamlet/.test(t.place||''))type='VILLAGE';else if(t.highway)type='ROAD';
    const name=t.name||t.ref||t.operator||type.replaceAll('_',' ');
    return {id:`osm-${el.type}-${el.id}`,name,type,lat:Number(center.lat),lon:Number(center.lon),source:'OSM LIVE',notes:t.highway?`road ${t.highway}`:t.shelter_type||''};
  }
  async function searchBailoutsOnline(){
    const pos=getPosition();if(!validPoint(pos))throw new Error('No valid position for bailout search.');
    const q=`[out:json][timeout:18];(node(around:8000,${pos.lat},${pos.lon})[information=trailhead];node(around:8000,${pos.lat},${pos.lon})[amenity=shelter];node(around:8000,${pos.lat},${pos.lon})[tourism~"^(wilderness_hut|alpine_hut|camp_site)$"];node(around:8000,${pos.lat},${pos.lon})[amenity=parking];node(around:8000,${pos.lat},${pos.lon})[place~"^(town|village|hamlet)$"];way(around:5000,${pos.lat},${pos.lon})[highway~"^(primary|secondary|tertiary|unclassified|residential)$"][name];);out center tags 140;`;
    const status=document.getElementById('bailoutStatus');if(status)status.textContent='SEARCHING OSM…';
    const res=await fetch('https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q)});
    if(!res.ok)throw new Error(`OSM bailout search failed (HTTP ${res.status}).`);
    const data=await res.json(),items=(data.elements||[]).map(normalizeOsmExit).filter(Boolean);
    const cache={retrievedAt:new Date().toISOString(),center:{lat:pos.lat,lon:pos.lon},items:rankBailouts(items,pos).slice(0,60).map(({score,distanceM,...x})=>x)};
    write('bailout-cache',cache);return renderBailouts(rankBailouts(localBailoutCandidates(),pos));
  }
  function clearBailoutCache(){try{localStorage.removeItem(key('bailout-cache'))}catch{}return renderBailouts()}
  function saveBailoutCandidate(item){
    if(!item||!validPoint(item))return false;
    document.dispatchEvent(new CustomEvent('fieldos:addwaypoint',{detail:{name:`BAILOUT — ${item.name}`,type:item.type==='CAMP'?'CAMP':item.type==='BASE'?'BASE':'JUNCTION',lat:item.lat,lon:item.lon,notes:`Bailout candidate from ${item.source}; straight-line screening distance ${(item.distanceM/1609.344).toFixed(2)} mi`}}));return true;
  }
  document.getElementById('bailoutRefresh')?.addEventListener('click',()=>renderBailouts());document.getElementById('bailoutSearchOnline')?.addEventListener('click',async e=>{e.currentTarget.disabled=true;try{await searchBailoutsOnline()}catch(err){const s=document.getElementById('bailoutStatus');if(s)s.textContent='SEARCH FAILED';console.warn('FIELD/OS bailout search failed',err)}finally{e.currentTarget.disabled=false}});
  document.getElementById('bailoutClearCache')?.addEventListener('click',clearBailoutCache);
  document.addEventListener('click',e=>{const b=e.target.closest('[data-bailout-save]');if(!b)return;const item=window.FIELD_BAILOUT?._rendered?.[Number(b.dataset.bailoutSave)];if(item){saveBailoutCandidate(item);b.textContent='SAVED';b.disabled=true}});
  document.addEventListener('fieldos:positionchange',()=>renderBailouts());document.addEventListener('fieldos:routechange',()=>renderBailouts());document.addEventListener('fieldos:waypointschange',()=>renderBailouts());document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='trailreturn')renderBailouts()});
  window.FIELD_BAILOUT={rank:rankBailouts,local:localBailoutCandidates,render:renderBailouts,searchOnline:searchBailoutsOnline,clearCache:clearBailoutCache,saveCandidate:saveBailoutCandidate,_rendered:[]};
  setTimeout(()=>renderBailouts(),120);

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
