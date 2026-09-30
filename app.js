const views = [...document.querySelectorAll('.view')];
const tabButtons = [...document.querySelectorAll('.tab-btn[data-tab-for]')];
const moreTabs = document.getElementById('moreTabs');
const tabSheet = document.getElementById('tabSheet');
const tabSheetBackdrop = document.getElementById('tabSheetBackdrop');
const moreViewNames = new Set(['route','trailreturn','breadcrumb','waypoints','track','trip','mission','survival','weather','sensors','log','power','system','sos']);
const DEMO_POS = {lat:44.4759, lon:-73.2121, alt:3420};
let currentNavPosition={...DEMO_POS, source:'DEMO GNSS'};
let currentAccuracy=4;
const STORE_PREFIX = 'fieldos-v12-';
const PREV_PREFIX = 'fieldos-v06-';
const V05_PREFIX = 'fieldos-v05-';
const LEGACY_PREFIX = 'fieldos-v04-';
function storageGet(key){try{return localStorage.getItem(key)}catch(err){console.warn('FIELD/OS storage unavailable',err);return null}}
function storageSet(key,val){try{localStorage.setItem(key,String(val));return true}catch(err){console.warn('FIELD/OS storage write failed',key,err);return false}}
function storageRemove(key){try{localStorage.removeItem(key);return true}catch(err){console.warn('FIELD/OS storage remove failed',key,err);return false}}
function storageKeys(){try{return Object.keys(localStorage)}catch(err){console.warn('FIELD/OS storage unavailable',err);return []}}
// One-time local migration so older trip/route data is not lost.
for(const key of storageKeys()){
  if(key.startsWith(PREV_PREFIX)){
    const next=STORE_PREFIX+key.slice(PREV_PREFIX.length),val=storageGet(key);
    if(storageGet(next)==null && val!=null) storageSet(next,val);
  }
}
for(const key of storageKeys()){
  if(key.startsWith(V05_PREFIX)){
    const next=STORE_PREFIX+key.slice(V05_PREFIX.length),val=storageGet(key);
    if(storageGet(next)==null && val!=null) storageSet(next,val);
  }
}
for(const key of storageKeys()){
  if(key.startsWith(LEGACY_PREFIX)){
    const next=STORE_PREFIX+key.slice(LEGACY_PREFIX.length),val=storageGet(key);
    if(storageGet(next)==null && val!=null) storageSet(next,val);
  }
}

