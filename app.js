const views = [...document.querySelectorAll('.view')];
const tabButtons = [...document.querySelectorAll('.tab-btn[data-tab-for]')];
const moreTabs = document.getElementById('moreTabs');
const tabSheet = document.getElementById('tabSheet');
const tabSheetBackdrop = document.getElementById('tabSheetBackdrop');
const moreViewNames = new Set(['route','trailreturn','waypoints','track','trip','survival','sensors','log','power','system','sos']);
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
function openView(name){
  const target=views.find(v=>v.dataset.view===name);
  if(!target)return;
  views.forEach(v => v.classList.toggle('active', v === target));
  tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tabFor === name));
  moreTabs?.classList.toggle('active', moreViewNames.has(name));
  closeTabSheet();
  document.getElementById('screen')?.focus({preventScroll:true});
  window.scrollTo({top:0, behavior:'auto'});
}

document.addEventListener('click', (e) => {
  const trigger = e.target.closest('[data-open]');
  if(trigger) openView(trigger.dataset.open);
  const theme = e.target.closest('[data-theme-choice]');
  if(theme){
    document.body.dataset.theme = theme.dataset.themeChoice;
    storageSet(STORE_PREFIX+'theme', theme.dataset.themeChoice);
  }
});

moreTabs?.addEventListener('click',()=>toggleTabSheet());
document.getElementById('closeTabSheet')?.addEventListener('click',()=>closeTabSheet());
tabSheetBackdrop?.addEventListener('click',()=>closeTabSheet());
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeTabSheet()});

const savedTheme = storageGet(STORE_PREFIX+'theme') || storageGet('fieldos-theme');
if(savedTheme) document.body.dataset.theme = savedTheme;

function updateClock(){
  const now = new Date();
  document.getElementById('clock').textContent = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit', second:'2-digit'});
  document.getElementById('date').textContent = now.toLocaleDateString([], {year:'numeric', month:'2-digit', day:'2-digit'});
}
updateClock(); setInterval(updateClock,1000);

