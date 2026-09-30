(() => {
  'use strict';

  const STORE_PREFIX='fieldos-v1.2-';
  const DEFAULT_CENTER={lat:44.4759,lon:-73.2121};
  const TILE=256;
  const states=new Map();

  const savedSource=localStorage.getItem(STORE_PREFIX+'map-source');
  let mode=['osm','topo','satellite'].includes(savedSource)?savedSource:'topo';
  let trails=localStorage.getItem(STORE_PREFIX+'hiking-routes')!=='off';
  let terrain=localStorage.getItem(STORE_PREFIX+'terrain-shade')==='on';
  let grid=localStorage.getItem(STORE_PREFIX+'map-grid')==='on';
  let liveEnabled=localStorage.getItem(STORE_PREFIX+'live-location')==='on';
  let livePosition=null;
  let locationAccuracy=null;
  let lastFixTime=0;
  let watchId=null;

  const clampLat=lat=>Math.max(-85.05112878,Math.min(85.05112878,Number(lat)||0));
  const maxZoom=()=>mode==='topo'?17:19;
  const world=(lat,lon,z)=>{
    const size=TILE*Math.pow(2,z),s=Math.sin(clampLat(lat)*Math.PI/180);
    return {x:(Number(lon)+180)/360*size,y:(.5-Math.log((1+s)/(1-s))/(4*Math.PI))*size};
  };
  const unworld=(x,y,z)=>{
    const size=TILE*Math.pow(2,z),lon=x/size*360-180,n=Math.PI-2*Math.PI*y/size;
    return {lat:180/Math.PI*Math.atan(Math.sinh(n)),lon};
  };
  const wrapX=(x,z)=>{const n=Math.pow(2,z);return ((x%n)+n)%n};
  const validY=(y,z)=>y>=0&&y<Math.pow(2,z);

  function osmUrl(z,x,y){return validY(y,z)?`https://tile.openstreetmap.org/${z}/${wrapX(x,z)}/${y}.png`:''}
  function topoUrl(z,x,y){
    if(!validY(y,z))return '';
    const sub=['a','b','c'][Math.abs(x+y)%3];
    return `https://${sub}.tile.opentopomap.org/${z}/${wrapX(x,z)}/${y}.png`;
  }
  function trailUrl(z,x,y){return validY(y,z)?`https://tile.waymarkedtrails.org/hiking/${z}/${wrapX(x,z)}/${y}.png`:''}
  function satelliteUrl(z,x,y){return validY(y,z)?`https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${wrapX(x,z)}`:''}
  function hillshadeUrl(z,x,y){return validY(y,z)?`https://services.arcgisonline.com/ArcGIS/rest/services/Elevation/World_Hillshade/MapServer/tile/${z}/${y}/${wrapX(x,z)}`:''}

  function targetForButton(btn){return btn.dataset.mapTarget || (btn.closest('#home')?'homeRealMap':'realMap')}
  function centerCandidate(){return livePosition||DEFAULT_CENTER}
  function formatAge(){
    if(!lastFixTime)return '—';
    const sec=Math.max(0,Math.round((Date.now()-lastFixTime)/1000));
    return sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${String(sec%60).padStart(2,'0')}s`;
  }

  function setPressed(el,on){
    if(!el)return;
    el.classList.toggle('active',!!on);
    el.setAttribute('aria-pressed',on?'true':'false');
  }

  function updateLocationLabels(){
    const state=liveEnabled?(watchId!=null?(livePosition?'LIVE':'ACQUIRING'):'STARTING'):(livePosition?'PAUSED':'OFF');
    const buttons=[...document.querySelectorAll('.map-location-toggle')];
    buttons.forEach(btn=>{
      btn.textContent=`LIVE LOCATION ${liveEnabled?'ON':'OFF'}`;
      setPressed(btn,liveEnabled);
    });
    const ls=document.getElementById('homeLocationState');if(ls)ls.textContent=state;
    const age=document.getElementById('homeLiveFixAge');if(age)age.textContent=formatAge();
    const acc=document.getElementById('homeLiveAccuracy');if(acc)acc.textContent=locationAccuracy!=null?`±${Math.round(locationAccuracy)} m`:'—';
    const oldAge=document.getElementById('homeFixAge');if(oldAge)oldAge.textContent=lastFixTime?formatAge():'—';
    const oldAcc=document.getElementById('homeAccuracy');if(oldAcc)oldAcc.textContent=locationAccuracy!=null?`±${Math.round(locationAccuracy)} m`:'—';
  }

  function updateLabels(){
    const kind=mode==='satellite'?'SATELLITE':mode==='osm'?'STREET OSM':'HIKING TOPO';
    const suffix=liveEnabled?(livePosition?'LIVE GNSS':'GNSS ACQUIRING'):(livePosition?'LAST FIX':'GNSS OFF');
    const h=document.getElementById('homeMapModeLabel');if(h)h.textContent=`${kind} / ${suffix}`;
    const m=document.getElementById('mapModeLabel');if(m)m.textContent=`${kind} / ${suffix}`;
    const d=document.getElementById('mapSourceDiag');if(d)d.textContent=`${kind} ENGINE READY`;

    setPressed(document.getElementById('mapTopoMode'),mode==='topo');
    setPressed(document.getElementById('mapOsmMode'),mode==='osm');
    setPressed(document.getElementById('mapSatelliteMode'),mode==='satellite');
    setPressed(document.getElementById('mapTrailLayer'),trails);
    setPressed(document.getElementById('mapTerrainLayer'),terrain);

    const topo=document.getElementById('homeLayerTopo');if(topo)topo.checked=mode==='topo';
    const sat=document.getElementById('homeLayerSatellite');if(sat)sat.checked=mode==='satellite';
    const tr=document.getElementById('homeLayerTrails');if(tr)tr.checked=trails;
    const te=document.getElementById('homeLayerTerrain');if(te)te.checked=terrain;
    const gr=document.getElementById('homeLayerGrid');if(gr)gr.checked=grid;

    updateLocationLabels();
  }

  function ensure(id){
    if(states.has(id))return states.get(id);
    const el=document.getElementById(id);
    if(!el)return null;
    el.hidden=false;
    el.innerHTML='<div class="native-map-base"></div><div class="native-map-terrain"></div><div class="native-map-trails"></div><div class="native-map-grid"></div><svg class="native-map-overlay" xmlns="http://www.w3.org/2000/svg"></svg><svg class="native-map-editor-overlay" xmlns="http://www.w3.org/2000/svg"></svg><div class="native-map-corner">FIELD/OS MAP</div><div class="native-map-attrib"></div><div class="native-map-diag">TILES 0 / ERR 0</div>';
    const st={
      id,el,
      base:el.querySelector('.native-map-base'),
      terrain:el.querySelector('.native-map-terrain'),
      trail:el.querySelector('.native-map-trails'),
      grid:el.querySelector('.native-map-grid'),
      overlay:el.querySelector('.native-map-overlay'),
      editor:el.querySelector('.native-map-editor-overlay'),
      center:{...centerCandidate()},zoom:14,
      loaded:0,errors:0,token:0,pointers:new Map(),dragStart:null,pinchStart:null,pointerDownOrigin:null,
      geoOverlay:null,tapHandler:null,rendered:false
    };

    const resetTransform=()=>{
      st.base.style.transform='';
      st.terrain.style.transform='';
      st.trail.style.transform='';
      st.grid.style.transform='';
      st.overlay.style.transform='';
      st.editor.style.transform='';
    };

    st.onPointerDown=e=>{
      if(e.button!==undefined&&e.button>0)return;
      e.preventDefault();
      st.el.setPointerCapture?.(e.pointerId);
      st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(st.pointers.size===1){
        st.dragStart={x:e.clientX,y:e.clientY,center:{...st.center}};
        st.pointerDownOrigin={x:e.clientX,y:e.clientY};
        st.el.classList.add('native-map-dragging');
      }else if(st.pointers.size===2){
        const p=[...st.pointers.values()];
        st.pinchStart={dist:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),zoom:st.zoom};
      }
    };
    st.onPointerMove=e=>{
      if(!st.pointers.has(e.pointerId))return;
      st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(st.pointers.size===1&&st.dragStart){
        const dx=e.clientX-st.dragStart.x,dy=e.clientY-st.dragStart.y,t=`translate(${dx}px,${dy}px)`;
        st.base.style.transform=t;st.terrain.style.transform=t;st.trail.style.transform=t;st.grid.style.transform=t;st.overlay.style.transform=t;st.editor.style.transform=t;
      }else if(st.pointers.size===2&&st.pinchStart){
        const p=[...st.pointers.values()],dist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
        const ratio=dist/Math.max(1,st.pinchStart.dist);
        const next=Math.max(2,Math.min(maxZoom(),st.pinchStart.zoom+Math.round(Math.log2(ratio))));
        const corner=st.el.querySelector('.native-map-corner');if(corner)corner.textContent=`PINCH Z${next}`;
      }
    };
    st.onPointerUp=e=>{
      const old=[...st.pointers.values()];
      st.pointers.delete(e.pointerId);
      const origin=st.pointerDownOrigin;
      const wasTap=!!(origin&&old.length===1&&!st.pinchStart&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<7);
      if(st.pinchStart&&old.length>=2){
        const dist=Math.hypot(old[1].x-old[0].x,old[1].y-old[0].y),ratio=dist/Math.max(1,st.pinchStart.dist);
        st.zoom=Math.max(2,Math.min(maxZoom(),st.pinchStart.zoom+Math.round(Math.log2(ratio))));
        st.pinchStart=null;st.dragStart=null;st.pointerDownOrigin=null;resetTransform();render(st);return;
      }
      if(st.dragStart&&!wasTap){
        const dx=e.clientX-st.dragStart.x,dy=e.clientY-st.dragStart.y;
        const c=world(st.dragStart.center.lat,st.dragStart.center.lon,st.zoom);
        st.center=unworld(c.x-dx,c.y-dy,st.zoom);
      }
      st.dragStart=null;st.pointerDownOrigin=null;st.el.classList.remove('native-map-dragging');resetTransform();
      if(wasTap&&typeof st.tapHandler==='function'){
        try{st.tapHandler(screenToLatLon(st,e.clientX,e.clientY))}catch(err){console.warn('FIELD/OS map tap handler failed',err)}
      }else render(st);
    };
    st.onWheel=e=>{e.preventDefault();st.zoom=Math.max(2,Math.min(maxZoom(),st.zoom+(e.deltaY<0?1:-1)));render(st)};
    st.onDbl=e=>{e.preventDefault();st.zoom=Math.min(maxZoom(),st.zoom+1);render(st)};

    el.addEventListener('pointerdown',st.onPointerDown);
    el.addEventListener('pointermove',st.onPointerMove);
    el.addEventListener('pointerup',st.onPointerUp);
    el.addEventListener('pointercancel',st.onPointerUp);
    el.addEventListener('wheel',st.onWheel,{passive:false});
    el.addEventListener('dblclick',st.onDbl);
    states.set(id,st);
    return st;
  }

  function plannedRoute(){
    return (window.FIELD_ROUTE_STATE?.getPoints?.()||[]).filter(p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
  }
  function drawOverlay(st,w,h){
    const c=world(st.center.lat,st.center.lon,st.zoom),parts=[];
    const route=plannedRoute();
    if(route.length){
      const pts=route.map(p=>{const q=world(p.lat,p.lon,st.zoom);return {x:q.x-c.x+w/2,y:q.y-c.y+h/2}});
      const line=pts.map(p=>`${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
      if(pts.length>1){
        parts.push(`<polyline points="${line}" class="planned-route-outline"/><polyline points="${line}" class="planned-route-line"/>`);
        let distance=0;
        for(let i=1;i<pts.length;i++){
          const a=pts[i-1],b=pts[i],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
          if(!len)continue;
          for(let at=90-distance;at<len;at+=90){
            const x=a.x+dx*at/len,y=a.y+dy*at/len;
            if(x>=0&&x<=w&&y>=0&&y<=h)parts.push(`<path d="M -5 -5 L 1 0 L -5 5" transform="translate(${x},${y}) rotate(${Math.atan2(dy,dx)*180/Math.PI})" class="planned-route-arrow"/>`);
          }
          distance=(distance+len)%90;
        }
      }
      [pts[0],...(pts.length>1?[pts[pts.length-1]]:[])].forEach((p,i)=>parts.push(`<g class="planned-route-marker"><title>${i?'Route finish':'Route start'}</title><circle cx="${p.x}" cy="${p.y}" r="12"/><text x="${p.x}" y="${p.y+4}">${i?'E':'S'}</text></g>`));
    }
    if(livePosition){
      const p=world(livePosition.lat,livePosition.lon,st.zoom),x=p.x-c.x+w/2,y=p.y-c.y+h/2;
      const mpp=Math.max(.01,156543.03392*Math.cos(livePosition.lat*Math.PI/180)/Math.pow(2,st.zoom));
      const r=Math.max(5,Math.min(90,(locationAccuracy||8)/mpp));
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" class="native-accuracy-ring"/>`);
      parts.push(`<circle cx="${x}" cy="${y}" r="7" class="native-self-marker"/>`);
      parts.push(`<path d="M ${x} ${y-14} l -5 9 h 10 z" class="native-self-arrow"/>`);
    }
    st.overlay.setAttribute('viewBox',`0 0 ${w} ${h}`);
    st.overlay.innerHTML=parts.join('');
  }

  function drawEditorOverlay(st,w,h){
    if(!st.editor)return;
    st.editor.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const data=st.geoOverlay||{},parts=[],c=world(st.center.lat,st.center.lon,st.zoom);
    const xy=p=>{
      const q=world(p.lat,p.lon,st.zoom);
      return {x:q.x-c.x+w/2,y:q.y-c.y+h/2};
    };
    const route=Array.isArray(data.route)?data.route.filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)):[];
    if(route.length>1){
      const pts=route.map(p=>{const q=xy(p);return `${q.x.toFixed(1)},${q.y.toFixed(1)}`}).join(' ');
      parts.push(`<polyline points="${pts}" class="planner-route-line"/>`);
    }
    const anchors=Array.isArray(data.anchors)?data.anchors:[];
    const snaps=Array.isArray(data.snapped)?data.snapped:[];
    anchors.forEach((p,i)=>{
      if(!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon))return;
      const a=xy(p),snap=snaps[i];
      if(snap&&Number.isFinite(+snap.lat)&&Number.isFinite(+snap.lon)){
        const b=xy(snap);parts.push(`<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="planner-snap-link"/>`);
      }
      parts.push(`<circle cx="${a.x}" cy="${a.y}" r="8" class="planner-anchor"/><text x="${a.x}" y="${a.y+3}" class="planner-anchor-label">${i===0?'S':i===anchors.length-1?'E':i}</text>`);
    });
    snaps.forEach(p=>{
      if(!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon))return;
      const q=xy(p);parts.push(`<circle cx="${q.x}" cy="${q.y}" r="4" class="planner-snap-point"/>`);
    });
    st.editor.innerHTML=parts.join('');
  }

  function setFallback(st,message){
    st.base.innerHTML='';st.terrain.innerHTML='';st.trail.innerHTML='';
    const diag=st.el.querySelector('.native-map-diag');if(diag)diag.textContent=message;
    const corner=st.el.querySelector('.native-map-corner');if(corner)corner.textContent='MAP NETWORK ERROR';
    st.el.classList.add('standalone-map-error');
  }

  function render(st){
    if(!st)return;
    st.el.classList.remove('standalone-map-error');
    const token=++st.token,rect=st.el.getBoundingClientRect();
    const w=Math.max(250,Math.round(rect.width||st.el.clientWidth||600)),h=Math.max(220,Math.round(rect.height||st.el.clientHeight||360));
    st.zoom=Math.max(2,Math.min(maxZoom(),Math.round(st.zoom)));
    const c=world(st.center.lat,st.center.lon,st.zoom);
    const minX=Math.floor((c.x-w/2)/TILE)-1,maxX=Math.floor((c.x+w/2)/TILE)+1,minY=Math.floor((c.y-h/2)/TILE)-1,maxY=Math.floor((c.y+h/2)/TILE)+1;
    const bf=document.createDocumentFragment(),hf=document.createDocumentFragment(),tf=document.createDocumentFragment();
    st.loaded=0;st.errors=0;
    const diag=st.el.querySelector('.native-map-diag');
    const updateDiag=()=>{if(token===st.token&&diag)diag.textContent=`TILES ${st.loaded} / ERR ${st.errors}`};
    const loaded=()=>{if(token!==st.token)return;st.loaded++;updateDiag()};
    const failed=()=>{if(token!==st.token)return;st.errors++;updateDiag()};
    const make=(src,cls,frag,left,top)=>{
      if(!src)return;
      const img=new Image();img.className='native-map-tile '+cls;img.alt='';img.draggable=false;
      img.style.left=left+'px';img.style.top=top+'px';img.onload=loaded;img.onerror=failed;img.src=src;frag.appendChild(img);
    };

    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const left=x*TILE-c.x+w/2,top=y*TILE-c.y+h/2;
      if(mode==='satellite'){
        make(osmUrl(st.zoom,x,y),'native-osm-base',bf,left,top);
        make(satelliteUrl(st.zoom,x,y),'native-satellite-tile',bf,left,top);
      }else{
        make(osmUrl(st.zoom,x,y),'native-osm-base',bf,left,top);
        if(mode==='topo')make(topoUrl(st.zoom,x,y),'native-topo-tile',bf,left,top);
      }
      if(terrain)make(hillshadeUrl(st.zoom,x,y),'native-terrain-tile',hf,left,top);
      if(trails&&st.zoom<=18)make(trailUrl(st.zoom,x,y),'native-trail-tile',tf,left,top);
    }

    st.base.replaceChildren(bf);
    st.terrain.replaceChildren(hf);
    st.trail.replaceChildren(tf);
    st.grid.classList.toggle('active',grid);
    drawOverlay(st,w,h);
    drawEditorOverlay(st,w,h);

    const attrib=st.el.querySelector('.native-map-attrib');
    if(attrib){
      const parts=['© OpenStreetMap contributors'];
      if(mode==='topo')parts.push('OpenTopoMap');
      if(mode==='satellite'||terrain)parts.push('Esri');
      if(trails)parts.push('Waymarked Trails');
      attrib.textContent=parts.join(' · ');
    }
    const corner=st.el.querySelector('.native-map-corner');
    if(corner)corner.textContent=`${mode==='satellite'?'SAT':mode==='topo'?'TOPO + OSM':'OSM'} Z${st.zoom}${terrain?' // TERRAIN':''}${trails?' // HIKING':''}`;
    updateDiag();
    setTimeout(()=>{
      if(token!==st.token)return;
      if(st.loaded===0)setFallback(st,'0 TILES LOADED — CHECK INTERNET / CONTENT BLOCKER');
      else{
        const main=document.getElementById('mapSourceDiag');
        if(main)main.textContent=`${mode.toUpperCase()} — ${st.loaded} TILES / ${st.errors} ERR`;
      }
    },3500);
  }

  function refresh(recenter=false){
    updateLabels();
    ['homeRealMap','realMap'].forEach(id=>ensure(id));
    for(const st of states.values()){
      if((st.id==='homeRealMap'||st.id==='realMap')&&(recenter||!st.rendered)){
        if(plannedRoute().length>1&&!liveEnabled)st.routeFitted=false;
        else st.center={...centerCandidate()};
      }
      st.rendered=true;
      if(!st.routeFitted&&plannedRoute().length>1&&st.el.getBoundingClientRect().width>0){
        st.routeFitted=true;fitBounds(st.id,plannedRoute(),{padding:48,maxZoom:16});
      }else render(st);
    }
  }

  document.addEventListener('fieldos:routechange',()=>{
    states.forEach(st=>{st.routeFitted=false});refresh(false);
  });

  function setLayers(settings){
    if(['osm','topo','satellite'].includes(settings.mode))mode=settings.mode;
    if(typeof settings.trails==='boolean')trails=settings.trails;
    if(typeof settings.terrain==='boolean')terrain=settings.terrain;
    if(typeof settings.grid==='boolean')grid=settings.grid;
    localStorage.setItem(STORE_PREFIX+'map-source',mode);
    for(const [key,value] of [['hiking-routes',trails],['terrain-shade',terrain],['map-grid',grid]])localStorage.setItem(STORE_PREFIX+key,value?'on':'off');
    refresh(false);
  }
  function setMode(next){
    mode=['osm','topo','satellite'].includes(next)?next:'topo';
    localStorage.setItem(STORE_PREFIX+'map-source',mode);
    states.forEach(st=>{st.zoom=Math.min(st.zoom,maxZoom())});
    refresh(false);
  }
  function setTrails(on){trails=!!on;localStorage.setItem(STORE_PREFIX+'hiking-routes',trails?'on':'off');refresh(false)}
  function setTerrain(on){terrain=!!on;localStorage.setItem(STORE_PREFIX+'terrain-shade',terrain?'on':'off');refresh(false)}
  function setGrid(on){grid=!!on;localStorage.setItem(STORE_PREFIX+'map-grid',grid?'on':'off');refresh(false)}
  function zoom(target,delta){const st=ensure(target)||ensure('realMap');if(!st)return;st.zoom=Math.max(2,Math.min(maxZoom(),st.zoom+delta));render(st)}
  function center(target){const st=ensure(target)||ensure('realMap');if(!st)return;st.center={...centerCandidate()};render(st)}

  function applyPosition(p){
    livePosition={lat:p.coords.latitude,lon:p.coords.longitude};
    locationAccuracy=Number.isFinite(p.coords.accuracy)?p.coords.accuracy:null;
    lastFixTime=Date.now();
    for(const id of ['homeRealMap','realMap']){const st=states.get(id);if(st)st.center={...livePosition}}
    refresh(true);
  }

  function startLiveLocation(){
    if(watchId!=null)return;
    if(!navigator.geolocation){
      liveEnabled=false;localStorage.setItem(STORE_PREFIX+'live-location','off');updateLabels();
      const d=document.getElementById('mapSourceDiag');if(d)d.textContent='GEOLOCATION UNAVAILABLE';
      return;
    }
    liveEnabled=true;localStorage.setItem(STORE_PREFIX+'live-location','on');updateLabels();
    const d=document.getElementById('mapSourceDiag');if(d)d.textContent='STARTING LIVE LOCATION…';
    watchId=navigator.geolocation.watchPosition(
      p=>applyPosition(p),
      e=>{
        const d2=document.getElementById('mapSourceDiag');if(d2)d2.textContent='LOCATION ERROR: '+String(e.message||e.code).slice(0,42);
        updateLocationLabels();
      },
      {enableHighAccuracy:true,timeout:15000,maximumAge:1500}
    );
    updateLabels();
  }

  function stopLiveLocation(){
    if(watchId!=null){navigator.geolocation.clearWatch(watchId);watchId=null}
    liveEnabled=false;localStorage.setItem(STORE_PREFIX+'live-location','off');
    updateLabels();refresh(false);
  }

  function toggleLiveLocation(){liveEnabled?stopLiveLocation():startLiveLocation()}

  function screenToLatLon(st,clientX,clientY){
    const rect=st.el.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),c=world(st.center.lat,st.center.lon,st.zoom);
    return unworld(c.x+(clientX-rect.left)-w/2,c.y+(clientY-rect.top)-h/2,st.zoom);
  }
  function mount(id,opts={}){
    const st=ensure(id);if(!st)return null;
    if(opts.center&&Number.isFinite(+opts.center.lat)&&Number.isFinite(+opts.center.lon))st.center={lat:+opts.center.lat,lon:+opts.center.lon};
    if(Number.isFinite(+opts.zoom))st.zoom=Math.max(2,Math.min(maxZoom(),Math.round(+opts.zoom)));
    st.rendered=true;requestAnimationFrame(()=>render(st));return st;
  }
  function setView(id,centerPos,zoomLevel){
    const st=ensure(id);if(!st||!centerPos)return;
    if(Number.isFinite(+centerPos.lat)&&Number.isFinite(+centerPos.lon))st.center={lat:+centerPos.lat,lon:+centerPos.lon};
    if(Number.isFinite(+zoomLevel))st.zoom=Math.max(2,Math.min(maxZoom(),Math.round(+zoomLevel)));
    st.rendered=true;render(st);
  }
  function fitBounds(id,points,opts={}){
    const st=ensure(id);if(!st)return;
    const pts=(Array.isArray(points)?points:[]).filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon));
    if(!pts.length)return;
    const minLat=Math.min(...pts.map(p=>+p.lat)),maxLat=Math.max(...pts.map(p=>+p.lat)),minLon=Math.min(...pts.map(p=>+p.lon)),maxLon=Math.max(...pts.map(p=>+p.lon));
    st.center={lat:(minLat+maxLat)/2,lon:(minLon+maxLon)/2};
    const rect=st.el.getBoundingClientRect(),pad=Math.max(0,Number(opts.padding)||36),availW=Math.max(80,(rect.width||600)-pad*2),availH=Math.max(80,(rect.height||360)-pad*2),cap=Math.min(maxZoom(),Number.isFinite(+opts.maxZoom)?+opts.maxZoom:maxZoom());
    let chosen=2;
    for(let z=2;z<=cap;z++){
      const nw=world(maxLat,minLon,z),se=world(minLat,maxLon,z);
      if(Math.abs(se.x-nw.x)<=availW&&Math.abs(se.y-nw.y)<=availH)chosen=z;else break;
    }
    st.zoom=chosen;st.rendered=true;render(st);
  }
  function setTapHandler(id,handler){const st=ensure(id);if(st)st.tapHandler=typeof handler==='function'?handler:null}
  function setGeoOverlay(id,data){const st=ensure(id);if(!st)return;st.geoOverlay=data||null;const rect=st.el.getBoundingClientRect();drawEditorOverlay(st,Math.max(250,Math.round(rect.width||600)),Math.max(220,Math.round(rect.height||360)))}
  function getView(id){const st=states.get(id);return st?{center:{...st.center},zoom:st.zoom}:null}

  function handleAction(btn){
    const action=btn.dataset.mapAction,target=targetForButton(btn);
    if(action==='topo')setMode('topo');
    else if(action==='osm')setMode('osm');
    else if(action==='satellite')setMode('satellite');
    else if(action==='trails')setTrails(!trails);
    else if(action==='terrain')setTerrain(!terrain);
    else if(action==='zoom-in')zoom(target,1);
    else if(action==='zoom-out')zoom(target,-1);
    else if(action==='center')center(target);
    else if(action==='fit-route')fitBounds(target,plannedRoute(),{padding:48,maxZoom:16});
    else if(action==='location-toggle')toggleLiveLocation();
  }

  function handleLayerInput(input){
    const layer=input.dataset.mapLayer,on=input.checked;
    if(layer==='trails')setTrails(on);
    else if(layer==='topo'){if(on)setMode('topo');else if(mode==='topo')setMode('osm')}
    else if(layer==='satellite'){if(on)setMode('satellite');else if(mode==='satellite')setMode('topo')}
    else if(layer==='terrain')setTerrain(on);
    else if(layer==='grid')setGrid(on);
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-map-action]');
    if(!btn)return;
    e.preventDefault();e.stopPropagation();e.stopImmediatePropagation?.();handleAction(btn);
  },true);

  document.addEventListener('change',e=>{
    const input=e.target.closest?.('[data-map-layer]');
    if(!input)return;
    e.stopPropagation();handleLayerInput(input);
  },true);

  window.addEventListener('resize',()=>{
    clearTimeout(window.__fieldMapResizeTimer);
    window.__fieldMapResizeTimer=setTimeout(()=>refresh(false),100);
  },{passive:true});

  setInterval(updateLocationLabels,1000);

  window.FIELD_MAP_ENGINE={
    refresh,setLayers,setMode,setTrails,setTerrain,setGrid,startLiveLocation,stopLiveLocation,toggleLiveLocation,zoom,center,
    mount,setView,fitBounds,setTapHandler,setGeoOverlay,getView,
    get mode(){return mode},get trails(){return trails},get terrain(){return terrain},get grid(){return grid},get live(){return liveEnabled}
  };

  const boot=()=>requestAnimationFrame(()=>{
    refresh(true);
    if(liveEnabled)startLiveLocation();
    setTimeout(()=>refresh(false),300);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
