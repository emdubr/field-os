/* FIELD/OS safety display binding. Never represent demo or stale data as live telemetry. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const put = (id, value) => { const el=$(id); if(el && el.textContent!==String(value)) el.textContent=String(value); };
  const fresh = (stamp, limit=60000) => Number.isFinite(Number(stamp)) && Number(stamp)>0 && Date.now()-Number(stamp)>=0 && Date.now()-Number(stamp)<limit;
  const decimal = (n,places=4) => Number(n).toFixed(places);
  const safeRead = (key, fallback) => {
    try { const value=JSON.parse(localStorage.getItem('fieldos-v12-'+key)); return value==null?fallback:value; }
    catch { return fallback; }
  };
  let phoneBattery=null, telemetry=null, telemetryAt=0;
  function position() {
    const p=window.FIELD_MAP_DATA?.current?.()||{};
    const source=String(p.source||'').toUpperCase();
    const accuracy=Number(p.accuracy);
    const trusted=Number.isFinite(p.lat)&&Number.isFinite(p.lon) &&
      Math.abs(p.lat)<=90 && Math.abs(p.lon)<=180 &&
      !/DEMO|SIMULATED|ESTIMATE|DEAD.RECKON/.test(source) &&
      Number.isFinite(accuracy) && accuracy>=0 && accuracy<=100 &&
      fresh(p.updatedAt,60000);
    return {p, trusted, accuracy};
  }
  const validNum = v => v!==null && v!==undefined && v!=='' && Number.isFinite(Number(v));
  const fmtFeet = n => validNum(n)?Math.round(Number(n)).toLocaleString()+' ft':'—';
  const fmtMiles = n => validNum(n)?Number(n).toFixed(2)+' mi':'—';
  function distance(a,b){
    const rad=Math.PI/180, lat1=a.lat*rad,lat2=b.lat*rad, dl=(b.lon-a.lon)*rad, dp=(b.lat-a.lat)*rad;
    return 3958.7613*2*Math.asin(Math.min(1,Math.sqrt(Math.sin(dp/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dl/2)**2)));
  }
  function bearing(a,b) {
    const r=Math.PI/180, d=(b.lon-a.lon)*r;
    return (Math.atan2(Math.sin(d)*Math.cos(b.lat*r),Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos(d))*180/Math.PI+360)%360;
  }
  const bearingLabel = v => Number.isFinite(v)?String(Math.round(v)).padStart(3,'0')+'°':'—';
  const cardinal = v => ['N','NE','E','SE','S','SW','W','NW'][Math.round(v/45)%8];
  const setStatus = (id,good) => {
    const el=$(id)?.closest('.status-chip');
    if(el){ el.classList.toggle('good',good);el.classList.toggle('warn',!good); }
  };
  function appendCells(parent, values){
    const row=document.createElement('div');
    for(const value of values){const span=document.createElement('span');span.textContent=String(value);row.append(span);}
    parent.append(row);
  }
  function tables(info){
    const route=window.FIELD_ROUTE_STATE?.getPlan?.()||{};
    const pts=window.FIELD_ROUTE_STATE?.getPoints?.()||route.points||[];
    const metrics=route.metrics||{};
    put('homeRouteSummary',pts.length>=2?
      (String(route.name||'SAVED ROUTE')+' · '+pts.length+' points'+(validNum(metrics.distanceMiles)?' · '+fmtMiles(metrics.distanceMiles):'')) :
      'NO SAVED ROUTE — OPEN PLANNER');
    const track=window.FIELD_TRACK_STATUS?.()||{};
    const active=track.active===true;
    put('homeTrackState',active?'● RECORDING':'STOPPED');
    put('homeTrackSummary',(Number(track.points)||0)+' points'+(validNum(track.distanceMiles)?' · '+fmtMiles(track.distanceMiles):''));
    const wp=safeRead('waypoints',[]),wpBox=$('homeWaypointRows');
    if(wpBox && Array.isArray(wp)){
      const stamp=wp.map(w=>[w.id,w.name,w.type,w.lat,w.lon].join(':')).join('|');
      if(wpBox.dataset.stamp!==stamp){
        wpBox.dataset.stamp=stamp;wpBox.replaceChildren();
        wp.slice(0,6).forEach((w,i)=>{
          const valid=validNum(w.lat)&&validNum(w.lon);
          const d=info.trusted&&valid?fmtMiles(distance(info.p,{lat:Number(w.lat),lon:Number(w.lon)})):'—';
          const b=info.trusted&&valid?bearingLabel(bearing(info.p,{lat:Number(w.lat),lon:Number(w.lon)})):'—';
          appendCells(wpBox,[String(i+1).padStart(2,'0'),w.name||'WAYPOINT',w.type||'GENERAL',d,b,fmtFeet(w.alt),'—']);
        });
        if(!wp.length)wpBox.textContent='NO WAYPOINTS SAVED';
      }
    }
    const trip=safeRead('trip',{}), tripName=String(trip?.tripName||'');
    put('homeTripSummary',tripName?
      'TRIP: '+tripName+' · RETURN: '+(trip.tripReturn||'NOT SET')+' · CHECK-IN: '+(trip.checkinInterval||'MANUAL')+' min' :
      'NO TRIP PLAN SAVED');
    const ev=safeRead('fieldlog',[]),log=$('homeEventRows');
    if(log && Array.isArray(ev)){
      const last=ev.slice(-5);
      const stamp=last.map(x=>JSON.stringify(x)).join('|');
      if(log.dataset.stamp!==stamp){
        log.dataset.stamp=stamp;log.replaceChildren();
        last.forEach(x=>{
          const line=document.createElement('span');
          line.textContent=[x.time||x.created||'',x.type||x.category||'LOG',x.text||x.message||''].filter(Boolean).join(' · ');
          log.append(line);
        });
        if(!last.length)log.textContent='NO RECORDED EVENTS';
      }
    }
  }
  function integrity(info){
    const known=info.trusted;
    ['sensorIntegrityGnss','systemIntegrityGnss'].forEach(id=>put(id,known?(info.accuracy<=25?'RECENT GNSS':'LOW ACCURACY'):'UNKNOWN / NO FIX'));
    const t=fresh(telemetryAt,15000)?telemetry:{};
    const imu=t.imu||{},baro=t.baro||t.env||{};
    ['sensorIntegrityImu','systemIntegrityImu'].forEach(id=>put(id,validNum(imu.pitch)&&validNum(imu.roll)?'DATA RECEIVED (NOT VERIFIED)':'UNKNOWN'));
    ['sensorIntegrityBaro','systemIntegrityBaro'].forEach(id=>put(id,validNum(baro.pressureHpa??baro.pressure)?'DATA RECEIVED (NOT VERIFIED)':'UNKNOWN'));
    put('sensorIntegrityDrift','UNKNOWN — NO CROSS-CHECK');
    put('systemIntegrityDr','NOT VERIFIED');
  }
  function mapState(info){
    const p=info.p, status=info.trusted;
    put('sosPosition',status?decimal(p.lat,5)+', '+decimal(p.lon,5):'NO FIX — LAST POSITION NOT VERIFIED');
    put('sosAltitude',status?fmtFeet(p.alt):'UNKNOWN');
    put('sosGnss',status?'RECENT · ±'+Math.round(info.accuracy)+' m':'NO TRUSTED FIX');
    put('sosBattery',phoneBattery==null?'UNAVAILABLE':Math.round(phoneBattery*100)+'% PHONE');
    put('deskLat',status?decimal(p.lat,5)+(p.lat>=0?'° N':'° S'):'NO FIX');
    put('deskLon',status?decimal(Math.abs(p.lon),5)+(p.lon>=0?'° E':'° W'):'NO FIX');
    put('homeNavCoord',status?decimal(p.lat,5)+', '+decimal(p.lon,5):'NO LIVE POSITION');
    put('homeNavElevation',status?fmtFeet(p.alt):'—');
    put('homeNavAccuracy',status?'±'+Math.round(info.accuracy)+' m':'—');
    put('homeNavFix',status?'RECENT':'NO FIX');
    put('homeFixQuality',status?'RECENT FIX':'NO FIX');
    setStatus('satCount',status);
    if(!status){ put('mobileFixState','NO FIX');put('homeHeading','—');put('homeHeadingCardinal','—'); }
    if(!status){
      ['homeBearing','homeDistanceNext','homeEta','homeVertSpeed','homeCourse','homeSensorAltitude','homeSensorGnss'].forEach(id=>put(id,'—'));
    }else{
      put('homeSensorAltitude',fmtFeet(p.alt));
      put('homeSensorGnss','RECENT FIX');
      put('homeCourse',validNum(p.heading)?bearingLabel(Number(p.heading)):'—');
    }
    put('homeSensorRtc','NOT VERIFIED');
    put('homeSensorBaro',validNum(telemetry?.env?.pressureHpa)&&fresh(telemetryAt,15000)?Number(telemetry.env.pressureHpa).toFixed(1)+' hPa':'—');
    put('homeSensorWind','—');
    put('homeSensorMesh','NO VERIFIED LINK');
    const map=window.FIELD_MAP_ENGINE?.state;
    put('homeMapPack',safeRead('offline-map-active',null)?'CHECK PACK IN MAP':'CHECK MAP MANAGER');
  }
  function nodes(){
    const list=window.FIELD_MESH?.state?.nodes||[];
    const active=Array.isArray(list)?list.filter(n=>fresh(n.lastHeard,300000)&&!n.demo).length:0;
    const count=active?String(active):'—';
    ['meshCount','deskMeshCount'].forEach(id=>put(id,count));
    put('homeMeshRows',active?active+' recently heard node(s) · OPEN COMMS FOR DETAILS':'NO RECENT MESH NODE DATA');
    const el=$('meshCount');if(el)setStatus('meshCount',active>0);
    put('homeSensorMesh',active?active+' RECENT NODE(S)':'NO VERIFIED LINK');
  }
  function update(){
    const info=position();
    mapState(info);integrity(info);nodes();tables(info);
    if(phoneBattery==null){
      ['mobileBattery','deskBatteryPct','powerPercent'].forEach(id=>put(id,'UNAVAILABLE'));
    }
  }
  function initBattery(){
    if(typeof navigator.getBattery!=='function'){update();return;}
    navigator.getBattery().then(b=>{
      const refresh=()=>{phoneBattery=validNum(b.level)?Number(b.level):null;update();};
      refresh();b.addEventListener('levelchange',refresh);b.addEventListener('chargingchange',refresh);
    }).catch(()=>{phoneBattery=null;update();});
  }
  document.addEventListener('fieldos:telemetry',e=>{
    const d=e.detail||{};
    if(d&&typeof d==='object'){telemetry=d;telemetryAt=Date.now();}
    update();
  });
  ['fieldos:positionchange','fieldos:routechange','fieldos:waypointschange','fieldos:trackchange','fieldos:meshroster','fieldos:viewchange'].forEach(name=>document.addEventListener(name,update));
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)update()});
  initBattery();update();
  if(window.FIELD_RUNTIME?.every)window.FIELD_RUNTIME.every(update,3000);
  window.FIELD_SAFETY={position,update};
})();