function closeTabSheet(){
  tabSheet?.classList.remove('open');
  tabSheet?.setAttribute('aria-hidden','true');
  tabSheetBackdrop?.setAttribute('hidden','');
  moreTabs?.setAttribute('aria-expanded','false');
  document.body.classList.remove('sheet-open');
}
function toggleTabSheet(force){
  if(!tabSheet||!moreTabs)return;
  const willOpen = force ?? !tabSheet.classList.contains('open');
  tabSheet.classList.toggle('open',willOpen);
  tabSheet.setAttribute('aria-hidden',String(!willOpen));
  if(tabSheetBackdrop){if(willOpen)tabSheetBackdrop.removeAttribute('hidden');else tabSheetBackdrop.setAttribute('hidden','')}
  moreTabs.setAttribute('aria-expanded',String(willOpen));
  document.body.classList.toggle('sheet-open',willOpen);
}
function syncNavigationState(name){
  tabButtons.forEach(b=>{
    const active=b.dataset.tabFor===name;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  const inMore=moreViewNames.has(name);
  moreTabs?.classList.toggle('active',inMore);
  if(moreTabs){
    if(inMore)moreTabs.setAttribute('aria-current','page');else moreTabs.removeAttribute('aria-current');
  }
  document.querySelectorAll('#tabSheet [data-open]').forEach(b=>{
    const active=b.dataset.open===name;
    b.classList.toggle('active',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('.workstation-nav [data-module]').forEach(b=>{
    const active=b.dataset.module===name;
    b.classList.toggle('selected',active);
    if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
  });
  document.querySelectorAll('#home .console-rail [data-open]').forEach(b=>{
    const active=name!=='home'&&b.dataset.open===name;
    b.classList.toggle('rail-active',active);
    b.setAttribute('aria-pressed',active?'true':'false');
    const raw=b.textContent.replace(/^[▶▷]\s*/,'').trim();
    b.textContent=(active?'▶ ':'▷ ')+raw;
  });
}
function openView(name,{history=true,focus=true}={}){
  const target=views.find(v=>v.dataset.view===name);
  if(!target){
    console.warn('FIELD/OS navigation target not found',name);
    return false;
  }
  const previous=document.querySelector('.view.active')?.dataset.view||'home';
  views.forEach(v => v.classList.toggle('active', v === target));
  syncNavigationState(name);
  closeTabSheet();
  if(focus)document.getElementById('screen')?.focus({preventScroll:true});
  window.scrollTo({top:0, behavior:'auto'});
  if(history&&previous!==name){
    try{window.history.pushState({fieldosView:name},'',name==='home'?location.pathname+location.search:`#${name}`)}catch{}
  }
  document.dispatchEvent(new CustomEvent('fieldos:viewchange',{detail:{view:name,previous}}));
  return true;
}
window.FIELD_OPEN_VIEW=openView;
window.FIELD_SYNC_NAV=syncNavigationState;

document.addEventListener('click', (e) => {
  const trigger=e.target.closest('[data-open]');
  const isMapControl=e.target.closest('[data-map-action]');
  // Navigation wins when a control explicitly declares a destination.
  if(trigger){
    e.preventDefault();
    openView(trigger.dataset.open);
  }else if(isMapControl){
    // handled by the map engine
  }
  const theme = e.target.closest('[data-theme-choice]');
  if(theme) applyTheme(theme.dataset.themeChoice,true);
});

window.addEventListener('popstate',e=>{
  const fromState=e.state?.fieldosView;
  const fromHash=location.hash.replace(/^#/,'');
  const target=views.some(v=>v.dataset.view===fromState)?fromState:
    views.some(v=>v.dataset.view===fromHash)?fromHash:'home';
  openView(target,{history:false});
});
window.addEventListener('hashchange',()=>{
  const target=location.hash.replace(/^#/,'');
  if(views.some(v=>v.dataset.view===target))openView(target,{history:false});
});

moreTabs?.addEventListener('click',()=>toggleTabSheet());
document.getElementById('closeTabSheet')?.addEventListener('click',()=>closeTabSheet());
tabSheetBackdrop?.addEventListener('click',()=>closeTabSheet());
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTabSheet()});
{
  const initialHash=location.hash.replace(/^#/,'');
  const initial=views.some(v=>v.dataset.view===initialHash)?initialHash:(document.querySelector('.view.active')?.dataset.view||'home');
  if(initial!=='home')openView(initial,{history:false,focus:false});
  else syncNavigationState('home');
}

function syncThemeButtons(){
  const active=document.body.dataset.theme||'green';
  document.querySelectorAll('[data-theme-choice]').forEach(btn=>{
    const on=btn.dataset.themeChoice===active;
    btn.classList.toggle('active',on);
    btn.setAttribute('aria-pressed',on?'true':'false');
  });
}

const THEME_META_COLORS={green:'#000402',amber:'#100b03',mono:'#0b0b0b',red:'#0d0303'};
function refreshThemeSurfaces(){
  const active=document.body.dataset.theme||'green';
  const meta=document.querySelector('meta[name="theme-color"]');
  if(meta)meta.setAttribute('content',THEME_META_COLORS[active]||'#000000');
  requestAnimationFrame(()=>{
    try{drawPressureChart()}catch{}
    try{updateRouteMetrics()}catch{}
    document.dispatchEvent(new CustomEvent('fieldos:themechange',{detail:{theme:active}}));
  });
}
function applyTheme(name,persist=true){
  const next=['green','amber','mono','red'].includes(name)?name:'green';
  document.body.dataset.theme=next;
  if(persist)storageSet(STORE_PREFIX+'theme',next);
  syncThemeButtons();
  refreshThemeSurfaces();
}

const savedTheme = storageGet(STORE_PREFIX+'theme') || storageGet('fieldos-theme') || 'green';
applyTheme(savedTheme,false);

function updateClock(){
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  document.getElementById('date').textContent = now.toLocaleDateString([], {year:'numeric', month:'2-digit', day:'2-digit'});
}
updateClock(); setInterval(updateClock,1000);

let demo = {alt:3420, heading:37, speed:2.4, temp:31, press:898, hum:64, sats:18, mesh:7};
const pressureHistory = Array.from({length:36},(_,i)=>899.4 - i*0.035 + Math.sin(i/4)*0.18);
const SENSOR_HISTORY_MAX=60;
const sensorHistory={
  gnssSats:Array.from({length:36},(_,i)=>16+Math.round(Math.sin(i/5)*2)),
  gnssAcc:Array.from({length:36},(_,i)=>4.5+Math.sin(i/4)*1.1),
  meshRssi:Array.from({length:36},(_,i)=>-82+Math.sin(i/4)*7),
  meshSnr:Array.from({length:36},(_,i)=>8+Math.sin(i/5)*3),
  meshNodes:Array.from({length:36},(_,i)=>7+Math.round(Math.sin(i/7))),
  temp:Array.from({length:36},(_,i)=>31+Math.sin(i/8)*1.8),
  humidity:Array.from({length:36},(_,i)=>64+Math.sin(i/7)*4),
  pitch:Array.from({length:36},(_,i)=>2+Math.sin(i/3)*2.5),
  roll:Array.from({length:36},(_,i)=>-1+Math.cos(i/4)*2.1),
  battery:Array.from({length:36},(_,i)=>64-i*.05)
};
function pushSensorHistory(key,value){if(!Number.isFinite(Number(value))||!sensorHistory[key])return;sensorHistory[key].push(Number(value));if(sensorHistory[key].length>SENSOR_HISTORY_MAX)sensorHistory[key].shift()}
function drawSensorSeries(canvasId,series,title){
  const c=document.getElementById(canvasId);if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height,st=getComputedStyle(document.body),fg=st.getPropertyValue('--fg2').trim()||'#72e58e',line=st.getPropertyValue('--line').trim()||'#245537',dim=st.getPropertyValue('--dim').trim()||'#64806a';
  ctx.clearRect(0,0,w,h);ctx.strokeStyle=line;ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke()}
  const all=series.flatMap(s=>s.data).filter(Number.isFinite);if(!all.length)return;let min=Math.min(...all),max=Math.max(...all);if(max-min<1){min-=.5;max+=.5}const pad=(max-min)*.12;min-=pad;max+=pad;
  const dashSets=[[],[9,5],[2,4]];
  series.forEach((s,si)=>{
    ctx.strokeStyle=s.stroke||fg;ctx.lineWidth=si===0?3:2;ctx.globalAlpha=si===0?1:.72;
    ctx.setLineDash(dashSets[si%dashSets.length]);ctx.beginPath();
    s.data.forEach((v,i)=>{const x=i/Math.max(1,s.data.length-1)*w,y=h-34-(v-min)/(max-min)*(h-62);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});
    ctx.stroke();
  });
  ctx.setLineDash([]);ctx.globalAlpha=1;
  ctx.fillStyle=fg;ctx.font='15px monospace';ctx.fillText(title,12,19);
  ctx.fillStyle=dim;ctx.font='11px monospace';
  const slot=w/Math.max(1,series.length);
  series.forEach((s,idx)=>{
    const x=12+idx*slot,label=`${s.label} ${Number(s.data.at(-1)).toFixed(s.decimals??1)}${s.unit||''}`;
    ctx.strokeStyle=fg;ctx.lineWidth=2;ctx.setLineDash(dashSets[idx%dashSets.length]);ctx.beginPath();ctx.moveTo(x,h-11);ctx.lineTo(x+18,h-11);ctx.stroke();ctx.setLineDash([]);
    ctx.fillStyle=dim;ctx.fillText(label,x+24,h-7);
  });
}
function drawAllSensorCharts(){
  drawSensorSeries('gnssSignalChart',[{label:'SAT',data:sensorHistory.gnssSats,decimals:0},{label:'ACC',data:sensorHistory.gnssAcc,unit:'m'}],'GNSS SIGNAL / FIX');
  drawSensorSeries('meshSignalChart',[{label:'RSSI',data:sensorHistory.meshRssi,unit:'dBm',decimals:0},{label:'SNR',data:sensorHistory.meshSnr,unit:'dB'},{label:'NODES',data:sensorHistory.meshNodes,decimals:0}],'MESH LINK QUALITY');
  drawSensorSeries('environmentChart',[{label:'TEMP',data:sensorHistory.temp,unit:'°F'},{label:'RH',data:sensorHistory.humidity,unit:'%'}],'ENVIRONMENT');
  drawSensorSeries('imuChart',[{label:'PITCH',data:sensorHistory.pitch,unit:'°'},{label:'ROLL',data:sensorHistory.roll,unit:'°'}],'IMU MOTION');
  drawSensorSeries('batteryChart',[{label:'BAT',data:sensorHistory.battery,unit:'%'}],'POWER TREND');
}
document.addEventListener('fieldos:telemetry',e=>{const t=e.detail||{};pushSensorHistory('gnssSats',t.gnss?.satellites??t.satellites);pushSensorHistory('gnssAcc',t.gnss?.accuracy??t.accuracy);pushSensorHistory('meshRssi',t.mesh?.rssi??t.rssi);pushSensorHistory('meshSnr',t.mesh?.snr??t.snr);pushSensorHistory('meshNodes',t.mesh?.nodes??t.nodes);pushSensorHistory('temp',t.env?.tempF??t.tempF);pushSensorHistory('humidity',t.env?.humidity??t.humidity);pushSensorHistory('pitch',t.imu?.pitch??t.pitch);pushSensorHistory('roll',t.imu?.roll??t.roll);pushSensorHistory('battery',t.battery?.percent??t.battery);drawAllSensorCharts()});
function headingCardinal(deg){
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
setInterval(()=>{
  demo.heading = (demo.heading + (Math.random() > .5 ? 1 : -1) + 360) % 360;
  demo.alt += Math.random() > .5 ? 1 : -1;
  demo.press += Math.random() > .58 ? 0.1 : -0.1;
  pressureHistory.push(demo.press); if(pressureHistory.length>36) pressureHistory.shift();
  pushSensorHistory('gnssSats',demo.sats);pushSensorHistory('gnssAcc',4+Math.random()*2);
  pushSensorHistory('meshRssi',-84+Math.random()*12-6);pushSensorHistory('meshSnr',8+Math.random()*6-3);pushSensorHistory('meshNodes',demo.mesh);
  pushSensorHistory('temp',demo.temp);pushSensorHistory('humidity',demo.hum);pushSensorHistory('pitch',2+Math.random()*4-2);pushSensorHistory('roll',-1+Math.random()*4-2);pushSensorHistory('battery',64-Math.random()*.25);
  drawAllSensorCharts();
  document.getElementById('altitude').textContent = `${demo.alt} ft`;
  document.getElementById('pressure').textContent = `${demo.press.toFixed(1)} hPa`;
  updateLiveNavigationUI?.();
  drawPressureChart();
}, 4000);

function toDMS(value, lat){
  const abs=Math.abs(value), d=Math.floor(abs), mFloat=(abs-d)*60, m=Math.floor(mFloat), sec=(mFloat-m)*60;
  const hemi=lat ? (value>=0?'N':'S') : (value>=0?'E':'W');
  return `${d}°${m}'${sec.toFixed(1)}\"${hemi}`;
}
const dmsEl=document.getElementById('coordDMS');
if(dmsEl) dmsEl.textContent=`${toDMS(currentNavPosition.lat,true)} ${toDMS(currentNavPosition.lon,false)}`;
function updatePositionDisplays(){
  const dd=document.getElementById('coordDD'),dms=document.getElementById('coordDMS');
  if(dd) dd.textContent=`${currentNavPosition.lat.toFixed(6)}, ${currentNavPosition.lon.toFixed(6)}`;
  if(dms) dms.textContent=`${toDMS(currentNavPosition.lat,true)} ${toDMS(currentNavPosition.lon,false)}`;
  updateSolar();
}
let fixAge=4;
setInterval(()=>{
  fixAge++;
  const h=String(Math.floor(fixAge/3600)).padStart(2,'0');
  const m=String(Math.floor((fixAge%3600)/60)).padStart(2,'0');
  const s=String(fixAge%60).padStart(2,'0');
  const el=document.getElementById('fixAge'); if(el) el.textContent=`${h}:${m}:${s}`;
  const homeAge=document.getElementById('homeFixAge'); if(homeAge) homeAge.textContent=`${h}:${m}:${s}`;
},1000);

function normalizeDeg(x){return ((x%360)+360)%360}
function solarPosition(date, lat, lon){
  const rad=Math.PI/180, deg=180/Math.PI;
  const jd=date.getTime()/86400000 + 2440587.5;
  const n=jd-2451545.0;
  const L=normalizeDeg(280.460 + 0.9856474*n);
  const g=normalizeDeg(357.528 + 0.9856003*n)*rad;
  const lambda=(L + 1.915*Math.sin(g) + 0.020*Math.sin(2*g))*rad;
  const eps=(23.439 - 0.0000004*n)*rad;
  const ra=Math.atan2(Math.cos(eps)*Math.sin(lambda),Math.cos(lambda))*deg;
  const dec=Math.asin(Math.sin(eps)*Math.sin(lambda));
  const gmst=normalizeDeg(280.46061837 + 360.98564736629*(jd-2451545.0));
  let H=normalizeDeg(gmst + lon - ra); if(H>180) H-=360; H*=rad;
  const phi=lat*rad;
  const elev=Math.asin(Math.sin(phi)*Math.sin(dec)+Math.cos(phi)*Math.cos(dec)*Math.cos(H));
  const az=normalizeDeg(Math.atan2(Math.sin(H),Math.cos(H)*Math.sin(phi)-Math.tan(dec)*Math.cos(phi))*deg+180);
  return {az,el:elev*deg};
}
function findSolarCrossing(a,b,lat,lon,threshold,rising){
  let lo=a.getTime(),hi=b.getTime();
  for(let n=0;n<18;n++){
    const mid=(lo+hi)/2,el=solarPosition(new Date(mid),lat,lon).el;
    if(rising ? el>threshold : el<=threshold) hi=mid; else lo=mid;
  }
  return new Date((lo+hi)/2);
}
function findSolarEvents(date,lat,lon,threshold){
  const start=new Date(date);start.setHours(0,0,0,0);
  const end=new Date(start);end.setDate(end.getDate()+1);
  const step=5*60*1000;
  let prevT=start,prevEl=solarPosition(prevT,lat,lon).el,rise=null,set=null;
  for(let ms=start.getTime()+step;ms<=end.getTime();ms+=step){
    const t=new Date(ms),el=solarPosition(t,lat,lon).el;
    if(!rise&&prevEl<=threshold&&el>threshold)rise=findSolarCrossing(prevT,t,lat,lon,threshold,true);
    if(!set&&prevEl>threshold&&el<=threshold)set=findSolarCrossing(prevT,t,lat,lon,threshold,false);
    prevT=t;prevEl=el;
  }
  return {rise,set,start,end};
}
function findSolarNoon(start,end,lat,lon){
  let bestT=start.getTime(),bestEl=-90;
  for(let ms=start.getTime();ms<=end.getTime();ms+=10*60*1000){
    const el=solarPosition(new Date(ms),lat,lon).el;
    if(el>bestEl){bestEl=el;bestT=ms}
  }
  let lo=Math.max(start.getTime(),bestT-20*60*1000),hi=Math.min(end.getTime(),bestT+20*60*1000);
  for(let n=0;n<18;n++){
    const m1=lo+(hi-lo)/3,m2=hi-(hi-lo)/3;
    if(solarPosition(new Date(m1),lat,lon).el<solarPosition(new Date(m2),lat,lon).el)lo=m1;else hi=m2;
  }
  const time=new Date((lo+hi)/2);
  return {time,elevation:solarPosition(time,lat,lon).el};
}
function solarEventsForDate(date,lat,lon){
  const standard=findSolarEvents(date,lat,lon,-0.833);
  const civil=findSolarEvents(date,lat,lon,-6);
  const noon=findSolarNoon(standard.start,standard.end,lat,lon);
  const sunrise=standard.rise,sunset=standard.set;
  let daylightMs=0,state='NORMAL';
  if(sunrise&&sunset)daylightMs=Math.max(0,sunset-sunrise);
  else{
    const above=noon.elevation>-0.833;
    daylightMs=above?(standard.end-standard.start):0;
    state=above?'POLAR DAY':'POLAR NIGHT';
  }
  return {
    sunrise,sunset,civilDawn:civil.rise,civilDusk:civil.set,
    solarNoon:noon.time,solarNoonElevation:noon.elevation,
    daylightMs,start:standard.start,end:standard.end,state
  };
}
function fmtClock(t){return t?t.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'}):'---'}
function fmtDurationMs(ms){
  if(!Number.isFinite(ms)||ms<0)return'---';
  const min=Math.round(ms/60000),h=Math.floor(min/60),m=min%60;
  return `${h}h ${String(m).padStart(2,'0')}m`;
}
function updateSolar(){
  const now=new Date(),lat=currentNavPosition.lat,lon=currentNavPosition.lon,p=solarPosition(now,lat,lon),ev=solarEventsForDate(now,lat,lon);
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('sunAz',`${p.az.toFixed(1)}°`);
  set('sunEl',`${p.el.toFixed(1)}°`);
  set('civilDawnTime',ev.civilDawn?fmtClock(ev.civilDawn):'---');
  set('sunriseTime',ev.sunrise?fmtClock(ev.sunrise):(ev.state==='POLAR DAY'?'NO SUNRISE':'NONE'));
  set('solarNoonTime',fmtClock(ev.solarNoon));
  set('solarNoonElevation',Number.isFinite(ev.solarNoonElevation)?`${ev.solarNoonElevation.toFixed(1)}°`:'---');
  set('sunsetTime',ev.sunset?fmtClock(ev.sunset):(ev.state==='POLAR DAY'?'NO SUNSET':'NONE'));
  set('civilDuskTime',ev.civilDusk?fmtClock(ev.civilDusk):'---');
  set('daylightDuration',fmtDurationMs(ev.daylightMs));

  const isDay=p.el>-0.833,isCivil=p.el>-6;
  const stateText=isDay?'SUN ABOVE HORIZON':isCivil?'CIVIL TWILIGHT':'NIGHT';
  set('sunState',stateText);

  let remaining='0h 00m',next='NO UPCOMING SOLAR EVENT';
  if(ev.state==='POLAR DAY'){remaining='24h 00m';next='POLAR DAY'}
  else if(ev.state==='POLAR NIGHT'){remaining='0h 00m';next='POLAR NIGHT'}
  else if(ev.sunrise&&now<ev.sunrise){
    remaining='0h 00m';next=`SUNRISE IN ${fmtDurationMs(ev.sunrise-now)}`;
  }else if(ev.sunset&&now<ev.sunset){
    remaining=fmtDurationMs(ev.sunset-now);next=`SUNSET IN ${remaining}`;
  }else if(ev.civilDusk&&now<ev.civilDusk){
    remaining='0h 00m';next=`CIVIL DUSK IN ${fmtDurationMs(ev.civilDusk-now)}`;
  }else{
    const tomorrow=new Date(now);tomorrow.setDate(tomorrow.getDate()+1);
    const nextDay=solarEventsForDate(tomorrow,lat,lon);
    next=nextDay.civilDawn?`CIVIL DAWN ${fmtClock(nextDay.civilDawn)}`:'NIGHT';
  }
  set('daylightRemaining',remaining);set('sunNextEvent',next);
  set('solarLocation',`${lat.toFixed(4)}, ${lon.toFixed(4)} · DEVICE LOCAL TIME`);
  set('solarPositionSource',hasTrustedMapPosition?.()?(currentNavPosition.source||'LIVE POSITION'):'DEMO POSITION');

  const marker=document.getElementById('sunArcMarker');
  if(marker){
    const daylight=ev.sunrise&&ev.sunset?ev.sunset-ev.sunrise:0;
    const frac=daylight?Math.max(0,Math.min(1,(now-ev.sunrise)/daylight)):(isDay?0.5:0);
    marker.style.left=`${(frac*100).toFixed(1)}%`;
    marker.classList.toggle('below-horizon',!isDay);
  }
  return ev;
}
updateSolar(); setInterval(updateSolar,30000);

const sendDemo=document.getElementById('sendDemo');
sendDemo?.addEventListener('click', ()=>{
  const box=document.getElementById('messageInput'),value=box?.value?.trim()||'';
  if(!value) return;
  const ev=new CustomEvent('fieldos:outgoingmessage',{detail:{text:value,channel:'PRIMARY',createdAt:Date.now()},cancelable:true});
  const accepted=!document.dispatchEvent(ev);
  if(accepted) box.value='';
  else alert(`No FIELD/OS transport queue is available yet. Message was not cleared.`);
});

let sosTimer;
const sos=document.getElementById('meshSos');
function startSos(e){
  e?.preventDefault?.();
  clearTimeout(sosTimer);
  sos.textContent='HOLD...';
  sosTimer=setTimeout(()=>{sosTimer=null;sos.textContent='MESH SOS ARMED — DEMO'; navigator.vibrate?.([120,80,120]);},1600);
}
function cancelSos(){
  if(sosTimer){clearTimeout(sosTimer);sosTimer=null}
  if(sos?.textContent==='HOLD...') sos.textContent='HOLD TO ARM MESH SOS';
}
sos?.addEventListener('pointerdown',startSos);
sos?.addEventListener('pointerup',cancelSos);
sos?.addEventListener('pointerleave',cancelSos);
sos?.addEventListener('pointercancel',cancelSos);
sos?.addEventListener('lostpointercapture',cancelSos);
window.addEventListener('blur',cancelSos);
document.addEventListener('visibilitychange',()=>{if(document.hidden)cancelSos()});

document.getElementById('centerBtn')?.addEventListener('click',()=>navigator.vibrate?.(30));

// Survival library
const guides=window.FIELD_GUIDES || [];
const guideGrid=document.getElementById('guideGrid');
const guideDetail=document.getElementById('guideDetail');
const guideSearch=document.getElementById('guideSearch');
const categories=['ALL',...new Set(guides.map(g=>g.category.toUpperCase()))];
let activeCategory='ALL';
function renderFilters(){
  const wrap=document.getElementById('guideFilters'); if(!wrap) return;
  wrap.innerHTML=categories.map(c=>`<button class="filter-chip ${c===activeCategory?'active':''}" data-guide-filter="${c}">${c}</button>`).join('');
}
function renderGuides(){
  if(!guideGrid) return;
  const q=(guideSearch?.value||'').trim().toLowerCase();
  const filtered=guides.filter(g=>(activeCategory==='ALL'||g.category.toUpperCase()===activeCategory) && (!q||`${g.title} ${g.category} ${g.summary} ${g.steps.join(' ')}`.toLowerCase().includes(q)));
  guideGrid.innerHTML=filtered.map(g=>`<button class="survival-card ${g.urgency==='EMERGENCY'?'emergency':g.urgency==='HIGH'?'high':''}" data-guide="${g.id}"><span class="urgency">${g.urgency}</span><b>${g.title}</b><small>${g.summary}</small></button>`).join('') || '<article class="panel"><p>No matching guide entries.</p></article>';
}
function closeGuideReader(){
  document.getElementById('survival')?.classList.remove('guide-reading-mode');
  guideDetail?.classList.remove('active');
  document.getElementById('survival')?.scrollIntoView({behavior:'auto',block:'start'});
}
function showGuide(id){
  const g=guides.find(x=>x.id===id); if(!g||!guideDetail) return;
  guideDetail.innerHTML=`<button class="guide-reader-back" type="button" data-guide-close>← FIELD GUIDE MENU</button>
    <header class="guide-reader-head"><span>${g.category.toUpperCase()} · ${g.urgency}</span><h3>${g.title}</h3><p>${g.summary}</p></header>
    <div class="guide-reader-body"><ol class="guide-steps">${g.steps.map(x=>`<li>${x}</li>`).join('')}</ol>
    <div class="guide-source"><b>SOURCE:</b> ${g.source}<br><span class="source-link">${g.url}</span><br><br>Offline quick reference only. For medical emergencies, use trained first aid and professional emergency services when available.</div></div>`;
  document.getElementById('survival')?.classList.add('guide-reading-mode');
  guideDetail.classList.add('active');
  document.getElementById('survival')?.scrollIntoView({behavior:'auto',block:'start'});
}
document.addEventListener('click',e=>{
  const f=e.target.closest('[data-guide-filter]'); if(f){activeCategory=f.dataset.guideFilter;renderFilters();renderGuides();}
  const g=e.target.closest('[data-guide]'); if(g) showGuide(g.dataset.guide);
  if(e.target.closest('[data-guide-close]')) closeGuideReader();
});
guideSearch?.addEventListener('input',renderGuides); renderFilters(); renderGuides();

// Trip plan and essentials
const essentials=['Navigation','Headlamp / illumination','Sun protection','Insulation / extra clothing','First aid','Fire / ignition','Repair kit / tools','Extra food','Extra water + treatment','Emergency shelter'];
function loadJSON(key,fallback){try{return JSON.parse(storageGet(STORE_PREFIX+key))??fallback}catch{return fallback}}
function saveJSON(key,val){return storageSet(STORE_PREFIX+key,JSON.stringify(val))}
function validLatLon(p){if(p?.lat==null||p?.lon==null||p.lat===''||p.lon==='')return false;const lat=Number(p?.lat),lon=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}
let essentialsState=loadJSON('essentials',{});
function renderEssentials(){
  const el=document.getElementById('essentialsChecklist'); if(!el) return;
  el.innerHTML=essentials.map((x,i)=>`<label class="check-item"><input type="checkbox" data-essential="${i}" ${essentialsState[i]?'checked':''}> <span>${x}</span></label>`).join('');
}
renderEssentials();
document.addEventListener('change',e=>{const c=e.target.closest('[data-essential]');if(c){essentialsState[c.dataset.essential]=c.checked;saveJSON('essentials',essentialsState)}});
const trip=loadJSON('trip',{});
['tripName','tripBase','tripReturn','checkinInterval','tripEmergency'].forEach(id=>{const el=document.getElementById(id);if(el&&trip[id]!=null) el.value=trip[id]});
document.getElementById('saveTrip')?.addEventListener('click',()=>{
  const data={}; ['tripName','tripBase','tripReturn','checkinInterval','tripEmergency'].forEach(id=>data[id]=document.getElementById(id)?.value||''); saveJSON('trip',data); navigator.vibrate?.(30); alert('Trip plan saved locally on this device.');
});
document.getElementById('checkinNow')?.addEventListener('click',()=>{
  const message=`CHECK-IN — position ${currentNavPosition.lat.toFixed(4)}, ${currentNavPosition.lon.toFixed(4)}; source ${currentNavPosition.source||'POSITION'}; status OK.`;
  addLog(message,'CHECK-IN');
  document.dispatchEvent(new CustomEvent('fieldos:checkin',{detail:{text:message,position:{lat:currentNavPosition.lat,lon:currentNavPosition.lon},source:currentNavPosition.source||'POSITION',createdAt:Date.now()}}));
  alert('Local check-in recorded. It will enter the FIELD/OS communications timeline; transmission requires a connected transport.');
});

// Field log
let fieldLog=loadJSON('fieldlog',[]); if(!Array.isArray(fieldLog)) fieldLog=[];
function renderLog(){
  const el=document.getElementById('logList'); if(!el) return;
  el.innerHTML=fieldLog.slice().reverse().map(e=>`<div class="log-entry"><b>${e.time} // ${e.type}</b><p>${escapeHTML(e.text)}</p></div>`).join('') || '<p class="muted">No log entries yet.</p>';
}
function escapeHTML(s=''){return s.replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]))}
function addLog(text,type='NOTE'){fieldLog.push({time:new Date().toLocaleString(),type,text});if(fieldLog.length>250)fieldLog.shift();saveJSON('fieldlog',fieldLog);renderLog()}
document.getElementById('saveLog')?.addEventListener('click',()=>{const el=document.getElementById('logInput');if(!el.value.trim())return;addLog(el.value.trim());el.value='';navigator.vibrate?.(25)});
document.getElementById('markLog')?.addEventListener('click',()=>addLog(`POSITION MARK — ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)} // ALT ${Math.round(currentNavPosition.alt??demo.alt)} ft // HDG ${Math.round(demo.heading)}°`,'POSITION'));
renderLog();

function downloadJSON(filename,data){
  const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}); const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
document.getElementById('exportLog')?.addEventListener('click',()=>downloadJSON('fieldos-field-log.json',fieldLog));

// Power modes
function applyPowerMode(mode){document.body.classList.remove('low-power','emergency-power');if(mode==='low')document.body.classList.add('low-power');if(mode==='emergency')document.body.classList.add('emergency-power');storageSet(STORE_PREFIX+'power',mode);const t=document.getElementById('powerModeText');if(t)t.textContent=mode==='low'?'Reduced visual effects and animation to conserve power.':mode==='emergency'?'Minimum-display mode: decorative effects disabled; prioritize navigation, comms and SOS.':'Normal refresh and display behavior.'}
applyPowerMode(storageGet(STORE_PREFIX+'power')||'normal');
document.querySelectorAll('.power-mode').forEach(b=>b.addEventListener('click',()=>applyPowerMode(b.dataset.power)));
if(navigator.getBattery){navigator.getBattery().then(b=>{const update=()=>{const p=document.getElementById('powerPercent');if(p)p.textContent=`${Math.round(b.level*100)}%`};update();b.addEventListener('levelchange',update)}).catch(()=>{})}

// Pressure trend canvas
function drawPressureChart(){
  const c=document.getElementById('pressureChart'); if(!c) return; const ctx=c.getContext('2d'); const w=c.width,h=c.height;ctx.clearRect(0,0,w,h);const styles=getComputedStyle(document.body), fg=styles.getPropertyValue('--fg2').trim()||'#6fcf82', line=styles.getPropertyValue('--line').trim()||'#2d6940';ctx.strokeStyle=line;ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke()}const min=Math.min(...pressureHistory)-.3,max=Math.max(...pressureHistory)+.3;ctx.strokeStyle=fg;ctx.lineWidth=3;ctx.beginPath();pressureHistory.forEach((v,i)=>{const x=i/(pressureHistory.length-1)*w,y=h-(v-min)/(max-min)*h;i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();ctx.fillStyle=fg;ctx.font='22px monospace';ctx.fillText(`${pressureHistory.at(-1).toFixed(1)} hPa`,14,30);
}
drawPressureChart();

// SOS packet and notes
const emergencyNotes=document.getElementById('emergencyNotes'); if(emergencyNotes){emergencyNotes.value=storageGet(STORE_PREFIX+'emergency-notes')||'';emergencyNotes.addEventListener('input',()=>storageSet(STORE_PREFIX+'emergency-notes',emergencyNotes.value))}
async function copyText(text){try{await navigator.clipboard.writeText(text);return true}catch{const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');ta.remove();return true}}
document.getElementById('copySos')?.addEventListener('click',async()=>{const notes=emergencyNotes?.value.trim()||'None entered';const packet=`FIELD/OS SOS\nTIME: ${new Date().toISOString()}\nPOSITION: ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)}\nALT: ${Math.round(currentNavPosition.alt??demo.alt)} ft\nPOSITION SOURCE: ${currentNavPosition.source||'POSITION'}\nNOTES: ${notes}`;await copyText(packet);alert('SOS packet copied. Prototype only — use 911 or certified satellite SOS for real emergencies when available.')});

// Data export / wipe
function collectState(){return {version:'0.5.1',exported:new Date().toISOString(),trip:loadJSON('trip',{}),essentials:loadJSON('essentials',{}),fieldLog:loadJSON('fieldlog',[]),emergencyNotes:storageGet(STORE_PREFIX+'emergency-notes')||'',theme:document.body.dataset.theme,powerMode:storageGet(STORE_PREFIX+'power')||'normal',routePlan:loadJSON('routePlan',{}),offlineRoutePack:loadJSON('offlineRoutePack',{}),waypoints:loadJSON('waypoints',[]),track:loadJSON('track',[]),checkin:loadJSON('checkin',{})}}
document.getElementById('exportState')?.addEventListener('click',()=>downloadJSON('fieldos-state.json',collectState()));
document.getElementById('wipeLocal')?.addEventListener('click',()=>{if(confirm('Erase FIELD/OS v1.2 local trip plans, logs, checklists and emergency notes?')){storageKeys().filter(k=>k.startsWith(STORE_PREFIX)).forEach(storageRemove);location.reload()}});

if('serviceWorker' in navigator){
  window.addEventListener('load',async()=>{
    try{
      const reg=await navigator.serviceWorker.register('./sw.js?v=3.60',{updateViaCache:'none'});
      await reg.update();
      if(reg.waiting)reg.waiting.postMessage({type:'SKIP_WAITING'});
      navigator.serviceWorker.addEventListener('controllerchange',()=>{
        const key='fieldos-sw-reloaded-v3.60';
        if(sessionStorage.getItem(key))return;
        sessionStorage.setItem(key,'1');
        location.reload();
      });
    }catch(err){console.warn('FIELD/OS service worker update failed',err)}
  });
}

const bootLines=['FIELD/OS SECURE FIELD CONSOLE v0.7','MOUNTING OFFLINE MAP CORE...','LOADING NAVIGATION FUSION BUS...','VERIFYING LOCAL SURVIVAL LIBRARY...','MOUNTING TRIP / LOG STORAGE...','READY // STANDALONE DEMO'];
const boot=document.getElementById('boot'), bootText=document.getElementById('bootText'), bootFill=document.getElementById('bootFill');
let lineIndex=0,progress=0;if(bootText)bootText.textContent='';
function dismissBoot(){if(!boot)return;clearInterval(bootTimer);bootFill && (bootFill.style.width='100%');boot.classList.add('hidden')}
const bootTimer=setInterval(()=>{if(lineIndex<bootLines.length){bootText.textContent+=`${bootLines[lineIndex]}\n`;lineIndex++}progress=Math.min(progress+20,100);if(bootFill)bootFill.style.width=`${progress}%`;if(progress>=100){clearInterval(bootTimer);setTimeout(()=>boot?.classList.add('hidden'),140)}},110);
boot?.addEventListener('click',dismissBoot,{once:true});

// v0.7 Route planner / Return-to-Trail / Return-to-Base
const routeMap=document.getElementById('routeMap');
const routeSvgLine=document.getElementById('routeLine');
const routePointsLayer=document.getElementById('routePointsLayer');
const defaultRoute=[];
let routePlan=loadJSON('routePlan',null);
if(!routePlan||typeof routePlan!=='object'||Array.isArray(routePlan)) routePlan={name:'FIELD ROUTE 01',points:defaultRoute,gain:0,grade:0,terrain:'maintained',notes:''};
const routeCenter={lat:DEMO_POS.lat,lon:DEMO_POS.lon,latSpan:.08,lonSpan:.11};
function normalizeRoutePoint(p){if(!validLatLon(p))return null;const lat=Number(p.lat),lon=Number(p.lon);let x=Number(p.x),y=Number(p.y);if(!Number.isFinite(x)||!Number.isFinite(y)){x=.5+(lon-routeCenter.lon)/routeCenter.lonSpan;y=.5-(lat-routeCenter.lat)/routeCenter.latSpan;}return {lat,lon,x:clamp(x,0,1),y:clamp(y,0,1)}}
const rawRoutePoints=Array.isArray(routePlan.points)?routePlan.points:defaultRoute;
let routePoints=rawRoutePoints.map(normalizeRoutePoint).filter(Boolean);
function clamp(v,a,b){return Math.max(a,Math.min(b,v))}
function mapXYToLatLon(x,y){return {lat:routeCenter.lat+(0.5-y)*routeCenter.latSpan,lon:routeCenter.lon+(x-0.5)*routeCenter.lonSpan}}
function haversineMiles(a,b){const R=3958.7613,rad=Math.PI/180,dLat=(b.lat-a.lat)*rad,dLon=(b.lon-a.lon)*rad,la1=a.lat*rad,la2=b.lat*rad;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(h))}
function bearingDeg(a,b){const r=Math.PI/180,dLon=(b.lon-a.lon)*r,la1=a.lat*r,la2=b.lat*r;const y=Math.sin(dLon)*Math.cos(la2),x=Math.cos(la1)*Math.sin(la2)-Math.sin(la1)*Math.cos(la2)*Math.cos(dLon);return normalizeDeg(Math.atan2(y,x)*180/Math.PI)}
function routeMiles(){let d=0;for(let i=1;i<routePoints.length;i++)d+=haversineMiles(routePoints[i-1],routePoints[i]);return d}
function drawRoute(){
  if(routeSvgLine) routeSvgLine.setAttribute('points',routePoints.map(p=>`${(p.x*1000).toFixed(1)},${(p.y*1000).toFixed(1)}`).join(' '));
  if(routePointsLayer) routePointsLayer.innerHTML=routePoints.map((p,i)=>`<i class="route-point" data-n="${String(i+1).padStart(2,'0')}" style="left:${p.x*100}%;top:${p.y*100}%"></i>`).join('');
  updateRouteMetrics(); updateReturnGuidance();
  document.dispatchEvent(new CustomEvent('fieldos:routechange',{detail:{points:routePoints.map(p=>({lat:p.lat,lon:p.lon}))}}));
}
function routeTerrainFactor(t){return ({maintained:1,rough:1.2,offtrail:1.45,scramble:1.7})[t]||1}
function updateRouteMetrics(){
  const dist=routeMiles(),gain=Math.max(0,Number(document.getElementById('routeGain')?.value??routePlan.gain??0)),grade=Math.max(0,Number(document.getElementById('routeGrade')?.value??routePlan.grade??0)),terrain=document.getElementById('routeTerrain')?.value||routePlan.terrain||'maintained';
  const score=dist*.7+(gain/1000)*1.3+grade*.08+({maintained:0,rough:1.2,offtrail:2.4,scramble:4})[terrain];
  let label='EASY',cls='easy';if(score>=4){label='MODERATE';cls='moderate'}if(score>=7.5){label='HARD';cls='hard'}if(score>=12){label='VERY HARD';cls='very-hard'}
  const baseHours=dist/3 + gain/2000;
  const researched=routePlan?.trailIntelligence;
  const hours=Number.isFinite(Number(researched?.estimatedHours))&&Number(researched.estimatedHours)>0?Number(researched.estimatedHours):baseHours*routeTerrainFactor(terrain);
  const totalMinutes=Math.max(0,Math.round(hours*60)),hr=Math.floor(totalMinutes/60),min=totalMinutes%60;
  const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val};
  set('routeDistance',`${dist.toFixed(2)} mi`);set('routeGainOut',routePoints.length<2?'—':routePlan.elevationSource==='UNAVAILABLE'&&gain===0?'N/A':`${Math.round(gain)} ft`);set('routeTime',hours?`${hr}h ${String(min).padStart(2,'0')}m`:'---');set('routePointCount',routePoints.length);
  const badge=document.getElementById('routeDifficulty');if(badge){badge.textContent=routePoints.length<2?'PLOT ROUTE':label;badge.className=`route-grade-badge ${cls}`}
  updateOfflineEstimate(); drawRouteProfile(dist,gain,terrain); return {dist,gain,grade,terrain,label,hours};
}
function drawRouteProfile(dist,gain,terrain){
  const c=document.getElementById('routeProfile');if(!c)return;
  const ctx=c.getContext('2d'),w=c.width,h=c.height,st=getComputedStyle(document.body);
  ctx.clearRect(0,0,w,h);ctx.strokeStyle=st.getPropertyValue('--line').trim();ctx.lineWidth=1;
  for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke()}
  const samples=routePlan.elevationProfile;
  ctx.fillStyle=st.getPropertyValue('--fg').trim();ctx.font='20px monospace';
  if(routePoints.length<2||!Array.isArray(samples)||samples.length<2){ctx.fillText(routePoints.length<2?'Add a start and destination':'Elevation profile unavailable',14,28);return;}
  const vals=samples.map(p=>p.elevationFt),min=Math.min(...vals),span=Math.max(40,Math.max(...vals)-min);
  ctx.strokeStyle=st.getPropertyValue('--warn').trim();ctx.lineWidth=3;ctx.beginPath();
  samples.forEach((p,i)=>{const x=i/(samples.length-1)*w,y=h-18-(p.elevationFt-min)/span*(h-55);i?ctx.lineTo(x,y):ctx.moveTo(x,y)});ctx.stroke();
  ctx.fillText(`${dist.toFixed(2)} mi // +${Math.round(gain)} ft`,14,25);
}
function updateOfflineEstimate(){const dist=routeMiles(),r=Number(document.getElementById('corridorRadius')?.value||1),detail=document.getElementById('offlineDetail')?.value||'medium',area=dist>0?dist*2*r+Math.PI*r*r:0,rate=({low:5,medium:20,high:75})[detail],mb=area*rate;const a=document.getElementById('corridorArea'),e=document.getElementById('offlineEstimate');if(a)a.textContent=area?`~${area.toFixed(1)} sq mi`:'---';if(e)e.textContent=area?(mb>1024?`~${(mb/1024).toFixed(1)} GB`:`~${Math.round(mb)} MB`):'---'}
function saveRoutePlan(){const metrics=updateRouteMetrics();routePlan={...routePlan,name:document.getElementById('routeName')?.value.trim()||'FIELD ROUTE',points:routePoints.map(({lat,lon})=>({lat,lon})),gain:metrics.gain,grade:metrics.grade,terrain:metrics.terrain,notes:document.getElementById('routeNotes')?.value||'',savedAt:new Date().toISOString()};saveJSON('routePlan',routePlan);updateReturnGuidance();navigator.vibrate?.(25);addLog(`ROUTE SAVED — ${routePlan.name}; ${metrics.dist.toFixed(2)} mi; +${Math.round(metrics.gain)} ft; ${metrics.label}.`,'ROUTE')}
function loadRouteFields(){if(document.getElementById('routeName'))document.getElementById('routeName').value=routePlan.name||'FIELD ROUTE 01';if(document.getElementById('routeGain'))document.getElementById('routeGain').value=routePlan.gain??0;if(document.getElementById('routeGrade'))document.getElementById('routeGrade').value=routePlan.grade??0;if(document.getElementById('routeTerrain'))document.getElementById('routeTerrain').value=routePlan.terrain||'maintained';if(document.getElementById('routeNotes'))document.getElementById('routeNotes').value=routePlan.notes||''}
routeMap?.addEventListener('click',e=>{if(e.target.closest('button,input,select,label,textarea,.route-point'))return;if(routePoints.length>=1000)return alert('Route point limit reached (1000). Simplify or save this route before adding more.');const r=routeMap.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1),ll=mapXYToLatLon(x,y);routePoints.push({x,y,...ll});drawRoute();navigator.vibrate?.(18)});
if(routeMap){
  document.getElementById('undoRoutePoint')?.addEventListener('click',e=>{if(e.currentTarget?.dataset.nativeRoute==='1')return;routePoints.pop();drawRoute()});
  document.getElementById('reverseRoute')?.addEventListener('click',e=>{if(e.currentTarget?.dataset.nativeRoute==='1')return;routePoints.reverse();drawRoute();addLog('ROUTE REVERSED — start/end swapped.','ROUTE')});
  document.getElementById('clearRoute')?.addEventListener('click',e=>{if(e.currentTarget?.dataset.nativeRoute==='1')return;if(confirm('Clear the plotted route?')){routePoints=[];drawRoute()}});
}
['routeGain','routeGrade','routeTerrain','corridorRadius','offlineDetail'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateRouteMetrics));
document.getElementById('routeSaveTop')?.addEventListener('click',e=>{if(e.currentTarget?.dataset.nativeRoute==='1')return;saveRoutePlan();alert('Route saved locally for offline use.')});
function routeAsGPX(){const name=escapeHTML(document.getElementById('routeName')?.value||routePlan.name||'FIELD ROUTE');return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="FIELD/OS v3.0" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${routePoints.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"></trkpt>`).join('')}</trkseg></trk></gpx>`}
function downloadText(filename,text,type='application/octet-stream'){const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=filename;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)}
document.getElementById('exportGpx')?.addEventListener('click',()=>{if(routePoints.length<2)return alert('Plot at least two route points first.');downloadText('fieldos-route.gpx',routeAsGPX(),'application/gpx+xml')});
document.getElementById('gpxImport')?.addEventListener('change',async e=>{
  const f=e.target.files?.[0]; if(!f) return;
  if(f.size>10*1024*1024){e.target.value='';return alert('GPX file is too large for the mobile planner. Keep it under 10 MB or simplify it first.');}
  const t=await f.text();
  let pts=[];
  try{
    const xml=new DOMParser().parseFromString(t,'application/xml');
    if(xml.querySelector('parsererror')) throw new Error('Invalid XML');
    pts=[...xml.querySelectorAll('trkpt,rtept')].map(n=>({lat:n.hasAttribute('lat')?Number(n.getAttribute('lat')):NaN,lon:n.hasAttribute('lon')?Number(n.getAttribute('lon')):NaN})).filter(p=>validLatLon(p));
  }catch(err){ return alert(`Could not parse GPX: ${err.message}`); }
  if(pts.length<2) return alert('No usable GPX track/route points found.');
  // Keep the UI responsive on very dense tracks while retaining endpoints.
  if(pts.length>500){const step=(pts.length-1)/499;pts=Array.from({length:500},(_,i)=>pts[Math.round(i*step)]);}
  const minLat=Math.min(...pts.map(p=>p.lat)),maxLat=Math.max(...pts.map(p=>p.lat)),minLon=Math.min(...pts.map(p=>p.lon)),maxLon=Math.max(...pts.map(p=>p.lon)),latRange=Math.max(maxLat-minLat,.0001),lonRange=Math.max(maxLon-minLon,.0001);
  routePoints=pts.map(p=>({...p,x:.08+.84*(p.lon-minLon)/lonRange,y:.08+.84*(maxLat-p.lat)/latRange}));
  routePlan={...routePlan,anchors:[{lat:pts[0].lat,lon:pts[0].lon},{lat:pts.at(-1).lat,lon:pts.at(-1).lon}],routingMode:'direct',routingSource:'GPX IMPORT',elevationProfile:null,elevationSource:'UNAVAILABLE',gain:0,grade:0};
  window.FIELD_ROUTE_STATE.setPoints(pts);
  document.getElementById('routeName').value=f.name.replace(/\.gpx$/i,''); drawRoute(); saveRoutePlan(); addLog(`GPX IMPORT — ${f.name}; ${pts.length} plotted points.`,'ROUTE');
  e.target.value='';
});

function saveOfflineRoutePack(){if(routePoints.length<2)return alert('Plot or import a route first.');saveRoutePlan();const metrics=updateRouteMetrics(),intel=routePlan.trailIntelligence||null;if(routePlan.routingMode==='trail'&&!intel)return alert('Trail research is not ready yet. Wait for the snapped route and elevation analysis before downloading the offline route pack.');const radius=Number(document.getElementById('corridorRadius')?.value||1),detail=document.getElementById('offlineDetail')?.value||'medium',lats=routePoints.map(p=>p.lat),lons=routePoints.map(p=>p.lon),pack={version:'0.6.0',name:routePlan.name,created:new Date().toISOString(),route:routePoints.map(({lat,lon})=>({lat,lon})),trailIntelligence:intel,corridorMiles:radius,detail,bounds:{north:Math.max(...lats),south:Math.min(...lats),east:Math.max(...lons),west:Math.min(...lons)},metrics};saveJSON('offlineRoutePack',pack);const st=document.getElementById('offlineStatus');if(st){st.textContent='ROUTE + CORRIDOR SAVED';st.className='route-pack-saved'};return pack}
document.getElementById('saveOfflinePack')?.addEventListener('click',()=>{if(!saveOfflineRoutePack())return;alert('Route and corridor plan saved locally. Basemap tile caching will be connected to the production offline map source.')});
document.getElementById('exportRoutePack')?.addEventListener('click',()=>{const pack=saveOfflineRoutePack();if(!pack)return;const geo={type:'FeatureCollection',properties:{fieldOSPack:pack},features:[{type:'Feature',properties:{name:pack.name},geometry:{type:'LineString',coordinates:pack.route.map(p=>[p.lon,p.lat])}}]};downloadJSON('fieldos-route-pack.geojson',geo)});
function nearestPointOnRoute(pos){if(routePoints.length<2)return null;const lat0=pos.lat*Math.PI/180,MX=111320*Math.cos(lat0),MY=110540;let best=null;for(let i=0;i<routePoints.length-1;i++){const a=routePoints[i],b=routePoints[i+1],ax=(a.lon-pos.lon)*MX,ay=(a.lat-pos.lat)*MY,bx=(b.lon-pos.lon)*MX,by=(b.lat-pos.lat)*MY,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy,t=den?clamp(-(ax*dx+ay*dy)/den,0,1):0,qx=ax+t*dx,qy=ay+t*dy,meters=Math.hypot(qx,qy),q={lat:pos.lat+qy/MY,lon:pos.lon+qx/MX};if(!best||meters<best.meters)best={meters,point:q,leg:i+1,t}}return best}
function updateReturnBase(){const base=routePoints[0];const d=document.getElementById('rtbDistance'),b=document.getElementById('rtbBearing'),tr=document.getElementById('rtbTrack'),alt=document.getElementById('rtbAlt');if(!base){if(d)d.textContent='NO ROUTE';if(b)b.textContent='---';if(tr)tr.textContent='NO ROUTE';return}const mi=haversineMiles(currentNavPosition,base),deg=bearingDeg(currentNavPosition,base);if(d)d.textContent=`${mi.toFixed(2)} mi`;if(b)b.textContent=`${deg.toFixed(0).padStart(3,'0')}° ${headingCardinal(deg)}`;if(tr)tr.textContent='ROUTE START';if(alt)alt.textContent='PROFILE N/A'}
function updateReturnGuidance(){const n=nearestPointOnRoute(currentNavPosition),name=document.getElementById('routeName')?.value||routePlan.name||'FIELD ROUTE';const ids=['rttDistance','rttBigDistance'];if(!n){ids.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='NO ROUTE'});['rttBearing','rttBigBearing','rttPoint','rttLeg'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='---'});updateReturnBase();return}const mi=n.meters/1609.344,deg=bearingDeg(currentNavPosition,n.point),card=headingCardinal(deg);ids.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=mi<.1?`${Math.round(n.meters*3.28084)} ft`:`${mi.toFixed(2)} mi`});const rb=document.getElementById('rttBearing');if(rb)rb.textContent=`${deg.toFixed(0).padStart(3,'0')}° ${card}`;const rbb=document.getElementById('rttBigBearing');if(rbb)rbb.innerHTML=`${deg.toFixed(0).padStart(3,'0')}° <small>${card}</small>`;const rr=document.getElementById('rttRouteName');if(rr)rr.textContent=name;const rbr=document.getElementById('rttBigRoute');if(rbr)rbr.textContent=name;const rp=document.getElementById('rttPoint');if(rp)rp.textContent=`LEG ${n.leg}`;const rl=document.getElementById('rttLeg');if(rl)rl.textContent=`${n.leg} / ${Math.max(1,routePoints.length-1)}`;const arr=document.getElementById('returnArrow');if(arr)arr.style.transform=`rotate(${deg}deg)`;const ps=document.getElementById('rttPosSource');if(ps)ps.textContent=currentNavPosition.source||'POSITION';updateReturnBase();updateRouteMonitor()}
document.getElementById('usePhonePos')?.addEventListener('click',()=>requestFieldLiveLocation());
document.getElementById('followBreadcrumbs')?.addEventListener('click',()=>{addLog(`RETURN TO BASE STARTED — target ${routePlan.name||'route start'}.`,'NAV')});
document.getElementById('mapMarkBtn')?.addEventListener('click',()=>addLog(`MAP MARK — ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)}.`,'POSITION'));
const cleanSharedRoutePoints=(list=[],limit=1000)=>(Array.isArray(list)?list:[]).filter(validLatLon).slice(0,limit).map(p=>({lat:Number(p.lat),lon:Number(p.lon)}));
window.FIELD_ROUTE_STATE={
  getPoints:()=>cleanSharedRoutePoints(routePoints),
  setPoints:(pts=[])=>{
    routePoints=cleanSharedRoutePoints(pts);
    routePlan={...routePlan,points:routePoints};
    saveJSON('routePlan',routePlan);drawRoute()
  },
  getPlan:()=>({
    ...routePlan,
    points:cleanSharedRoutePoints(routePoints),
    anchors:cleanSharedRoutePoints(routePlan.anchors,30),
    routedAnchors:cleanSharedRoutePoints(routePlan.routedAnchors,30)
  }),
  setMeta:(meta={})=>{
    if(!meta||typeof meta!=='object'||Array.isArray(meta))return;
    const safe={...meta};
    if('anchors' in safe)safe.anchors=cleanSharedRoutePoints(safe.anchors,30);
    if('routedAnchors' in safe)safe.routedAnchors=cleanSharedRoutePoints(safe.routedAnchors,30);
    routePlan={...routePlan,...safe,points:cleanSharedRoutePoints(routePoints)};
    saveJSON('routePlan',routePlan);
    document.dispatchEvent(new CustomEvent('fieldos:routemetadatachange'));
  },
  save:()=>saveRoutePlan(),
  current:()=>({lat:Number(currentNavPosition.lat),lon:Number(currentNavPosition.lon),alt:currentNavPosition.alt??null,source:currentNavPosition.source||'POSITION'})
};
loadRouteFields();queueMicrotask(drawRoute);
const savedPack=loadJSON('offlineRoutePack',null);if(savedPack){const st=document.getElementById('offlineStatus');if(st){st.textContent='ROUTE + CORRIDOR SAVED';st.className='route-pack-saved'}}


