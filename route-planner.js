(() => {
  'use strict';

  const MAP_ID='routePlannerMap';
  const OVERPASS_ENDPOINTS=[
    'https://overpass-api.de/api/interpreter',
    'https://overpass.private.coffee/api/interpreter'
  ];
  const graphCache=new Map();
  let anchors=[];
  let snapped=[];
  let busy=false;
  let aborter=null;
  let initialized=false;
  let plannerMap=null;
  let plannerRouteLayer=null;
  let plannerAnchorLayer=null;
  let plannerSnapLayer=null;
  let plannerBaseFallbackActive=false;

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

  function status(text,kind=''){
    const el=$('routePlannerStatus');
    if(!el)return;
    el.textContent=text;
    el.className=`route-planner-status ${kind}`.trim();
  }
  function setBusy(on){
    busy=!!on;
    document.querySelectorAll('[data-route-plan-action]').forEach(b=>b.disabled=busy);
    const snap=$('routeSnapMode');if(snap)snap.disabled=busy;
    $('routePlannerMap')?.classList.toggle('routing-busy',busy);
  }
  function routeMode(){return $('routeSnapMode')?.value||'trail'}
  function planMeta(){return state()?.getPlan?.()||{}}

  function sanitizeAnchors(list){
    return (Array.isArray(list)?list:[]).filter(valid).slice(0,30).map(p=>({lat:Number(p.lat),lon:Number(p.lon)}));
  }
  function loadAnchors(){
    const plan=planMeta(),pts=state()?.getPoints?.()||[];
    anchors=sanitizeAnchors(plan.anchors);
    if(!anchors.length&&pts.length>=2)anchors=[{lat:+pts[0].lat,lon:+pts[0].lon},{lat:+pts.at(-1).lat,lon:+pts.at(-1).lon}];
    if($('routeSnapMode'))$('routeSnapMode').value=plan.routingMode==='direct'?'direct':'trail';
  }

  function updateControls(){
    const count=anchors.length;
    const a=$('routeAnchorCount');if(a)a.textContent=String(count);
    const help=$('routePlannerHelp');
    if(help)help.textContent=count===0?'Tap the map to set a start point.':count===1?'Start set. Tap the map to set a destination.':'Tap the map to add another via point. The route will recalculate.';
    $('undoRoutePoint')?.toggleAttribute('disabled',count===0||busy);
    $('reverseRoute')?.toggleAttribute('disabled',count<2||busy);
    $('clearRoute')?.toggleAttribute('disabled',count===0||busy);
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
      status('ROUTE MAP LIBRARY FAILED TO LOAD -- CHECK CONNECTION AND REFRESH','error');
      el.innerHTML='<div class="route-map-load-error"><b>MAP ENGINE UNAVAILABLE</b><span>Leaflet did not load. Refresh FIELD/OS while online once so the planner map can be cached.</span></div>';
      return null;
    }
    const here=state()?.current?.()||{lat:44.4759,lon:-73.2121};
    plannerMap=L.map(el,{
      zoomControl:true,
      attributionControl:true,
      preferCanvas:true,
      doubleClickZoom:true,
      tap:true
    }).setView([here.lat,here.lon],14);

    const osm=L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{
      maxZoom:19,
      attribution:'© OpenStreetMap contributors',
      crossOrigin:true
    }).addTo(plannerMap);

    const topo=L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',{
      subdomains:'abc',
      maxZoom:17,
      opacity:.93,
      attribution:'OpenTopoMap',
      crossOrigin:true
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
      attribution:'Waymarked Trails',
      crossOrigin:true
    });
    hiking.on('tileerror',()=>{});
    hiking.addTo(plannerMap);

    plannerRouteLayer=L.layerGroup().addTo(plannerMap);
    plannerAnchorLayer=L.layerGroup().addTo(plannerMap);
    plannerSnapLayer=L.layerGroup().addTo(plannerMap);

    plannerMap.on('click',e=>{if(!busy)addAnchor({lat:e.latlng.lat,lon:e.latlng.lng})});
    plannerMap.on('load',()=>requestAnimationFrame(()=>plannerMap?.invalidateSize(false)));
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
    if(map&&plannerRouteLayer&&plannerAnchorLayer&&plannerSnapLayer){
      const c=plannerColors();
      plannerRouteLayer.clearLayers();plannerAnchorLayer.clearLayers();plannerSnapLayer.clearLayers();
      const pts=(Array.isArray(route)?route:[]).filter(valid);
      if(pts.length>1){
        L.polyline(pts.map(p=>[p.lat,p.lon]),{
          color:c.route,weight:5,opacity:.96,lineCap:'round',lineJoin:'round'
        }).addTo(plannerRouteLayer);
      }
      anchors.forEach((p,i)=>{
        if(!valid(p))return;
        const label=i===0?'S':i===anchors.length-1?'E':String(i);
        L.circleMarker([p.lat,p.lon],{
          radius:8,color:c.fg,weight:2,fillColor:c.panel,fillOpacity:1
        }).bindTooltip(label,{permanent:true,direction:'center',className:'planner-leaflet-label'}).addTo(plannerAnchorLayer);
        const sp=snapped[i];
        if(valid(sp)){
          L.polyline([[p.lat,p.lon],[sp.lat,sp.lon]],{
            color:c.fg2,weight:1.5,opacity:.7,dashArray:'4 5'
          }).addTo(plannerSnapLayer);
        }
      });
      snapped.forEach(p=>{
        if(!valid(p))return;
        L.circleMarker([p.lat,p.lon],{
          radius:4,color:c.bg,weight:2,fillColor:c.fg2,fillOpacity:1
        }).addTo(plannerSnapLayer);
      });
    }
    updateControls();
  }

  function activate(){
    const st=state();
    if(!st||!$(MAP_ID))return;
    if(!initialized){
      loadAnchors();
      if(!ensurePlannerMap())return;
      bindControls();
      initialized=true;
    }
    const pts=st.getPoints?.()||[];
    requestAnimationFrame(()=>{
      plannerMap?.invalidateSize(false);
      overlay(pts);
      if(pts.length>1)fitPlanner(pts,16);
      else if(anchors.length)fitPlanner(anchors,16);
      else{
        const here=st.current?.()||{lat:44.4759,lon:-73.2121};
        plannerMap?.setView([here.lat,here.lon],14);
      }
    });
    status(routeMode()==='trail'?'SNAP TO TRAILS READY':'DIRECT / OFF-TRAIL MODE','ready');
  }

  function bindControls(){
    document.querySelectorAll('[data-route-plan-action]').forEach(btn=>btn.addEventListener('click',()=>{
      const action=btn.dataset.routePlanAction;
      if(action==='current')addAnchor(state()?.current?.());
      else if(action==='undo')undo();
      else if(action==='reverse')reverse();
      else if(action==='clear')clearAll();
      else if(action==='recenter')recenter();
    }));
    $('routeSnapMode')?.addEventListener('change',()=>{
      state()?.setMeta?.({routingMode:routeMode()});
      if(anchors.length>=2)recalculate();
      else status(routeMode()==='trail'?'SNAP TO TRAILS READY':'DIRECT / OFF-TRAIL MODE','ready');
    });
  }

  function addAnchor(p){
    if(!valid(p))return;
    if(anchors.length>=30)return status('Waypoint limit reached. Save this route before adding more.','error');
    anchors.push({lat:+p.lat,lon:+p.lon});
    navigator.vibrate?.(18);
    state()?.setMeta?.({anchors,routingMode:routeMode()});
    overlay();
    if(anchors.length>=2)recalculate();
    else{
      state()?.setPoints?.([anchors[0]]);
      overlay([anchors[0]]);
      status('START SET -- TAP DESTINATION','ready');
    }
  }

  function undo(){
    if(!anchors.length)return;
    anchors.pop();snapped=[];
    state()?.setMeta?.({anchors,routingMode:routeMode()});
    if(anchors.length>=2)recalculate();
    else{
      const pts=anchors.length?[anchors[0]]:[];
      state()?.setPoints?.(pts);overlay(pts);
      status(anchors.length?'START SET -- TAP DESTINATION':'TAP MAP TO SET START','ready');
    }
  }

  function reverse(){
    if(anchors.length<2)return;
    anchors.reverse();snapped=[];
    state()?.setMeta?.({anchors,routingMode:routeMode()});
    recalculate();
  }

  function clearAll(){
    aborter?.abort();
    anchors=[];snapped=[];
    state()?.setMeta?.({anchors:[],routingMode:routeMode()});
    state()?.setPoints?.([]);overlay([]);
    status('TAP MAP TO SET START','ready');
  }

  function recenter(){
    const pts=state()?.getPoints?.()||[];
    if(pts.length>1)fitPlanner(pts,16);
    else if(anchors.length)fitPlanner(anchors,16);
    else{
      const here=state()?.current?.()||{lat:44.4759,lon:-73.2121};
      ensurePlannerMap()?.setView([here.lat,here.lon],14);
    }
  }

  function bboxFor(a,b){
    const legMiles=Math.max(.1,miles(a,b));
    const padMiles=clamp(Math.max(1.0,legMiles*.28),1,4);
    const midLat=(a.lat+b.lat)/2,latPad=padMiles/69,lonPad=padMiles/(69*Math.max(.25,Math.cos(midLat*Math.PI/180)));
    return {s:Math.min(a.lat,b.lat)-latPad,w:Math.min(a.lon,b.lon)-lonPad,n:Math.max(a.lat,b.lat)+latPad,e:Math.max(a.lon,b.lon)+lonPad};
  }
  function bboxKey(b){return [b.s,b.w,b.n,b.e].map(x=>(Math.round(x*200)/200).toFixed(3)).join(',')}
  function queryFor(b){
    return `[out:json][timeout:22];\nway["highway"~"^(path|footway|track|bridleway|steps|pedestrian|unclassified|service|residential)$"]["access"!~"^(private|no)$"]["foot"!~"^no$"](${b.s.toFixed(6)},${b.w.toFixed(6)},${b.n.toFixed(6)},${b.e.toFixed(6)});\nout body geom;`;
  }

  async function fetchTrailGraph(a,b,signal){
    const box=bboxFor(a,b),key=bboxKey(box);
    if(graphCache.has(key))return graphCache.get(key);
    const q=queryFor(box);let lastErr=null;
    for(const endpoint of OVERPASS_ENDPOINTS){
      try{
        const controller=new AbortController();
        const relay=()=>controller.abort(); signal?.addEventListener('abort',relay,{once:true});
        const timer=setTimeout(()=>controller.abort(),26000);
        const res=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded;charset=UTF-8'},body:'data='+encodeURIComponent(q),signal:controller.signal});
        clearTimeout(timer); signal?.removeEventListener('abort',relay);
        if(!res.ok)throw new Error(`trail server ${res.status}`);
        const json=await res.json();
        const graph=buildGraph(json.elements||[]);
        if(graph.nodes.size<2||graph.segments.length<1)throw new Error('no usable trail network in this area');
        graphCache.set(key,graph);if(graphCache.size>10)graphCache.delete(graphCache.keys().next().value);
        return graph;
      }catch(err){
        if(signal?.aborted)throw err;
        lastErr=err;
      }
    }
    throw lastErr||new Error('trail network unavailable');
  }

  function wayFactor(tags={}){
    const h=tags.highway||'';
    if(h==='path')return .86;
    if(h==='footway')return .9;
    if(h==='track')return .98;
    if(h==='bridleway')return 1.03;
    if(h==='steps')return 1.12;
    if(h==='pedestrian')return 1.0;
    if(h==='unclassified')return 1.55;
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

  function nearestNode(graph,p,maxMeters=650){
    let best=null;
    for(const node of graph.nodes.values()){
      const d=meters(p,node);
      if(d<=maxMeters&&(!best||d<best.d))best={id:node.id,node,d};
    }
    return best;
  }

  class MinHeap{
    constructor(){this.a=[]}
    push(item){let i=this.a.length;this.a.push(item);while(i){const p=(i-1)>>1;if(this.a[p].f<=item.f)break;this.a[i]=this.a[p];i=p;this.a[p]=item}}
    pop(){if(!this.a.length)return null;const root=this.a[0],last=this.a.pop();if(this.a.length){let i=0;this.a[0]=last;for(;;){let l=i*2+1,r=l+1,s=i;if(l<this.a.length&&this.a[l].f<this.a[s].f)s=l;if(r<this.a.length&&this.a[r].f<this.a[s].f)s=r;if(s===i)break;[this.a[i],this.a[s]]=[this.a[s],this.a[i]];i=s}}return root}
    get size(){return this.a.length}
  }

  function shortestPath(graph,startId,endId){
    if(startId===endId)return [graph.nodes.get(startId)];
    const goal=graph.nodes.get(endId),open=new MinHeap(),g=new Map([[startId,0]]),came=new Map(),closed=new Set();
    open.push({id:startId,f:meters(graph.nodes.get(startId),goal)});
    let visits=0;
    while(open.size&&visits<100000){
      const cur=open.pop();if(closed.has(cur.id))continue;closed.add(cur.id);visits++;
      if(cur.id===endId){
        const ids=[endId];let x=endId;
        while(came.has(x)){x=came.get(x);ids.push(x)}
        ids.reverse();return ids.map(id=>graph.nodes.get(id));
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
    return null;
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

  async function routeLeg(a,b,signal){
    if(miles(a,b)>35)throw new Error('A single snapped leg is too long for the lightweight trail router. Add a via point closer to the trail corridor.');
    const graph=await fetchTrailGraph(a,b,signal),sa=nearestNode(graph,a),sb=nearestNode(graph,b);
    if(!sa||!sb)throw new Error('No mapped hiking path was found close enough to one of the selected points. Zoom in and tap closer to a trail.');
    const path=shortestPath(graph,sa.id,sb.id);
    if(!path||path.length<2)throw new Error('The nearby mapped trails are not connected. Add an intermediate point or use DIRECT mode for an off-trail leg.');
    return {points:path.map(p=>({lat:p.lat,lon:p.lon})),startSnap:{lat:sa.node.lat,lon:sa.node.lon,d:sa.d},endSnap:{lat:sb.node.lat,lon:sb.node.lon,d:sb.d}};
  }

  async function recalculate(){
    if(anchors.length<2)return;
    aborter?.abort();aborter=new AbortController();
    const signal=aborter.signal;setBusy(true);snapped=[];
    try{
      if(routeMode()==='direct'){
        const direct=anchors.map(p=>({...p}));
        state()?.setPoints?.(direct);state()?.setMeta?.({anchors,routingMode:'direct',routingSource:'DIRECT'});overlay(direct);
        fitPlanner(direct,16);
        status(`DIRECT ROUTE -- ${miles(direct[0],direct.at(-1)).toFixed(2)} MI END-TO-END`,'ready');
        return;
      }
      status(`LOADING OSM TRAILS -- LEG 1 / ${anchors.length-1}`,'loading');
      const full=[];let maxSnap=0;
      for(let i=1;i<anchors.length;i++){
        if(signal.aborted)return;
        status(`SNAPPING TO TRAILS -- LEG ${i} / ${anchors.length-1}`,'loading');
        const leg=await routeLeg(anchors[i-1],anchors[i],signal);
        maxSnap=Math.max(maxSnap,leg.startSnap.d,leg.endSnap.d);
        if(i===1)snapped.push({lat:leg.startSnap.lat,lon:leg.startSnap.lon});
        snapped.push({lat:leg.endSnap.lat,lon:leg.endSnap.lon});
        full.push(...(i===1?leg.points:leg.points.slice(1)));
      }
      const clean=dedupe(full);
      if(clean.length<2)throw new Error('The trail router returned an empty path.');
      state()?.setPoints?.(clean);
      state()?.setMeta?.({anchors,routingMode:'trail',routingSource:'OPENSTREETMAP / OVERPASS',snapMaxMeters:Math.round(maxSnap)});
      overlay(clean);fitPlanner(clean,16);
      const dist=clean.reduce((sum,p,i)=>i?sum+miles(clean[i-1],p):0,0);
      status(`SNAPPED TO OSM TRAILS -- ${dist.toFixed(2)} MI * MAX SNAP ${Math.round(maxSnap)} M`,'ready');
      navigator.vibrate?.([20,35,20]);
    }catch(err){
      if(signal.aborted)return;
      console.warn('FIELD/OS trail routing failed',err);
      status(`TRAIL ROUTE FAILED -- ${String(err.message||err).toUpperCase()}`,'error');
      overlay(state()?.getPoints?.()||[]);
    }finally{if(!signal.aborted)setBusy(false)}
  }

  document.addEventListener('fieldos:viewchange',e=>{if(e.detail?.view==='route')setTimeout(activate,0)});
  document.addEventListener('fieldos:routechange',()=>{if(initialized)overlay(state()?.getPoints?.()||[])});
  if(document.querySelector('#route.active'))setTimeout(activate,0);

  window.FIELD_ROUTE_PLANNER={activate,recalculate,get anchors(){return anchors.map(p=>({...p}))}};
})();