let demo = {alt:3420, heading:37, speed:2.4, temp:31, press:898, hum:64, sats:18, mesh:7};
const pressureHistory = Array.from({length:36},(_,i)=>899.4 - i*0.035 + Math.sin(i/4)*0.18);
function headingCardinal(deg){
  const dirs = ['N','NE','E','SE','S','SW','W','NW'];
  return dirs[Math.round(deg / 45) % 8];
}
setInterval(()=>{
  demo.heading = (demo.heading + (Math.random() > .5 ? 1 : -1) + 360) % 360;
  demo.alt += Math.random() > .5 ? 1 : -1;
  demo.press += Math.random() > .58 ? 0.1 : -0.1;
  pressureHistory.push(demo.press); if(pressureHistory.length>36) pressureHistory.shift();
  document.getElementById('heading').textContent = `${String(Math.round(demo.heading)).padStart(3,'0')}° ${headingCardinal(demo.heading)}`;
  document.getElementById('altitude').textContent = `${demo.alt} ft`;
  document.getElementById('pressure').textContent = `${demo.press.toFixed(1)} hPa`;
  const needle = document.querySelector('.needle');
  if(needle) needle.style.transform = `translate(-50%,-100%) rotate(${demo.heading}deg)`;
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
function updateSolar(){
  const p=solarPosition(new Date(),currentNavPosition.lat,currentNavPosition.lon);
  const az=document.getElementById('sunAz'), el=document.getElementById('sunEl');
  if(az) az.textContent=`${p.az.toFixed(1)}°`;
  if(el) el.textContent=`${p.el.toFixed(1)}°`;
}
updateSolar(); setInterval(updateSolar,60000);

const sendDemo=document.getElementById('sendDemo');
sendDemo?.addEventListener('click', ()=>{
  const box=document.getElementById('messageInput');
  if(!box.value.trim()) return;
  alert(`DEMO ONLY — would transmit: ${box.value.trim()}`); box.value='';
});

let sosTimer;
const sos=document.getElementById('meshSos');
function startSos(){
  sos.textContent='HOLD...';
  sosTimer=setTimeout(()=>{sos.textContent='MESH SOS ARMED — DEMO'; navigator.vibrate?.([120,80,120]);},1600);
}
function cancelSos(){clearTimeout(sosTimer); if(sos?.textContent==='HOLD...') sos.textContent='HOLD TO ARM MESH SOS';}
sos?.addEventListener('pointerdown',startSos); sos?.addEventListener('pointerup',cancelSos); sos?.addEventListener('pointerleave',cancelSos);

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
function showGuide(id){
  const g=guides.find(x=>x.id===id); if(!g||!guideDetail) return;
  guideDetail.innerHTML=`<div class="panel-title"><span>${g.title}</span><span class="tiny">${g.category.toUpperCase()} / ${g.urgency}</span></div><p>${g.summary}</p><ol class="guide-steps">${g.steps.map(x=>`<li>${x}</li>`).join('')}</ol><div class="guide-source"><b>SOURCE:</b> ${g.source}<br><span class="source-link">${g.url}</span><br><br>Offline quick reference only. For medical emergencies, use trained first aid and professional emergency services when available.</div>`;
  guideDetail.scrollIntoView({behavior:'smooth',block:'start'});
}
document.addEventListener('click',e=>{
  const f=e.target.closest('[data-guide-filter]'); if(f){activeCategory=f.dataset.guideFilter;renderFilters();renderGuides();}
  const g=e.target.closest('[data-guide]'); if(g) showGuide(g.dataset.guide);
});
guideSearch?.addEventListener('input',renderGuides); renderFilters(); renderGuides();

// Trip plan and essentials
const essentials=['Navigation','Headlamp / illumination','Sun protection','Insulation / extra clothing','First aid','Fire / ignition','Repair kit / tools','Extra food','Extra water + treatment','Emergency shelter'];
function loadJSON(key,fallback){try{return JSON.parse(storageGet(STORE_PREFIX+key))??fallback}catch{return fallback}}
function saveJSON(key,val){return storageSet(STORE_PREFIX+key,JSON.stringify(val))}
function validLatLon(p){const lat=Number(p?.lat),lon=Number(p?.lon);return Number.isFinite(lat)&&Number.isFinite(lon)&&lat>=-90&&lat<=90&&lon>=-180&&lon<=180}
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
document.getElementById('checkinNow')?.addEventListener('click',()=>{addLog(`CHECK-IN — position ${currentNavPosition.lat.toFixed(4)}, ${currentNavPosition.lon.toFixed(4)}; source ${currentNavPosition.source||'POSITION'}; battery demo 64%; status OK.`,'CHECK-IN');alert('Local check-in recorded. Live mesh transmission will be added when TAP integration is connected.')});

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

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}))}

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
const defaultRoute=[
  {x:.31,y:.75,lat:44.4559,lon:-73.2328},
  {x:.40,y:.64,lat:44.4647,lon:-73.2229},
  {x:.48,y:.56,lat:44.4711,lon:-73.2143},
  {x:.58,y:.43,lat:44.4815,lon:-73.2033},
  {x:.70,y:.30,lat:44.4919,lon:-73.1901}
];
let routePlan=loadJSON('routePlan',null);
if(!routePlan||typeof routePlan!=='object'||Array.isArray(routePlan)) routePlan={name:'FIELD ROUTE 01',points:defaultRoute,gain:1200,grade:12,terrain:'maintained',notes:''};
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
}
function routeTerrainFactor(t){return ({maintained:1,rough:1.2,offtrail:1.45,scramble:1.7})[t]||1}
function updateRouteMetrics(){
  const dist=routeMiles(),gain=Math.max(0,Number(document.getElementById('routeGain')?.value??routePlan.gain??0)),grade=Math.max(0,Number(document.getElementById('routeGrade')?.value??routePlan.grade??0)),terrain=document.getElementById('routeTerrain')?.value||routePlan.terrain||'maintained';
  const score=dist*.7+(gain/1000)*1.3+grade*.08+({maintained:0,rough:1.2,offtrail:2.4,scramble:4})[terrain];
  let label='EASY',cls='easy';if(score>=4){label='MODERATE';cls='moderate'}if(score>=7.5){label='HARD';cls='hard'}if(score>=12){label='VERY HARD';cls='very-hard'}
  const hours=(dist/3 + gain/2000)*routeTerrainFactor(terrain);const totalMinutes=Math.max(0,Math.round(hours*60)),hr=Math.floor(totalMinutes/60),min=totalMinutes%60;
  const set=(id,val)=>{const e=document.getElementById(id);if(e)e.textContent=val};
  set('routeDistance',`${dist.toFixed(2)} mi`);set('routeGainOut',`${Math.round(gain)} ft`);set('routeTime',hours?`${hr}h ${String(min).padStart(2,'0')}m`:'---');set('routePointCount',routePoints.length);
  const badge=document.getElementById('routeDifficulty');if(badge){badge.textContent=label;badge.className=`route-grade-badge ${cls}`}
  updateOfflineEstimate(); drawRouteProfile(dist,gain,terrain); return {dist,gain,grade,terrain,label,hours};
}
function drawRouteProfile(dist,gain,terrain){const c=document.getElementById('routeProfile');if(!c)return;const ctx=c.getContext('2d'),w=c.width,h=c.height,st=getComputedStyle(document.body),fg=st.getPropertyValue('--fg2').trim()||'#6fcf82',line=st.getPropertyValue('--line').trim()||'#2d6940',warn=st.getPropertyValue('--warn').trim()||'#ffd166';ctx.clearRect(0,0,w,h);ctx.strokeStyle=line;ctx.lineWidth=1;for(let i=1;i<4;i++){ctx.beginPath();ctx.moveTo(0,h*i/4);ctx.lineTo(w,h*i/4);ctx.stroke()}const rough=terrain==='maintained'?.18:terrain==='rough'?.27:.34;ctx.strokeStyle=warn;ctx.lineWidth=4;ctx.beginPath();for(let i=0;i<60;i++){const x=i/59*w,base=.75-(i/59)*.48,und=Math.sin(i*.46)*rough*.16+Math.sin(i*.15)*rough*.13,y=clamp((base+und)*h,12,h-12);i?ctx.lineTo(x,y):ctx.moveTo(x,y)}ctx.stroke();ctx.fillStyle=fg;ctx.font='21px monospace';ctx.fillText(`${dist.toFixed(2)} mi // +${Math.round(gain)} ft`,14,28)}
function updateOfflineEstimate(){const dist=routeMiles(),r=Number(document.getElementById('corridorRadius')?.value||1),detail=document.getElementById('offlineDetail')?.value||'medium',area=dist>0?dist*2*r+Math.PI*r*r:0,rate=({low:5,medium:20,high:75})[detail],mb=area*rate;const a=document.getElementById('corridorArea'),e=document.getElementById('offlineEstimate');if(a)a.textContent=area?`~${area.toFixed(1)} sq mi`:'---';if(e)e.textContent=area?(mb>1024?`~${(mb/1024).toFixed(1)} GB`:`~${Math.round(mb)} MB`):'---'}
function saveRoutePlan(){const metrics=updateRouteMetrics();routePlan={name:document.getElementById('routeName')?.value.trim()||'FIELD ROUTE',points:routePoints,gain:metrics.gain,grade:metrics.grade,terrain:metrics.terrain,notes:document.getElementById('routeNotes')?.value||'',savedAt:new Date().toISOString()};saveJSON('routePlan',routePlan);updateReturnGuidance();navigator.vibrate?.(25);addLog(`ROUTE SAVED — ${routePlan.name}; ${metrics.dist.toFixed(2)} mi; +${Math.round(metrics.gain)} ft; ${metrics.label}.`,'ROUTE')}
function loadRouteFields(){if(document.getElementById('routeName'))document.getElementById('routeName').value=routePlan.name||'FIELD ROUTE 01';if(document.getElementById('routeGain'))document.getElementById('routeGain').value=routePlan.gain??1200;if(document.getElementById('routeGrade'))document.getElementById('routeGrade').value=routePlan.grade??12;if(document.getElementById('routeTerrain'))document.getElementById('routeTerrain').value=routePlan.terrain||'maintained';if(document.getElementById('routeNotes'))document.getElementById('routeNotes').value=routePlan.notes||''}
routeMap?.addEventListener('click',e=>{if(e.target.closest('button,input,select,label,textarea,.route-point'))return;if(routePoints.length>=1000)return alert('Route point limit reached (1000). Simplify or save this route before adding more.');const r=routeMap.getBoundingClientRect(),x=clamp((e.clientX-r.left)/r.width,0,1),y=clamp((e.clientY-r.top)/r.height,0,1),ll=mapXYToLatLon(x,y);routePoints.push({x,y,...ll});drawRoute();navigator.vibrate?.(18)});
document.getElementById('undoRoutePoint')?.addEventListener('click',()=>{routePoints.pop();drawRoute()});
document.getElementById('reverseRoute')?.addEventListener('click',()=>{routePoints.reverse();drawRoute();addLog('ROUTE REVERSED — start/end swapped.','ROUTE')});
document.getElementById('clearRoute')?.addEventListener('click',()=>{if(confirm('Clear the plotted route?')){routePoints=[];drawRoute()}});
['routeGain','routeGrade','routeTerrain','corridorRadius','offlineDetail'].forEach(id=>document.getElementById(id)?.addEventListener('input',updateRouteMetrics));
document.getElementById('routeSaveTop')?.addEventListener('click',()=>{saveRoutePlan();alert('Route saved locally for offline use.')});
function routeAsGPX(){const name=escapeHTML(document.getElementById('routeName')?.value||routePlan.name||'FIELD ROUTE');return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="FIELD/OS v2.0" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>${name}</name><trkseg>${routePoints.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}"></trkpt>`).join('')}</trkseg></trk></gpx>`}
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
    pts=[...xml.querySelectorAll('trkpt,rtept')].map(n=>({lat:Number(n.getAttribute('lat')),lon:Number(n.getAttribute('lon'))})).filter(p=>validLatLon(p));
  }catch(err){ return alert(`Could not parse GPX: ${err.message}`); }
  if(pts.length<2) return alert('No usable GPX track/route points found.');
  // Keep the UI responsive on very dense tracks while retaining endpoints.
  if(pts.length>500){const step=(pts.length-1)/499;pts=Array.from({length:500},(_,i)=>pts[Math.round(i*step)]);}
  const minLat=Math.min(...pts.map(p=>p.lat)),maxLat=Math.max(...pts.map(p=>p.lat)),minLon=Math.min(...pts.map(p=>p.lon)),maxLon=Math.max(...pts.map(p=>p.lon)),latRange=Math.max(maxLat-minLat,.0001),lonRange=Math.max(maxLon-minLon,.0001);
  routePoints=pts.map(p=>({...p,x:.08+.84*(p.lon-minLon)/lonRange,y:.08+.84*(maxLat-p.lat)/latRange}));
  document.getElementById('routeName').value=f.name.replace(/\.gpx$/i,''); drawRoute(); addLog(`GPX IMPORT — ${f.name}; ${pts.length} plotted points.`,'ROUTE');
  e.target.value='';
});