// v0.7 Route Watch / Waypoints / Breadcrumb Track / Check-in Timer
function routeProgressAt(pos){
  const n=nearestPointOnRoute(pos); if(!n) return null;
  let before=0; for(let i=1;i<n.leg;i++) before+=haversineMiles(routePoints[i-1],routePoints[i]);
  const legStart=routePoints[n.leg-1],legEnd=routePoints[n.leg];
  const legDist=haversineMiles(legStart,legEnd);
  const progress=before+legDist*n.t,total=routeMiles();
  return {...n,progress,total,remaining:Math.max(0,total-progress)};
}
function updateRouteMonitor(){
  const p=routeProgressAt(currentNavPosition), thresholdFt=Number(document.getElementById('deviationThreshold')?.value||100);
  const progressEl=document.getElementById('routeProgress'), remainEl=document.getElementById('routeRemaining'), etaEl=document.getElementById('routeEta'), devEl=document.getElementById('routeDeviation'), banner=document.getElementById('routeDeviationBanner'), state=document.getElementById('routeWatchState');
  if(!p){ if(progressEl)progressEl.textContent='NO ROUTE'; if(remainEl)remainEl.textContent='---'; if(etaEl)etaEl.textContent='---'; if(devEl)devEl.textContent='---'; if(banner){banner.textContent='NO SAVED ROUTE';banner.className='deviation-banner'}; return; }
  const pct=p.total?Math.min(100,p.progress/p.total*100):0, ft=p.meters*3.28084;
  const speed=Math.max(.7,Number(demo.speed)||2.0), hours=p.remaining/speed, mins=Math.round(hours*60);
  if(progressEl) progressEl.textContent=`${pct.toFixed(0)}% / ${p.progress.toFixed(2)} mi`;
  if(remainEl) remainEl.textContent=`${p.remaining.toFixed(2)} mi`;
  if(etaEl) etaEl.textContent=mins<60?`~${mins} min`:`~${Math.floor(mins/60)}h ${mins%60}m`;
  if(devEl) devEl.textContent=ft<528?`${Math.round(ft)} ft`:`${(ft/5280).toFixed(2)} mi`;
  if(state) state.textContent=ft>thresholdFt?'DEVIATION':'MONITORING';
  if(banner){
    const severe=ft>thresholdFt*3, off=ft>thresholdFt;
    banner.textContent=severe?`ROUTE DEVIATION — ${Math.round(ft)} FT`:off?`OFF ROUTE — ${Math.round(ft)} FT`:'ON ROUTE';
    banner.className=`deviation-banner ${severe?'critical-banner':off?'warn-banner':'good-banner'}`;
  }
}
document.getElementById('deviationThreshold')?.addEventListener('change',()=>{storageSet(STORE_PREFIX+'deviation-threshold',document.getElementById('deviationThreshold').value);updateRouteMonitor()});
const savedThreshold=storageGet(STORE_PREFIX+'deviation-threshold'); if(savedThreshold&&document.getElementById('deviationThreshold'))document.getElementById('deviationThreshold').value=savedThreshold;

