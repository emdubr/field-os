(() => {
  'use strict';

  const MAP_ID='routePlannerMap';
  const OVERPASS_ENDPOINTS=[
    'https://overpass.kumi.systems/api/interpreter',
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  const graphCache=new Map();
  const pendingGraphs=new Map();
  const CACHE_MS=20*60*1000;
  const legCache=new Map();
  let lastSuccessfulAnchors=[];
  const legKey=(a,b)=>[a.lat,a.lon,b.lat,b.lon].map(n=>Number(n).toFixed(6)).join(',');
  let anchors=[];
  let snapped=[];
  let busy=false;
  let aborter=null;
  let initialized=false;
  let plannerMap=null;
  let plannerRouteLayer=null;
  let plannerPreviewLayer=null;
  let plannerRouteRenderer=null;
  let plannerPreviewRenderer=null;
  let plannerDomRouteSvg=null;
  let plannerDomRouteGeometry=[];
  let plannerRouteRedrawFrame=0;
  let plannerZooming=false;
  let plannerAnchorLayer=null;
  let plannerSnapLayer=null;
  let plannerDirectionLayer=null;
  let plannerUserLayer=null;
  let plannerBaseFallbackActive=false;
  let hasActivated=false;
  let hoverPoint=null;
  let routingResolvedAnchors=0;
  let followWatchId=null;
  let followEnabled=false;
  let latestFollowPosition=null;
  let gaiaRouteEnabled=true;
  const SAVED_ROUTES_KEY='fieldos-v12-saved-routes';
  const GAIA_LAYER_KEY='fieldos-v12-gaia-route-layer';

  const $=id=>document.getElementById(id);
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  const miles=(a,b)=>{
    const R=3958.7613,r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r,la1=a.lat*r,la2=b.lat*r;
    const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;
    return 2*R*Math.asin(Math.min(1,Math.sqrt(h)));
  };
  const meters=(a,b)=>miles(a,b)*1609.344;
  const state=()=>window.FIELD_ROUTE_STATE;

  class RoutePlannerError extends Error{
    constructor(code,message,meta={}){
      super(message);
      this.name='RoutePlannerError';
      this.code=code;
      this.meta=meta||{};
    }
  }
  const rpError=(code,message,meta={})=>new RoutePlannerError(code,message,meta);
  let lastDiagnostic={code:'RP-000',stage:'READY',detail:'NO ERROR',meta:{},time:new Date().toISOString()};

  function diagnostic(code='RP-000',stage='READY',detail='',meta={}){
    lastDiagnostic={code,stage,detail:String(detail||''),meta:meta||{},time:new Date().toISOString()};
    const el=$('routePlannerDiag');
    if(el){
      el.textContent=[code,stage,String(detail||'')].filter(Boolean).join(' // ');
      el.classList.toggle('error',code!=='RP-000');
    }
  }
  function normalizeRouteError(err,fallback='RP-900'){
    if(err instanceof RoutePlannerError)return err;
    if(err?.name==='AbortError')return rpError('RP-099','Route calculation cancelled');
    return rpError(fallback,String(err?.message||err||'Unknown route planner error'));
  }
  function showRouteError(err,stage='ROUTING',suffix=''){
    const e=normalizeRouteError(err);
    diagnostic(e.code,stage,e.message,e.meta);
    status(`${e.code} // ${e.message.toUpperCase()}${suffix}`,'error');
    console.warn('FIELD/OS route error',e.code,stage,e.message,e.meta);
    return e;
  }
  async function copyRouteDiagnostic(){
    const payload=[
      'FIELD/OS ROUTE DIAGNOSTIC',
      'BUILD: v3.29',
      `CODE: ${lastDiagnostic.code}`,
      `STAGE: ${lastDiagnostic.stage}`,
      `DETAIL: ${lastDiagnostic.detail}`,
      `META: ${JSON.stringify(lastDiagnostic.meta||{})}`,
      `MODE: ${routeMode()}`,
      `ANCHORS: ${anchors.length}`,
      `ONLINE: ${navigator.onLine}`,
      `TIME: ${lastDiagnostic.time}`
    ].join('\n');
    try{
      await navigator.clipboard.writeText(payload);
      const btn=$('copyRouteDiag');if(btn){const old=btn.textContent;btn.textContent='COPIED';setTimeout(()=>btn.textContent=old,1200)}
    }catch{
      diagnostic('RP-701','DIAGNOSTICS','Clipboard unavailable. Select the code text manually.');
    }
  }

  function status(text,kind=''){
    const el=$('routePlannerStatus');
    if(!el)return;
    el.textContent=text;
    el.className=`route-planner-status ${kind}`.trim();
  }
  function setBusy(on){
    busy=!!on;
    document.querySelectorAll('[data-route-plan-action]').forEach(b=>b.disabled=busy&&!['clear','recenter'].includes(b.dataset.routePlanAction));
    const snap=$('routeSnapMode');if(snap)snap.disabled=busy;
    $('routePlannerMap')?.classList.toggle('routing-busy',busy);
    updateControls();
  }
  function routeMode(){return $('routeSnapMode')?.value||'trail'}
  function planMeta(){return state()?.getPlan?.()||{}}

  function sanitizeAnchors(list){
    return (Array.isArray(list)?list:[]).filter(valid).slice(0,30).map(p=>({lat:Number(p.lat),lon:Number(p.lon)}));
  }
  function loadAnchors(){
    try{gaiaRouteEnabled=localStorage.getItem(GAIA_LAYER_KEY)!=='off'}catch{gaiaRouteEnabled=true}
    updateGaiaLayerButton();
    const plan=planMeta(),pts=state()?.getPoints?.()||[];
    anchors=sanitizeAnchors(plan.anchors);
    if(!anchors.length&&pts.length>=2)anchors=[{lat:+pts[0].lat,lon:+pts[0].lon},{lat:+pts.at(-1).lat,lon:+pts.at(-1).lon}];
    if($('routeSnapMode'))$('routeSnapMode').value=plan.routingMode==='direct'?'direct':'trail';
    if(pts.length>1)lastSuccessfulAnchors=sanitizeAnchors(plan.routedAnchors||anchors);
    for(const leg of plan.legs||[])if(valid(leg.a)&&valid(leg.b)&&Array.isArray(leg.result?.points))legCache.set(legKey(leg.a,leg.b),leg.result);
  }

  function updateControls(){
    const count=anchors.length;
    const a=$('routeAnchorCount');if(a)a.textContent=String(count);
    const help=$('routePlannerHelp');
    if(help)help.textContent=count===0?'Tap the map to set a start point.':count===1?'Start set. Tap the map to set a destination.':'Tap the map to add another via point. The route will recalculate.';
    $('undoRoutePoint')?.toggleAttribute('disabled',count===0||busy);
    $('reverseRoute')?.toggleAttribute('disabled',count<2||busy);
    $('clearRoute')?.toggleAttribute('disabled',count===0);
  }

  function geometryFromLegs(legs){
    const out=[];
    for(const leg of Array.isArray(legs)?legs:[]){
      const pts=(leg?.result?.points||[]).filter(valid).map(p=>({lat:+p.lat,lon:+p.lon}));
      if(pts.length<2)continue;
      if(!out.length)out.push(...pts);
      else{
        const join=meters(out.at(-1),pts[0]);
        if(join>2){
          // Geometry should normally be continuous; preserve the actual snapped
          // points rather than inventing a straight anchor-to-anchor shortcut.
          out.push(pts[0]);
        }
        out.push(...pts.slice(1));
      }
    }
    return dedupe(out);
  }
  function authoritativeGeometry(route=state()?.getPoints?.()||[]){
    const plan=planMeta();
    if(plan.routingMode==='trail'){
      const fromLegs=geometryFromLegs(plan.legs);
      if(fromLegs.length>1)return fromLegs;
    }
    return dedupe((Array.isArray(route)?route:[]).filter(valid));
  }
  function routeBearing(a,b){
    const r=Math.PI/180,y=Math.sin((b.lon-a.lon)*r)*Math.cos(b.lat*r);
    const x=Math.cos(a.lat*r)*Math.sin(b.lat*r)-Math.sin(a.lat*r)*Math.cos(b.lat*r)*Math.cos((b.lon-a.lon)*r);
    return (Math.atan2(y,x)*180/Math.PI+360)%360;
  }
  function updateGaiaLayerButton(){
    const btn=$('gaiaRouteLayer');
    if(!btn)return;
    btn.classList.toggle('active',gaiaRouteEnabled);
    btn.setAttribute('aria-pressed',gaiaRouteEnabled?'true':'false');
    btn.textContent=gaiaRouteEnabled?'ROUTE LAYER // ON':'ROUTE LAYER // OFF';
  }
  function toggleGaiaRouteLayer(){
    gaiaRouteEnabled=!gaiaRouteEnabled;
    try{localStorage.setItem(GAIA_LAYER_KEY,gaiaRouteEnabled?'on':'off')}catch{}
    updateGaiaLayerButton();
    overlay(state()?.getPoints?.()||[]);
    refreshDomRouteLayer();
  }
  function drawRouteDirections(points,c){
    if(!plannerDirectionLayer||!gaiaRouteEnabled)return 0;
    const pts=(Array.isArray(points)?points:[]).filter(valid);
    if(pts.length<2)return 0;
    const cumulative=[0];let total=0;
    for(let i=1;i<pts.length;i++){total+=meters(pts[i-1],pts[i]);cumulative.push(total)}
    if(total<80)return;
    const count=clamp(Math.floor(total/450),2,10);
    for(let k=1;k<=count;k++){
      const target=total*(k/(count+1));
      let i=1;while(i<cumulative.length&&cumulative[i]<target)i++;
      if(i>=pts.length)i=pts.length-1;
      const a=pts[i-1],b=pts[i],seg=Math.max(1,cumulative[i]-cumulative[i-1]);
      const t=clamp((target-cumulative[i-1])/seg,0,1);
      const p={lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t};
      const deg=routeBearing(a,b);
      const icon=L.divIcon({
        className:'gaia-route-direction-wrap',
        html:`<span class="gaia-route-direction" style="transform:rotate(${deg}deg)">▲</span>`,
        iconSize:[18,18],iconAnchor:[9,9]
      });
      L.marker([p.lat,p.lon],{pane:'fieldRouteDirectionPane',icon,interactive:false,keyboard:false}).addTo(plannerDirectionLayer);
    }
    return count;
  }

  function ensureDomRouteLayer(){
    const host=$(MAP_ID);
    if(!host)return null;
    if(plannerDomRouteSvg?.isConnected)return plannerDomRouteSvg;
    const ns='http://www.w3.org/2000/svg';
    const svg=document.createElementNS(ns,'svg');
    svg.setAttribute('class','planner-dom-route-layer');
    svg.setAttribute('aria-hidden','true');
    svg.innerHTML='<polyline class="route-dom-casing"/><polyline class="route-dom-main"/><polyline class="route-dom-highlight"/>';
    host.appendChild(svg);
    plannerDomRouteSvg=svg;
    return svg;
  }
  function drawDomRouteLayer(points=[]){
    const svg=ensureDomRouteLayer();
    if(!svg||!plannerMap)return;
    const pts=(Array.isArray(points)?points:[]).filter(valid);
    plannerDomRouteGeometry=pts.map(p=>({lat:+p.lat,lon:+p.lon}));
    const rect=plannerMap.getContainer().getBoundingClientRect();
    const w=Math.max(1,Math.round(rect.width)),h=Math.max(1,Math.round(rect.height));
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    svg.setAttribute('width',String(w));svg.setAttribute('height',String(h));
    const poly=gaiaRouteEnabled&&pts.length>1
      ?pts.map(p=>{const q=plannerMap.latLngToContainerPoint([p.lat,p.lon]);return `${q.x.toFixed(1)},${q.y.toFixed(1)}`}).join(' ')
      :'';
    svg.querySelectorAll('polyline').forEach(el=>el.setAttribute('points',poly));
    svg.classList.toggle('has-route',!!poly);
  }
  function refreshDomRouteLayer(){drawDomRouteLayer(plannerDomRouteGeometry)}
  function scheduleDomRouteLayer(){
    if(plannerRouteRedrawFrame)return;
    plannerRouteRedrawFrame=requestAnimationFrame(()=>{
      plannerRouteRedrawFrame=0;
      if(!plannerZooming)refreshDomRouteLayer();
    });
  }
  function setDomRouteZooming(on){
    plannerZooming=!!on;
    const svg=ensureDomRouteLayer();
    if(svg)svg.classList.toggle('route-zooming',plannerZooming);
    if(!plannerZooming)scheduleDomRouteLayer();
  }

  function plannerColors(){
    const st=getComputedStyle(document.body);
    return {
      route:st.getPropertyValue('--warn').trim()||'#ffd166',
      fg:st.getPropertyValue('--fg').trim()||'#baf7c7',
      fg2:st.getPropertyValue('--fg2').trim()||'#72e58e',
      panel:st.getPropertyValue('--panel2').trim()||'#09120b',
      bg:st.getPropertyValue('--bg').trim()||'#071009'
    };
  }

  function ensurePlannerMap(){
    if(plannerMap)return plannerMap;
    const el=$(MAP_ID);
    if(!el)return null;
    if(!window.L){
      showRouteError(rpError('RP-002','Map library failed to load. Refresh FIELD/OS while online.'),'STARTUP');
      el.innerHTML='<div class="route-map-load-error"><b>RP-002 // MAP ENGINE UNAVAILABLE</b><span>Leaflet did not load. Refresh FIELD/OS while online once so the planner map can be cached.</span></div>';
      return null;
    }
    const here=state()?.current?.()||{lat:44.4759,lon:-73.2121};
    plannerMap=L.map(el,{
      zoomControl:true,
      attributionControl:true,
      preferCanvas:false,
      doubleClickZoom:false,
      tap:true
    }).setView([here.lat,here.lon],14);

    const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'© OpenStreetMap contributors'
    }).addTo(plannerMap);

    const topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
      subdomains:'abc',
      maxZoom:17,
      opacity:.93,
      attribution:'OpenTopoMap'
    }).addTo(plannerMap);

    let topoErrors=0;
    topo.on('tileerror',()=>{
      topoErrors++;
      if(topoErrors>=3&&!plannerBaseFallbackActive){
        plannerBaseFallbackActive=true;
        topo.setOpacity(0);
        status('TOPO TILES UNAVAILABLE -- USING OSM BASEMAP','ready');
      }
    });

    const hiking=L.tileLayer('https://tile.waymarkedtrails.org/hiking/{z}/{x}/{y}.png',{
      maxZoom:18,
      opacity:.72,
      attribution:'Waymarked Trails'
    });
    hiking.on('tileerror',()=>{});
    hiking.addTo(plannerMap);

    // Keep route geometry above all raster/trail tiles like Gaia GPS.
    const routePane=plannerMap.createPane('fieldRoutePane');
    routePane.style.zIndex='610';
    routePane.style.pointerEvents='none';
    const previewPane=plannerMap.createPane('fieldRoutePreviewPane');
    previewPane.style.zIndex='605';
    previewPane.style.pointerEvents='none';
    const snapPane=plannerMap.createPane('fieldRouteSnapPane');
    snapPane.style.zIndex='620';
    snapPane.style.pointerEvents='none';
    const anchorPane=plannerMap.createPane('fieldRouteAnchorPane');
    anchorPane.style.zIndex='630';
    const directionPane=plannerMap.createPane('fieldRouteDirectionPane');
    directionPane.style.zIndex='760';
    directionPane.style.pointerEvents='none';

    // Explicit SVG renderers avoid the custom-pane Canvas visibility issue.
    plannerRouteRenderer=L.svg({pane:'fieldRoutePane',padding:.65});
    plannerPreviewRenderer=L.svg({pane:'fieldRoutePreviewPane',padding:.65});

    plannerRouteLayer=L.layerGroup().addTo(plannerMap);
    plannerPreviewLayer=L.layerGroup().addTo(plannerMap);
    plannerAnchorLayer=L.layerGroup().addTo(plannerMap);
    plannerSnapLayer=L.layerGroup().addTo(plannerMap);
    plannerDirectionLayer=L.layerGroup().addTo(plannerMap);
    plannerUserLayer=L.layerGroup().addTo(plannerMap);

    plannerMap.on('click',e=>{if(!busy)addAnchor({lat:e.latlng.lat,lon:e.latlng.lng})});
    plannerMap.on('mousemove',e=>{
      if(busy||!anchors.length)return;
      hoverPoint={lat:e.latlng.lat,lon:e.latlng.lng};
      overlay(state()?.getPoints?.()||[]);
    });
    plannerMap.on('mouseout',()=>{
      if(!hoverPoint)return;
      hoverPoint=null;
      overlay(state()?.getPoints?.()||[]);
    });
    plannerMap.on('load',()=>requestAnimationFrame(()=>{plannerMap?.invalidateSize(false);refreshDomRouteLayer()}));
    // Pan redraws are coalesced to one paint per animation frame. Zoom uses
    // Leaflet's animation without recomputing every route point on every tick.
    plannerMap.on('move resize',scheduleDomRouteLayer);
    plannerMap.on('zoomstart',()=>setDomRouteZooming(true));
    plannerMap.on('zoomend',()=>setDomRouteZooming(false));
    plannerMap.on('moveend',scheduleDomRouteLayer);
    return plannerMap;
  }

  function fitPlanner(points,maxZoom=16){
    const map=ensurePlannerMap();
    const pts=(Array.isArray(points)?points:[]).filter(valid);
    if(!map||!pts.length)return;
    if(pts.length===1){map.setView([pts[0].lat,pts[0].lon],Math.min(maxZoom,15));return;}
    map.fitBounds(pts.map(p=>[p.lat,p.lon]),{padding:[42,42],maxZoom});
  }

  function overlay(route=state()?.getPoints?.()||[]){
    const map=ensurePlannerMap();
    if(map&&plannerRouteLayer&&plannerPreviewLayer&&plannerAnchorLayer&&plannerSnapLayer&&plannerDirectionLayer){
      const c=plannerColors();
      plannerRouteLayer.clearLayers();plannerPreviewLayer.clearLayers();plannerAnchorLayer.clearLayers();plannerSnapLayer.clearLayers();plannerDirectionLayer.clearLayers();
      const pts=authoritativeGeometry(route);
      $('routePlannerMap')?.classList.toggle('route-has-line',gaiaRouteEnabled&&pts.length>1);
      const geometryState=$('routeGeometryState');
      if(geometryState)geometryState.textContent=pts.length>1?`SNAPPED GEOMETRY // ${pts.length} PTS`:'SNAPPED GEOMETRY // NONE';

      // Route Layer: draw the authoritative geometry in a dedicated DOM SVG
      // above Leaflet. This avoids Canvas/SVG pane renderer differences.
      drawDomRouteLayer(pts);
      const arrowCount=gaiaRouteEnabled&&pts.length>1?drawRouteDirections(pts,c):0;
      if(geometryState&&pts.length>1)geometryState.textContent=`SNAPPED GEOMETRY // ${pts.length} PTS // ${arrowCount} ARROWS`;

      // While planning, always show the unresolved leg(s) immediately as a dashed guide.
      if(anchors.length){
        const resolved=busy?Math.max(1,routingResolvedAnchors):Math.max(1,lastSuccessfulAnchors.length);
        let guide=[];
        if(resolved<anchors.length){
          const start=pts.length?pts.at(-1):anchors[Math.max(0,resolved-1)];
          if(valid(start))guide.push(start);
          guide.push(...anchors.slice(resolved).filter(valid));
        }
        if(!busy&&valid(hoverPoint)){
          const start=anchors.at(-1);
          if(valid(start))guide=guide.length?[...guide,hoverPoint]:[start,hoverPoint];
        }
        if(guide.length>1){
          L.polyline(guide.map(p=>[p.lat,p.lon]),{
            pane:'fieldRoutePreviewPane',renderer:plannerPreviewRenderer,className:'gaia-route-preview',
            color:c.route,weight:4,opacity:.95,dashArray:'10 8',lineCap:'round',interactive:false
          }).addTo(plannerPreviewLayer);
        }
      }

      anchors.forEach((p,i)=>{
        if(!valid(p))return;
        const label=i===0?'S':i===anchors.length-1?'E':String(i);
        L.circleMarker([p.lat,p.lon],{
          pane:'fieldRouteAnchorPane',radius:8,color:c.fg,weight:2,fillColor:c.panel,fillOpacity:1
        }).bindTooltip(label,{permanent:true,direction:'center',className:'planner-leaflet-label'}).addTo(plannerAnchorLayer);
        const sp=snapped[i];
        if(valid(sp)){
          L.polyline([[p.lat,p.lon],[sp.lat,sp.lon]],{
            pane:'fieldRouteSnapPane',color:c.fg2,weight:1.5,opacity:.7,dashArray:'4 5'
          }).addTo(plannerSnapLayer);
        }
      });
      snapped.forEach(p=>{
        if(!valid(p))return;
        L.circleMarker([p.lat,p.lon],{
          pane:'fieldRouteSnapPane',radius:4,color:c.bg,weight:2,fillColor:c.fg2,fillOpacity:1
        }).addTo(plannerSnapLayer);
      });
    }
    updateControls();
  }

  function activate(){
    const el=$(MAP_ID);
    if(!el){
      showRouteError(rpError('RP-003','Route planner map container is missing.'),'STARTUP');
      return false;
    }
    try{
      if(!initialized){
        const map=ensurePlannerMap();
        if(!map)return false;
        bindControls();
        initialized=true;
      }

      const st=state(),firstOpen=!hasActivated;
      if(st){
        loadAnchors();
        const rawPts=st.getPoints?.()||[];
        const plan=st.getPlan?.()||{};
        const pts=authoritativeGeometry(rawPts);
        if(plan.routingMode==='trail'&&pts.length>1&&pts.length!==rawPts.length){
          st.setPoints?.(pts);
          st.setMeta?.({...plan,points:pts});
        }
        const savedProfile=Array.isArray(plan.elevationProfile)&&plan.elevationProfile.length>1?{
          samples:plan.elevationProfile,
          gainFt:Number(plan.elevationGainFt)||0,
          lossFt:Number(plan.elevationLossFt)||0,
          minFt:Number(plan.elevationMinFt)||0,
          maxFt:Number(plan.elevationMaxFt)||0,
          maxGrade:Number(plan.elevationMaxGrade??plan.grade)||0
        }:null;
        applyRouteStats(pts,savedProfile,savedProfile?'ready':(pts.length>1?'unavailable':'empty'));
        renderSavedRoutes();updateFollowButton();updateGaiaLayerButton();
        if(latestFollowPosition)drawPlannerPosition(latestFollowPosition);
        requestAnimationFrame(()=>{
          plannerMap?.invalidateSize(false);
          overlay(pts);
          if(firstOpen&&pts.length>1)fitPlanner(pts,16);
          else if(firstOpen&&anchors.length)fitPlanner(anchors,16);
          else if(firstOpen){
            const here=st.current?.()||{lat:44.4759,lon:-73.2121};
            plannerMap?.setView([here.lat,here.lon],14);
          }
        });
      }else{
        const fallback={lat:44.4759,lon:-73.2121};
        requestAnimationFrame(()=>{
          plannerMap?.invalidateSize(false);
          plannerMap?.setView([fallback.lat,fallback.lon],14);
        });
        diagnostic('RP-001','STARTUP','Route data bridge not ready.');
        status('RP-001 // MAP READY -- WAITING FOR ROUTE DATA BRIDGE','loading');
        return true;
      }

      if(!hasActivated)status(routeMode()==='trail'?'SNAP TO TRAILS READY':'DIRECT / OFF-TRAIL MODE','ready');
      hasActivated=true;return true;
    }catch(err){
      console.error('FIELD/OS route planner startup failed',err);
      const startupError=showRouteError(err,'STARTUP');
      const box=$(MAP_ID);
      if(box&&!box.querySelector('.route-map-load-error')){
        box.insertAdjacentHTML('beforeend',`<div class="route-map-load-error"><b>${startupError.code} // ROUTE MAP STARTUP ERROR</b><span>${startupError.message}</span></div>`);
      }
      return false;
    }
  }

  function bindControls(){
    document.querySelectorAll('[data-route-plan-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.routePlanAction;
      if(action==='current')addAnchor(latestFollowPosition||state()?.current?.());
      else if(action==='undo')undo();
      else if(action==='reverse')reverse();
      else if(action==='clear')clearAll();
      else if(action==='recenter')recenter();
      else if(action==='follow')toggleFollow();
      else if(action==='load-saved')loadSelectedRoute();
      else if(action==='gaia-layer')toggleGaiaRouteLayer();
    }));
    $('routeSnapMode')?.addEventListener('change',()=>{
      state()?.setMeta?.({routingMode:routeMode()});
      if(anchors.length>=2)recalculate();
      else status(routeMode()==='trail'?'SNAP TO TRAILS READY':'DIRECT / OFF-TRAIL MODE','ready');
    });
    $('saveRouteVisible')?.addEventListener('click',e=>{e.preventDefault();saveCurrentRoute()});
    $('routeSaveTop')?.addEventListener('click',e=>{e.preventDefault();saveCurrentRoute()});
    $('copyRouteDiag')?.addEventListener('click',copyRouteDiagnostic);
    renderSavedRoutes();
  }

  function addAnchor(p){
    if(!valid(p))return showRouteError(rpError('RP-101','Invalid route control point.'),'CONTROL POINT');
    if(anchors.length>=30)return showRouteError(rpError('RP-102','Waypoint limit reached. Save this route before adding more.'),'CONTROL POINT');
    hoverPoint=null;
    anchors=[...anchors,{lat:+p.lat,lon:+p.lon}];
    navigator.vibrate?.(18);
    state()?.setMeta?.({anchors,routingMode:routeMode()});
    // Draw the new leg immediately before the network snap begins.
    overlay();
    if(anchors.length>=2)recalculate();
    else{
      state()?.setMeta?.({anchors:[anchors[0]],routedAnchors:[],legs:[],routingMode:routeMode(),routeBuildState:'START'});
      state()?.setPoints?.([anchors[0]]);
      overlay([anchors[0]]);
      status('START SET -- TAP DESTINATION','ready');
      if(routeMode()==='trail')fetchTrailGraph(anchors[0],anchors[0]).catch(()=>{});
    }
  }

  function undo(){
    if(!anchors.length)return;
    aborter?.abort();setBusy(false);
    anchors=anchors.slice(0,-1);snapped=[];
    state()?.setMeta?.({anchors,routedAnchors:[],legs:[],routingMode:routeMode(),routeBuildState:'EDITING'});
    if(anchors.length>=2)recalculate();
    else{
      const pts=anchors.length?[anchors[0]]:[];
      state()?.setPoints?.(pts);overlay(pts);
      status(anchors.length?'START SET -- TAP DESTINATION':'TAP MAP TO SET START','ready');
    }
  }

  function reverse(){
    if(anchors.length<2)return;
    aborter?.abort();setBusy(false);
    const plan=planMeta(),points=state()?.getPoints?.()||[];
    anchors=[...anchors].reverse();snapped.reverse();
    if(points.length<2){state()?.setMeta?.({anchors});recalculate();return;}
    points.reverse();setBusy(true);
    const reversedAnchors=anchors.map(p=>({...p}));
    const samples=plan.elevationProfile,total=samples?.at(-1)?.distanceM||0;
    const profile=Array.isArray(samples)&&samples.length>1?{
      samples:[...samples].reverse().map(p=>({...p,distanceM:total-p.distanceM})),
      gainFt:plan.elevationLossFt,lossFt:plan.elevationGainFt,minFt:plan.elevationMinFt,maxFt:plan.elevationMaxFt,maxGrade:Number(plan.elevationMaxGrade??plan.grade)||0
    }:null;
    state()?.setPoints?.(points);
    state()?.setMeta?.({...plan,anchors:reversedAnchors,routedAnchors:reversedAnchors,points,legs:[],routeBuildState:'REVERSED',
      elevationProfile:profile?.samples||null,elevationGainFt:profile?.gainFt??null,elevationLossFt:profile?.lossFt??null,
      gain:profile?.gainFt||0,grade:plan.grade||0});
    // setPoints emits a route event; restore the newly reversed control points.
    anchors=sanitizeAnchors(state()?.getPlan?.().anchors);
    lastSuccessfulAnchors=anchors.map(p=>({...p}));
    applyRouteStats(points,profile);state()?.save?.();overlay(points);setBusy(false);
    status(`ROUTE REVERSED -- ${routeDistanceMiles(points).toFixed(2)} MI // NO DOWNLOAD NEEDED`,'ready');
  }

  function clearAll(){
    aborter?.abort();setBusy(false);
    anchors=[];snapped=[];lastSuccessfulAnchors=[];
    state()?.setMeta?.({anchors:[],routedAnchors:[],legs:[],routingMode:routeMode(),routingSource:null,routeBuildState:'EMPTY',routeBuildLeg:0});
    state()?.setPoints?.([]);overlay([]);applyRouteStats([],null,'empty');
    status('TAP MAP TO SET START','ready');
  }

  function recenter(){
    const pts=authoritativeGeometry(state()?.getPoints?.()||[]);
    if(pts.length>1)fitPlanner(pts,16);
    else if(anchors.length)fitPlanner(anchors,16);
    else{
      const here=state()?.current?.()||{lat:44.4759,lon:-73.2121};
      ensurePlannerMap()?.setView([here.lat,here.lon],14);
    }
  }

  function publishPlannerPosition(pos){
    if(!valid(pos))return;
    latestFollowPosition={lat:+pos.lat,lon:+pos.lon,alt:pos.alt??null,accuracy:Number(pos.accuracy)||null,heading:Number.isFinite(Number(pos.heading))?Number(pos.heading):null,source:pos.source||'PHONE GPS'};
    window.FIELD_CURRENT_POSITION={...latestFollowPosition};
    try{localStorage.setItem('fieldos-v12-last-position',JSON.stringify(latestFollowPosition))}catch{}
    document.dispatchEvent(new CustomEvent('fieldos:positionchange',{detail:{...latestFollowPosition}}));
  }

  function drawPlannerPosition(pos=latestFollowPosition){
    if(!plannerMap||!plannerUserLayer||!valid(pos))return;
    plannerUserLayer.clearLayers();
    const c=plannerColors(),p=[pos.lat,pos.lon],acc=Math.max(0,Number(pos.accuracy)||0);
    if(acc){
      L.circle(p,{radius:acc,color:c.fg2,weight:1,opacity:.8,fillColor:c.fg2,fillOpacity:.08,interactive:false}).addTo(plannerUserLayer);
    }
    L.circleMarker(p,{radius:8,color:'#ffffff',weight:2,fillColor:c.fg2,fillOpacity:1,interactive:false})
      .bindTooltip('YOU',{permanent:true,direction:'top',offset:[0,-8],className:'planner-user-label'})
      .addTo(plannerUserLayer);
    if(followEnabled)plannerMap.panTo(p,{animate:true,duration:.35});
    const gps=$('plannerGpsStatus');
    if(gps)gps.textContent=`GPS // ${acc?('±'+Math.round(acc)+' m'):'LIVE'}${followEnabled?' // FOLLOWING':''}`;
  }

  function updateFollowButton(){
    const btn=$('routeFollowMe');
    if(!btn)return;
    btn.classList.toggle('active',followEnabled);
    btn.setAttribute('aria-pressed',followEnabled?'true':'false');
    btn.textContent=followEnabled?'FOLLOWING GPS':'FOLLOW ME';
  }

  function startFollow(){
    if(!navigator.geolocation){
      showRouteError(rpError('RP-501','GPS follow is unavailable in this browser.'),'GPS');
      return;
    }
    if(followWatchId!=null){followEnabled=true;updateFollowButton();drawPlannerPosition();return;}
    followEnabled=true;updateFollowButton();
    status('REQUESTING LIVE GPS -- KEEP FIELD/OS OPEN','loading');
    followWatchId=navigator.geolocation.watchPosition(
      p=>{
        const pos={lat:p.coords.latitude,lon:p.coords.longitude,alt:p.coords.altitude,accuracy:p.coords.accuracy,heading:p.coords.heading,source:'PHONE GPS'};
        publishPlannerPosition(pos);drawPlannerPosition(pos);
        const pts=state()?.getPoints?.()||[];
        if(!busy)status(pts.length>1?'FOLLOWING ROUTE -- LIVE GPS':'LIVE GPS FOLLOW -- PLAN OR LOAD A ROUTE','ready');
      },
      err=>{
        const code=err?.code===1?'RP-502':err?.code===3?'RP-503':'RP-504';
        const msg=err?.code===1?'GPS permission denied.':err?.code===3?'GPS request timed out.':'GPS position unavailable.';
        showRouteError(rpError(code,msg,{browserMessage:String(err?.message||'')}),'GPS');
        stopFollow();
      },
      {enableHighAccuracy:true,maximumAge:2000,timeout:15000}
    );
  }

  function stopFollow(){
    if(followWatchId!=null&&navigator.geolocation)navigator.geolocation.clearWatch(followWatchId);
    followWatchId=null;followEnabled=false;updateFollowButton();
    const gps=$('plannerGpsStatus');if(gps)gps.textContent=latestFollowPosition?'GPS // PAUSED':'GPS // OFF';
  }

  function toggleFollow(){followEnabled?stopFollow():startFollow()}

  function readSavedRoutes(){
    try{
      const parsed=JSON.parse(localStorage.getItem(SAVED_ROUTES_KEY)||'[]');
      return Array.isArray(parsed)?parsed:[];
    }catch{return []}
  }
  function writeSavedRoutes(routes){
    try{localStorage.setItem(SAVED_ROUTES_KEY,JSON.stringify(routes));return true}catch(err){console.warn('FIELD/OS saved routes write failed',err);return false}
  }
  function renderSavedRoutes(){
    const sel=$('savedRouteSelect');if(!sel)return;
    const routes=readSavedRoutes();
    const current=sel.value;
    sel.innerHTML='<option value="">SAVED ROUTES…</option>'+routes.map(x=>`<option value="${x.id}">${String(x.name||'FIELD ROUTE').replace(/[<>&"]/g,'')} // ${Number(x.distanceMiles||0).toFixed(2)} MI</option>`).join('');
    if(routes.some(x=>x.id===current))sel.value=current;
    const count=$('savedRouteCount');if(count)count.textContent=String(routes.length);
  }
  function saveCurrentRoute(){
    const st=state(),points=st?.getPoints?.()||[];
    if(points.length<2){showRouteError(rpError('RP-601','Plot or load a route before saving.'),'SAVE');return}
    const plan=st.getPlan?.()||{},name=$('routeName')?.value.trim()||plan.name||'FIELD ROUTE';
    const snapshot={
      id:'route-'+Date.now(),name,savedAt:new Date().toISOString(),
      points:points.map(p=>({lat:+p.lat,lon:+p.lon})),
      anchors:sanitizeAnchors(anchors),
      routedAnchors:sanitizeAnchors(plan.routedAnchors||anchors),
      legs:Array.isArray(plan.legs)?plan.legs.map(leg=>({
        a:valid(leg?.a)?{lat:+leg.a.lat,lon:+leg.a.lon}:null,
        b:valid(leg?.b)?{lat:+leg.b.lat,lon:+leg.b.lon}:null,
        routeStart:valid(leg?.routeStart)?{lat:+leg.routeStart.lat,lon:+leg.routeStart.lon}:null,
        result:leg?.result&&Array.isArray(leg.result.points)?{
          ...leg.result,
          points:leg.result.points.filter(valid).map(p=>({lat:+p.lat,lon:+p.lon}))
        }:null
      })).filter(leg=>leg.a&&leg.b&&leg.result?.points?.length>1):[],
      routingMode:plan.routingMode||routeMode(),
      routingSource:plan.routingSource||'FIELD/OS',
      distanceMiles:routeDistanceMiles(points),
      elevationSource:plan.elevationSource||null,
      elevationGainFt:Number(plan.elevationGainFt)||0,
      elevationLossFt:Number(plan.elevationLossFt)||0,
      elevationMinFt:Number(plan.elevationMinFt)||0,
      elevationMaxFt:Number(plan.elevationMaxFt)||0,
      elevationMaxGrade:Number(plan.elevationMaxGrade??plan.grade)||0,
      elevationProfile:Array.isArray(plan.elevationProfile)?plan.elevationProfile:null,
      gain:Number(plan.gain)||0,grade:Number(plan.grade)||0,
      terrain:plan.terrain||'maintained',notes:plan.notes||''
    };
    const routes=readSavedRoutes();
    routes.unshift(snapshot);
    if(routes.length>10)routes.length=10;
    if(!writeSavedRoutes(routes)){showRouteError(rpError('RP-602','Local route storage is unavailable.'),'SAVE');return}
    st.setMeta?.({...plan,name,savedAt:snapshot.savedAt});st.save?.();
    renderSavedRoutes();
    if($('savedRouteSelect'))$('savedRouteSelect').value=snapshot.id;
    status(`ROUTE SAVED -- ${name.toUpperCase()} // ${snapshot.distanceMiles.toFixed(2)} MI`,'ready');
    navigator.vibrate?.(25);
  }
  function loadSelectedRoute(){
    const id=$('savedRouteSelect')?.value;if(!id)return showRouteError(rpError('RP-603','Select a saved route first.'),'LOAD');
    const saved=readSavedRoutes().find(x=>x.id===id);if(!saved)return showRouteError(rpError('RP-603','Saved route was not found.'),'LOAD');
    const st=state(),points=(saved.points||[]).filter(valid);
    if(points.length<2)return showRouteError(rpError('RP-604','Saved route has no usable geometry.'),'LOAD');
    anchors=sanitizeAnchors(saved.anchors);
    if(!anchors.length)anchors=[points[0],points.at(-1)];
    lastSuccessfulAnchors=anchors.map(p=>({...p}));routingResolvedAnchors=anchors.length;snapped=[];
    st?.setMeta?.({...saved,anchors,routedAnchors:anchors,legs:Array.isArray(saved.legs)?saved.legs:[]});st?.setPoints?.(points);st?.save?.();
    const profile=Array.isArray(saved.elevationProfile)&&saved.elevationProfile.length>1?{
      samples:saved.elevationProfile,gainFt:Number(saved.elevationGainFt)||0,lossFt:Number(saved.elevationLossFt)||0,
      minFt:Number(saved.elevationMinFt)||0,maxFt:Number(saved.elevationMaxFt)||0,maxGrade:Number(saved.elevationMaxGrade??saved.grade)||0
    }:null;
    if($('routeName'))$('routeName').value=saved.name||'FIELD ROUTE';
    applyRouteStats(points,profile,profile?'ready':'unavailable');overlay(points);fitPlanner(points,16);
    status(`SAVED ROUTE LOADED -- ${String(saved.name||'FIELD ROUTE').toUpperCase()} // ${routeDistanceMiles(points).toFixed(2)} MI`,'ready');
  }

  document.addEventListener('fieldos:positionchange',e=>{
    const p=e.detail;
    if(valid(p)){latestFollowPosition={...p};drawPlannerPosition(latestFollowPosition)}
  });


  function bboxFor(a,b){
    const legMiles=Math.max(.1,miles(a,b));
    const padMiles=clamp(Math.max(miles(a,b)<.01?.7:.4,legMiles*.22),.4,2);
    const midLat=(a.lat+b.lat)/2,latPad=padMiles/69,lonPad=padMiles/(69*Math.max(.25,Math.cos(midLat*Math.PI/180)));
    return {s:Math.min(a.lat,b.lat)-latPad,w:Math.min(a.lon,b.lon)-lonPad,n:Math.max(a.lat,b.lat)+latPad,e:Math.max(a.lon,b.lon)+lonPad};
  }
  function bboxKey(b){return [b.s,b.w,b.n,b.e].map(x=>(Math.round(x*200)/200).toFixed(3)).join(',')}
  function queryFor(b){
    return `[out:json][timeout:22];\nway["highway"~"^(path|footway|track|bridleway|steps|pedestrian|cycleway|unclassified|living_street|service|residential)$"]["access"!~"^(private|no)$"]["foot"!~"^no$"](${b.s.toFixed(6)},${b.w.toFixed(6)},${b.n.toFixed(6)},${b.e.toFixed(6)});\nout body geom;`;
  }

  function covers(box,a,b){
    const margin=.001;
    return [a,b].every(p=>p.lat>box.s+margin&&p.lat<box.n-margin&&p.lon>box.w+margin&&p.lon<box.e-margin);
  }
  function waitForGraph(promise,signal){
    if(!signal)return promise;
    if(signal.aborted)return Promise.reject(new DOMException('Cancelled','AbortError'));
    return new Promise((resolve,reject)=>{
      const stop=()=>reject(new DOMException('Cancelled','AbortError'));
      signal.addEventListener('abort',stop,{once:true});
      promise.then(resolve,reject).finally(()=>signal.removeEventListener('abort',stop));
    });
  }
  async function fetchTrailGraph(a,b,signal,force=false){
    if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
    for(const [key,entry] of graphCache){
      if(Date.now()-entry.created>CACHE_MS){graphCache.delete(key);continue;}
      if(!force&&covers(entry.box,a,b))return entry.graph;
    }
    for(const entry of pendingGraphs.values())if(covers(entry.box,a,b))return waitForGraph(entry.promise,signal);
    const box=bboxFor(a,b);
    if(force){box.s-=.035;box.n+=.035;box.w-=.05;box.e+=.05;}
    const key=bboxKey(box),q=queryFor(box);
    if(pendingGraphs.has(key))return waitForGraph(pendingGraphs.get(key).promise,signal);

    const controllers=OVERPASS_ENDPOINTS.map(()=>new AbortController());
    const failures=[];
    const cancelAll=()=>controllers.forEach(c=>c.abort());
    signal?.addEventListener('abort',cancelAll,{once:true});

    const requests=OVERPASS_ENDPOINTS.map((endpoint,i)=>new Promise((resolve,reject)=>{
      const controller=controllers[i];let deadline,timedOut=false;
      setTimeout(async()=>{
        if(controller.signal.aborted)return reject(new DOMException('Cancelled','AbortError'));
        deadline=setTimeout(()=>{timedOut=true;controller.abort()},24000);
        try{
          const res=await fetch(endpoint+'?data='+encodeURIComponent(q),{signal:controller.signal,cache:'no-store'});
          if(!res.ok)throw rpError('RP-202',`Trail-data server returned HTTP ${res.status}.`,{endpoint,status:res.status});
          let json;
          try{json=await res.json()}catch{throw rpError('RP-205','Trail-data server returned malformed JSON.',{endpoint})}
          const graph=buildGraph(json.elements||[]);
          if(graph.nodes.size<2||graph.segments.length<1)throw rpError('RP-204','No mapped walkable trails were returned for this area.',{endpoint,expanded:force});
          graph.rawElements=json.elements;resolve(graph);
        }catch(err){
          let e=normalizeRouteError(err,'RP-201');
          if(err?.name==='AbortError'&&timedOut)e=rpError('RP-203','Trail-data request timed out.',{endpoint});
          if(e.code!=='RP-099')failures.push({endpoint,code:e.code,message:e.message});
          reject(e);
        }finally{
          clearTimeout(deadline);
        }
      },[0,1200,3000][i]);
    }));

    const promise=Promise.any(requests).then(graph=>{
      graphCache.set(key,{box,graph,created:Date.now()});
      try{const raw=JSON.stringify({box,elements:graph.rawElements,created:Date.now()});if(raw.length<2500000)sessionStorage.setItem('fieldos-trail-network',raw)}catch{}
      delete graph.rawElements;
      if(graphCache.size>8)graphCache.delete(graphCache.keys().next().value);
      return graph;
    }).catch(()=>{
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      const codes=failures.map(x=>x.code);
      if(codes.length&&codes.every(x=>x==='RP-204'))throw rpError('RP-204','No mapped walkable trails were found in the search area.',{failures,expanded:force});
      if(codes.length&&codes.every(x=>x==='RP-203'))throw rpError('RP-203','All trail-data requests timed out.',{failures});
      if(codes.length&&codes.every(x=>x==='RP-202'))throw rpError('RP-202','All trail-data servers returned HTTP errors.',{failures});
      throw rpError('RP-201','Trail-data servers are unavailable or returned mixed failures.',{failures});
    }).finally(()=>{
      cancelAll();signal?.removeEventListener('abort',cancelAll);pendingGraphs.delete(key);
    });

    pendingGraphs.set(key,{box,promise});
    return waitForGraph(promise,signal);
  }

  try{
    const cached=JSON.parse(sessionStorage.getItem('fieldos-trail-network')||'null');
    if(cached?.box&&Array.isArray(cached.elements)&&Date.now()-cached.created<CACHE_MS){
      graphCache.set(bboxKey(cached.box),{box:cached.box,graph:buildGraph(cached.elements),created:cached.created});
    }
  }catch{}

  function wayFactor(tags={}){
    const h=tags.highway||'';
    if(h==='path')return .86;
    if(h==='footway')return .9;
    if(h==='track')return .98;
    if(h==='bridleway')return 1.03;
    if(h==='steps')return 1.12;
    if(h==='pedestrian')return 1.0;
    if(h==='cycleway')return 1.15;
    if(h==='unclassified')return 1.55;
    if(h==='living_street')return 1.65;
    if(h==='service')return 1.85;
    if(h==='residential')return 2.25;
    return 1.4;
  }

  function buildGraph(elements){
    const nodes=new Map(),adj=new Map(),segments=[];
    const addNode=(id,p)=>{if(!nodes.has(id))nodes.set(id,{id,lat:+p.lat,lon:+p.lon})};
    const addEdge=(a,b,w,tags)=>{
      if(!adj.has(a))adj.set(a,[]);adj.get(a).push({to:b,w,tags});
    };
    for(const way of elements){
      if(way.type!=='way'||!Array.isArray(way.geometry)||way.geometry.length<2)continue;
      const ids=Array.isArray(way.nodes)&&way.nodes.length===way.geometry.length?way.nodes:way.geometry.map((_,i)=>`${way.id}:${i}`);
      for(let i=0;i<way.geometry.length;i++)addNode(String(ids[i]),way.geometry[i]);
      const factor=wayFactor(way.tags||{});
      for(let i=1;i<way.geometry.length;i++){
        const a=String(ids[i-1]),b=String(ids[i]),pa=nodes.get(a),pb=nodes.get(b),d=meters(pa,pb);
        if(!Number.isFinite(d)||d<=0)continue;
        const w=d*factor;addEdge(a,b,w,way.tags||{});addEdge(b,a,w,way.tags||{});
        segments.push({a,b,pa,pb,tags:way.tags||{}});
      }
    }
    return {nodes,adj,segments};
  }

  function nearestNode(graph,p,maxMeters=500){
    let best=null;
    const cos=Math.max(.01,Math.cos(p.lat*Math.PI/180));
    for(const seg of graph.segments){
      const dx=(seg.pb.lon-seg.pa.lon)*cos,dy=seg.pb.lat-seg.pa.lat;
      const t=clamp(((p.lon-seg.pa.lon)*cos*dx+(p.lat-seg.pa.lat)*dy)/(dx*dx+dy*dy||1),0,1);
      const node={lat:seg.pa.lat+t*(seg.pb.lat-seg.pa.lat),lon:seg.pa.lon+t*(seg.pb.lon-seg.pa.lon)};
      const d=meters(p,node);if(d<=maxMeters&&(!best||d<best.d))best={seg,node,d,t};
    }
    if(!best)return null;
    if(best.t<1e-8)return {id:best.seg.a,node:best.seg.pa,d:best.d};
    if(best.t>1-1e-8)return {id:best.seg.b,node:best.seg.pb,d:best.d};
    const {seg,node}=best,id=`snap:${graph.nodes.size}`;node.id=id;graph.nodes.set(id,node);graph.adj.set(id,[]);
    // Split the selected edge so two points on the same segment connect directly.
    graph.adj.set(seg.a,(graph.adj.get(seg.a)||[]).filter(e=>e.to!==seg.b));
    graph.adj.set(seg.b,(graph.adj.get(seg.b)||[]).filter(e=>e.to!==seg.a));
    for(const [to,point] of [[seg.a,seg.pa],[seg.b,seg.pb]]){
      const w=meters(node,point)*wayFactor(seg.tags);
      graph.adj.get(id).push({to,w,tags:seg.tags});graph.adj.get(to).push({to:id,w,tags:seg.tags});
    }
    graph.segments.splice(graph.segments.indexOf(seg),1,{...seg,b:id,pb:node},{...seg,a:id,pa:node});
    return {id,node,d:best.d};
  }

  class MinHeap{
    constructor(){this.a=[]}
    push(item){let i=this.a.length;this.a.push(item);while(i){const p=(i-1)>>1;if(this.a[p].f<=item.f)break;this.a[i]=this.a[p];i=p;this.a[p]=item}}
    pop(){if(!this.a.length)return null;const root=this.a[0],last=this.a.pop();if(this.a.length){let i=0;this.a[0]=last;for(;;){let l=i*2+1,r=l+1,s=i;if(l<this.a.length&&this.a[l].f<this.a[s].f)s=l;if(r<this.a.length&&this.a[r].f<this.a[s].f)s=r;if(s===i)break;[this.a[i],this.a[s]]=[this.a[s],this.a[i]];i=s}}return root}
    get size(){return this.a.length}
  }

  function shortestPath(graph,startId,endId){
    if(startId===endId)return {path:[graph.nodes.get(startId)],visits:0,limitHit:false};
    const goal=graph.nodes.get(endId),open=new MinHeap(),g=new Map([[startId,0]]),came=new Map(),closed=new Set();
    open.push({id:startId,f:meters(graph.nodes.get(startId),goal)});
    let visits=0;
    const VISIT_LIMIT=120000;
    while(open.size&&visits<VISIT_LIMIT){
      const cur=open.pop();if(closed.has(cur.id))continue;closed.add(cur.id);visits++;
      if(cur.id===endId){
        const ids=[endId];let x=endId;
        while(came.has(x)){x=came.get(x);ids.push(x)}
        ids.reverse();return {path:ids.map(id=>graph.nodes.get(id)),visits,limitHit:false};
      }
      for(const edge of graph.adj.get(cur.id)||[]){
        if(closed.has(edge.to))continue;
        const ng=(g.get(cur.id)||0)+edge.w;
        if(ng<(g.get(edge.to)??Infinity)){
          g.set(edge.to,ng);came.set(edge.to,cur.id);
          const h=meters(graph.nodes.get(edge.to),goal);
          open.push({id:edge.to,f:ng+h*.84});
        }
      }
    }
    return {path:null,visits,limitHit:visits>=VISIT_LIMIT};
  }

  function dedupe(points){
    const out=[];
    for(const p of points){
      if(!valid(p))continue;
      const q={lat:+p.lat,lon:+p.lon};
      if(!out.length||meters(out.at(-1),q)>.8)out.push(q);
    }
    return out;
  }

  async function routeLeg(a,b,signal,retry=false){
    const cached=legCache.get(legKey(a,b));if(cached)return {...cached,cached:true};
    const back=legCache.get(legKey(b,a));
    if(back)return {...back,points:[...back.points].reverse(),startSnap:back.endSnap,endSnap:back.startSnap,cached:true};
    const legMi=miles(a,b);
    if(legMi>35)throw rpError('RP-301','Snapped leg is over 35 miles. Add an intermediate point.',{legMiles:+legMi.toFixed(2)});

    let source;
    try{
      source=await fetchTrailGraph(a,b,signal,retry);
    }catch(err){
      const e=normalizeRouteError(err,'RP-201');
      if(!retry&&e.code==='RP-204')return routeLeg(a,b,signal,true);
      throw e;
    }

    const graph={nodes:new Map(source.nodes),adj:new Map([...source.adj].map(([id,edges])=>[id,edges.slice()])),segments:source.segments.slice()};
    const snapRadius=retry?1200:550;

    const sa=nearestNode(graph,a,snapRadius);
    if(!sa){
      if(!retry)return routeLeg(a,b,signal,true);
      throw rpError('RP-302','Start point is too far from mapped walkable trail geometry.',{snapLimitM:snapRadius,nodes:graph.nodes.size,segments:graph.segments.length});
    }

    const sb=nearestNode(graph,b,snapRadius);
    if(!sb){
      if(!retry)return routeLeg(a,b,signal,true);
      throw rpError('RP-303','End point is too far from mapped walkable trail geometry.',{snapLimitM:snapRadius,startSnapM:Math.round(sa.d),nodes:graph.nodes.size,segments:graph.segments.length});
    }

    const search=shortestPath(graph,sa.id,sb.id);
    if(!search.path&&!retry)return routeLeg(a,b,signal,true);
    if(!search.path){
      if(search.limitHit)throw rpError('RP-305','Trail path search exceeded the graph complexity limit. Add an intermediate point.',{visits:search.visits,nodes:graph.nodes.size,segments:graph.segments.length});
      throw rpError('RP-304','Nearby mapped trails are not connected. Add an intermediate point or use DIRECT mode.',{visits:search.visits,startSnapM:Math.round(sa.d),endSnapM:Math.round(sb.d),nodes:graph.nodes.size,segments:graph.segments.length});
    }

    if(search.path.length<2&&legMi>.03)throw rpError('RP-306','Both control points snapped to the same trail location. Move one point farther along the trail.',{legMiles:+legMi.toFixed(3),startSnapM:Math.round(sa.d),endSnapM:Math.round(sb.d)});

    const result={
      points:search.path.map(p=>({lat:p.lat,lon:p.lon})),
      startSnap:{lat:sa.node.lat,lon:sa.node.lon,d:sa.d},
      endSnap:{lat:sb.node.lat,lon:sb.node.lon,d:sb.d},
      diagnostics:{retry,snapRadius,startSnapM:Math.round(sa.d),endSnapM:Math.round(sb.d),nodes:graph.nodes.size,segments:graph.segments.length,visits:search.visits}
    };
    legCache.set(legKey(a,b),result);
    if(legCache.size>100)legCache.delete(legCache.keys().next().value);
    return result;
  }

  function routeDistanceMiles(points){
    return (Array.isArray(points)?points:[]).reduce((sum,p,i,arr)=>i?sum+miles(arr[i-1],p):0,0);
  }

  function samplePolyline(points,maxSamples=140){
    const pts=(Array.isArray(points)?points:[]).filter(valid);
    if(pts.length<2)return pts;
    const seg=[],cum=[0];let total=0;
    for(let i=1;i<pts.length;i++){
      const d=meters(pts[i-1],pts[i]);seg.push(d);total+=d;cum.push(total);
    }
    const count=Math.min(maxSamples,Math.max(2,Math.ceil(total/75)+1));
    const out=[];let si=0;
    for(let k=0;k<count;k++){
      const target=total*(k/(count-1));
      while(si<seg.length-1&&cum[si+1]<target)si++;
      const a=pts[si],b=pts[si+1]||a,den=seg[si]||1,t=clamp((target-cum[si])/den,0,1);
      out.push({lat:a.lat+(b.lat-a.lat)*t,lon:a.lon+(b.lon-a.lon)*t,distanceM:target});
    }
    return out;
  }

  async function fetchElevationProfile(points,signal){
    const samples=samplePolyline(points,140);
    if(samples.length<2)return null;
    const controller=new AbortController();
    const relay=()=>controller.abort();signal?.addEventListener('abort',relay,{once:true});
    let timedOut=false;
    const timer=setTimeout(()=>{timedOut=true;controller.abort()},18000);
    try{
      const raw=[];
      const chunks=[];
      for(let i=0;i<samples.length;i+=100)chunks.push(samples.slice(i,i+100));
      for(let ci=0;ci<chunks.length;ci++){
        const chunk=chunks[ci];
        const lat=chunk.map(p=>p.lat.toFixed(6)).join(',');
        const lon=chunk.map(p=>p.lon.toFixed(6)).join(',');
        const url=`https://api.open-meteo.com/v1/elevation?latitude=${encodeURIComponent(lat)}&longitude=${encodeURIComponent(lon)}`;
        const res=await fetch(url,{signal:controller.signal,cache:'no-store'});
        if(!res.ok)throw rpError('RP-401',`Elevation server returned HTTP ${res.status}.`,{status:res.status,chunk:ci+1,chunks:chunks.length});
        let json;
        try{json=await res.json()}catch{throw rpError('RP-402','Elevation server returned malformed data.',{chunk:ci+1,chunks:chunks.length})}
        const elevations=Array.isArray(json.elevation)?json.elevation.map(v=>v==null?NaN:Number(v)):[];
        if(elevations.length!==chunk.length||elevations.some(v=>!Number.isFinite(v))){
          throw rpError('RP-402','Elevation response did not contain valid samples.',{expected:chunk.length,received:elevations.length,chunk:ci+1,chunks:chunks.length});
        }
        raw.push(...elevations);
      }
      if(raw.length!==samples.length)throw rpError('RP-402','Elevation sample merge was incomplete.',{expected:samples.length,received:raw.length,chunks:chunks.length});
      const ft=raw.map(v=>v*3.28084);
      const smooth=ft.map((v,i,arr)=>{
        const vals=[arr[i-1],v,arr[i+1]].filter(Number.isFinite);
        return vals.reduce((a,b)=>a+b,0)/vals.length;
      });
      let gain=0,loss=0,maxGrade=0;
      for(let i=1;i<smooth.length;i++){
        const de=smooth[i]-smooth[i-1],runFt=Math.max(1,(samples[i].distanceM-samples[i-1].distanceM)*3.28084);
        if(de>5)gain+=de;
        else if(de<-5)loss+=-de;
        maxGrade=Math.max(maxGrade,Math.abs(de/runFt*100));
      }
      return {
        samples:samples.map((p,i)=>({lat:p.lat,lon:p.lon,distanceM:p.distanceM,elevationFt:smooth[i]})),
        gainFt:gain,lossFt:loss,minFt:Math.min(...smooth),maxFt:Math.max(...smooth),maxGrade
      };
    }catch(err){
      if(err?.name==='AbortError'&&timedOut&&!signal?.aborted)throw rpError('RP-403','Elevation request timed out.');
      throw err;
    }finally{
      clearTimeout(timer);signal?.removeEventListener('abort',relay);
    }
  }

  function profileElevationAt(samples,distanceM){
    const s=(Array.isArray(samples)?samples:[]).filter(x=>Number.isFinite(x?.distanceM)&&Number.isFinite(x?.elevationFt));
    if(!s.length)return NaN;
    if(distanceM<=s[0].distanceM)return s[0].elevationFt;
    if(distanceM>=s.at(-1).distanceM)return s.at(-1).elevationFt;
    let i=1;while(i<s.length&&s[i].distanceM<distanceM)i++;
    const a=s[i-1],b=s[i],span=Math.max(1,b.distanceM-a.distanceM),t=(distanceM-a.distanceM)/span;
    return a.elevationFt+(b.elevationFt-a.elevationFt)*t;
  }

  function slopeClass(grade){
    const g=Math.abs(Number(grade)||0);
    if(g>=15)return {key:'hard',label:'HARD',rank:2};
    if(g>=8)return {key:'medium',label:'MEDIUM',rank:1};
    return {key:'easy',label:g<3?'FLAT':'EASY',rank:0};
  }
  function sampleGrade(a,b){
    const runFt=Math.max(1,(b.distanceM-a.distanceM)*3.28084);
    return (b.elevationFt-a.elevationFt)/runFt*100;
  }

  function elevationDetail(profile,distMi){
    const samples=(profile?.samples||[]).filter(x=>Number.isFinite(x?.distanceM)&&Number.isFinite(x?.elevationFt));
    if(samples.length<2)return null;
    const totalM=samples.at(-1).distanceM||distMi*1609.344;
    const startFt=samples[0].elevationFt,endFt=samples.at(-1).elevationFt;
    const high=samples.reduce((a,b)=>b.elevationFt>a.elevationFt?b:a,samples[0]);
    const low=samples.reduce((a,b)=>b.elevationFt<a.elevationFt?b:a,samples[0]);
    let maxUp=-Infinity,maxDown=Infinity;
    for(let i=1;i<samples.length;i++){
      const runFt=Math.max(1,(samples[i].distanceM-samples[i-1].distanceM)*3.28084);
      const grade=(samples[i].elevationFt-samples[i-1].elevationFt)/runFt*100;
      maxUp=Math.max(maxUp,grade);maxDown=Math.min(maxDown,grade);
    }
    const quarterM=0.25*1609.344;
    let qUp=-Infinity,qDown=Infinity,qUpAt=0,qDownAt=0;
    if(totalM>=quarterM){
      for(let d=0;d<=totalM-quarterM;d+=Math.max(30,totalM/160)){
        const a=profileElevationAt(samples,d),b=profileElevationAt(samples,d+quarterM);
        const grade=(b-a)/(quarterM*3.28084)*100;
        if(grade>qUp){qUp=grade;qUpAt=d}
        if(grade<qDown){qDown=grade;qDownAt=d}
      }
    }
    const binMi=distMi<=3?.25:distMi<=8?.5:distMi<=15?1:distMi<=30?2:5;
    const binM=binMi*1609.344,bins=[];
    for(let start=0;start<totalM-1;start+=binM){
      const end=Math.min(totalM,start+binM);
      const startFtBin=profileElevationAt(samples,start),endFtBin=profileElevationAt(samples,end);
      let gain=0,loss=0,prev=startFtBin,maxLocalGrade=0,maxUpGrade=0,maxDownGrade=0;
      const segmentSamples=[{distanceM:start,elevationFt:startFtBin},...samples.filter(x=>x.distanceM>start&&x.distanceM<end),{distanceM:end,elevationFt:endFtBin}];
      for(let j=1;j<segmentSamples.length;j++){
        const p=segmentSamples[j],prior=segmentSamples[j-1],de=p.elevationFt-prev;
        if(de>5)gain+=de;else if(de<-5)loss+=-de;
        const local=sampleGrade(prior,p);
        maxLocalGrade=Math.max(maxLocalGrade,Math.abs(local));
        maxUpGrade=Math.max(maxUpGrade,local);
        maxDownGrade=Math.min(maxDownGrade,local);
        prev=p.elevationFt;
      }
      const net=endFtBin-startFtBin,runFt=Math.max(1,(end-start)*3.28084),avgGrade=net/runFt*100;
      const difficulty=slopeClass(maxLocalGrade);
      bins.push({
        startMi:start/1609.344,endMi:end/1609.344,startFt:startFtBin,endFt:endFtBin,
        gainFt:gain,lossFt:loss,netFt:net,avgGrade,maxLocalGrade,maxUpGrade,maxDownGrade,difficulty
      });
    }
    const exposure={easyMi:0,mediumMi:0,hardMi:0};
    for(let i=1;i<samples.length;i++){
      const mi=(samples[i].distanceM-samples[i-1].distanceM)/1609.344;
      const cls=slopeClass(sampleGrade(samples[i-1],samples[i])).key;
      exposure[cls+'Mi']+=mi;
    }
    return {
      startFt,endFt,netFt:endFt-startFt,highFt:high.elevationFt,highMi:high.distanceM/1609.344,
      lowFt:low.elevationFt,lowMi:low.distanceM/1609.344,maxUp,maxDown,
      quarterUp:Number.isFinite(qUp)?qUp:null,quarterDown:Number.isFinite(qDown)?qDown:null,
      quarterUpMi:qUpAt/1609.344,quarterDownMi:qDownAt/1609.344,binMi,bins,exposure
    };
  }

  function renderElevationBreakdown(profile,distMi){
    const detail=elevationDetail(profile,distMi);
    const set=(id,val)=>{const el=$(id);if(el)el.textContent=val};
    if(!detail){
      ['elevStart','elevFinish','elevHigh','elevLow','elevNet','elevMaxUp','elevMaxDown','elevQuarterUp','elevQuarterDown','elevEasyMiles','elevMediumMiles','elevHardMiles'].forEach(id=>set(id,'---'));
      const body=$('elevationSegmentRows');if(body)body.innerHTML='<tr><td colspan="10">PLOT ROUTE TO CALCULATE ELEVATION BREAKDOWN</td></tr>';
      return;
    }
    const ft=v=>`${Math.round(v).toLocaleString()} ft`;
    const signed=v=>`${v>=0?'+':'−'}${Math.round(Math.abs(v)).toLocaleString()} ft`;
    const grade=v=>Number.isFinite(v)?`${v>=0?'+':''}${v.toFixed(1)}%`:'---';
    set('elevStart',ft(detail.startFt));set('elevFinish',ft(detail.endFt));
    set('elevHigh',`${ft(detail.highFt)} @ ${detail.highMi.toFixed(2)} mi`);
    set('elevLow',`${ft(detail.lowFt)} @ ${detail.lowMi.toFixed(2)} mi`);
    set('elevNet',signed(detail.netFt));set('elevMaxUp',grade(detail.maxUp));set('elevMaxDown',grade(detail.maxDown));
    set('elevQuarterUp',detail.quarterUp==null?'ROUTE < 0.25 MI':`${grade(detail.quarterUp)} @ ${detail.quarterUpMi.toFixed(2)} mi`);
    set('elevQuarterDown',detail.quarterDown==null?'ROUTE < 0.25 MI':`${grade(detail.quarterDown)} @ ${detail.quarterDownMi.toFixed(2)} mi`);
    set('elevEasyMiles',`${detail.exposure.easyMi.toFixed(2)} mi`);
    set('elevMediumMiles',`${detail.exposure.mediumMi.toFixed(2)} mi`);
    set('elevHardMiles',`${detail.exposure.hardMi.toFixed(2)} mi`);
    set('elevationBandSize',`${detail.binMi.toFixed(detail.binMi<1?2:0)} MI BANDS // CLASS BY MAX LOCAL GRADE`);
    const body=$('elevationSegmentRows');
    if(body)body.innerHTML=detail.bins.map(b=>`<tr class="slope-${b.difficulty.key}">
      <td>${b.startMi.toFixed(2)}–${b.endMi.toFixed(2)}</td>
      <td>${Math.round(b.startFt).toLocaleString()}</td>
      <td>${Math.round(b.endFt).toLocaleString()}</td>
      <td>+${Math.round(b.gainFt).toLocaleString()}</td>
      <td>−${Math.round(b.lossFt).toLocaleString()}</td>
      <td>${signed(b.netFt)}</td>
      <td>${grade(b.avgGrade)}</td>
      <td>${grade(b.maxUpGrade)}</td>
      <td>${grade(b.maxDownGrade)}</td>
      <td><b class="slope-badge slope-${b.difficulty.key}">${b.difficulty.label} · ${b.maxLocalGrade.toFixed(1)}%</b></td>
    </tr>`).join('');
  }

  function drawElevationProfile(profile,distMi){
    const c=$('routeProfile');if(!c||!profile?.samples?.length)return;
    const ctx=c.getContext('2d'),w=c.width,h=c.height,st=getComputedStyle(document.body);
    const fg=st.getPropertyValue('--fg2').trim()||'#72e58e',line=st.getPropertyValue('--line').trim()||'#245537',warn=st.getPropertyValue('--warn').trim()||'#ffd166';
    ctx.clearRect(0,0,w,h);
    const vals=profile.samples.map(p=>p.elevationFt),min=Math.min(...vals),max=Math.max(...vals),span=Math.max(40,max-min);
    const left=52,right=14,top=34,bottom=28,plotW=w-left-right,plotH=h-top-bottom;
    ctx.strokeStyle=line;ctx.lineWidth=1;ctx.fillStyle=fg;ctx.font='13px monospace';
    for(let i=0;i<=4;i++){
      const y=top+plotH*i/4,e=max-span*i/4;
      ctx.beginPath();ctx.moveTo(left,y);ctx.lineTo(w-right,y);ctx.stroke();
      ctx.fillText(`${Math.round(e)}`,4,y+4);
    }
    for(let i=0;i<=4;i++){
      const x=left+plotW*i/4;
      ctx.beginPath();ctx.moveTo(x,top);ctx.lineTo(x,h-bottom);ctx.stroke();
      const mi=distMi*i/4,label=`${mi.toFixed(distMi<4?1:0)}mi`;
      ctx.fillText(label,Math.min(w-48,Math.max(left-5,x-14)),h-8);
    }
    const xy=profile.samples.map(p=>({
      x:left+(p.distanceM/(profile.samples.at(-1).distanceM||1))*plotW,
      y:top+plotH-(p.elevationFt-min)/span*plotH
    }));
    ctx.beginPath();xy.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));
    ctx.lineTo(xy.at(-1).x,h-bottom);ctx.lineTo(xy[0].x,h-bottom);ctx.closePath();
    ctx.globalAlpha=.12;ctx.fillStyle=warn;ctx.fill();ctx.globalAlpha=1;
    // Base profile stays neutral; only medium/hard slope segments receive warning colors.
    ctx.strokeStyle=fg;ctx.lineWidth=3;ctx.beginPath();
    xy.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.stroke();
    for(let i=1;i<xy.length;i++){
      const gradeValue=sampleGrade(profile.samples[i-1],profile.samples[i]);
      const cls=slopeClass(gradeValue);
      if(cls.key==='easy')continue;
      ctx.strokeStyle=cls.key==='hard'?'#e5484d':'#f28c28';
      ctx.lineWidth=cls.key==='hard'?6:5;
      ctx.beginPath();ctx.moveTo(xy[i-1].x,xy[i-1].y);ctx.lineTo(xy[i].x,xy[i].y);ctx.stroke();
    }
    ctx.fillStyle=fg;ctx.font='18px monospace';
    ctx.fillText(`${distMi.toFixed(2)} mi // +${Math.round(profile.gainFt)} ft / -${Math.round(profile.lossFt)} ft`,left,22);
    renderElevationBreakdown(profile,distMi);
  }

  function applyRouteStats(points,profile,elevationState='auto'){
    const pts=(Array.isArray(points)?points:[]).filter(valid),dist=routeDistanceMiles(pts);
    const set=(id,val)=>{const el=$(id);if(el)el.textContent=val};
    const distText=`${dist.toFixed(2)} mi`;
    set('routeDistance',distText);set('plannerRouteDistance',distText);
    set('routePointCount',String(pts.length));set('plannerRoutePoints',String(pts.length));
    if(profile){
      const gain=Math.round(profile.gainFt),loss=Math.round(profile.lossFt),min=Math.round(profile.minFt),max=Math.round(profile.maxFt);
      const gainText=`${gain.toLocaleString()} ft`,lossText=`${loss.toLocaleString()} ft`,rangeText=`${min.toLocaleString()}–${max.toLocaleString()} ft`;
      set('routeGainOut',gainText);set('plannerRouteGain',gainText);
      set('routeLossOut',lossText);set('plannerRouteLoss',lossText);
      set('routeElevRange',rangeText);set('plannerRouteElevRange',rangeText);
      set('plannerElevationSource','ELEVATION // COPERNICUS GLO-90 DEM');
      const gainInput=$('routeGain'),gradeInput=$('routeGrade');
      if(gainInput)gainInput.value=String(gain);
      if(gradeInput)gradeInput.value=String(Math.round(profile.maxGrade));
      gainInput?.dispatchEvent(new Event('input',{bubbles:true}));
      drawElevationProfile(profile,dist);
    }else{
      const hasRoute=pts.length>1;
      const loading=elevationState==='loading'&&hasRoute;
      const unavailable=elevationState==='unavailable'&&hasRoute;
      const placeholder=loading?'LOADING…':unavailable?'N/A':'---';
      set('routeGainOut',placeholder);set('plannerRouteGain',placeholder);
      set('routeLossOut',placeholder);set('plannerRouteLoss',placeholder);
      set('routeElevRange',placeholder);set('plannerRouteElevRange',placeholder);
      set('plannerElevationSource',loading?'ELEVATION // LOADING DEM…':unavailable?'ELEVATION // UNAVAILABLE':'ELEVATION // WAITING FOR ROUTE');
      renderElevationBreakdown(null,dist);
    }
    return dist;
  }

  async function enrichRoute(points,signal,baseStatus){
    const dist=applyRouteStats(points,null,'loading');
    status(`${baseStatus} -- ${dist.toFixed(2)} MI // ELEVATION LOADING — YOU CAN KEEP EDITING`,'loading');
    try{
      const profile=await fetchElevationProfile(points,signal);
      if(signal?.aborted)throw new DOMException('Cancelled','AbortError');
      if(!profile)return {dist,profile:null};
      applyRouteStats(points,profile);
      state()?.setMeta?.({
        distanceMiles:dist,
        elevationSource:'COPERNICUS GLO-90 / OPEN-METEO',
        elevationGainFt:Math.round(profile.gainFt),
        elevationLossFt:Math.round(profile.lossFt),
        elevationMinFt:Math.round(profile.minFt),
        elevationMaxFt:Math.round(profile.maxFt),
        elevationMaxGrade:Number(profile.maxGrade)||0,
        elevationProfile:profile.samples
      });
      state()?.save?.();
      return {dist,profile};
    }catch(err){
      if(signal?.aborted)throw err;
      console.warn('FIELD/OS elevation lookup failed',err);
      const elevationError=normalizeRouteError(err,'RP-400');
      diagnostic(elevationError.code,'ELEVATION',elevationError.message,elevationError.meta);
      applyRouteStats(points,null,'unavailable');
      state()?.setMeta?.({distanceMiles:dist,elevationSource:'UNAVAILABLE'});
      state()?.save?.();
      return {dist,profile:null,elevationError:String(err?.message||err)};
    }
  }

  async function recalculate(){
    if(anchors.length<2)return;
    if(!state())return showRouteError(rpError('RP-001','Route data bridge is unavailable.'),'ROUTING');
    diagnostic('RP-000','ROUTING','Starting snapped route calculation.');
    aborter?.abort();aborter=new AbortController();
    const signal=aborter.signal;setBusy(true);snapped=[];hoverPoint=null;
    const previousPoints=state()?.getPoints?.()||[],previousAnchors=lastSuccessfulAnchors.map(p=>({...p}));
    routingResolvedAnchors=Math.max(1,Math.min(lastSuccessfulAnchors.length,anchors.length-1));
    overlay(previousPoints);
    try{
      if(routeMode()==='direct'){
        const direct=anchors.map(p=>({...p}));
        routingResolvedAnchors=anchors.length;
        state()?.setPoints?.(direct);state()?.setMeta?.({anchors,routedAnchors:anchors.map(p=>({...p})),legs:[],routingMode:'direct',routingSource:'DIRECT'});overlay(direct);
        lastSuccessfulAnchors=anchors.map(p=>({...p}));
        fitPlanner(direct,16);setBusy(false);
        const enriched=await enrichRoute(direct,signal,'DIRECT ROUTE');
        const elev=enriched.profile?` // +${Math.round(enriched.profile.gainFt)} FT / -${Math.round(enriched.profile.lossFt)} FT`:' // ELEVATION N/A';
        status(`DIRECT ROUTE -- ${enriched.dist.toFixed(2)} MI${elev}`,'ready');
        return;
      }
      status(`LOADING OSM TRAILS -- LEG 1 / ${anchors.length-1}`,'loading');
      const full=[],legs=[];let maxSnap=0,carrySnap=null;
      for(let i=1;i<anchors.length;i++){
        if(signal.aborted)return;
        status(`SNAPPING TO TRAILS -- LEG ${i} / ${anchors.length-1}`,'loading');
        const routeStart=carrySnap?{lat:carrySnap.lat,lon:carrySnap.lon}:anchors[i-1];
        const leg=await routeLeg(routeStart,anchors[i],signal);
        carrySnap={lat:leg.endSnap.lat,lon:leg.endSnap.lon};
        if(signal.aborted)return;
        legs.push({a:{...anchors[i-1]},b:{...anchors[i]},routeStart:{...routeStart},result:leg});
        if(leg.diagnostics){
          diagnostic('RP-000',`LEG ${i} OK`,`SNAP ${leg.diagnostics.startSnapM}m → ${leg.diagnostics.endSnapM}m | GRAPH ${leg.diagnostics.nodes}N/${leg.diagnostics.segments}S`,leg.diagnostics);
        }
        maxSnap=Math.max(maxSnap,leg.startSnap.d,leg.endSnap.d);
        if(i===1)snapped.push({lat:leg.startSnap.lat,lon:leg.startSnap.lon});
        snapped.push({lat:leg.endSnap.lat,lon:leg.endSnap.lon});
        full.push(...(i===1?leg.points:leg.points.slice(1)));
        // Gaia-style behavior: commit and paint every solved leg immediately.
        routingResolvedAnchors=i+1;
        const partial=dedupe(full);
        state()?.setPoints?.(partial);
        state()?.setMeta?.({
          anchors:anchors.map(p=>({...p})),
          routedAnchors:anchors.slice(0,i+1).map(p=>({...p})),
          legs:[...legs],
          routingMode:'trail',
          routingSource:'OPENSTREETMAP / OVERPASS',
          routeBuildState:'PARTIAL',
          routeBuildLeg:i
        });
        overlay(partial);
        applyRouteStats(partial,null,'loading');
        status(`SNAPPED LEG ${i} / ${anchors.length-1} -- ${routeDistanceMiles(partial).toFixed(2)} MI // LINE DRAWN // ROUTING NEXT LEG`,'loading');
      }
      if(signal.aborted)return;
      const clean=dedupe(full);
      if(clean.length<2)throw rpError('RP-307','Trail router returned empty route geometry.',{rawPoints:full.length});
      state()?.setPoints?.(clean);
      state()?.setMeta?.({anchors,routedAnchors:anchors.map(p=>({...p})),legs,routingMode:'trail',routingSource:'OPENSTREETMAP / OVERPASS',snapMaxMeters:Math.round(maxSnap),routeBuildState:'COMPLETE',routeBuildLeg:anchors.length-1});
      lastSuccessfulAnchors=anchors.map(p=>({...p}));
      routingResolvedAnchors=anchors.length;
      overlay(clean);fitPlanner(clean,16);setBusy(false);
      const enriched=await enrichRoute(clean,signal,'SNAPPED TO OSM TRAILS');
      const elev=enriched.profile?` // +${Math.round(enriched.profile.gainFt)} FT / -${Math.round(enriched.profile.lossFt)} FT`:' // ELEVATION N/A';
      diagnostic('RP-000','ROUTE READY',`${enriched.dist.toFixed(2)} MI | ${clean.length} DRAWN PTS | MAX SNAP ${Math.round(maxSnap)} M`,{distanceMiles:enriched.dist,drawnPoints:clean.length,maxSnapM:Math.round(maxSnap),legs:anchors.length-1});
      status(`SNAPPED TO OSM TRAILS -- ${enriched.dist.toFixed(2)} MI${elev} // MAX SNAP ${Math.round(maxSnap)} M`,'ready');
      navigator.vibrate?.([20,35,20]);
    }catch(err){
      if(signal.aborted)return;
      console.warn('FIELD/OS trail routing failed',err);
      const partialNow=state()?.getPoints?.()||[];
      const hasNewPartial=partialNow.length>1&&routeDistanceMiles(partialNow)>routeDistanceMiles(previousPoints)+.001;
      if(!hasNewPartial&&previousPoints.length>1){anchors=previousAnchors;state()?.setMeta?.({anchors});}
      routingResolvedAnchors=hasNewPartial?Math.max(1,routingResolvedAnchors):lastSuccessfulAnchors.length;
      showRouteError(err,'TRAIL SNAP',hasNewPartial?' // COMPLETED LEGS KEPT':previousPoints.length>1?' // LAST WORKING ROUTE KEPT':'');
      overlay(hasNewPartial?partialNow:previousPoints);
    }finally{if(aborter?.signal===signal)setBusy(false)}
  }

  function routeVisible(){return !!document.querySelector('#route.active')}
  function kickPlanner(){
    if(!routeVisible())return;
    const ok=activate();
    if(ok&&state()&&initialized)return;
    setTimeout(()=>{if(routeVisible())activate()},250);
    setTimeout(()=>{if(routeVisible())activate()},900);
  }

  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='route')setTimeout(kickPlanner,0)});
  document.addEventListener('fieldos:routechange',()=>{if(initialized){if(!busy)loadAnchors();overlay(state()?.getPoints?.()||[])}});
  document.addEventListener('fieldos:themechange',()=>{if(initialized)overlay()});
  document.addEventListener('click',e=>{
    if(e.target.closest?.('[data-open="route"]'))setTimeout(kickPlanner,60);
  },true);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden)kickPlanner()});
  window.addEventListener('pageshow',kickPlanner);

  const routeView=document.getElementById('route');
  if(routeView){
    new MutationObserver(()=>{if(routeVisible())kickPlanner()}).observe(routeView,{attributes:true,attributeFilter:['class']});
  }

  let watchdogCount=0;
  const watchdog=setInterval(()=>{
    watchdogCount++;
    if(routeVisible())kickPlanner();
    if(initialized&&state()||watchdogCount>24)clearInterval(watchdog);
  },500);

  if(routeVisible())setTimeout(kickPlanner,0);

  window.FIELD_ROUTE_PLANNER={activate,recalculate,get anchors(){return anchors.map(p=>({...p}))}};
})();

