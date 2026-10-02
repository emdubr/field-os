/* FIELD/OS v3.41 — features 19–27: conditions + adaptive navigation */
(() => {
  'use strict';
  const PREFIX='fieldos-v12-';
  const key=n=>PREFIX+n;
  const read=(n,f)=>{try{const raw=localStorage.getItem(key(n));return raw==null?f:(JSON.parse(raw)??f)}catch{return f}};
  const write=(n,v)=>{try{localStorage.setItem(key(n),JSON.stringify(v));return true}catch{return false}};
  async function boundedFetch(fetcher,url,init={},timeoutMs=20000){
    if(typeof AbortController==='undefined')return fetcher(url,init);
    const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),Math.max(1000,timeoutMs));
    try{return await fetcher(url,{...init,signal:controller.signal})}finally{clearTimeout(timer)}
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const validPoint=p=>p&&p.lat!=null&&p.lon!=null&&p.lat!==''&&p.lon!==''&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  const rad=d=>d*Math.PI/180;
  const meters=(a,b)=>{const R=6371000,dLat=rad(Number(b.lat)-Number(a.lat)),dLon=rad(Number(b.lon)-Number(a.lon)),la1=rad(Number(a.lat)),la2=rad(Number(b.lat));const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.min(1,Math.sqrt(h)))};
  const bearing=(a,b)=>{const y=Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat)),x=Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon));return (Math.atan2(y,x)*180/Math.PI+360)%360};
  const cardinal=deg=>['N','NE','E','SE','S','SW','W','NW'][Math.round((((Number(deg)||0)%360)+360)%360/45)%8];
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const getPosition=()=>{const p=window.FIELD_ROUTE_STATE?.current?.()||{};return validPoint(p)?{lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null,source:p.source||'POSITION'}:null};
  const getPlan=()=>window.FIELD_ROUTE_STATE?.getPlan?.()||{};
  const cleanPoints=list=>(Array.isArray(list)?list:[]).filter(validPoint).map(p=>({lat:Number(p.lat),lon:Number(p.lon),alt:p.alt??null}));
  let routeGeometryCacheKey='',routeGeometryCache=null;
  function routeGeometry(plan=getPlan()){
    const raw=Array.isArray(plan?.points)?plan.points:[],key=plan?.updatedAt?`${plan.updatedAt}|${raw.length}`:'';
    if(key&&routeGeometryCacheKey===key&&routeGeometryCache)return routeGeometryCache;
    const pts=cleanPoints(raw),cum=[0];for(let i=1;i<pts.length;i++)cum[i]=cum[i-1]+meters(pts[i-1],pts[i]);
    const value={pts,cum,total:cum.at(-1)||0};
    if(key){routeGeometryCacheKey=key;routeGeometryCache=value}
    return value;
  }
  const fmtMiles=m=>Number.isFinite(m)?(m/1609.344).toFixed(2)+' mi':'—';
  const fmtTime=h=>!Number.isFinite(h)||h<0?'—':h<1?Math.round(h*60)+' min':Math.floor(h)+'h '+Math.round((h%1)*60)+'m';
  const weatherCache=()=>window.FIELD_WEATHER?.state?.cache||null;
  const nearestRouteIndex=(pts,pos)=>{if(!validPoint(pos)||!pts.length)return 0;let best=Infinity,idx=0;for(let i=0;i<pts.length;i++){const d=meters(pos,pts[i]);if(d<best){best=d;idx=i}}return idx};
  const routeProgressFraction=(plan=getPlan(),pos=getPosition())=>{
    const {pts,cum,total}=routeGeometry(plan);if(pts.length<2||!validPoint(pos)||!total)return 0;
    let bestDist=Infinity,bestAlong=0;
    for(let i=0;i<pts.length-1;i++){
      const a=pts[i],b=pts[i+1],latScale=111320,lonScale=111320*Math.cos(rad((a.lat+b.lat+pos.lat)/3));
      const abx=(b.lon-a.lon)*lonScale,aby=(b.lat-a.lat)*latScale,apx=(pos.lon-a.lon)*lonScale,apy=(pos.lat-a.lat)*latScale,len2=abx*abx+aby*aby;
      const t=len2?clamp((apx*abx+apy*aby)/len2,0,1):0,dx=apx-t*abx,dy=apy-t*aby,d=Math.hypot(dx,dy);
      if(d<bestDist){bestDist=d;bestAlong=cum[i]+t*(cum[i+1]-cum[i])}
    }
    return clamp(bestAlong/total,0,1);
  };

  // Feature 19 — Barometric Storm Detection.
  const savedPressure=read('pressure-history',[]);
  const pressureState={samples:(Array.isArray(savedPressure)?savedPressure:[]).filter(x=>Number.isFinite(x?.v)&&Number.isFinite(x?.t)).slice(-720),lastAlert:null};
  function addPressure(v,t=Date.now()){v=Number(v);t=Number(t)||Date.now();if(!Number.isFinite(v)||v<700||v>1100)return null;const last=pressureState.samples.at(-1);if(last&&Math.abs(t-last.t)<5000)pressureState.samples[pressureState.samples.length-1]={v,t};else pressureState.samples.push({v,t});pressureState.samples=pressureState.samples.filter(x=>t-x.t<=12*3600000).slice(-720);write('pressure-history',pressureState.samples);return analyzePressure(t)}
  function pressureDelta(hours,now=Date.now()){const s=pressureState.samples.filter(x=>now-x.t<=hours*3600000&&now>=x.t).sort((a,b)=>a.t-b.t);if(s.length<2)return null;return s.at(-1).v-s[0].v}
  function analyzePressure(now=Date.now()){const current=pressureState.samples.at(-1)?.v??null,d1=pressureDelta(1,now),d3=pressureDelta(3,now),rate=d3==null?null:d3/3;let level='insufficient',label='INSUFFICIENT HISTORY';if(d3!=null){if(d3<=-4){level='alert';label='RAPID PRESSURE FALL'}else if(d3<=-2){level='watch';label='PRESSURE FALL WATCH'}else if(d3>=3){level='rise';label='RAPID PRESSURE RISE'}else{level='stable';label='PRESSURE TREND STABLE'}}return {current,d1,d3,rate,level,label}}
  function renderPressure(result=analyzePressure()){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v},panel=document.querySelector('.pressure-storm-panel');set('stormWatchState',result.label);set('pressureCurrent',result.current==null?'—':result.current.toFixed(1)+' hPa');set('pressureDelta1h',result.d1==null?'—':(result.d1>=0?'+':'')+result.d1.toFixed(1)+' hPa');set('pressureDelta3h',result.d3==null?'—':(result.d3>=0?'+':'')+result.d3.toFixed(1)+' hPa');set('pressureRate',result.rate==null?'—':(result.rate>=0?'+':'')+result.rate.toFixed(2));set('pressureAssessment',result.label);panel?.classList.toggle('storm-watch',result.level==='watch');panel?.classList.toggle('storm-alert',result.level==='alert');if(['watch','alert'].includes(result.level)&&pressureState.lastAlert!==result.level){pressureState.lastAlert=result.level;document.dispatchEvent(new CustomEvent('fieldos:sensoralert',{detail:{id:'pressure-'+result.level+'-'+Date.now(),source:'BAROMETER',title:result.label,text:`Pressure changed ${result.d3.toFixed(1)} hPa across the available 3-hour window. This is a pressure-trend warning, not a weather forecast.`,severity:result.level==='alert'?'high':'warn',createdAt:Date.now()}}))}return result}

  // Feature 20 — Wildfire / Smoke / Closure cache and route screening.
  const savedHazards=read('hazard-geojson',null)?.features;
  const hazardState={features:Array.isArray(savedHazards)?savedHazards:[]};
  function hazardCategory(p={}){const s=String(p.category??p.hazard??p.type??p.layer??p.incident_type??'HAZARD').toUpperCase();if(/SMOKE/.test(s))return 'SMOKE';if(/FIRE|WILDFIRE|BURN/.test(s))return 'FIRE';if(/CLOSURE|CLOSED|EVAC/.test(s))return 'CLOSURE';return s.slice(0,30)||'HAZARD'}
  function pointInRing(p,ring=[]){let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const xi=Number(ring[i][0]),yi=Number(ring[i][1]),xj=Number(ring[j][0]),yj=Number(ring[j][1]);const hit=((yi>p.lat)!==(yj>p.lat))&&(p.lon<(xj-xi)*(p.lat-yi)/(yj-yi+1e-12)+xi);if(hit)inside=!inside}return inside}
  function hazardContains(f,p){const g=f?.geometry;if(!g||!validPoint(p))return false;if(g.type==='Polygon')return inPolygon(p,g.coordinates);if(g.type==='MultiPolygon')return (g.coordinates||[]).some(poly=>inPolygon(p,poly));if(g.type==='Point'){const q={lon:Number(g.coordinates?.[0]),lat:Number(g.coordinates?.[1])};return validPoint(q)&&meters(p,q)<=1609.344}return false}
  function ingestHazards(data){hazardState.features=(Array.isArray(data?.features)?data.features:[]).filter(f=>f?.geometry).slice(0,500);write('hazard-geojson',{savedAt:new Date().toISOString(),features:hazardState.features});renderHazards();return hazardState.features}
  function inPolygon(p,rings=[]){return Array.isArray(rings)&&pointInRing(p,rings[0]||[])&&!rings.slice(1).some(r=>pointInRing(p,r))}
  function segmentCrosses(a,b,c,d){
    const cross=(p,q,r)=>(q.lon-p.lon)*(r.lat-p.lat)-(q.lat-p.lat)*(r.lon-p.lon);
    const on=(p,q,r)=>Math.abs(cross(p,q,r))<1e-12&&r.lon>=Math.min(p.lon,q.lon)&&r.lon<=Math.max(p.lon,q.lon)&&r.lat>=Math.min(p.lat,q.lat)&&r.lat<=Math.max(p.lat,q.lat);
    const x=cross(a,b,c),y=cross(a,b,d),z=cross(c,d,a),w=cross(c,d,b);
    return ((x>0&&y<0||x<0&&y>0)&&(z>0&&w<0||z<0&&w>0))||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);
  }
  function segmentNearPoint(a,b,p,radius){
    const scale=Math.cos(rad(p.lat)),x=(b.lon-a.lon)*scale,y=b.lat-a.lat,px=(p.lon-a.lon)*scale,py=p.lat-a.lat;
    const t=clamp((px*x+py*y)/(x*x+y*y||1),0,1);
    return meters(p,{lat:a.lat+t*(b.lat-a.lat),lon:a.lon+t*(b.lon-a.lon)})<=radius;
  }
  function screenHazards(plan=getPlan()){
    const pts=cleanPoints(plan.points||[]),hits=[];
    for(const f of hazardState.features){
      const g=f?.geometry;if(!g)continue;
      let hit=pts.some(p=>hazardContains(f,p));
      const polys=g.type==='Polygon'?[g.coordinates]:g.type==='MultiPolygon'?g.coordinates:[];
      if(!hit)for(let i=1;i<pts.length&&!hit;i++){
        if(g.type==='Point')hit=segmentNearPoint(pts[i-1],pts[i],{lon:g.coordinates?.[0],lat:g.coordinates?.[1]},1609.344);
        for(const poly of polys||[])for(const ring of poly||[])for(let j=0;j<ring.length&&!hit;j++){
          const c=ring[j],d=ring[(j+1)%ring.length];
          hit=segmentCrosses(pts[i-1],pts[i],{lon:c[0],lat:c[1]},{lon:d[0],lat:d[1]});
        }
      }
      if(hit){const p=f.properties||{};hits.push({category:hazardCategory(p),name:String(p.name??p.title??p.incident_name??'HAZARD'),detail:String(p.description??p.status??p.note??'Route intersects cached hazard geometry.')})}
    }
    return hits;
  }
  function renderHazards(){const hits=screenHazards(),list=document.getElementById('hazardList'),set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('hazardLayerState',hazardState.features.length?`CACHE // ${hazardState.features.length} FEATURE${hazardState.features.length===1?'':'S'}`:'CACHE // EMPTY');set('hazardRouteSummary',hits.length?`ROUTE SCREENING: ${hits.length} cached hazard intersection${hits.length===1?'':'s'} found.`:'No route intersections found in currently cached hazard geometry. Absence of cached data does not mean no hazard exists.');if(list)list.innerHTML=hits.map(h=>`<div class="condition-row bad"><b>${esc(h.category)} — ${esc(h.name)}</b><small>${esc(h.detail)}</small></div>`).join('')||'<p class="muted">No cached hazard intersections.</p>';return hits}
  function clearHazards(){hazardState.features=[];try{localStorage.removeItem(key('hazard-geojson'))}catch{}renderHazards()}
  document.getElementById('hazardGeoJsonImport')?.addEventListener('change',async e=>{const file=e.currentTarget.files?.[0];if(!file)return;try{ingestHazards(JSON.parse(await file.text()))}catch(err){console.warn('Hazard import failed',err)}e.currentTarget.value=''});document.getElementById('hazardClear')?.addEventListener('click',clearHazards);

  // Feature 21 — Avalanche Mode (slope screening only).
  function analyzeAvalanche(plan=getPlan()){const ep=plan.elevationProfile,s=Array.isArray(ep)?ep:(Array.isArray(ep?.samples)?ep.samples:[]),bands={low:0,moderate:0,high:0,extreme:0,total:0},aspects={};for(let i=1;i<s.length;i++){const a=s[i-1],b=s[i];if(!validPoint(a)||!validPoint(b)||!Number.isFinite(Number(a.elevationFt))||!Number.isFinite(Number(b.elevationFt)))continue;const run=meters(a,b);if(run<3)continue;const deg=Math.atan(Math.abs((Number(b.elevationFt)-Number(a.elevationFt))*0.3048)/run)*180/Math.PI;bands.total+=run;if(deg>=25&&deg<30)bands.low+=run;else if(deg>=30&&deg<35)bands.moderate+=run;else if(deg>=35&&deg<=45)bands.high+=run;else if(deg>45)bands.extreme+=run;if(deg>=25){const asp=cardinal(Number(b.elevationFt)>=Number(a.elevationFt)?bearing(a,b):bearing(b,a));aspects[asp]=(aspects[asp]||0)+run}}const exposure=bands.total?(bands.low+bands.moderate+bands.high)/bands.total:0,dominant=Object.entries(aspects).sort((a,b)=>b[1]-a[1])[0]?.[0]||'—';return {bands,exposure,dominantAspect:dominant}}
  function renderAvalanche(r=analyzeAvalanche()){const pct=x=>r.bands.total?(x/r.bands.total*100).toFixed(0)+'%':'—',set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('avalancheState',r.bands.total?'ROUTE SCREENED':'WAITING FOR ROUTE');set('avalancheExposure',r.bands.total?(r.exposure*100).toFixed(0)+'%':'—');set('avalancheLow',pct(r.bands.low));set('avalancheModerate',pct(r.bands.moderate));set('avalancheHigh',pct(r.bands.high));set('avalancheExtreme',pct(r.bands.extreme));return r}
  const bulletin=document.getElementById('avalancheBulletin');if(bulletin){bulletin.value=read('avalanche-bulletin','')||'';bulletin.addEventListener('input',()=>write('avalanche-bulletin',bulletin.value))}

  // Feature 22 — Snow Travel.
  function forecast24(cache=weatherCache()){const rows=cache?.hourly||[],now=Date.now(),end=now+24*3600000;return rows.filter(r=>{const t=Date.parse(r.time);return t>=now-3600000&&t<=end})}
  function analyzeSnow(cache=weatherCache()){const rows=forecast24(cache),cur=cache?.current||rows[0];if(!cur)return null;const snow24=rows.reduce((a,r)=>a+(Number.isFinite(r.snowfallIn)?r.snowfallIn:0),0),depth=Math.max(Number.isFinite(cur.snowDepthIn)?cur.snowDepthIn:0,...rows.map(r=>Number.isFinite(r.snowDepthIn)?r.snowDepthIn:0)),wind=Math.max(Number.isFinite(cur.windMph)?cur.windMph:0,...rows.map(r=>Number.isFinite(r.windMph)?r.windMph:0)),dir=Number.isFinite(cur.windDir)?cur.windDir:rows.find(r=>Number.isFinite(r.windDir))?.windDir,loading=Number.isFinite(dir)?cardinal(dir+180):'—',freeze=Number.isFinite(cur.freezingFt)?cur.freezingFt:rows.find(r=>Number.isFinite(r.freezingFt))?.freezingFt;let note='NORMAL SCREENING';if(snow24>=6&&wind>=20)note='NEW SNOW + WIND LOADING';else if(snow24>=3)note='RECENT / FORECAST SNOW';else if(wind>=25)note='STRONG WIND / DRIFTING';return {snow24,depth,wind,loading,freeze,note}}
  function renderSnow(r=analyzeSnow()){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};if(!r){set('snowTravelState','NO FORECAST');return null}set('snowTravelState','FORECAST CACHE');set('snowfall24',r.snow24.toFixed(1)+' in');set('snowDepth',r.depth.toFixed(1)+' in');set('snowFreezingLevel',Number.isFinite(r.freeze)?Math.round(r.freeze).toLocaleString()+' ft':'—');set('snowWind',Math.round(r.wind)+' mph');set('snowLoadingAspect',r.loading);set('snowTravelNote',r.note);return r}

  // Feature 23 — Water Intelligence.
  const waterState={cache:read('water-cache',null)};
  function normalizeWater(raw={}){if(!validPoint(raw))return null;const lat=Number(raw.lat),lon=Number(raw.lon);return {id:String(raw.id||raw.name||Math.random()),name:String(raw.name||'WATER'),type:String(raw.type||'WATER').toUpperCase(),lat,lon,source:String(raw.source||'LOCAL'),detail:String(raw.detail||'')}}
  function collectWater(){const out=[],wps=read('waypoints',[]);for(const w of Array.isArray(wps)?wps:[])if(validPoint(w)&&/WATER|SPRING|STREAM|DRINK/i.test(String(w.type||'')+' '+String(w.name||'')))out.push(normalizeWater({...w,source:'WAYPOINT'}));if(Array.isArray(waterState.cache?.items))out.push(...waterState.cache.items.map(normalizeWater).filter(Boolean));const plan=getPlan(),cross=(plan.trailSections||[]).filter(s=>s.ford||s.waterway);for(const s of cross)out.push({id:'route-'+out.length,name:s.label||s.name||'ROUTE WATER CROSSING',type:'CROSSING',lat:null,lon:null,source:'ROUTE TAG',detail:s.ford?'FORD / VERIFY FLOW':String(s.waterway||'WATERWAY')});return out}
  function rankWater(items=collectWater(),pos=getPosition()){return items.map(x=>({...x,distanceM:validPoint(x)&&validPoint(pos)?meters(pos,x):null})).sort((a,b)=>(a.distanceM??Infinity)-(b.distanceM??Infinity))}
  async function searchWaterOnline(fetcher=fetch){const p=getPosition();if(!validPoint(p))throw new Error('No valid position');const q=`[out:json][timeout:16];(node(around:10000,${p.lat},${p.lon})[natural=spring];node(around:10000,${p.lat},${p.lon})[amenity=drinking_water];node(around:10000,${p.lat},${p.lon})[man_made=water_tap];node(around:10000,${p.lat},${p.lon})[tourism=water_point];);out body;`;const r=await boundedFetch(fetcher,'https://overpass-api.de/api/interpreter',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q)},20000);if(!r.ok)throw new Error('Water search HTTP '+r.status);const data=await r.json(),items=(data.elements||[]).map(e=>normalizeWater({id:'osm-'+e.id,name:e.tags?.name||e.tags?.natural||e.tags?.amenity||'WATER',type:e.tags?.natural==='spring'?'SPRING':'WATER',lat:e.lat,lon:e.lon,source:'OSM CACHE',detail:e.tags?.drinking_water?'drinking_water='+e.tags.drinking_water:''})).filter(Boolean);waterState.cache={savedAt:new Date().toISOString(),center:p,items:items.slice(0,100)};write('water-cache',waterState.cache);return renderWater()}
  function renderWater(items=rankWater()){const list=document.getElementById('waterIntelList'),state=document.getElementById('waterIntelState');if(state)state.textContent=`${items.length} SOURCE${items.length===1?'':'S'} // ${waterState.cache?.savedAt?'CACHE READY':'LOCAL'}`;if(list)list.innerHTML=items.length?items.slice(0,20).map(x=>`<div class="condition-row"><b>${esc(x.name)} — ${esc(x.type)}</b><span>${x.distanceM==null?'ROUTE TAG':fmtMiles(x.distanceM)}</span><small>${esc(x.source)}${x.detail?' // '+esc(x.detail):''} // Verify presence and potability in the field.</small></div>`).join(''):'<p class="muted">No saved or cached water references.</p>';return items}
  function clearWater(){waterState.cache=null;try{localStorage.removeItem(key('water-cache'))}catch{}renderWater()}
  document.getElementById('waterSearchOnline')?.addEventListener('click',async e=>{const button=e.currentTarget;button.disabled=true;try{await searchWaterOnline()}catch(err){const label=document.getElementById('waterIntelState');if(label)label.textContent='SEARCH FAILED — CACHED SOURCES RETAINED';console.warn(err)}finally{button.disabled=false}});document.getElementById('waterClearCache')?.addEventListener('click',clearWater);

  // Feature 24 — Trail-condition intelligence.
  function analyzeTrailConditions(plan=getPlan(),cache=weatherCache()){const secs=Array.isArray(plan.trailSections)?plan.trailSections:[],surfaces=secs.map(s=>String(s.surface||'').toLowerCase()),rows=forecast24(cache),precip12=rows.slice(0,12).reduce((a,r)=>a+(Number.isFinite(r.precipIn)?r.precipIn:0),0),snow=analyzeSnow(cache),temps=rows.map(r=>r.tempF).filter(Number.isFinite),minT=temps.length?Math.min(...temps):null,maxT=temps.length?Math.max(...temps):null,tags=[],unpaved=surfaces.some(s=>/dirt|earth|ground|mud|grass|unpaved|gravel/.test(s)),rocky=surfaces.some(s=>/rock|stone|scree|boulder/.test(s))||secs.some(s=>/alpine|mountain/.test(String(s.sacScale||'')));if(rocky)tags.push({id:'rocky',level:'warn',label:'ROCKY / TECHNICAL'});if(unpaved&&precip12>=.1)tags.push({id:'mud',level:'warn',label:'MUD / SOFT SURFACE LIKELY'});if(precip12>=.25)tags.push({id:'wet',level:'warn',label:'WET TRAIL LIKELY'});if(snow&&(snow.snow24>=1||snow.depth>=1))tags.push({id:'snow',level:snow.snow24>=6?'bad':'warn',label:'SNOW TRAVEL'});if(minT!=null&&maxT!=null&&minT<=32&&maxT>=32)tags.push({id:'ice',level:'warn',label:'FREEZE / THAW — ICE POSSIBLE'});if(!tags.length)tags.push({id:'clear',level:'good',label:'NO CONDITION FLAGS FROM CACHED DATA'});let speedFactor=1;for(const t of tags){if(t.id==='rocky')speedFactor*=1.12;if(t.id==='mud')speedFactor*=1.12;if(t.id==='wet')speedFactor*=1.06;if(t.id==='snow')speedFactor*=snow?.snow24>=6?1.35:1.18;if(t.id==='ice')speedFactor*=1.18}speedFactor=clamp(speedFactor,1,1.8);return {tags,speedFactor,precip12,minT,maxT,summary:`${secs.length} route section${secs.length===1?'':'s'} // 12h precip ${precip12.toFixed(2)} in // condition time factor ${speedFactor.toFixed(2)}×`}}
  function renderTrailConditions(r=analyzeTrailConditions()){const box=document.getElementById('trailConditionTags'),sum=document.getElementById('trailConditionSummary'),state=document.getElementById('trailConditionState');if(box)box.innerHTML=r.tags.map(t=>`<span class="condition-tag ${t.level}">${esc(t.label)}</span>`).join('');if(sum)sum.textContent=r.summary;if(state)state.textContent=r.tags.some(t=>t.level==='bad')?'HIGH IMPACT':r.tags.some(t=>t.level==='warn')?'CONDITION FLAGS':'NO FLAGS';return r}

  // Feature 26 — Fatigue model.
  function computeFatigue(plan=getPlan(),progress=routeProgressFraction(plan)){const geometry=routeGeometry(plan),distanceMi=Number(plan.distanceMiles)||geometry.total/1609.344,gainFt=Number(plan.elevationGainFt??plan.elevationProfile?.gainFt??plan.gain??0)||0,doneMi=distanceMi*clamp(progress,0,1),doneGain=gainFt*clamp(progress,0,1),factor=clamp(1+doneMi/45+doneGain/18000,1,1.6),level=factor<1.1?'FRESH':factor<1.25?'ACCUMULATING':factor<1.42?'FATIGUED':'HIGH FATIGUE LOAD';return {factor,level,distanceMi,gainFt,doneMi,doneGain,progress}}

  // Feature 25 — Adaptive ETA.
  let paceCacheRaw,paceCacheValue;
  function learnPace(track){if(arguments.length===0){let raw=null;try{raw=localStorage.getItem(key('track'))}catch{}if(paceCacheValue&&raw===paceCacheRaw)return paceCacheValue;let data=[];try{data=JSON.parse(raw)||[]}catch{}paceCacheRaw=raw;return paceCacheValue=learnPace(data)}const pts=(Array.isArray(track)?track:[]).filter(p=>validPoint(p)&&p.time);let dist=0,timeH=0,segments=0;for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],ta=typeof a.time==='number'?a.time:Date.parse(a.time),tb=typeof b.time==='number'?b.time:Date.parse(b.time),dt=(tb-ta)/3600000;if(!(dt>0&&dt<=.5))continue;const d=meters(a,b)/1609.344,speed=d/dt;if(speed>.2&&speed<7){dist+=d;timeH+=dt;segments++}}if(dist>=.3&&timeH>0&&segments>=3)return {mph:clamp(dist/timeH,1.2,4.5),source:'RECORDED TRACK',distanceMi:dist,segments};return {mph:2.5,source:'DEFAULT HIKING MODEL',distanceMi:dist,segments}}
  function computeAdaptiveEta(plan=getPlan(),position=getPosition()){const geometry=routeGeometry(plan),pts=geometry.pts,distanceMi=Number(plan.distanceMiles)||geometry.total/1609.344,gainFt=Number(plan.elevationGainFt??plan.elevationProfile?.gainFt??plan.gain??0)||0,pace=learnPace(),conditions=analyzeTrailConditions(plan),progress=routeProgressFraction(plan,position),fatigue=computeFatigue(plan,progress),horizontal=pace.mph?distanceMi/pace.mph:0,vertical=Math.max(0,gainFt)/2000*.5,total=(horizontal+vertical)*conditions.speedFactor*fatigue.factor,remaining=Math.max(0,total*(1-progress)),confidence=pace.source==='RECORDED TRACK'?(pace.distanceMi>=2?'HIGH':'MEDIUM'):'BASELINE';return {pace,conditions,fatigue,progress,distanceMi,gainFt,totalHours:total,remainingHours:remaining,adjustedMph:total?distanceMi/total:pace.mph,confidence}}
  function renderAdaptiveEta(r=computeAdaptiveEta()){const set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v};set('adaptiveEtaState',r.distanceMi?'MODEL ACTIVE':'WAITING FOR ROUTE');set('adaptiveBasePace',r.pace.mph.toFixed(1)+' mph');set('adaptivePaceSource',r.pace.source);set('adaptiveConditionFactor',r.conditions.speedFactor.toFixed(2)+'×');set('adaptiveConditionText',r.conditions.tags.map(x=>x.id.toUpperCase()).join(' / '));set('fatigueFactor',r.fatigue.factor.toFixed(2)+'×');set('fatigueText',r.fatigue.level);set('adaptiveSpeed',r.adjustedMph.toFixed(1)+' mph');set('adaptiveEta',fmtTime(r.totalHours));set('adaptiveRemainingEta',fmtTime(r.remainingHours));set('adaptiveEtaConfidence','MODEL '+r.confidence);set('adaptiveProgressText',Math.round(r.progress*100)+'% route progress');return r}

  // Feature 27 — Turn-by-turn trail instructions.
  const turnState={cues:[],index:0,haptics:true,lastVibrated:null};
  function deltaBearing(a,b){return ((b-a+540)%360)-180}
  function pointIndexAtDistance(cum,d){let best=0;for(let i=1;i<cum.length;i++)if(Math.abs(cum[i]-d)<Math.abs(cum[best]-d))best=i;return best}
  function generateTurns(plan=getPlan()){const {pts,cum}=routeGeometry(plan);if(pts.length<2){turnState.cues=[];return []}const cues=[{id:'start',index:0,distanceM:0,type:'start',instruction:'START ROUTE',trail:String(plan.name||'ROUTE'),bearing:bearing(pts[0],pts[1])}],minSpacing=80;let lastCueD=0;for(let i=1;i<pts.length-1;i++){const inB=bearing(pts[i-1],pts[i]),outB=bearing(pts[i],pts[i+1]),d=deltaBearing(inB,outB);if(Math.abs(d)>=38&&cum[i]-lastCueD>=minSpacing){cues.push({id:'turn-'+i,index:i,distanceM:cum[i],type:d>0?'right':'left',instruction:`${Math.abs(d)>=100?'SHARP ':''}TURN ${d>0?'RIGHT':'LEFT'}`,trail:'ROUTE',bearing:outB});lastCueD=cum[i]}}let secD=0,lastTrail='';for(const s of Array.isArray(plan.trailSections)?plan.trailSections:[]){const name=String(s.name||s.label||s.ref||'').trim();if(!name){secD+=Number(s.distanceM)||0;continue}const idx=pointIndexAtDistance(cum,secD);if(secD>0&&name.toLowerCase()!==lastTrail){const outB=idx<pts.length-1?bearing(pts[idx],pts[idx+1]):0;cues.push({id:'trail-'+cues.length,index:idx,distanceM:secD,type:'trail',instruction:`CONTINUE ON ${name.toUpperCase()}`,trail:name,bearing:outB});}lastTrail=name.toLowerCase();secD+=Number(s.distanceM)||0}cues.push({id:'finish',index:pts.length-1,distanceM:cum.at(-1),type:'finish',instruction:'ARRIVE AT ROUTE END',trail:String(plan.name||'ROUTE'),bearing:0});cues.sort((a,b)=>a.distanceM-b.distanceM);turnState.cues=cues;turnState.index=0;return cues}
  function nextTurn(position=getPosition(),plan=getPlan()){if(!turnState.cues.length)generateTurns(plan);const {pts,cum,total}=routeGeometry(plan);if(!pts.length||!turnState.cues.length)return null;const progress=routeProgressFraction(plan,position)*total;let ci=turnState.cues.findIndex(c=>c.distanceM>=progress-20);if(ci<0)ci=turnState.cues.length-1;turnState.index=ci;const cue=turnState.cues[ci],distanceM=Math.max(0,cue.distanceM-progress);return {...cue,distanceToCueM:distanceM,progressM:progress,totalM:total,remaining:Math.max(0,turnState.cues.length-ci-1)}}
  function renderTurnNav(forceIndex=null){const plan=getPlan();if(!turnState.cues.length)generateTurns(plan);if(forceIndex!=null)turnState.index=clamp(forceIndex,0,Math.max(0,turnState.cues.length-1));const cue=forceIndex==null?nextTurn():turnState.cues[turnState.index],set=(id,v)=>{const e=document.getElementById(id);if(e)e.textContent=v},arrow=document.getElementById('turnNavArrow');if(!cue){set('turnNavState','WAITING FOR ROUTE');set('turnNavInstruction','NO ACTIVE INSTRUCTION');return null}const dist=cue.distanceToCueM??0;set('turnNavState','CUE '+(turnState.index+1)+' / '+turnState.cues.length);set('turnNavInstruction',cue.instruction);set('turnNavDistance',dist<160.934?Math.round(dist*3.28084)+' ft':fmtMiles(dist));set('turnNavTrail',cue.trail||'ROUTE');set('turnNavNext',cue.type.toUpperCase());set('turnNavRemaining',String(cue.remaining??Math.max(0,turnState.cues.length-turnState.index-1)));set('turnNavProgress',cue.totalM?Math.round((cue.progressM||0)/cue.totalM*100)+'%':'—');set('turnNavHapticsState',turnState.haptics?'ON':'OFF');if(arrow)arrow.style.transform=`rotate(${Number(cue.bearing)||0}deg)`;if(forceIndex==null&&turnState.haptics&&dist<=60&&turnState.lastVibrated!==cue.id){navigator.vibrate?.([80,50,80]);turnState.lastVibrated=cue.id}return cue}
  document.getElementById('turnNavPrev')?.addEventListener('click',()=>renderTurnNav(turnState.index-1));document.getElementById('turnNavNextBtn')?.addEventListener('click',()=>renderTurnNav(turnState.index+1));document.getElementById('turnNavToggleHaptics')?.addEventListener('click',()=>{turnState.haptics=!turnState.haptics;renderTurnNav(turnState.index)});
  const opsViewVisible=id=>!!document.querySelector(`#${id}.active`);
  const refreshRouteDependentOps=()=>{
    generateTurns();
    if(opsViewVisible('weather')){renderHazards();renderAvalanche();renderWater();renderTrailConditions()}
    if(opsViewVisible('route'))renderAdaptiveEta();
    if(opsViewVisible('nav'))renderTurnNav();
  };
  document.addEventListener('fieldos:routemetadatachange',refreshRouteDependentOps);
  document.addEventListener('fieldos:routechange',refreshRouteDependentOps);document.addEventListener('fieldos:positionchange',()=>{if(opsViewVisible('route'))renderAdaptiveEta();if(opsViewVisible('nav'))renderTurnNav()});document.addEventListener('fieldos:telemetry',e=>{const p=Number(e.detail?.pressureHpa??e.detail?.pressure);if(Number.isFinite(p)){addPressure(p,Number(e.detail?.time)||Date.now());if(opsViewVisible('weather'))renderPressure()}});
  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='weather'){renderPressure();renderHazards();renderAvalanche();renderSnow();renderWater();renderTrailConditions()}if(e.detail?.view==='route')renderAdaptiveEta();if(e.detail?.view==='nav')renderTurnNav()});
  document.addEventListener('fieldos:weatherchange',()=>{if(opsViewVisible('weather')){renderSnow();renderTrailConditions()}if(opsViewVisible('route'))renderAdaptiveEta()});
  window.FIELD_RUNTIME.idle(()=>{generateTurns();const active=document.querySelector('.view.active')?.id;if(active==='weather'){renderPressure();renderHazards();renderAvalanche();renderSnow();renderWater();renderTrailConditions()}else if(active==='route')renderAdaptiveEta();else if(active==='nav')renderTurnNav()},700);

  window.FIELD_PRESSURE={state:pressureState,add:addPressure,analyze:analyzePressure,render:renderPressure};
  window.FIELD_HAZARDS={state:hazardState,ingest:ingestHazards,screen:screenHazards,render:renderHazards,clear:clearHazards,contains:hazardContains};
  window.FIELD_AVALANCHE={analyze:analyzeAvalanche,render:renderAvalanche};
  window.FIELD_SNOW={analyze:analyzeSnow,render:renderSnow};
  window.FIELD_WATER={state:waterState,collect:collectWater,rank:rankWater,searchOnline:searchWaterOnline,render:renderWater,clear:clearWater};
  window.FIELD_TRAIL_CONDITIONS={analyze:analyzeTrailConditions,render:renderTrailConditions};
  window.FIELD_FATIGUE={compute:computeFatigue};
  window.FIELD_ADAPTIVE_ETA={learn:learnPace,compute:computeAdaptiveEta,render:renderAdaptiveEta};
  window.FIELD_TURNS={state:turnState,generate:generateTurns,next:nextTurn,render:renderTurnNav,setHaptics:v=>{turnState.haptics=!!v;return renderTurnNav(turnState.index)}};
})();