// Waypoints
let waypoints=loadJSON('waypoints',[]);if(!Array.isArray(waypoints))waypoints=[];waypoints=waypoints.filter(validLatLon).map(w=>({...w,lat:Number(w.lat),lon:Number(w.lon),name:String(w.name||'WAYPOINT'),type:String(w.type||'NOTE'),notes:String(w.notes||'')}));let activeWaypointId=storageGet(STORE_PREFIX+'active-waypoint')||'';
function waypointSymbol(type){return ({BASE:'⌂',CAMP:'△',WATER:'≈',HAZARD:'!',JUNCTION:'◇',NOTE:'•'})[type]||'•'}
function renderWaypoints(){
  const list=document.getElementById('waypointList'); if(!list)return;
  list.innerHTML=waypoints.map(w=>`<div class="waypoint-row"><div class="waypoint-symbol">${waypointSymbol(w.type)}</div><div class="waypoint-main"><b>${escapeHTML(w.name)} ${w.id===activeWaypointId?'[NAV]':''}</b><small>${w.type} // ${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}${w.notes?` // ${escapeHTML(w.notes)}`:''}</small></div><div class="waypoint-actions"><button class="micro-btn" data-wp-nav="${w.id}">NAV</button><button class="micro-btn" data-wp-copy="${w.id}">COPY</button><button class="micro-btn danger" data-wp-delete="${w.id}">DEL</button></div></div>`).join('')||'<p class="muted">No waypoints saved yet.</p>';
  updateWaypointNav();
}
function saveWaypointCurrent(forceBase=false){
  if(waypoints.length>=500){alert('Waypoint limit reached (500). Export or delete old waypoints before adding more.');return;}
  const name=(document.getElementById('waypointName')?.value||'').trim()||(forceBase?'BASE':'WAYPOINT '+String(waypoints.length+1).padStart(2,'0'));
  const type=forceBase?'BASE':document.getElementById('waypointType')?.value||'NOTE', notes=document.getElementById('waypointNotes')?.value||'';
  const w={id:`wp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name,type,notes,lat:currentNavPosition.lat,lon:currentNavPosition.lon,alt:currentNavPosition.alt??demo.alt,created:new Date().toISOString()};
  waypoints.push(w); saveJSON('waypoints',waypoints); if(forceBase){activeWaypointId=w.id;storageSet(STORE_PREFIX+'active-waypoint',w.id)} renderWaypoints(); addLog(`WAYPOINT — ${name} at ${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}.`,'POSITION'); navigator.vibrate?.(25);
}
function updateWaypointNav(){
  const w=waypoints.find(x=>x.id===activeWaypointId),t=document.getElementById('waypointTarget'),d=document.getElementById('waypointDistance'),b=document.getElementById('waypointBearing'),c=document.getElementById('waypointCoord'),a=document.getElementById('waypointArrow');
  if(!w){if(t)t.textContent='NONE';if(d)d.textContent='---';if(b)b.innerHTML='---° <small>---</small>';if(c)c.textContent='---';return;}
  const mi=haversineMiles(currentNavPosition,w),deg=bearingDeg(currentNavPosition,w),card=headingCardinal(deg); if(t)t.textContent=w.name;if(d)d.textContent=mi<.1?`${Math.round(mi*5280)} ft`:`${mi.toFixed(2)} mi`;if(b)b.innerHTML=`${deg.toFixed(0).padStart(3,'0')}° <small>${card}</small>`;if(c)c.textContent=`${w.lat.toFixed(5)}, ${w.lon.toFixed(5)}`;if(a)a.style.transform=`rotate(${deg}deg)`;
}
document.getElementById('saveWaypoint')?.addEventListener('click',()=>saveWaypointCurrent(false));
document.getElementById('addCurrentWaypoint')?.addEventListener('click',()=>saveWaypointCurrent(false));
document.getElementById('setBaseWaypoint')?.addEventListener('click',()=>saveWaypointCurrent(true));
document.getElementById('exportWaypoints')?.addEventListener('click',()=>downloadJSON('fieldos-waypoints.json',waypoints));
document.addEventListener('click',async e=>{
  const nav=e.target.closest('[data-wp-nav]');if(nav){activeWaypointId=nav.dataset.wpNav;storageSet(STORE_PREFIX+'active-waypoint',activeWaypointId);renderWaypoints();navigator.vibrate?.(20)}
  const cp=e.target.closest('[data-wp-copy]');if(cp){const w=waypoints.find(x=>x.id===cp.dataset.wpCopy);if(w){await copyText(`${w.name}: ${w.lat.toFixed(6)}, ${w.lon.toFixed(6)}`);}}
  const del=e.target.closest('[data-wp-delete]');if(del){const id=del.dataset.wpDelete;if(confirm('Delete this waypoint?')){waypoints=waypoints.filter(x=>x.id!==id);if(activeWaypointId===id){activeWaypointId='';storageRemove(STORE_PREFIX+'active-waypoint')}saveJSON('waypoints',waypoints);renderWaypoints()}}
});
renderWaypoints();
document.addEventListener('fieldos:addwaypoint',e=>{
  const p=e.detail||{};if(!validLatLon(p)||waypoints.length>=500)return;
  const duplicate=waypoints.some(w=>haversineMiles(w,p)<.01&&String(w.name||'').toLowerCase()===String(p.name||'').toLowerCase());
  if(duplicate)return;
  const w={id:`wp-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,name:String(p.name||'BAILOUT'),type:String(p.type||'JUNCTION'),notes:String(p.notes||'Saved from FIELD/OS bailout planner'),lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null,created:new Date().toISOString()};
  waypoints.push(w);saveJSON('waypoints',waypoints);renderWaypoints();document.dispatchEvent(new CustomEvent('fieldos:waypointschange',{detail:{count:waypoints.length,added:w}}));
});