function saveOfflineRoutePack(){if(routePoints.length<2)return alert('Plot or import a route first.');saveRoutePlan();const metrics=updateRouteMetrics(),radius=Number(document.getElementById('corridorRadius')?.value||1),detail=document.getElementById('offlineDetail')?.value||'medium',lats=routePoints.map(p=>p.lat),lons=routePoints.map(p=>p.lon),pack={version:'0.5.1',name:routePlan.name,created:new Date().toISOString(),route:routePoints.map(({lat,lon})=>({lat,lon})),corridorMiles:radius,detail,bounds:{north:Math.max(...lats),south:Math.min(...lats),east:Math.max(...lons),west:Math.min(...lons)},metrics};saveJSON('offlineRoutePack',pack);const st=document.getElementById('offlineStatus');if(st){st.textContent='ROUTE + CORRIDOR SAVED';st.className='route-pack-saved'};return pack}
document.getElementById('saveOfflinePack')?.addEventListener('click',()=>{saveOfflineRoutePack();alert('Route and corridor plan saved locally. Basemap tile caching will be connected to the production offline map source.')});
document.getElementById('exportRoutePack')?.addEventListener('click',()=>{const pack=saveOfflineRoutePack();if(!pack)return;const geo={type:'FeatureCollection',properties:{fieldOSPack:pack},features:[{type:'Feature',properties:{name:pack.name},geometry:{type:'LineString',coordinates:pack.route.map(p=>[p.lon,p.lat])}}]};downloadJSON('fieldos-route-pack.geojson',geo)});
function nearestPointOnRoute(pos){if(routePoints.length<2)return null;const lat0=pos.lat*Math.PI/180,MX=111320*Math.cos(lat0),MY=110540;let best=null;for(let i=0;i<routePoints.length-1;i++){const a=routePoints[i],b=routePoints[i+1],ax=(a.lon-pos.lon)*MX,ay=(a.lat-pos.lat)*MY,bx=(b.lon-pos.lon)*MX,by=(b.lat-pos.lat)*MY,dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy,t=den?clamp(-(ax*dx+ay*dy)/den,0,1):0,qx=ax+t*dx,qy=ay+t*dy,meters=Math.hypot(qx,qy),q={lat:pos.lat+qy/MY,lon:pos.lon+qx/MX};if(!best||meters<best.meters)best={meters,point:q,leg:i+1,t}}return best}
function updateReturnBase(){const base=routePoints[0];const d=document.getElementById('rtbDistance'),b=document.getElementById('rtbBearing'),tr=document.getElementById('rtbTrack'),alt=document.getElementById('rtbAlt');if(!base){if(d)d.textContent='NO ROUTE';if(b)b.textContent='---';if(tr)tr.textContent='NO ROUTE';return}const mi=haversineMiles(currentNavPosition,base),deg=bearingDeg(currentNavPosition,base);if(d)d.textContent=`${mi.toFixed(2)} mi`;if(b)b.textContent=`${deg.toFixed(0).padStart(3,'0')}° ${headingCardinal(deg)}`;if(tr)tr.textContent='ROUTE START';if(alt)alt.textContent='PROFILE N/A'}
function updateReturnGuidance(){const n=nearestPointOnRoute(currentNavPosition),name=document.getElementById('routeName')?.value||routePlan.name||'FIELD ROUTE';const ids=['rttDistance','rttBigDistance'];if(!n){ids.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='NO ROUTE'});['rttBearing','rttBigBearing','rttPoint','rttLeg'].forEach(id=>{const e=document.getElementById(id);if(e)e.textContent='---'});updateReturnBase();return}const mi=n.meters/1609.344,deg=bearingDeg(currentNavPosition,n.point),card=headingCardinal(deg);ids.forEach(id=>{const e=document.getElementById(id);if(e)e.textContent=mi<.1?`${Math.round(n.meters*3.28084)} ft`:`${mi.toFixed(2)} mi`});const rb=document.getElementById('rttBearing');if(rb)rb.textContent=`${deg.toFixed(0).padStart(3,'0')}° ${card}`;const rbb=document.getElementById('rttBigBearing');if(rbb)rbb.innerHTML=`${deg.toFixed(0).padStart(3,'0')}° <small>${card}</small>`;const rr=document.getElementById('rttRouteName');if(rr)rr.textContent=name;const rbr=document.getElementById('rttBigRoute');if(rbr)rbr.textContent=name;const rp=document.getElementById('rttPoint');if(rp)rp.textContent=`LEG ${n.leg}`;const rl=document.getElementById('rttLeg');if(rl)rl.textContent=`${n.leg} / ${Math.max(1,routePoints.length-1)}`;const arr=document.getElementById('returnArrow');if(arr)arr.style.transform=`rotate(${deg}deg)`;const ps=document.getElementById('rttPosSource');if(ps)ps.textContent=currentNavPosition.source||'POSITION';updateReturnBase();updateRouteMonitor()}
document.getElementById('usePhonePos')?.addEventListener('click',()=>requestFieldLiveLocation());
document.getElementById('followBreadcrumbs')?.addEventListener('click',()=>{addLog(`RETURN TO BASE STARTED — target ${routePlan.name||'route start'}.`,'NAV')});
document.getElementById('mapMarkBtn')?.addEventListener('click',()=>addLog(`MAP MARK — ${currentNavPosition.lat.toFixed(5)}, ${currentNavPosition.lon.toFixed(5)}.`,'POSITION'));
loadRouteFields();drawRoute();
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
function trackAsGPX(){return `<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="FIELD/OS v2.0" xmlns="http://www.topografix.com/GPX/1/1"><trk><name>FIELD OS TRACK</name><trkseg>${recordedTrack.map(p=>`<trkpt lat="${p.lat.toFixed(7)}" lon="${p.lon.toFixed(7)}">${p.alt!=null?`<ele>${p.alt}</ele>`:''}<time>${p.time}</time></trkpt>`).join('')}</trkseg></trk></gpx>`}
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
  const landscape=window.matchMedia('(orientation: landscape) and (max-height: 600px)').matches;
  if(!landscape){shell.style.transform='';shell.style.marginLeft='';vp.style.height='';return;}
  const baseW=1500, availW=Math.max(280,window.innerWidth-8);
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
  let prev=solarPosition(date,lat,lon).el;
  for(let min=1;min<=24*60;min+=2){const t=new Date(date.getTime()+min*60000),el=solarPosition(t,lat,lon).el;if(prev>-0.833&&el<=-0.833)return t;prev=el;}
  return null;
}
function updateHandheldStatus(){
  const fix=document.getElementById('mobileFixState'),age=document.getElementById('mobileFixAge');
  if(fix){fix.textContent=fixAge>180?'STALE':`3D / ±${Math.round(currentAccuracy)}m`;fix.closest('button')?.classList.toggle('status-stale',fixAge>180);}if(age)age.textContent=`AGE ${fmtAge(fixAge)}`;const ha=document.getElementById('homeAccuracy');if(ha)ha.textContent=`±${Math.round(currentAccuracy)} m`;
  const td=document.getElementById('rttDistance')?.textContent||document.getElementById('rttBigDistance')?.textContent||'---',tb=document.getElementById('rttBearing')?.textContent||'---';
  const bd=document.getElementById('rtbDistance')?.textContent||'---',bb=document.getElementById('rtbBearing')?.textContent||'---';
  const mtd=document.getElementById('mobileTrailDist'),mtb=document.getElementById('mobileTrailBrg'),mbd=document.getElementById('mobileBaseDist'),mbb=document.getElementById('mobileBaseBrg');
  if(mtd)mtd.textContent=td;if(mtb)mtb.textContent=tb;if(mbd)mbd.textContent=bd;if(mbb)mbb.textContent=bb;
  const now=new Date(),set=nextSunset(now,currentNavPosition.lat,currentNavPosition.lon),day=document.getElementById('mobileDaylight'),sun=document.getElementById('mobileSunState');
  if(set&&day){const sec=Math.max(0,(set-now)/1000);day.textContent=`${Math.floor(sec/3600)}h ${String(Math.floor((sec%3600)/60)).padStart(2,'0')}m`;if(sun)sun.textContent=`SUNSET ${set.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;}
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


// v2.0 — interactive hiking topo map + repaired live navigation
let fieldLiveSpeed=null;
let fieldLiveHeading=null;
let fieldLocationPrompted=false;
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
      if(req){req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error);}
      else{tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}
    });
  }finally{db.close();}
}
async function listFieldMapPacks(){return await fieldMapDb('readonly',s=>s.getAll());}
async function getFieldMapPack(id){if(!id)return null;return await fieldMapDb('readonly',s=>s.get(id));}
async function deleteFieldMapPack(id){if(!id)return;await fieldMapDb('readwrite',s=>s.delete(id));}
async function saveFieldMapPackBlob(blob,name,source='import'){
  if(!blob||!blob.size)throw new Error('Map file is empty.');
  try{if(navigator.storage?.persist)await navigator.storage.persist();}catch{}
  if(blob.size>FIELD_MAP_MAX_BYTES)throw new Error('Map pack is larger than the 250 MB FIELD/OS browser safety limit.');
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
  if(mode)mode.textContent=(fieldMapMode==='offline'&&active)?'OFFLINE PMTILES':'ONLINE OSM';
  if(navigator.storage?.estimate){
    try{const e=await navigator.storage.estimate(),st=document.getElementById('offlineMapStorage');if(st)st.textContent=`${fmtBytes(e.usage||0)} / ${fmtBytes(e.quota||0)}`;}catch{}
  }
}
function ensureFieldMap(id,fallbackId,labelId){
  if(fieldMaps.has(id))return fieldMaps.get(id);
  const el=document.getElementById(id),fallback=document.getElementById(fallbackId),label=document.getElementById(labelId);
  if(!el||typeof L==='undefined')return null;
  const map=L.map(el,{zoomControl:false,attributionControl:true,preferCanvas:true,minZoom:2,maxZoom:19});
  map.attributionControl.setPrefix(false);
  const overlay=L.layerGroup().addTo(map);
  const state={id,el,fallback,label,map,overlay,base:null,trails:null,baseKind:'',attr:'',centered:false,tileErrors:0};
  fieldMaps.set(id,state);
  map.setView([currentNavPosition.lat,currentNavPosition.lon],14);
  map.on('zoomend moveend',()=>{state.centered=true;});
  return state;
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
document.getElementById('mapTopoMode')?.addEventListener('click',()=>useTopoFieldMap());
document.getElementById('homeTopoMode')?.addEventListener('click',()=>useTopoFieldMap());
document.getElementById('mapOsmMode')?.addEventListener('click',()=>useOnlineFieldMap());
document.getElementById('mapTrailLayer')?.addEventListener('click',()=>toggleHikingRoutes());
document.getElementById('homeTrailLayer')?.addEventListener('click',()=>toggleHikingRoutes());
document.getElementById('centerBtn')?.addEventListener('click',()=>updateFieldMaps(true));
document.getElementById('homeMapCenter')?.addEventListener('click',()=>updateFieldMaps(true));
document.getElementById('homeMapZoomIn')?.addEventListener('click',()=>{const s=fieldMaps.get('homeRealMap');if(s&&!s.el.hidden)s.map.zoomIn();});
document.getElementById('homeMapZoomOut')?.addEventListener('click',()=>{const s=fieldMaps.get('homeRealMap');if(s&&!s.el.hidden)s.map.zoomOut();});
function updateLiveNavigationUI(){
  const trusted=hasTrustedMapPosition();
  const heading=trusted?(Number.isFinite(fieldLiveHeading)?fieldLiveHeading:null):demo.heading;
  const speed=trusted?(Number.isFinite(fieldLiveSpeed)?fieldLiveSpeed:null):demo.speed;
  const card=Number.isFinite(heading)?headingCardinal(heading):'--';
  const set=(id,value)=>{const el=document.getElementById(id);if(el)el.textContent=value;};
  set('navHeading',Number.isFinite(heading)?String(Math.round(heading)).padStart(3,'0')+'°':'---°');
  set('navHeadingCardinal',card);
  set('navAccuracy',trusted?`±${Math.round(currentAccuracy)} m`:'NO LIVE FIX');
  set('navCompassSource',trusted?(Number.isFinite(fieldLiveHeading)?'PHONE COURSE':'COURSE UNAVAILABLE'):'DEMO / IMU PENDING');
  set('navPositionSource',trusted?(currentNavPosition.source||'LIVE POSITION'):'AWAITING LIVE POSITION');
  set('navStripPos',trusted?`${currentNavPosition.lat.toFixed(4)}, ${currentNavPosition.lon.toFixed(4)}`:'AWAITING FIX');
  set('navStripAcc',trusted?`±${Math.round(currentAccuracy)}m`:'—');
  set('navStripSpeed',Number.isFinite(speed)?`${speed.toFixed(1)} mph`:'—');
  set('navStripHeading',Number.isFinite(heading)?`${String(Math.round(heading)).padStart(3,'0')}° ${card}`:'—');
  set('navStripRoute',routePoints.length>=2?`${routeMiles().toFixed(1)} mi`:'NONE');
  set('navStripTrack',recordedTrack.length?`${recordedTrack.length} pts`:'IDLE');
}
function applyFieldGeolocation(p,source='PHONE GNSS'){
  currentNavPosition={lat:p.coords.latitude,lon:p.coords.longitude,alt:p.coords.altitude??demo.alt,source};
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
document.getElementById('requestLiveLocation')?.addEventListener('click',()=>requestFieldLiveLocation());
window.addEventListener('online',()=>updateFieldMaps(false));
window.addEventListener('offline',()=>updateFieldMaps(false));
document.addEventListener('click',e=>{
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