// Breadcrumb track recorder
let recordedTrack=loadJSON('track',[]);if(!Array.isArray(recordedTrack))recordedTrack=[];recordedTrack=recordedTrack.filter(validLatLon).slice(-5000);let trackWatchId=null, trackStartedAt=Number(storageGet(STORE_PREFIX+'track-start')||0), trackStoppedAt=Number(storageGet(STORE_PREFIX+'track-stop')||0);
function trackDistanceMiles(){let d=0;for(let i=1;i<recordedTrack.length;i++)d+=haversineMiles(recordedTrack[i-1],recordedTrack[i]);return d}
function updateTrackUI(){
  const d=document.getElementById('trackDistance'),p=document.getElementById('trackPoints'),line=document.getElementById('trackLine');if(d)d.textContent=trackDistanceMiles().toFixed(2);if(p)p.textContent=recordedTrack.length;
  if(line){if(recordedTrack.length<2)line.setAttribute('points','');else{const lats=recordedTrack.map(x=>x.lat),lons=recordedTrack.map(x=>x.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons),latR=Math.max(maxLat-minLat,.00001),lonR=Math.max(maxLon-minLon,.00001);line.setAttribute('points',recordedTrack.map(x=>`${40+920*(x.lon-minLon)/lonR},${20+360*(maxLat-x.lat)/latR}`).join(' '));}}
}
function addTrackPoint(pos,accuracy=null){const prev=recordedTrack.at(-1);if(prev&&haversineMiles(prev,pos)<.003)return;recordedTrack.push({lat:pos.lat,lon:pos.lon,alt:pos.alt??null,time:new Date().toISOString(),accuracy});if(recordedTrack.length>5000)recordedTrack.shift();saveJSON('track',recordedTrack);updateTrackUI()}
function startTrack(){if(!navigator.geolocation)return alert('Phone geolocation unavailable.');if(trackWatchId!=null)return;trackStartedAt=Date.now();trackStoppedAt=0;storageSet(STORE_PREFIX+'track-start',trackStartedAt);storageRemove(STORE_PREFIX+'track-stop');const state=document.getElementById('trackState');if(state)state.textContent='RECORDING';trackWatchId=navigator.geolocation.watchPosition(p=>{applyFieldGeolocation(p,'PHONE TRACK');addTrackPoint(currentNavPosition,p.coords.accuracy);const acc=document.getElementById('trackAccuracy');if(acc)acc.textContent=`±${Math.round(p.coords.accuracy)}m`;updateLiveNavigationUI();},err=>{stopTrack();alert(`Track recorder stopped: ${err.message}`)},{enableHighAccuracy:true,maximumAge:3000,timeout:15000});}
function stopTrack(){if(trackWatchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(trackWatchId);if(trackWatchId!=null){trackStoppedAt=Date.now();storageSet(STORE_PREFIX+'track-stop',trackStoppedAt)}trackWatchId=null;const state=document.getElementById('trackState');if(state)state.textContent='STOPPED';}
function trackAsGPX(){return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="FIELD/OS v3.0" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>FIELD OS TRACK</name><trkseg>${recordedTrack.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.alt!=null?`<ele>${(p.alt/3.28084).toFixed(2)}</ele>`:''}<time>${p.time}</time></trkpt>`).join('')}</trkseg></trk></gpx>`}
document.getElementById('startTrack')?.addEventListener('click',startTrack);document.getElementById('stopTrack')?.addEventListener('click',stopTrack);document.getElementById('addDemoTrackPoint')?.addEventListener('click',()=>addTrackPoint(currentNavPosition));document.getElementById('exportTrack')?.addEventListener('click',()=>{if(recordedTrack.length<2)return alert('Record at least two points first.');downloadText('fieldos-breadcrumb-track.gpx',trackAsGPX(),'application/gpx+xml')});document.getElementById('clearTrack')?.addEventListener('click',()=>{if(confirm('Clear recorded breadcrumb track?')){stopTrack();recordedTrack=[];trackStartedAt=0;trackStoppedAt=0;storageRemove(STORE_PREFIX+'track-start');storageRemove(STORE_PREFIX+'track-stop');saveJSON('track',recordedTrack);updateTrackUI()}});
setInterval(()=>{const e=document.getElementById('trackDuration');if(!e)return;const start=trackStartedAt||Date.now(),end=trackWatchId!=null?Date.now():(trackStoppedAt||Date.now()),sec=trackStartedAt?Math.max(0,Math.floor((end-start)/1000)):0,h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor(sec%3600/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');e.textContent=`${h}:${m}:${s}`},1000);updateTrackUI();

// Local check-in countdown (no background guarantee on iOS)
let checkinState=loadJSON('checkin',{last:0});if(!checkinState||typeof checkinState!=='object'||Array.isArray(checkinState))checkinState={last:0};checkinState.last=Number(checkinState.last)||0;
function resetCheckinTimer(){checkinState.last=Date.now();saveJSON('checkin',checkinState);updateCheckinTimer()}
function updateCheckinTimer(){
  const interval=Number(document.getElementById('checkinInterval')?.value||0),clock=document.getElementById('checkinCountdown'),detail=document.getElementById('checkinDetail'),home=document.getElementById('homeCheckinStatus');
  if(!clock)return;if(!interval){clock.textContent='MANUAL';clock.className='checkin-clock';if(detail)detail.textContent='Automatic local countdown disabled.';if(home)home.textContent='manual';return;}
  if(!checkinState.last){clock.textContent='READY';clock.className='checkin-clock';if(detail)detail.textContent='Press CHECK IN NOW or RESET TIMER to start the countdown.';if(home)home.textContent='not started';return;}
  const last=checkinState.last,due=last+interval*60000,left=Math.floor((due-Date.now())/1000),abs=Math.abs(left),h=Math.floor(abs/3600),m=Math.floor(abs%3600/60),s=abs%60,txt=`${h?String(h).padStart(2,'0')+':':''}${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
  if(left<0){clock.textContent=`OVERDUE ${txt}`;clock.className='checkin-clock overdue';if(detail)detail.textContent='Record/send a check-in when safe. This local timer cannot guarantee background alerts on iOS.';if(home)home.textContent='OVERDUE';}
  else{clock.textContent=txt;clock.className=`checkin-clock ${left<600?'soon':''}`;if(detail)detail.textContent=`Next local check-in due ${new Date(due).toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}.`;if(home)home.textContent=left<600?'due soon':`${Math.ceil(left/60)}m`;}
}
document.getElementById('resetCheckin')?.addEventListener('click',resetCheckinTimer);document.getElementById('checkinNow')?.addEventListener('click',resetCheckinTimer);document.getElementById('saveTrip')?.addEventListener('click',updateCheckinTimer);document.getElementById('checkinInterval')?.addEventListener('change',updateCheckinTimer);document.getElementById('copyCheckin')?.addEventListener('click',async()=>{await copyText(`FIELD/OS CHECK-IN\nTIME: ${new Date().toISOString()}\nPOSITION: ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)}\nALT: ${Math.round(currentNavPosition.alt??demo.alt)} ft\nSTATUS: OK`)});setInterval(updateCheckinTimer,1000);updateCheckinTimer();

updateRouteMonitor();


document.getElementById('copyCurrentCoord')?.addEventListener('click',async()=>{await copyText(`${currentNavPosition.lat.toFixed(6)}, ${currentNavPosition.lon.toFixed(6)}`);navigator.vibrate?.(15)});
document.getElementById('saveCurrentAsBase')?.addEventListener('click',()=>{const nameEl=document.getElementById('waypointName');if(nameEl&&!nameEl.value.trim())nameEl.value='BASE';saveWaypointCurrent(true);openView('waypoints')});

// v1.1 reference-fit: preserve the full generated workstation composition on small landscape screens.
function fitReferenceConsole(){
  const shell=document.querySelector('#home .detail-console'), vp=document.querySelector('#home .console-viewport');
  if(!shell||!vp)return;
  // Phones now use the responsive mobile layout in landscape. The old
  // reference-fit scaled a 1500px desktop console down to ~0.5x on iPhone,
  // making controls and readouts microscopic.
  const landscape=window.matchMedia('(orientation: landscape) and (max-height: 600px) and (min-width: 1001px)').matches;
  if(!landscape){shell.style.transform='';shell.style.marginLeft='';vp.style.height='';return;}
  const baseW=1500, availW=Math.max(1001,window.innerWidth-8);
  const scale=availW/baseW;
  shell.style.transform=`translateX(-50%) scale(${scale})`;
  const actualH=Math.max(930,shell.scrollHeight);
  vp.style.setProperty('--fit-console-h',`${Math.ceil(actualH*scale)}px`); vp.style.height=`${Math.ceil(actualH*scale)}px`;
}
window.addEventListener('resize',fitReferenceConsole,{passive:true});
window.addEventListener('orientationchange',()=>setTimeout(fitReferenceConsole,80));
requestAnimationFrame(fitReferenceConsole);
// v1.2 handheld telemetry and resilience helpers
function fmtAge(sec){sec=Math.max(0,Math.floor(sec));const h=String(Math.floor(sec/3600)).padStart(2,'0'),m=String(Math.floor((sec%3600)/60)).padStart(2,'0'),s=String(sec%60).padStart(2,'0');return h==='00'?`${m}:${s}`:`${h}:${m}:${s}`}
function nextSunset(date,lat,lon){
  const today=solarEventsForDate(date,lat,lon);
  if(today.sunset&&today.sunset>date)return today.sunset;
  const tomorrow=new Date(date);tomorrow.setDate(tomorrow.getDate()+1);
  return solarEventsForDate(tomorrow,lat,lon).sunset;
}
function updateHandheldStatus(){
  const fix=document.getElementById('mobileFixState'),age=document.getElementById('mobileFixAge');
  if(fix){fix.textContent=fixAge>180?'STALE':`3D / ±${Math.round(currentAccuracy)}m`;fix.closest('button')?.classList.toggle('status-stale',fixAge>180);}if(age)age.textContent=`AGE ${fmtAge(fixAge)}`;const ha=document.getElementById('homeAccuracy');if(ha)ha.textContent=`±${Math.round(currentAccuracy)} m`;
  const td=document.getElementById('rttDistance')?.textContent||document.getElementById('rttBigDistance')?.textContent||'---',tb=document.getElementById('rttBearing')?.textContent||'---';
  const bd=document.getElementById('rtbDistance')?.textContent||'---',bb=document.getElementById('rtbBearing')?.textContent||'---';
  const mtd=document.getElementById('mobileTrailDist'),mtb=document.getElementById('mobileTrailBrg'),mbd=document.getElementById('mobileBaseDist'),mbb=document.getElementById('mobileBaseBrg');
  if(mtd)mtd.textContent=td;if(mtb)mtb.textContent=tb;if(mbd)mbd.textContent=bd;if(mbb)mbb.textContent=bb;
  const now=new Date(),solar=solarEventsForDate(now,currentNavPosition.lat,currentNavPosition.lon),day=document.getElementById('mobileDaylight'),sun=document.getElementById('mobileSunState');
  if(day)day.textContent=fmtDurationMs(solar.daylightMs);
  if(sun){
    if(solar.sunrise&&solar.sunset)sun.textContent=`↑${fmtClock(solar.sunrise)} ↓${fmtClock(solar.sunset)}`;
    else sun.textContent=solar.state==='POLAR DAY'?'SUN ALL DAY':'NO SUNRISE';
  }
  const hc=document.getElementById('mobileCheckin');
  if(hc){
    const interval=Number(document.getElementById('checkinInterval')?.value||0);
    if(!interval) hc.textContent='MANUAL';
    else if(!checkinState?.last) hc.textContent='READY';
    else {const left=Math.floor((checkinState.last+interval*60000-Date.now())/1000);hc.textContent=left<0?'OVERDUE':left<600?'DUE SOON':`${Math.ceil(left/60)}m`;hc.closest('button')?.classList.toggle('status-stale',left<0);hc.closest('button')?.classList.toggle('status-soon',left>=0&&left<600);}
  }
}
setInterval(updateHandheldStatus,1000);setTimeout(updateHandheldStatus,50);
if(navigator.getBattery){navigator.getBattery().then(b=>{const paint=()=>{const el=document.getElementById('mobileBattery'),ps=document.getElementById('mobilePowerState');if(el)el.textContent=`${Math.round(b.level*100)}%`;const db=document.getElementById('deskBatteryPct');if(db)db.textContent=`${Math.round(b.level*100)}%`;if(ps)ps.textContent=b.charging?'CHARGING':'PHONE';};paint();b.addEventListener('levelchange',paint);b.addEventListener('chargingchange',paint);}).catch(()=>{});}

// v1.2 screen wake lock for active field navigation
let fieldWakeLock=null;
async function setFieldWakeLock(force){
  const status=document.getElementById('wakeLockStatus'),btn=document.getElementById('toggleWakeLock');
  const want=force ?? !fieldWakeLock;
  if(!('wakeLock' in navigator)){if(status)status.textContent='UNAVAILABLE — browser does not expose Screen Wake Lock.';if(btn)btn.textContent='WAKE LOCK UNSUPPORTED';return;}
  try{
    if(want&&!fieldWakeLock){fieldWakeLock=await navigator.wakeLock.request('screen');if(status)status.textContent='ON — FIELD/OS requested screen stay awake.';if(btn)btn.textContent='ALLOW SCREEN SLEEP';fieldWakeLock.addEventListener?.('release',()=>{fieldWakeLock=null;if(status)status.textContent='OFF — wake lock released.';if(btn)btn.textContent='KEEP SCREEN AWAKE';});}
    else if(!want&&fieldWakeLock){await fieldWakeLock.release();fieldWakeLock=null;if(status)status.textContent='OFF — screen may sleep normally.';if(btn)btn.textContent='KEEP SCREEN AWAKE';}
  }catch(err){fieldWakeLock=null;if(status)status.textContent=`FAILED — ${err?.message||'wake lock request rejected'}`;if(btn)btn.textContent='KEEP SCREEN AWAKE';}
}
document.getElementById('toggleWakeLock')?.addEventListener('click',()=>setFieldWakeLock());
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'&&fieldWakeLock)setFieldWakeLock(true)});


// v2.8 — standalone map engine owns live layers and continuous GNSS
let fieldLiveSpeed=null;
let fieldLiveHeading=null;
let fieldDeviceHeading=null;
let fieldDeviceHeadingSource='';
let fieldCompassEnabled=false;
let fieldLocationPrompted=false;
function renderFieldCompassTicks(){
  const ns='http://www.w3.org/2000/svg';
  for(const id of ['navCompassTicks','homeCompassTicks']){
    const g=document.getElementById(id);if(!g||g.childNodes.length)continue;
    for(let deg=0;deg<360;deg+=10){
      const major=deg%30===0,line=document.createElementNS(ns,'line');
      line.setAttribute('x1','100');line.setAttribute('x2','100');
      line.setAttribute('y1',major?'18':'20');line.setAttribute('y2',major?'29':'25');
      line.setAttribute('transform',`rotate(${deg} 100 100)`);
      line.setAttribute('class',major?'major':'minor');g.appendChild(line);
    }
  }
}
function handleFieldDeviceOrientation(e){
  let heading=null,source='';
  if(Number.isFinite(e.webkitCompassHeading)){
    heading=normalizeDeg(e.webkitCompassHeading);source='DEVICE / MAG';
  }else if(Number.isFinite(e.alpha)){
    const angle=Number(screen.orientation?.angle ?? window.orientation ?? 0)||0;
    heading=normalizeDeg(360-e.alpha+angle);
    source=e.absolute?'DEVICE / TRUE':'DEVICE / REL';
  }
  if(!Number.isFinite(heading))return;
  fieldDeviceHeading=heading;fieldDeviceHeadingSource=source;fieldCompassEnabled=true;
  updateLiveNavigationUI();
}
async function enableFieldDeviceCompass(){
  const statuses=[document.getElementById('compassPermissionState'),document.getElementById('homeCompassPermissionState')].filter(Boolean);
  const buttons=[document.getElementById('enableCompass'),document.getElementById('homeEnableCompass')].filter(Boolean);
  const setStatuses=text=>statuses.forEach(el=>el.textContent=text);
  const setButtons=text=>buttons.forEach(el=>el.textContent=text);
  if(typeof DeviceOrientationEvent==='undefined'){
    setStatuses('Device orientation is unavailable in this browser.');
    setButtons('COMPASS UNAVAILABLE');
    return;
  }
  try{
    if(typeof DeviceOrientationEvent.requestPermission==='function'){
      const result=await DeviceOrientationEvent.requestPermission();
      if(result!=='granted')throw new Error('Compass permission was not granted.');
    }
    window.removeEventListener('deviceorientation',handleFieldDeviceOrientation,true);
    window.removeEventListener('deviceorientationabsolute',handleFieldDeviceOrientation,true);
    window.addEventListener('deviceorientation',handleFieldDeviceOrientation,true);
    window.addEventListener('deviceorientationabsolute',handleFieldDeviceOrientation,true);
    fieldCompassEnabled=true;
    setStatuses('Device compass enabled. Rotate the phone to test heading.');
    setButtons('DEVICE COMPASS ON');
  }catch(err){
    fieldCompassEnabled=false;fieldDeviceHeading=null;fieldDeviceHeadingSource='';
    setStatuses(String(err?.message||'Compass permission failed.'));
    setButtons('ENABLE DEVICE COMPASS');
    updateLiveNavigationUI();
  }
}
document.getElementById('enableCompass')?.addEventListener('click',enableFieldDeviceCompass);
document.getElementById('homeEnableCompass')?.addEventListener('click',enableFieldDeviceCompass);
renderFieldCompassTicks();

// v1.8 — real OpenStreetMap + offline OSM-derived PMTiles
const FIELD_MAP_DB='fieldos-offline-maps-v1';
const FIELD_MAP_STORE='packs';
const FIELD_MAP_MAX_BYTES=250*1024*1024;
const FIELD_OSM_ATTR='© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap contributors</a>';
const FIELD_TOPO_ATTR='Kartendaten: © OpenStreetMap-Mitwirkende, SRTM | Kartendarstellung: © <a href="https://opentopomap.org/" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA)';
const FIELD_TRAIL_ATTR='© <a href="https://hiking.waymarkedtrails.org/" target="_blank" rel="noopener">Waymarked Trails</a>, OpenStreetMap contributors';
let fieldMapMode=storageGet(STORE_PREFIX+'map-source')||'topo';
let fieldActivePackId=storageGet(STORE_PREFIX+'map-pack')||'';
let fieldActivePackRecord=null;
let fieldTrailLayerEnabled=storageGet(STORE_PREFIX+'hiking-routes')!=='off';
let fieldMapLibPromise=null;
const fieldMaps=new Map();

function loadFieldAsset(tag,attrs){
  return new Promise((resolve,reject)=>{
    const existing=[...document.querySelectorAll(tag)].find(el=>Object.entries(attrs).some(([k,v])=>el.getAttribute(k)===v));
    if(existing){if(tag==='script'&&existing.dataset.fieldLoaded==='1')return resolve(existing);if(tag==='link')return resolve(existing);}
    const el=document.createElement(tag);
    Object.entries(attrs).forEach(([k,v])=>el.setAttribute(k,v));
    el.onload=()=>{el.dataset.fieldLoaded='1';resolve(el)};el.onerror=()=>reject(new Error('Failed to load '+(attrs.src||attrs.href)));
    document.head.appendChild(el);
  });
}
async function ensureFieldMapLibraries(){
  if(typeof L!=='undefined')return true;
  if(fieldMapLibPromise)return fieldMapLibPromise;
  fieldMapLibPromise=(async()=>{
    const cssUrls=['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.css','https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'];
    const jsUrls=['https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js','https://unpkg.com/leaflet@1.9.4/dist/leaflet.js'];
    for(const href of cssUrls){try{await loadFieldAsset('link',{rel:'stylesheet',href});break}catch{}}
    for(const src of jsUrls){try{await loadFieldAsset('script',{src});if(typeof L!=='undefined')break}catch{}}
    return typeof L!=='undefined';
  })();
  return fieldMapLibPromise;
}
async function ensureOfflineMapLibraries(){
  if(typeof pmtiles!=='undefined'&&typeof protomapsL!=='undefined')return true;
  const groups=[
    ['https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js','https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js'],
    ['https://cdn.jsdelivr.net/npm/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js','https://unpkg.com/protomaps-leaflet@5.1.0/dist/protomaps-leaflet.js']
  ];
  for(const urls of groups){
    if((urls[0].includes('/pmtiles@')&&typeof pmtiles!=='undefined')||(urls[0].includes('protomaps-leaflet')&&typeof protomapsL!=='undefined'))continue;
    for(const src of urls){try{await loadFieldAsset('script',{src});break}catch{}}
  }
  return typeof pmtiles!=='undefined'&&typeof protomapsL!=='undefined';
}
function hasTrustedMapPosition(){
  return validLatLon(currentNavPosition)&&!String(currentNavPosition.source||'').toUpperCase().includes('DEMO');
}
function fmtBytes(n){
  n=Number(n)||0;
  if(n<1024)return n+' B';
  if(n<1024*1024)return (n/1024).toFixed(1)+' KB';
  if(n<1024*1024*1024)return (n/1024/1024).toFixed(1)+' MB';
  return (n/1024/1024/1024).toFixed(2)+' GB';
}
function setOfflineMapStatus(msg,progress=null){
  const el=document.getElementById('offlineMapStatus');if(el)el.textContent=msg;
  const p=document.getElementById('offlineMapProgress');if(p&&progress!=null)p.value=Math.max(0,Math.min(100,progress));
}
function openFieldMapDB(){
  return new Promise((resolve,reject)=>{
    if(!('indexedDB' in window))return reject(new Error('IndexedDB unavailable'));
    const req=indexedDB.open(FIELD_MAP_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains(FIELD_MAP_STORE))db.createObjectStore(FIELD_MAP_STORE,{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Map database open failed'));
  });
}
async function fieldMapDb(mode,action){
  const db=await openFieldMapDB();
  try{
    return await new Promise((resolve,reject)=>{
      const tx=db.transaction(FIELD_MAP_STORE,mode),store=tx.objectStore(FIELD_MAP_STORE);
      let req;
      try{req=action(store);}catch(err){reject(err);return;}
      let result;
      if(req){req.onsuccess=()=>{result=req.result};req.onerror=()=>reject(req.error);}
      tx.oncomplete=()=>resolve(result);
      tx.onerror=()=>reject(tx.error||new Error('Map storage failed'));
      tx.onabort=()=>reject(tx.error||new Error('Map storage transaction aborted'));
    });
  }finally{db.close();}
}
async function listFieldMapPacks(){return await fieldMapDb('readonly',s=>s.getAll());}
async function getFieldMapPack(id){if(!id)return null;return await fieldMapDb('readonly',s=>s.get(id));}
async function deleteFieldMapPack(id){if(!id)return;await fieldMapDb('readwrite',s=>s.delete(id));}
async function ensureMapStorageCapacity(bytes){
  const need=Math.max(0,Number(bytes)||0);
  if(!navigator.storage?.estimate)return {ok:true,need,available:null};
  const e=await navigator.storage.estimate(),available=Math.max(0,Number(e.quota||0)-Number(e.usage||0));
  if(need&&available<need*1.12)throw new Error(`Not enough browser storage. Need about ${fmtBytes(need*1.12)} including safety margin; ${fmtBytes(available)} appears available.`);
  return {ok:true,need,available,usage:Number(e.usage||0),quota:Number(e.quota||0)};
}
function fmtMapPackAge(created){
  const ms=Date.now()-Date.parse(created||'');if(!Number.isFinite(ms)||ms<0)return 'UNKNOWN';
  const h=Math.floor(ms/3600000);if(h<1)return '<1 HOUR OLD';if(h<48)return h+' HOURS OLD';return Math.floor(h/24)+' DAYS OLD';
}
async function saveFieldMapPackBlob(blob,name,source='import'){
  if(!blob||!blob.size)throw new Error('Map file is empty.');
  try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}
  if(blob.size>FIELD_MAP_MAX_BYTES)throw new Error('Map pack is larger than the 250 MB FIELD/OS browser safety limit.');
  await ensureMapStorageCapacity(blob.size);
  if(typeof pmtiles==='undefined')throw new Error('PMTiles library unavailable.');
  const safeName=String(name||'offline-map.pmtiles').replace(/[^a-zA-Z0-9._ -]/g,'_');
  const file=blob instanceof File?blob:new File([blob],safeName,{type:'application/octet-stream'});
  const archive=new pmtiles.PMTiles(new pmtiles.FileSource(file));
  const header=await archive.getHeader();
  const id='map-'+Date.now()+'-'+Math.random().toString(36).slice(2,8);
  const rec={id,name:safeName,size:file.size,blob:file,created:new Date().toISOString(),source,minZoom:header.minZoom,maxZoom:header.maxZoom,bounds:[header.minLon,header.minLat,header.maxLon,header.maxLat],center:[header.centerLat,header.centerLon,header.centerZoom]};
  await fieldMapDb('readwrite',s=>s.put(rec));
  return rec;
}
async function refreshFieldMapPackUI(){
  const sel=document.getElementById('offlinePmtilesSelect');
  let packs=[];
  try{packs=await listFieldMapPacks();}catch(err){setOfflineMapStatus('STORAGE ERROR');return;}
  packs.sort((a,b)=>String(b.created).localeCompare(String(a.created)));
  if(sel){
    sel.innerHTML=packs.length?packs.map(p=>`<option value="${escapeHTML(p.id)}">${escapeHTML(p.name)} — ${fmtBytes(p.size)}</option>`).join(''):'<option value="">NO SAVED PACKS</option>';
    if(fieldActivePackId&&packs.some(p=>p.id===fieldActivePackId))sel.value=fieldActivePackId;
  }
  if(fieldActivePackId&&!packs.some(p=>p.id===fieldActivePackId)){fieldActivePackId='';fieldActivePackRecord=null;storageRemove(STORE_PREFIX+'map-pack');}
  const src=document.getElementById('offlineMapSource'),sz=document.getElementById('offlineMapSize'),mode=document.getElementById('offlineMapMode');
  const active=packs.find(p=>p.id===fieldActivePackId);
  if(src)src.textContent=(fieldMapMode==='offline'&&active)?active.name:'ONLINE OSM';
  if(sz)sz.textContent=active?fmtBytes(active.size):'—';
  const age=document.getElementById('offlineMapAge'),origin=document.getElementById('offlineMapOrigin');
  if(age)age.textContent=active?fmtMapPackAge(active.created):'—';
  if(origin)origin.textContent=active?String(active.source||'import').toUpperCase():'—';
  if(mode)mode.textContent=(fieldMapMode==='offline'&&active)?'OFFLINE PMTILES':'ONLINE OSM';
  if(navigator.storage?.estimate){
    try{const e=await navigator.storage.estimate(),st=document.getElementById('offlineMapStorage');if(st)st.textContent=`${fmtBytes(e.usage||0)} / ${fmtBytes(e.quota||0)}`;}catch{}
  }
}
function ensureFieldMap(id,fallbackId,labelId){
  if(fieldMaps.has(id))return fieldMaps.get(id);
  const el=document.getElementById(id),fallback=document.getElementById(fallbackId),label=document.getElementById(labelId);
  if(!el||typeof L==='undefined')return null;
  const map=L.map(el,{zoomControl:false,attributionControl:true,preferCanvas:true,minZoom:2,maxZoom:19,zoomAnimation:true,fadeAnimation:true,markerZoomAnimation:true,zoomSnap:.125,zoomDelta:.25,wheelDebounceTime:12,wheelPxPerZoomLevel:180});
  map.attributionControl.setPrefix(false);
  const overlay=L.layerGroup().addTo(map);
  const state={id,el,fallback,label,map,overlay,base:null,trails:null,baseKind:'',attr:'',centered:false,tileErrors:0};
  fieldMaps.set(id,state);
  map.setView([currentNavPosition.lat,currentNavPosition.lon],14);enableContinuousWheelZoom(map);
  map.on('zoomend moveend',()=>{state.centered=true;});
  return state;
}
function enableContinuousWheelZoom(map){
  if(!map||map._fieldContinuousWheel)return;
  map._fieldContinuousWheel=true;
  map.scrollWheelZoom?.disable?.();
  const el=map.getContainer();let target=map.getZoom(),raf=0,anchor=null,last=0;
  const frame=()=>{
    raf=0;const now=performance.now();const current=map.getZoom();const diff=target-current;
    if(Math.abs(diff)<.002){if(Math.abs(diff)>0)map.setZoomAround(anchor||map.getSize().divideBy(2),target,{animate:false});return;}
    const dt=Math.min(32,Math.max(8,now-(last||now-16)));last=now;
    const next=current+diff*(1-Math.exp(-dt/55));
    map.setZoomAround(anchor||map.getSize().divideBy(2),next,{animate:false});
    raf=requestAnimationFrame(frame);
  };
  el.addEventListener('wheel',e=>{
    if(e.ctrlKey)return;
    e.preventDefault();anchor=map.mouseEventToContainerPoint(e);
    const dy=Math.max(-120,Math.min(120,e.deltaY));
    target=Math.max(map.getMinZoom(),Math.min(map.getMaxZoom(),target-dy/420));
    last=performance.now();if(!raf)raf=requestAnimationFrame(frame);
  },{passive:false});
  map.on('zoomend',()=>{if(!raf)target=map.getZoom()});
}
function showFieldFallback(state,message='SCHEMATIC FALLBACK'){
  if(!state)return;
  state.el.hidden=true;
  if(state.fallback)state.fallback.hidden=false;
  if(state.label)state.label.textContent=message;
}
function showFieldRealMap(state,label){
  if(!state)return;
  state.el.hidden=false;
  if(state.fallback)state.fallback.hidden=true;
  if(state.label)state.label.textContent=label;
  requestAnimationFrame(()=>state.map.invalidateSize(false));
}
function removeFieldBase(state){
  if(state.base){try{state.map.removeLayer(state.base);}catch{}state.base=null;}
  if(state.attr){try{state.map.attributionControl.removeAttribution(state.attr);}catch{}state.attr='';}
  state.baseKind='';
}
async function setFieldBase(state,kind,pack=null){
  const key=kind==='offline'&&pack?`offline:${pack.id}`:kind;
  if(state.baseKind===key&&state.base){
    syncHikingOverlay(state);
    return;
  }
  removeFieldBase(state);
  if(state.trails){try{state.map.removeLayer(state.trails);}catch{}state.trails=null;}
  if(kind==='offline'){
    if(!pack||!(await ensureOfflineMapLibraries()))throw new Error('Offline PMTiles renderer unavailable.');
    const file=pack.blob instanceof File?pack.blob:new File([pack.blob],pack.name||'offline.pmtiles',{type:'application/octet-stream'});
    const archive=new pmtiles.PMTiles(new pmtiles.FileSource(file));
    state.base=protomapsL.leafletLayer({url:archive,flavor:'dark',lang:'en'});
    state.base.addTo(state.map);
    state.attr=FIELD_OSM_ATTR+' · OFFLINE PMTiles';
    state.map.attributionControl.addAttribution(state.attr);
  }else if(kind==='osm'){
    state.tileErrors=0;
    state.base=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      minZoom:2,maxZoom:19,maxNativeZoom:19,attribution:FIELD_OSM_ATTR
    });
    state.base.on('tileerror',()=>{state.tileErrors++;if(state.tileErrors===3)setOfflineMapStatus('OSM TILE ERROR');});
    state.base.addTo(state.map);
  }else{
    state.tileErrors=0;
    state.base=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
      subdomains:'abc',minZoom:2,maxZoom:19,maxNativeZoom:17,attribution:FIELD_TOPO_ATTR
    });
    state.base.on('tileerror',()=>{
      state.tileErrors++;
      if(state.tileErrors===4){
        setOfflineMapStatus('TOPO SERVER ERROR — FALLBACK OSM');
        const diag=document.getElementById('mapSourceDiag');if(diag)diag.textContent='TOPO ERROR — OSM FALLBACK';
        setFieldBase(state,'osm').catch(()=>{});
      }
    });
    state.base.addTo(state.map);
  }
  state.baseKind=key;
  syncHikingOverlay(state);
}
function syncHikingOverlay(state){
  if(!state||state.baseKind.startsWith('offline:'))return;
  if(fieldTrailLayerEnabled){
    if(!state.trails){
      state.trails=L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',{
        minZoom:2,maxZoom:18,maxNativeZoom:18,opacity:.92,attribution:FIELD_TRAIL_ATTR,pane:'overlayPane'
      });
      state.trails.on('tileerror',()=>{const d=document.getElementById('mapSourceDiag');if(d)d.textContent='HIKING ROUTE OVERLAY UNAVAILABLE';});
      state.trails.addTo(state.map);
    }
  }else if(state.trails){try{state.map.removeLayer(state.trails);}catch{}state.trails=null;}
}
function mapRouteLatLngs(){return routePoints.filter(validLatLon).map(p=>[p.lat,p.lon]);}
function mapTrackLatLngs(){
  const step=Math.max(1,Math.ceil(recordedTrack.length/1500));
  return recordedTrack.filter((_,i)=>i%step===0).filter(validLatLon).map(p=>[p.lat,p.lon]);
}
function drawFieldMapOverlays(state){
  state.overlay.clearLayers();
  if(hasTrustedMapPosition()){
    const pos=[currentNavPosition.lat,currentNavPosition.lon];
    L.circle(pos,{radius:Math.max(3,Number(currentAccuracy)||4),className:'field-map-accuracy',interactive:false}).addTo(state.overlay);
    L.circleMarker(pos,{radius:7,className:'field-map-self',fillOpacity:1}).bindTooltip('CURRENT POSITION',{direction:'top'}).addTo(state.overlay);
  }
  const route=mapRouteLatLngs();if(route.length>=2)L.polyline(route,{className:'field-map-route',weight:4,opacity:.95}).addTo(state.overlay);
  const track=mapTrackLatLngs();if(track.length>=2)L.polyline(track,{className:'field-map-track',weight:3,opacity:.82,dashArray:'5 5'}).addTo(state.overlay);
  waypoints.forEach(w=>{
    if(!validLatLon(w))return;
    const icon=L.divIcon({className:'field-map-waypoint-wrap',html:`<span class="field-map-waypoint ${w.type==='BASE'?'base':''}">${escapeHTML(waypointSymbol(w.type))}</span>`,iconSize:[22,22],iconAnchor:[11,11]});
    L.marker([w.lat,w.lon],{icon}).bindTooltip(escapeHTML(w.name),{direction:'top'}).addTo(state.overlay);
  });
}
async function resolveActiveFieldPack(){
  if(!fieldActivePackId)return null;
  if(fieldActivePackRecord?.id===fieldActivePackId)return fieldActivePackRecord;
  try{fieldActivePackRecord=await getFieldMapPack(fieldActivePackId);return fieldActivePackRecord;}catch{return null;}
}
async function updateFieldMaps(recenter=false){
  if(window.FIELD_MAP_ENGINE_EXTERNAL)return window.FIELD_MAP_ENGINE?.refresh?.(recenter);
  const libs=await ensureFieldMapLibraries();
  const diag=document.getElementById('mapSourceDiag');
  if(!libs){
    if(diag)diag.textContent='MAP ENGINE FAILED — RETRY';
    ['homeMapModeLabel','mapModeLabel'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='MAP ENGINE ERROR';});
    return;
  }
  if(diag)diag.textContent='MAP ENGINE READY';
  const states=[
    ensureFieldMap('homeRealMap','homeMapFallback','homeMapModeLabel'),
    ensureFieldMap('realMap','mapFallback','mapModeLabel')
  ].filter(Boolean);
  if(!states.length)return;
  const trusted=hasTrustedMapPosition();
  const pack=await resolveActiveFieldPack();
  const useOffline=(fieldMapMode==='offline'||!navigator.onLine)&&!!pack;
  const canOnline=navigator.onLine!==false;
  if(!useOffline&&!canOnline){
    states.forEach(s=>showFieldFallback(s,'NO NETWORK / NO OFFLINE PACK'));
    return;
  }
  for(const state of states){
    try{
      const onlineKind=fieldMapMode==='osm'?'osm':'topo';
      await setFieldBase(state,useOffline?'offline':onlineKind,pack);
      drawFieldMapOverlays(state);
      const label=useOffline?(trusted?'OFFLINE MAP / LIVE FIX':'OFFLINE MAP / AWAITING FIX'):(onlineKind==='topo'?(trusted?'HIKING TOPO / GNSS':'HIKING TOPO / AWAITING FIX'):(trusted?'STREET OSM / GNSS':'STREET OSM / AWAITING FIX'));
      showFieldRealMap(state,label);
      if(recenter||!state.centered){
        let center=[currentNavPosition.lat,currentNavPosition.lon];
        if(!trusted&&routePoints.length)center=[routePoints[0].lat,routePoints[0].lon];
        else if(!trusted&&waypoints.length)center=[waypoints[0].lat,waypoints[0].lon];
        state.map.setView(center,Math.max(13,state.map.getZoom()||14));state.centered=true;
      }
    }catch(err){
      console.warn('FIELD/OS map source failed',err);
      showFieldFallback(state,'MAP SOURCE ERROR');
      setOfflineMapStatus('MAP SOURCE ERROR');
    }
  }
  const src=document.getElementById('offlineMapSource');if(src)src.textContent=useOffline?(pack?.name||'OFFLINE PMTILES'):(fieldMapMode==='osm'?'STREET OSM':'OPEN TOPO HIKING');
}
window.FIELD_OFFLINE_MAPS={
  async active(){return await resolveActiveFieldPack()},
  async leafletLayer(){
    const pack=await resolveActiveFieldPack();if(!pack)return null;
    if(!(await ensureOfflineMapLibraries()))return null;
    const file=pack.blob instanceof File?pack.blob:new File([pack.blob],pack.name||'offline.pmtiles',{type:'application/octet-stream'});
    const archive=new pmtiles.PMTiles(new pmtiles.FileSource(file));
    return {layer:protomapsL.leafletLayer({url:archive,flavor:'dark',lang:'en'}),pack};
  },
  async ready(){const pack=await resolveActiveFieldPack();return {pack:!!pack,name:pack?.name||'',mode:fieldMapMode,offline:navigator.onLine===false}}
};
async function activateFieldMapPack(id){
  const rec=await getFieldMapPack(id);
  if(!rec)throw new Error('Saved map pack not found.');
  fieldActivePackId=id;fieldActivePackRecord=rec;fieldMapMode='offline';
  storageSet(STORE_PREFIX+'map-pack',id);storageSet(STORE_PREFIX+'map-source','offline');
  await refreshFieldMapPackUI();await updateFieldMaps(true);setOfflineMapStatus('OFFLINE PACK ACTIVE',100);
}
async function useOnlineFieldMap(){
  fieldMapMode='osm';storageSet(STORE_PREFIX+'map-source','osm');
  await refreshFieldMapPackUI();await updateFieldMaps(true);setOfflineMapStatus('STREET OSM ACTIVE',100);paintMapSourceButtons();
}
async function useTopoFieldMap(){
  fieldMapMode='topo';storageSet(STORE_PREFIX+'map-source','topo');
  await refreshFieldMapPackUI();await updateFieldMaps(true);setOfflineMapStatus('HIKING TOPO ACTIVE',100);paintMapSourceButtons();
}
function paintMapSourceButtons(){
  const topo=fieldMapMode!=='osm'&&fieldMapMode!=='offline';
  document.getElementById('mapTopoMode')?.classList.toggle('active',topo);
  document.getElementById('mapOsmMode')?.classList.toggle('active',fieldMapMode==='osm');
  document.getElementById('mapTrailLayer')?.classList.toggle('active',fieldTrailLayerEnabled);
  const homeTrail=document.getElementById('homeTrailLayer');if(homeTrail)homeTrail.classList.toggle('active',fieldTrailLayerEnabled);
  const homeTopo=document.getElementById('homeTopoMode');if(homeTopo)homeTopo.classList.toggle('active',topo);
}
async function toggleHikingRoutes(){
  fieldTrailLayerEnabled=!fieldTrailLayerEnabled;
  storageSet(STORE_PREFIX+'hiking-routes',fieldTrailLayerEnabled?'on':'off');
  fieldMaps.forEach(syncHikingOverlay);
  paintMapSourceButtons();
}
async function downloadFieldPmtiles(url){
  const raw=String(url||'').trim();
  if(!raw)throw new Error('Enter a PMTiles URL.');
  const u=new URL(raw,location.href);
  if(u.protocol!=='https:')throw new Error('Use an HTTPS PMTiles URL.');
  if(u.hostname==='tile.openstreetmap.org')throw new Error('Official OSM raster tiles cannot be bulk-downloaded for offline use.');
  setOfflineMapStatus('CONNECTING…',1);
  const res=await fetch(u.href,{mode:'cors',credentials:'omit'});
  if(!res.ok)throw new Error(`Download failed: HTTP ${res.status}`);
  const advertised=Number(res.headers.get('content-length')||0);
  if(advertised>FIELD_MAP_MAX_BYTES)throw new Error('Map pack exceeds the 250 MB FIELD/OS browser safety limit.');
  if(advertised)await ensureMapStorageCapacity(advertised);
  let blob;
  if(res.body?.getReader){
    const reader=res.body.getReader(),chunks=[];let got=0;
    while(true){
      const {done,value}=await reader.read();if(done)break;
      got+=value.byteLength;if(got>FIELD_MAP_MAX_BYTES){reader.cancel();throw new Error('Map pack exceeded the 250 MB FIELD/OS browser safety limit.');}
      chunks.push(value);setOfflineMapStatus(`DOWNLOADING ${fmtBytes(got)}`,advertised?got/advertised*92:Math.min(92,got/FIELD_MAP_MAX_BYTES*100));
    }
    blob=new Blob(chunks,{type:'application/octet-stream'});
  }else blob=await res.blob();
  const name=decodeURIComponent(u.pathname.split('/').pop()||'downloaded-map.pmtiles');
  setOfflineMapStatus('VALIDATING…',94);
  return await saveFieldMapPackBlob(blob,name,'download');
}
function routeCorridorBounds(points=routePoints,paddingMiles=2){
  const valid=(Array.isArray(points)?points:[]).filter(validLatLon);
  if(!valid.length)return null;
  let minLat=90,maxLat=-90,minLon=180,maxLon=-180;
  for(const p of valid){minLat=Math.min(minLat,Number(p.lat));maxLat=Math.max(maxLat,Number(p.lat));minLon=Math.min(minLon,Number(p.lon));maxLon=Math.max(maxLon,Number(p.lon));}
  const pad=Math.max(.25,Math.min(15,Number(paddingMiles)||2)),mid=(minLat+maxLat)/2*Math.PI/180;
  const latPad=pad/69,lonPad=pad/Math.max(10,69*Math.cos(mid));
  return {minLat:Math.max(-85,minLat-latPad),maxLat:Math.min(85,maxLat+latPad),minLon:Math.max(-180,minLon-lonPad),maxLon:Math.min(180,maxLon+lonPad),paddingMiles:pad};
}
function packCoversBounds(pack,b){
  const p=pack?.bounds;if(!b||!Array.isArray(p)||p.length<4)return false;
  return Number(p[0])<=b.minLon&&Number(p[1])<=b.minLat&&Number(p[2])>=b.maxLon&&Number(p[3])>=b.maxLat;
}
async function analyzeRouteOfflineCoverage(){
  const out=document.getElementById('routeOfflineCoverage'),pad=Number(document.getElementById('routeCorridorPadding')?.value||2);
  const b=routeCorridorBounds(routePoints,pad);
  if(!b){if(out)out.textContent='PLAN A ROUTE FIRST';return {bounds:null,matches:[]};}
  let packs=[];try{packs=await listFieldMapPacks();}catch{}
  const matches=packs.filter(p=>packCoversBounds(p,b));
  const text=matches.length?`READY // ${matches.length} SAVED PACK${matches.length===1?'':'S'} COVER FULL ${b.paddingMiles.toFixed(1)} MI CORRIDOR`:`GAP // NO SAVED PACK COVERS FULL ${b.paddingMiles.toFixed(1)} MI CORRIDOR`;
  if(out)out.textContent=text;
  const boundsOut=document.getElementById('routeCorridorBounds');
  if(boundsOut)boundsOut.textContent=`${b.minLat.toFixed(4)}, ${b.minLon.toFixed(4)} → ${b.maxLat.toFixed(4)}, ${b.maxLon.toFixed(4)}`;
  return {bounds:b,matches};
}
async function activateBestRoutePack(){
  const {matches}=await analyzeRouteOfflineCoverage();
  if(!matches.length)return alert('No saved PMTiles pack fully covers this route corridor. Import or download a regional pack first.');
  matches.sort((a,b)=>Number(a.size||Infinity)-Number(b.size||Infinity));
  await activateFieldMapPack(matches[0].id);
  setOfflineMapStatus('ROUTE CORRIDOR PACK ACTIVE',100);
}
function corridorTemplateUrl(template,bounds){
  const raw=String(template||'').trim();if(!raw)throw new Error('Save a PMTiles corridor URL template first.');
  if(!bounds)throw new Error('Plan a route before building a corridor download.');
  const replacements={west:bounds.minLon,south:bounds.minLat,east:bounds.maxLon,north:bounds.maxLat,bbox:`${bounds.minLon},${bounds.minLat},${bounds.maxLon},${bounds.maxLat}`};
  let out=raw;for(const [k,v] of Object.entries(replacements))out=out.replaceAll(`{${k}}`,encodeURIComponent(String(v)));
  const u=new URL(out,location.href);if(u.protocol!=='https:')throw new Error('Corridor provider template must use HTTPS.');
  if(u.hostname==='tile.openstreetmap.org')throw new Error('Official OSM raster tiles cannot be used as a corridor download provider.');
  return u.href;
}
function saveCorridorProviderTemplate(){
  const input=document.getElementById('routeCorridorTemplate'),raw=String(input?.value||'').trim();
  if(raw&&!/\{(bbox|west|south|east|north)\}/.test(raw))return alert('Template needs {bbox} or coordinate tokens such as {west}, {south}, {east}, {north}.');
  storageSet(STORE_PREFIX+'corridor-pmtiles-template',raw);
  const s=document.getElementById('routeCorridorProviderState');if(s)s.textContent=raw?'TEMPLATE SAVED':'TEMPLATE CLEARED';
}
async function downloadRouteCorridorPack(){
  const btn=document.getElementById('downloadRouteCorridor');if(btn)btn.disabled=true;
  try{
    const pad=Number(document.getElementById('routeCorridorPadding')?.value||2),bounds=routeCorridorBounds(routePoints,pad);
    const template=String(document.getElementById('routeCorridorTemplate')?.value||storageGet(STORE_PREFIX+'corridor-pmtiles-template')||'');
    const url=corridorTemplateUrl(template,bounds);
    setOfflineMapStatus('BUILDING ROUTE CORRIDOR…',1);
    const rec=await downloadFieldPmtiles(url);await refreshFieldMapPackUI();await activateFieldMapPack(rec.id);await analyzeRouteOfflineCoverage();
  }catch(err){setOfflineMapStatus('CORRIDOR DOWNLOAD FAILED');alert(err.message||String(err));}finally{if(btn)btn.disabled=false;}
}
const corridorTemplateInput=document.getElementById('routeCorridorTemplate');
if(corridorTemplateInput)corridorTemplateInput.value=storageGet(STORE_PREFIX+'corridor-pmtiles-template')||'';
document.getElementById('saveRouteCorridorTemplate')?.addEventListener('click',saveCorridorProviderTemplate);
document.getElementById('downloadRouteCorridor')?.addEventListener('click',downloadRouteCorridorPack);
document.getElementById('checkRouteOffline')?.addEventListener('click',analyzeRouteOfflineCoverage);
document.getElementById('activateRouteOffline')?.addEventListener('click',activateBestRoutePack);
document.getElementById('routeCorridorPadding')?.addEventListener('change',analyzeRouteOfflineCoverage);
document.addEventListener('fieldos:routechange',()=>analyzeRouteOfflineCoverage());
document.getElementById('offlinePmtilesFile')?.addEventListener('change',async e=>{
  const file=e.target.files?.[0];if(!file)return;
  try{setOfflineMapStatus('IMPORTING…',20);const rec=await saveFieldMapPackBlob(file,file.name,'import');await refreshFieldMapPackUI();await activateFieldMapPack(rec.id);}catch(err){setOfflineMapStatus('IMPORT FAILED');alert(err.message||String(err));}finally{e.target.value='';}
});
document.getElementById('downloadPmtiles')?.addEventListener('click',async()=>{
  const btn=document.getElementById('downloadPmtiles');if(btn)btn.disabled=true;
  try{const rec=await downloadFieldPmtiles(document.getElementById('offlinePmtilesUrl')?.value);await refreshFieldMapPackUI();await activateFieldMapPack(rec.id);}catch(err){setOfflineMapStatus('DOWNLOAD FAILED');alert(err.message||String(err));}finally{if(btn)btn.disabled=false;}
});
document.getElementById('activatePmtiles')?.addEventListener('click',async()=>{
  const id=document.getElementById('offlinePmtilesSelect')?.value;if(!id)return alert('No saved map pack selected.');
  try{await activateFieldMapPack(id);}catch(err){alert(err.message||String(err));}
});
document.getElementById('deletePmtiles')?.addEventListener('click',async()=>{
  const id=document.getElementById('offlinePmtilesSelect')?.value;if(!id)return;
  if(!confirm('Delete this offline map pack from FIELD/OS?'))return;
  await deleteFieldMapPack(id);
  if(fieldActivePackId===id){fieldActivePackId='';fieldActivePackRecord=null;fieldMapMode='osm';storageRemove(STORE_PREFIX+'map-pack');storageSet(STORE_PREFIX+'map-source','osm');}
  await refreshFieldMapPackUI();await updateFieldMaps(true);setOfflineMapStatus('PACK DELETED',0);
});
document.getElementById('useOnlineOsm')?.addEventListener('click',()=>useTopoFieldMap());
async function runMapControl(action,target='realMap'){
  if(window.FIELD_MAP_ENGINE_EXTERNAL)return window.FIELD_MAP_ENGINE?.[action==='location'?'requestLocation':'refresh']?.(action==='center');
  const diag=document.getElementById('mapSourceDiag');
  try{
    if(action==='topo')return await useTopoFieldMap();
    if(action==='osm')return await useOnlineFieldMap();
    if(action==='trails')return await toggleHikingRoutes();
    if(action==='location')return requestFieldLiveLocation();
    await updateFieldMaps(action==='center');
    const state=fieldMaps.get(target)||fieldMaps.get('realMap');
    if(!state||state.el.hidden){if(diag)diag.textContent='MAP NOT READY';return;}
    if(action==='zoom-in')state.map.zoomIn();
    else if(action==='zoom-out')state.map.zoomOut();
    else if(action==='center'){
      const trusted=hasTrustedMapPosition(),p=trusted?currentNavPosition:(routePoints[0]||waypoints[0]||currentNavPosition);
      state.map.setView([p.lat,p.lon],Math.max(13,state.map.getZoom()||14));
      state.centered=true;
    }
    requestAnimationFrame(()=>state.map.invalidateSize(false));
  }catch(err){
    console.warn('FIELD/OS map control failed',action,err);
    if(diag)diag.textContent=`CONTROL ERROR: ${String(err?.message||err).slice(0,48)}`;
  }
}
document.addEventListener('click',e=>{
  const btn=e.target.closest('[data-map-action]');
  if(!btn)return;
  e.preventDefault();
  const action=btn.dataset.mapAction,target=btn.dataset.mapTarget||'realMap';
  runMapControl(action,target);
});
function updateLiveNavigationUI(){
  const trusted=hasTrustedMapPosition();
  const deviceHeading=Number.isFinite(fieldDeviceHeading)?fieldDeviceHeading:null;
  const courseHeading=Number.isFinite(fieldLiveHeading)?fieldLiveHeading:null;
  const heading=deviceHeading??(trusted?courseHeading:demo.heading);
  const source=Number.isFinite(deviceHeading)?(fieldDeviceHeadingSource||'DEVICE'):Number.isFinite(courseHeading)?'GNSS COURSE':trusted?'NO HEADING':'DEMO';
  const speed=trusted?(Number.isFinite(fieldLiveSpeed)?fieldLiveSpeed:null):demo.speed;
  const card=Number.isFinite(heading)?headingCardinal(heading):'--';
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  const headingText=Number.isFinite(heading)?String(Math.round(heading)).padStart(3,'0')+'°':'---°';
  set('navHeading',headingText);
  set('navHeadingCardinal',card);
  set('navAccuracy',trusted?`±${Math.round(currentAccuracy)} m`:'NO LIVE FIX');
  set('navCompassSource',source);
  set('navPositionSource',trusted?(currentNavPosition.source||'LIVE POSITION'):'AWAITING LIVE POSITION');
  set('navStripPos',trusted?`${currentNavPosition.lat.toFixed(4)}, ${currentNavPosition.lon.toFixed(4)}`:'AWAITING FIX');
  set('navStripAcc',trusted?`±${Math.round(currentAccuracy)}m`:'—');
  set('navStripSpeed',Number.isFinite(speed)?`${speed.toFixed(1)} mph`:'—');
  set('navStripHeading',Number.isFinite(heading)?`${headingText} ${card}`:'—');
  set('navStripRoute',routePoints.length>=2?`${routeMiles().toFixed(1)} mi`:'NONE');
  set('navStripTrack',recordedTrack.length?`${recordedTrack.length} pts`:'IDLE');
  set('navCourseQuality',source);
  set('navHeadingMode',Number.isFinite(deviceHeading)?(fieldDeviceHeadingSource.includes('MAG')?'MAG':'DEVICE'):Number.isFinite(courseHeading)?'GNSS':'—');

  for(const id of ['navCompassRotor','homeCompassRotor']){
    const rotor=document.getElementById(id);
    if(rotor){
      const angle=Number.isFinite(heading)?heading:0;
      rotor.removeAttribute('transform');
      rotor.style.setProperty('--compass-heading',`${angle}deg`);
      rotor.classList.toggle('no-course',!Number.isFinite(heading));
    }
  }
  set('homeHeading',headingText);
  set('homeHeadingCardinal',card);
  set('homeCompassSource',source);
}
function applyFieldGeolocation(p,source='PHONE GNSS'){
  currentNavPosition={lat:p.coords.latitude,lon:p.coords.longitude,alt:p.coords.altitude??demo.alt,source};
  window.FIELD_CURRENT_POSITION={...currentNavPosition,accuracy:p.coords.accuracy??null,heading:p.coords.heading??null};
  try{localStorage.setItem('fieldos-v12-last-position',JSON.stringify(window.FIELD_CURRENT_POSITION))}catch{}
  document.dispatchEvent(new CustomEvent('fieldos:positionchange',{detail:{...window.FIELD_CURRENT_POSITION}}));
  currentAccuracy=Number.isFinite(p.coords.accuracy)?p.coords.accuracy:currentAccuracy;
  fieldLiveSpeed=Number.isFinite(p.coords.speed)?p.coords.speed*2.236936:null;
  fieldLiveHeading=Number.isFinite(p.coords.heading)?p.coords.heading:null;
  fixAge=0;
  updatePositionDisplays();
  updateReturnGuidance();
  updateWaypointNav();
  updateLiveNavigationUI();
  updateFieldMaps(true);
}
function requestFieldLiveLocation({quiet=false}={}){
  if(!navigator.geolocation){if(!quiet)alert('Phone geolocation is not available in this browser.');return;}
  navigator.geolocation.getCurrentPosition(
    p=>{applyFieldGeolocation(p,'PHONE GNSS');addLog(`PHONE POSITION ACQUIRED — ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)}.`,'NAV');},
    err=>{updateLiveNavigationUI();updateFieldMaps(false);if(!quiet)alert(`Location unavailable: ${err.message}`);},
    {enableHighAccuracy:true,timeout:12000,maximumAge:3000}
  );
}
window.addEventListener('online',()=>updateFieldMaps(false));
window.addEventListener('offline',()=>updateFieldMaps(false));
document.addEventListener('click',e=>{
  if(window.FIELD_MAP_ENGINE_EXTERNAL){
    if(e.target.closest('[data-open="map"],[data-open="home"]'))setTimeout(()=>{window.FIELD_MAP_ENGINE?.refresh?.(false);updateLiveNavigationUI();},30);
    return;
  }
  const opensMap=e.target.closest('[data-open="map"]');
  if(opensMap&&!hasTrustedMapPosition()&&!fieldLocationPrompted){
    fieldLocationPrompted=true;
    requestFieldLiveLocation({quiet:true});
  }
  if(e.target.closest('[data-open="map"],[data-open="home"]'))setTimeout(()=>{updateFieldMaps(false);updateLiveNavigationUI();},30);
});

// Patch existing state updates so overlays remain synchronized.
const fieldOriginalUpdatePositionDisplays=updatePositionDisplays;
updatePositionDisplays=function(){fieldOriginalUpdatePositionDisplays();updateFieldMaps(false);};
const fieldOriginalDrawRoute=drawRoute;
drawRoute=function(){fieldOriginalDrawRoute();updateFieldMaps(false);};
const fieldOriginalRenderWaypoints=renderWaypoints;
renderWaypoints=function(){fieldOriginalRenderWaypoints();updateFieldMaps(false);};
const fieldOriginalUpdateTrackUI=updateTrackUI;
updateTrackUI=function(){fieldOriginalUpdateTrackUI();updateFieldMaps(false);};

refreshFieldMapPackUI().then(()=>{paintMapSourceButtons();return updateFieldMaps(false)}).catch(()=>{});

setTimeout(()=>{updateLiveNavigationUI();updateFieldMaps(false);},80);


/* v2.3 native online map engine
   Normal topo/street/hiking maps no longer depend on Leaflet or a map-library CDN.
   The existing Leaflet/PMTiles path is retained only for saved offline PMTiles packs. */
const fieldLegacyUpdateFieldMaps=updateFieldMaps;
const fieldLegacyRunMapControl=runMapControl;
const fieldNativeMaps=new Map();

function fieldClampMapLat(lat){return Math.max(-85.05112878,Math.min(85.05112878,Number(lat)||0))}
function fieldWorldPoint(lat,lon,z){
  const size=256*Math.pow(2,z),clat=fieldClampMapLat(lat),sin=Math.sin(clat*Math.PI/180);
  return {x:(Number(lon)+180)/360*size,y:(.5-Math.log((1+sin)/(1-sin))/(4*Math.PI))*size};
}
function fieldLatLonFromWorld(x,y,z){
  const size=256*Math.pow(2,z),lon=x/size*360-180,n=Math.PI-2*Math.PI*y/size;
  return {lat:180/Math.PI*Math.atan(Math.sinh(n)),lon};
}
function fieldNativeCenterCandidate(){
  if(hasTrustedMapPosition())return {lat:currentNavPosition.lat,lon:currentNavPosition.lon};
  const rp=routePoints.find(validLatLon);if(rp)return {lat:rp.lat,lon:rp.lon};
  const wp=waypoints.find(validLatLon);if(wp)return {lat:wp.lat,lon:wp.lon};
  return {lat:currentNavPosition.lat,lon:currentNavPosition.lon};
}
function fieldNativeTileUrl(kind,z,x,y){
  const n=Math.pow(2,z),xx=((x%n)+n)%n;
  if(y<0||y>=n)return '';
  if(kind==='osm')return `https://tile.openstreetmap.org/${z}/${xx}/${y}.png`;
  const sub=['a','b','c'][Math.abs(x+y)%3];
  return `https://${sub}.tile.opentopomap.org/${z}/${xx}/${y}.png`;
}
function fieldNativeTrailUrl(z,x,y){
  const n=Math.pow(2,z),xx=((x%n)+n)%n;
  if(y<0||y>=n)return '';
  return `https://tile.waymarkedtrails.org/hiking/${z}/${xx}/${y}.png`;
}
function fieldNativeScreenPoint(st,lat,lon,w,h){
  const p=fieldWorldPoint(lat,lon,st.zoom),c=fieldWorldPoint(st.center.lat,st.center.lon,st.zoom);
  return {x:p.x-c.x+w/2,y:p.y-c.y+h/2};
}
function fieldNativeResetDrag(st){
  st.base.style.transform='';st.trails.style.transform='';st.overlay.style.transform='';
}
function fieldNativeDestroyAll(){
  for(const st of fieldNativeMaps.values()){
    st.active=false;
    st.el.removeEventListener('pointerdown',st.onDown);
    st.el.removeEventListener('pointermove',st.onMove);
    st.el.removeEventListener('pointerup',st.onUp);
    st.el.removeEventListener('pointercancel',st.onUp);
    st.el.removeEventListener('wheel',st.onWheel);
    st.el.removeEventListener('dblclick',st.onDbl);
    try{st.el.releasePointerCapture(st.drag?.id)}catch{}
    clearTimeout(st.zoomSettleTimer);
    st.el.innerHTML='';
  }
  fieldNativeMaps.clear();
}
function fieldLegacyDestroyAll(){
  for(const st of fieldMaps.values()){try{st.map.remove()}catch{}}
  fieldMaps.clear();
}
function fieldNativeEnsure(id,fallbackId,labelId){
  if(fieldNativeMaps.has(id))return fieldNativeMaps.get(id);
  const el=document.getElementById(id),fallback=document.getElementById(fallbackId),label=document.getElementById(labelId);
  if(!el)return null;
  el.innerHTML='<div class="native-map-base"></div><div class="native-map-trails"></div><svg class="native-map-overlay" xmlns="http://www.w3.org/2000/svg"></svg><div class="native-map-corner">FIELD/OS MAP</div><div class="native-map-attrib">© OpenStreetMap contributors · OpenTopoMap · Waymarked Trails</div><div class="native-map-diag">TILES 0 / ERR 0</div>';
  const st={
    id,el,fallback,label,
    base:el.querySelector('.native-map-base'),
    trails:el.querySelector('.native-map-trails'),
    overlay:el.querySelector('.native-map-overlay'),
    center:fieldNativeCenterCandidate(),zoom:14,active:true,initialized:false,drag:null,tileErrors:0,tileLoads:0,failover:false,renderToken:0
  };
  st.onDown=e=>{
    if(!st.active||e.button>0)return;
    e.preventDefault();st.drag={id:e.pointerId,x:e.clientX,y:e.clientY,startCenter:{...st.center}};
    try{st.el.setPointerCapture(e.pointerId)}catch{}
    st.el.classList.add('native-map-dragging');
  };
  st.onMove=e=>{
    if(!st.active||!st.drag||e.pointerId!==st.drag.id)return;
    const dx=e.clientX-st.drag.x,dy=e.clientY-st.drag.y,t=`translate(${dx}px,${dy}px)`;
    st.base.style.transform=t;st.trails.style.transform=t;st.overlay.style.transform=t;
  };
  st.onUp=e=>{
    if(!st.active||!st.drag||e.pointerId!==st.drag.id)return;
    const dx=e.clientX-st.drag.x,dy=e.clientY-st.drag.y,c=fieldWorldPoint(st.drag.startCenter.lat,st.drag.startCenter.lon,st.zoom);
    st.center=fieldLatLonFromWorld(c.x-dx,c.y-dy,st.zoom);
    st.drag=null;st.el.classList.remove('native-map-dragging');fieldNativeResetDrag(st);fieldNativeRender(st);
  };
  st.onWheel=e=>{
    if(!st.active)return;
    e.preventDefault();
    const max=fieldMapMode==='osm'?19:17;
    if(!Number.isFinite(st.renderedZoom))st.renderedZoom=Math.round(st.zoom);
    const dy=Math.max(-120,Math.min(120,e.deltaY));
    st.zoom=Math.max(2,Math.min(max,st.zoom-dy/520));
    const scale=Math.pow(2,st.zoom-st.renderedZoom),ox=Math.max(0,Math.min(st.el.clientWidth,e.offsetX)),oy=Math.max(0,Math.min(st.el.clientHeight,e.offsetY));
    const origin=ox+'px '+oy+'px';
    st.base.style.transformOrigin=origin;st.trails.style.transformOrigin=origin;st.overlay.style.transformOrigin=origin;
    const visual='scale('+scale.toFixed(5)+')';st.base.style.transform=visual;st.trails.style.transform=visual;st.overlay.style.transform=visual;
    clearTimeout(st.zoomSettleTimer);
    st.zoomSettleTimer=setTimeout(()=>{if(!st.active)return;st.zoom=Math.max(2,Math.min(max,Math.round(st.zoom)));st.renderedZoom=st.zoom;fieldNativeResetDrag(st);fieldNativeRender(st);},110);
  };
  st.onDbl=e=>{if(!st.active)return;e.preventDefault();const max=fieldMapMode==='osm'?19:17;st.zoom=Math.min(max,st.zoom+1);fieldNativeRender(st);};
  el.addEventListener('pointerdown',st.onDown);
  el.addEventListener('pointermove',st.onMove);
  el.addEventListener('pointerup',st.onUp);
  el.addEventListener('pointercancel',st.onUp);
  el.addEventListener('wheel',st.onWheel,{passive:false});
  el.addEventListener('dblclick',st.onDbl);
  fieldNativeMaps.set(id,st);
  return st;
}
function fieldNativeSvgCircle(cx,cy,r,cls){
  return `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" class="${cls}"/>`;
}
function fieldNativeRenderOverlay(st,w,h){
  const svg=st.overlay,items=[];
  const route=routePoints.filter(validLatLon);
  if(route.length>=2){
    const pts=route.map(p=>fieldNativeScreenPoint(st,p.lat,p.lon,w,h)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    items.push(`<polyline points="${pts}" class="native-route-line"/>`);
  }
  const step=Math.max(1,Math.ceil(recordedTrack.length/1500)),track=recordedTrack.filter((_,i)=>i%step===0).filter(validLatLon);
  if(track.length>=2){
    const pts=track.map(p=>fieldNativeScreenPoint(st,p.lat,p.lon,w,h)).map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
    items.push(`<polyline points="${pts}" class="native-track-line"/>`);
  }
  if(hasTrustedMapPosition()){
    const p=fieldNativeScreenPoint(st,currentNavPosition.lat,currentNavPosition.lon,w,h);
    const acc=Math.max(4,Math.min(80,(Number(currentAccuracy)||4)/Math.max(1,156543.03*Math.cos(currentNavPosition.lat*Math.PI/180)/Math.pow(2,st.zoom))));
    items.push(fieldNativeSvgCircle(p.x,p.y,acc,'native-accuracy-ring'));
    items.push(fieldNativeSvgCircle(p.x,p.y,7,'native-self-marker'));
    items.push(`<path d="M ${p.x.toFixed(1)} ${(p.y-13).toFixed(1)} l -5 9 h 10 z" class="native-self-arrow"/>`);
  }
  waypoints.filter(validLatLon).slice(0,200).forEach(wp=>{
    const p=fieldNativeScreenPoint(st,wp.lat,wp.lon,w,h),isBase=wp.type==='BASE',label=escapeHTML(String(wp.name||wp.type||'WP').slice(0,18));
    if(p.x<-50||p.x>w+50||p.y<-50||p.y>h+50)return;
    items.push(fieldNativeSvgCircle(p.x,p.y,isBase?6:4,isBase?'native-base-marker':'native-waypoint-marker'));
    items.push(`<text x="${(p.x+8).toFixed(1)}" y="${(p.y-7).toFixed(1)}" class="native-waypoint-label">${label}</text>`);
  });
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
  svg.innerHTML=items.join('');
}
function fieldNativeRender(st){
  if(!st||!st.active)return;
  const token=++st.renderToken;
  const w=Math.max(220,st.el.clientWidth||st.el.getBoundingClientRect().width||600),h=Math.max(200,st.el.clientHeight||st.el.getBoundingClientRect().height||360);
  const kind=fieldMapMode==='osm'?'osm':'topo',max=kind==='osm'?19:17;
  st.zoom=Math.max(2,Math.min(max,Math.round(st.zoom)));st.renderedZoom=st.zoom;
  const c=fieldWorldPoint(st.center.lat,st.center.lon,st.zoom),minX=Math.floor((c.x-w/2)/256)-1,maxX=Math.floor((c.x+w/2)/256)+1,minY=Math.floor((c.y-h/2)/256)-1,maxY=Math.floor((c.y+h/2)/256)+1;
  const baseFrag=document.createDocumentFragment(),trailFrag=document.createDocumentFragment();
  st.tileErrors=0;st.tileLoads=0;
  const diag=st.el.querySelector('.native-map-diag');
  const paintDiag=()=>{if(diag&&token===st.renderToken)diag.textContent=`TILES ${st.tileLoads} / ERR ${st.tileErrors}`;};
  const onLoad=()=>{if(token!==st.renderToken)return;st.tileLoads++;paintDiag();};
  const onError=()=>{if(token!==st.renderToken)return;st.tileErrors++;paintDiag();};
  for(let ty=minY;ty<=maxY;ty++)for(let tx=minX;tx<=maxX;tx++){
    const left=tx*256-c.x+w/2,top=ty*256-c.y+h/2;
    const osmSrc=fieldNativeTileUrl('osm',st.zoom,tx,ty);
    if(osmSrc){
      const oi=new Image();
      oi.className='native-map-tile native-osm-base';oi.alt='';oi.draggable=false;oi.referrerPolicy='strict-origin-when-cross-origin';
      oi.style.left=`${left}px`;oi.style.top=`${top}px`;oi.onload=onLoad;oi.onerror=onError;oi.src=osmSrc;
      baseFrag.appendChild(oi);
    }
    if(kind==='topo'){
      const topoSrc=fieldNativeTileUrl('topo',st.zoom,tx,ty);
      if(topoSrc){
        const ti=new Image();
        ti.className='native-map-tile native-topo-tile';ti.alt='';ti.draggable=false;ti.referrerPolicy='strict-origin-when-cross-origin';
        ti.style.left=`${left}px`;ti.style.top=`${top}px`;ti.onload=onLoad;ti.onerror=onError;ti.src=topoSrc;
        baseFrag.appendChild(ti);
      }
    }
    if(fieldTrailLayerEnabled&&st.zoom<=18){
      const trailSrc=fieldNativeTrailUrl(st.zoom,tx,ty);
      if(trailSrc){
        const hi=new Image();hi.className='native-map-tile native-trail-tile';hi.alt='';hi.draggable=false;hi.referrerPolicy='strict-origin-when-cross-origin';
        hi.style.left=`${left}px`;hi.style.top=`${top}px`;hi.onload=onLoad;hi.onerror=onError;hi.src=trailSrc;trailFrag.appendChild(hi);
      }
    }
  }
  st.base.replaceChildren(baseFrag);st.trails.replaceChildren(trailFrag);
  fieldNativeRenderOverlay(st,w,h);
  st.initialized=true;
  paintDiag();
  const corner=st.el.querySelector('.native-map-corner');if(corner)corner.textContent=`${kind==='topo'?'TOPO + OSM':'OSM'} Z${st.zoom} ${fieldTrailLayerEnabled?'// HIKING':''}`;

  // If nothing loads at all, turn the blank panel into a clear failure message.
  setTimeout(()=>{
    if(token!==st.renderToken||!st.active||st.el.hidden)return;
    if(st.tileLoads===0){
      fieldNativeShowEmbedFallback(st,'Direct map tiles did not load. Using OpenStreetMap embedded fallback.');
      const d=document.getElementById('mapSourceDiag');if(d)d.textContent='0 MAP TILES LOADED';
    }else{
      const d=document.getElementById('mapSourceDiag');if(d)d.textContent=`${kind==='topo'?'TOPO/OSM':'OSM'} — ${st.tileLoads} TILES`;
    }
  },3500);
}
function fieldOsmEmbedUrl(st){
  const w=Math.max(320,st.el.clientWidth||600),h=Math.max(220,st.el.clientHeight||360),c=fieldWorldPoint(st.center.lat,st.center.lon,st.zoom);
  const nw=fieldLatLonFromWorld(c.x-w/2,c.y-h/2,st.zoom),se=fieldLatLonFromWorld(c.x+w/2,c.y+h/2,st.zoom);
  const bbox=[nw.lon,se.lat,se.lon,nw.lat].map(v=>Number(v).toFixed(6)).join(',');
  const marker=hasTrustedMapPosition()?'&marker='+currentNavPosition.lat.toFixed(6)+','+currentNavPosition.lon.toFixed(6):'';
  return 'https://www.openstreetmap.org/export/embed.html?bbox='+encodeURIComponent(bbox)+'&layer=mapnik'+marker;
}
function fieldNativeShowEmbedFallback(st,msg){
  if(!st||!navigator.onLine)return fieldNativeShowFallback(st,msg);
  st.el.hidden=true;
  if(st.fallback){
    st.fallback.hidden=false;
    st.fallback.innerHTML='<div class="field-embed-head"><b>OSM EMBED FALLBACK</b><span>'+escapeHTML(msg)+'</span></div><iframe class="field-map-embed" title="OpenStreetMap fallback" src="'+fieldOsmEmbedUrl(st)+'" loading="eager" referrerpolicy="strict-origin-when-cross-origin"></iframe>';
  }
  if(st.label)st.label.textContent='OSM EMBED FALLBACK';
}
function fieldNativeShowFallback(st,msg){
  if(!st)return;st.el.hidden=true;
  if(st.fallback){
    st.fallback.hidden=false;
    st.fallback.innerHTML='<b>LIVE MAP UNAVAILABLE</b><span>'+escapeHTML(msg)+'</span>';
  }
  if(st.label)st.label.textContent='MAP UNAVAILABLE';
}
function fieldNativeShow(st,label){
  st.el.hidden=false;if(st.fallback)st.fallback.hidden=true;if(st.label)st.label.textContent=label;
}
updateFieldMaps=async function(recenter=false){
  if(window.FIELD_MAP_ENGINE_EXTERNAL)return window.FIELD_MAP_ENGINE?.refresh?.(recenter);
  const pack=await resolveActiveFieldPack();
  const useOffline=(fieldMapMode==='offline'||navigator.onLine===false)&&!!pack;
  if(useOffline){
    fieldNativeDestroyAll();
    return fieldLegacyUpdateFieldMaps(recenter);
  }
  if(navigator.onLine===false&&!pack){
    fieldLegacyDestroyAll();
    const specs=[['homeRealMap','homeMapFallback','homeMapModeLabel'],['realMap','mapFallback','mapModeLabel']];
    for(const [id,f,l] of specs){
      const st=fieldNativeEnsure(id,f,l);if(st)fieldNativeShowFallback(st,'NO NETWORK AND NO OFFLINE MAP PACK');
    }
    const d=document.getElementById('mapSourceDiag');if(d)d.textContent='NO NETWORK / NO OFFLINE PACK';
    return;
  }
  fieldLegacyDestroyAll();
  const target=fieldNativeCenterCandidate(),trusted=hasTrustedMapPosition(),kind=fieldMapMode==='osm'?'STREET OSM':'HIKING TOPO';
  const specs=[['homeRealMap','homeMapFallback','homeMapModeLabel'],['realMap','mapFallback','mapModeLabel']];
  for(const [id,f,l] of specs){
    const st=fieldNativeEnsure(id,f,l);if(!st)continue;
    st.active=true;
    if(recenter||!st.initialized)st.center={...target};
    fieldNativeShow(st,`${kind} / ${trusted?'GNSS':'AWAITING FIX'}`);
    fieldNativeRender(st);
  }
  const d=document.getElementById('mapSourceDiag');if(d)d.textContent=`${kind} READY`;
  const src=document.getElementById('offlineMapSource');if(src)src.textContent=kind;
};
toggleHikingRoutes=async function(){
  fieldTrailLayerEnabled=!fieldTrailLayerEnabled;
  storageSet(STORE_PREFIX+'hiking-routes',fieldTrailLayerEnabled?'on':'off');
  paintMapSourceButtons();
  await updateFieldMaps(false);
};
runMapControl=async function(action,target='realMap'){
  if(window.FIELD_MAP_ENGINE_EXTERNAL)return;
  const diag=document.getElementById('mapSourceDiag');
  try{
    if(action==='topo')return useTopoFieldMap();
    if(action==='osm')return useOnlineFieldMap();
    if(action==='trails')return toggleHikingRoutes();
    if(action==='location')return requestFieldLiveLocation();
    const pack=await resolveActiveFieldPack(),useOffline=(fieldMapMode==='offline'||navigator.onLine===false)&&!!pack;
    if(useOffline)return fieldLegacyRunMapControl(action,target);
    await updateFieldMaps(action==='center');
    const st=fieldNativeMaps.get(target)||fieldNativeMaps.get('realMap');if(!st||st.el.hidden)return;
    if(action==='zoom-in'){const max=fieldMapMode==='osm'?19:17;st.zoom=Math.min(max,st.zoom+1);fieldNativeRender(st);}
    else if(action==='zoom-out'){st.zoom=Math.max(2,st.zoom-1);fieldNativeRender(st);}
    else if(action==='center'){st.center=fieldNativeCenterCandidate();fieldNativeRender(st);}
  }catch(err){
    console.warn('FIELD/OS native map control failed',action,err);
    if(diag)diag.textContent=`MAP CONTROL ERROR: ${String(err?.message||err).slice(0,42)}`;
  }
};
window.addEventListener('resize',()=>{for(const st of fieldNativeMaps.values())if(st.active&&!st.el.hidden)fieldNativeRender(st)},{passive:true});
setTimeout(()=>updateFieldMaps(false),120);

if(routePlan.elevationProfile?.length){document.getElementById('routeLossOut').textContent=`${Math.round(routePlan.elevationLossFt)} ft`;document.getElementById('routeElevRange').textContent=`${Math.round(routePlan.elevationMinFt)}–${Math.round(routePlan.elevationMaxFt)} ft`;}

document.getElementById('saveRouteVisible')?.addEventListener('click',e=>{if(e.currentTarget?.dataset.nativeSave==='1')return;document.getElementById('routeSaveTop')?.click()});
