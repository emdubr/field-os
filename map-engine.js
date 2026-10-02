(() => {
  'use strict';

  const STORE_PREFIX='fieldos-v12-';
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
  const tileZoomFor=z=>Math.max(2,Math.min(maxZoom(),Math.floor(Number(z)+1e-6)));
  const rasterScaleFor=z=>Math.pow(2,z-tileZoomFor(z));
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

  function isVisible(st){
    if(!st?.el||st.el.hidden)return false;
    const view=st.el.closest('.view');
    return !view||view.classList.contains('active');
  }

  function targetForButton(btn){return btn.dataset.mapTarget || (btn.closest('#home')?'homeRealMap':'realMap')}
  function centerCandidate(){return livePosition||DEFAULT_CENTER}
  function formatAge(){
    if(!lastFixTime)return '—';
    const sec=Math.max(0,Math.round((Date.now()-lastFixTime)/1000));
    return sec<60?`${sec}s`:`${Math.floor(sec/60)}m ${String(sec%60).padStart(2,'0')}s`;
  }

  function emitState(){
    document.dispatchEvent(new CustomEvent('fieldos:mapstatechange',{detail:{mode,trails,terrain,grid,live:liveEnabled}}));
  }

  function setPressed(el,on){
    if(!el)return;
    el.classList.toggle('active',!!on);
    el.setAttribute('aria-pressed',on?'true':'false');
  }

  let locationLabelNodes=null;
  function getLocationLabelNodes(){
    if(locationLabelNodes)return locationLabelNodes;
    return locationLabelNodes={
      buttons:[...document.querySelectorAll('.map-location-toggle')],
      state:document.getElementById('homeLocationState'),
      age:document.getElementById('homeLiveFixAge'),
      accuracy:document.getElementById('homeLiveAccuracy'),
      oldAge:document.getElementById('homeFixAge'),
      oldAccuracy:document.getElementById('homeAccuracy')
    };
  }
  function updateLocationLabels(){
    const state=liveEnabled?(watchId!=null?(livePosition?'LIVE':'ACQUIRING'):'STARTING'):(livePosition?'PAUSED':'OFF'),nodes=getLocationLabelNodes();
    nodes.buttons.forEach(btn=>{
      btn.textContent=`LIVE LOCATION ${liveEnabled?'ON':'OFF'}`;
      setPressed(btn,liveEnabled);
    });
    if(nodes.state)nodes.state.textContent=state;
    if(nodes.age)nodes.age.textContent=formatAge();
    const accuracy=locationAccuracy!=null?`±${Math.round(locationAccuracy)} m`:'—';
    if(nodes.accuracy)nodes.accuracy.textContent=accuracy;
    if(nodes.oldAge)nodes.oldAge.textContent=lastFixTime?formatAge():'—';
    if(nodes.oldAccuracy)nodes.oldAccuracy.textContent=accuracy;
  }

  function updateLabels(){
    document.dispatchEvent(new CustomEvent('fieldos:maplayerschange'));
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
      geoOverlay:null,tapHandler:null,rendered:false,renderFrame:0,wheelDelta:0,wheelZoom:0,wheelTimer:0,wheelAnchor:null,failureTimer:0,resizeObserver:null,
      settleTimer:0,gestureFrame:0,pendingGesture:null,deferredPinch:null,lastRenderKey:'',layoutRect:null,renderSize:null,tiles:new Map(),tileRevision:0
    };
    const readLayout=()=>{
      if(st.layoutRect)return st.layoutRect;
      const rect=st.el.getBoundingClientRect();
      return st.layoutRect={left:rect.left,top:rect.top,width:rect.width,height:rect.height};
    };
    const invalidateLayout=()=>{st.layoutRect=null};

    const rasterLayers=[st.base,st.terrain,st.trail],vectorLayers=[st.grid,st.overlay,st.editor];
    const applyRestingCamera=()=>{
      const scale=rasterScaleFor(st.zoom);
      for(const layer of rasterLayers){layer.style.transition='';layer.style.transformOrigin='50% 50%';layer.style.transform=Math.abs(scale-1)<.001?'':`scale(${scale})`}
      for(const layer of vectorLayers){layer.style.transition='';layer.style.transformOrigin='50% 50%';layer.style.transform=''}
    };
    st.applyRestingCamera=applyRestingCamera;
    st.readLayout=readLayout;
    st.invalidateLayout=invalidateLayout;
    const paintGesture=gesture=>{
      const rect=readLayout(),w=Math.max(1,rect.width),h=Math.max(1,rect.height);
      const ax=gesture.originX==null?w/2:Math.max(0,Math.min(w,gesture.originX-rect.left));
      const ay=gesture.originY==null?h/2:Math.max(0,Math.min(h,gesture.originY-rect.top));
      const baseScale=rasterScaleFor(st.zoom),g=Math.max(.5,Math.min(2,gesture.scale||1));
      const compensateX=g*(1-baseScale)*(w/2-ax),compensateY=g*(1-baseScale)*(h/2-ay);
      for(const layer of rasterLayers){
        layer.style.transformOrigin=`${ax}px ${ay}px`;
        layer.style.transform=`translate(${gesture.dx+compensateX}px,${gesture.dy+compensateY}px) scale(${baseScale*g})`;
      }
      for(const layer of vectorLayers){
        layer.style.transformOrigin=`${ax}px ${ay}px`;
        layer.style.transform=`translate(${gesture.dx}px,${gesture.dy}px) scale(${g})`;
      }
    };
    const queueGesture=(dx=0,dy=0,scale=1,originX=null,originY=null)=>{
      st.pendingGesture={dx,dy,scale,originX,originY};
      if(st.gestureFrame)return;
      st.gestureFrame=requestAnimationFrame(()=>{st.gestureFrame=0;const p=st.pendingGesture;st.pendingGesture=null;if(p)paintGesture(p)});
    };
    const commitGesture=()=>{
      if(st.gestureFrame){cancelAnimationFrame(st.gestureFrame);st.gestureFrame=0}
      const pending=st.pendingGesture;st.pendingGesture=null;
      if(pending)paintGesture(pending);
      clearTimeout(st.settleTimer);
      // Keep the compositor preview visible until render() has staged the
      // replacement tile frame. This removes the release-time map snap.
      st.settleTimer=setTimeout(()=>{if(st.pointers.size===0)render(st)},0);
    };
    const settleFractionalZoom=(visualZoom,clientX,clientY,anchor)=>{
      // Commit the camera immediately but retain the final compositor preview
      // until the replacement tile frame is ready.
      if(st.gestureFrame){cancelAnimationFrame(st.gestureFrame);st.gestureFrame=0}
      const pending=st.pendingGesture;st.pendingGesture=null;
      if(pending)paintGesture(pending);
      const next=Math.max(2,Math.min(maxZoom(),visualZoom));
      preserveAnchor(anchor,clientX,clientY,next);st.zoom=next;
      clearTimeout(st.settleTimer);
      st.settleTimer=setTimeout(()=>{if(st.pointers.size===0)render(st)},0);
    };
    const previewZoom=(scale,clientX,clientY)=>queueGesture(0,0,scale,clientX,clientY);
    const previewPinch=(scale,clientX,clientY,startX,startY,baseDx=0,baseDy=0)=>{
      queueGesture(baseDx+clientX-startX,baseDy+clientY-startY,scale,startX,startY);
    };
    const preserveAnchor=(anchor,clientX,clientY,newZoom)=>{
      if(!anchor)return;
      const rect=readLayout(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),a=world(anchor.lat,anchor.lon,newZoom);
      st.center=unworld(a.x-(clientX-rect.left-w/2),a.y-(clientY-rect.top-h/2),newZoom);
    };

    st.onPointerDown=e=>{
      if(e.button!==undefined&&e.button>0)return;
      e.preventDefault();
      try{st.el.setPointerCapture?.(e.pointerId)}catch{}
      st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(st.pointers.size===1){
        st.dragStart={x:e.clientX,y:e.clientY,center:{...st.center}};
        st.pointerDownOrigin={x:e.clientX,y:e.clientY};
        st.el.classList.add('native-map-dragging');
      }else if(st.pointers.size===2){
        const p=[...st.pointers.values()];
        const midX=(p[0].x+p[1].x)/2,midY=(p[0].y+p[1].y)/2;
        const baseDx=st.dragStart?p[0].x-st.dragStart.x:0,baseDy=st.dragStart?p[0].y-st.dragStart.y:0;
        st.pinchStart={dist:Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),zoom:st.zoom,anchor:screenToLatLon(st,midX-baseDx,midY-baseDy),midX,midY,baseDx,baseDy};
      }
    };
    st.onPointerMove=e=>{
      if(!st.pointers.has(e.pointerId))return;
      st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(st.pointers.size===1&&st.dragStart){
        const dx=e.clientX-st.dragStart.x,dy=e.clientY-st.dragStart.y;
        queueGesture(dx,dy,1);
      }else if(st.pointers.size===2&&st.pinchStart){
        const p=[...st.pointers.values()],dist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
        const ratio=dist/Math.max(1,st.pinchStart.dist),midX=(p[0].x+p[1].x)/2,midY=(p[0].y+p[1].y)/2;
        const fractional=Math.log2(Math.max(.5,Math.min(2,ratio))),next=Math.max(2,Math.min(maxZoom(),st.pinchStart.zoom+fractional));
        st.pinchStart.lastMidX=midX;st.pinchStart.lastMidY=midY;st.pinchStart.visualZoom=next;previewPinch(Math.pow(2,next-st.pinchStart.zoom),midX,midY,st.pinchStart.midX,st.pinchStart.midY,st.pinchStart.baseDx,st.pinchStart.baseDy);
      }
    };
    st.onPointerUp=e=>{
      const old=[...st.pointers.values()];
      st.pointers.delete(e.pointerId);
      try{st.el.releasePointerCapture?.(e.pointerId)}catch{}
      const origin=st.pointerDownOrigin;
      const wasTap=!!(origin&&old.length===1&&!st.pinchStart&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)<7);
      if(st.pinchStart&&old.length>=2){
        const pinch=st.pinchStart,dist=Math.hypot(old[1].x-old[0].x,old[1].y-old[0].y),ratio=dist/Math.max(1,pinch.dist);
        const visualZoom=pinch.visualZoom??Math.max(2,Math.min(maxZoom(),pinch.zoom+Math.log2(Math.max(.5,Math.min(2,ratio)))));
        const midX=pinch.lastMidX??pinch.midX,midY=pinch.lastMidY??pinch.midY;
        st.pinchStart=null;st.pointerDownOrigin=null;
        const remaining=[...st.pointers.values()][0];
        if(remaining){
          // Do not reconcile the compositor preview while iOS still owns one
          // finger from the pinch. Freeze the exact visual frame and commit
          // only when the final pointer is released.
          st.deferredPinch={visualZoom,midX,midY,anchor:pinch.anchor};
          st.dragStart=null;
        }else{
          settleFractionalZoom(visualZoom,midX,midY,pinch.anchor);
          st.el.classList.remove('native-map-dragging');
        }
        return;
      }
      if(st.deferredPinch){
        const pinch=st.deferredPinch;st.deferredPinch=null;
        st.dragStart=null;st.pointerDownOrigin=null;st.el.classList.remove('native-map-dragging');
        settleFractionalZoom(pinch.visualZoom,pinch.midX,pinch.midY,pinch.anchor);
        return;
      }
      if(st.dragStart&&!wasTap){
        const dx=e.clientX-st.dragStart.x,dy=e.clientY-st.dragStart.y;
        const c=world(st.dragStart.center.lat,st.dragStart.center.lon,st.zoom);
        st.center=unworld(c.x-dx,c.y-dy,st.zoom);
      }
      st.dragStart=null;st.pointerDownOrigin=null;st.el.classList.remove('native-map-dragging');
      if(wasTap&&typeof st.tapHandler==='function'){
        try{st.tapHandler(screenToLatLon(st,e.clientX,e.clientY))}catch(err){console.warn('FIELD/OS map tap handler failed',err)}
      }else{
        commitGesture();
      }
    };
    st.onPointerCancel=e=>{
      // A cancelled OS/browser gesture must never become a map tap.
      st.pointers.clear();
      try{st.el.releasePointerCapture?.(e.pointerId)}catch{}
      st.dragStart=null;st.pinchStart=null;st.deferredPinch=null;st.pointerDownOrigin=null;
      st.el.classList.remove('native-map-dragging');
      if(st.gestureFrame){cancelAnimationFrame(st.gestureFrame);st.gestureFrame=0;st.pendingGesture=null}
      clearTimeout(st.settleTimer);
      // Preserve the last compositor frame on cancellation; rebuilding on an
      // OS-level pointercancel caused the map to flash during interrupted pinch.
      requestAnimationFrame(()=>render(st));
    };
    st.onWheel=e=>{
      if(e.ctrlKey)return;
      e.preventDefault();
      st.wheelDelta+=Math.max(-120,Math.min(120,e.deltaY));
      const rect=readLayout(),anchorX=e.clientX,anchorY=e.clientY;
      st.wheelAnchor={point:screenToLatLon(st,anchorX,anchorY),x:anchorX,y:anchorY};
      if(!st.renderFrame)st.renderFrame=requestAnimationFrame(()=>{
        st.renderFrame=0;
        const delta=st.wheelDelta;st.wheelDelta=0;
        // Trackpads can deliver very dense wheel bursts. A slightly lower gain
        // avoids oscillating across integer tile zoom boundaries every frame.
        st.wheelZoom=Math.max(-.75,Math.min(.75,st.wheelZoom-delta/560));
        const previewAnchor=st.wheelAnchor;
        previewZoom(Math.pow(2,st.wheelZoom),previewAnchor?.x??anchorX,previewAnchor?.y??anchorY);
      });
      clearTimeout(st.wheelTimer);
      st.wheelTimer=setTimeout(()=>{
        const fractional=st.wheelZoom,anchor=st.wheelAnchor;st.wheelZoom=0;st.wheelAnchor=null;
        if(Math.abs(fractional)<.04){applyRestingCamera();return}
        settleFractionalZoom(Math.max(2,Math.min(maxZoom(),st.zoom+fractional)),anchor?.x??0,anchor?.y??0,anchor?.point);
      },120);
    };
    st.onDbl=e=>{
      e.preventDefault();
      const anchor=screenToLatLon(st,e.clientX,e.clientY),nextZoom=Math.min(maxZoom(),st.zoom+1);
      preserveAnchor(anchor,e.clientX,e.clientY,nextZoom);st.zoom=nextZoom;render(st);
    };

    el.addEventListener('pointerdown',st.onPointerDown);
    el.addEventListener('pointermove',st.onPointerMove);
    el.addEventListener('pointerup',st.onPointerUp);
    el.addEventListener('pointercancel',st.onPointerCancel);
    el.addEventListener('wheel',st.onWheel,{passive:false});
    el.addEventListener('dblclick',st.onDbl);
    if('ResizeObserver' in window){
      let resizeFrame=0,lastW=0,lastH=0;
      st.resizeObserver=new ResizeObserver(entries=>{
        const box=entries[0]?.contentRect;if(!box||box.width<1||box.height<1)return;
        const w=Math.round(box.width),h=Math.round(box.height);st.layoutRect=null;st.renderSize=null;
        // Mobile browser chrome and safe-area settling can report a stream of
        // 1–3 px resizes. They do not require rebuilding the raster tile frame.
        if(lastW&&lastH&&Math.abs(w-lastW)<8&&Math.abs(h-lastH)<8)return;
        lastW=w;lastH=h;
        cancelAnimationFrame(resizeFrame);
        resizeFrame=requestAnimationFrame(()=>{if(st.rendered&&isVisible(st))render(st)});
      });
      st.resizeObserver.observe(el);
    }else{
      let resizeTimer=0;
      st.onResize=()=>{st.layoutRect=null;st.renderSize=null;clearTimeout(resizeTimer);resizeTimer=setTimeout(()=>{if(st.rendered&&isVisible(st))render(st)},100)};
      window.addEventListener('resize',st.onResize,{passive:true});
    }
    states.set(id,st);
    return st;
  }

  function bridgePosition(){
    const p=window.FIELD_MAP_DATA?.current?.();
    if(!p||!Number.isFinite(+p.lat)||!Number.isFinite(+p.lon)||String(p.source||'').toUpperCase().includes('DEMO'))return null;
    return {lat:+p.lat,lon:+p.lon,accuracy:Number.isFinite(+p.accuracy)?+p.accuracy:null};
  }
  function bridgeWaypoints(){return (window.FIELD_MAP_DATA?.waypoints?.()||[]).filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon))}
  function bridgeTrack(){return (window.FIELD_MAP_DATA?.track?.()||[]).filter(p=>Number.isFinite(+p.lat)&&Number.isFinite(+p.lon))}

  let cachedRoute=null,routeBridge=null;
  function plannedRoute(){
    const currentBridge=window.FIELD_ROUTE_STATE;
    if(currentBridge!==routeBridge){routeBridge=currentBridge;cachedRoute=null}
    if(cachedRoute)return cachedRoute;
    if(!currentBridge?.getPoints)return [];
    return cachedRoute=(currentBridge.getPoints()||[]).filter(p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon));
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
    const track=bridgeTrack(),trackStep=Math.max(1,Math.ceil(track.length/1500));
    const trackPts=track.filter((_,i)=>i%trackStep===0);
    if(trackPts.length>1){
      const line=trackPts.map(p=>{const q=world(p.lat,p.lon,st.zoom);return `${(q.x-c.x+w/2).toFixed(1)},${(q.y-c.y+h/2).toFixed(1)}`}).join(' ');
      parts.push(`<polyline points="${line}" class="native-track-line"/>`);
    }
    for(const wp of bridgeWaypoints().slice(0,200)){
      const q=world(wp.lat,wp.lon,st.zoom),x=q.x-c.x+w/2,y=q.y-c.y+h/2;
      if(x<-50||x>w+50||y<-50||y>h+50)continue;
      const base=String(wp.type||'').toUpperCase()==='BASE',label=String(wp.name||wp.type||'WP').replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch])).slice(0,24);
      parts.push(`<circle cx="${x}" cy="${y}" r="${base?6:4}" class="${base?'native-base-marker':'native-waypoint-marker'}"/><text x="${x+8}" y="${y-7}" class="native-waypoint-label">${label}</text>`);
    }
    const position=livePosition||bridgePosition();
    if(position){
      const p=world(position.lat,position.lon,st.zoom),x=p.x-c.x+w/2,y=p.y-c.y+h/2;
      const mpp=Math.max(.01,156543.03392*Math.cos(position.lat*Math.PI/180)/Math.pow(2,st.zoom));
      const r=Math.max(5,Math.min(90,(locationAccuracy||position.accuracy||8)/mpp));
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

  // Retained tile renderer: camera updates reposition existing images. Only
  // newly exposed coordinates allocate tiles; older zooms provide a backdrop
  // until the replacement base layer has actually loaded.
  function render(st,force=false){
    if(!st||states.get(st.id)!==st)return;
    if(st.pointers.size){st.lastRenderKey='';return;}
    const rect=st.el.getBoundingClientRect();
    const w=Math.max(250,Math.round(rect.width||st.el.clientWidth||600)),h=Math.max(220,Math.round(rect.height||st.el.clientHeight||360));
    st.renderSize={w,h};
    st.zoom=Math.max(2,Math.min(maxZoom(),st.zoom));
    const tileZoom=tileZoomFor(st.zoom),renderScale=rasterScaleFor(st.zoom),c=world(st.center.lat,st.center.lon,tileZoom);
    // Exact camera coordinates matter: a 32px rounded key left raster tiles
    // behind the route overlay on small drags.
    const renderKey=[mode,trails,terrain,grid,st.zoom,c.x,c.y,w,h].join('|');
    if(!force&&st.lastRenderKey===renderKey){drawOverlay(st,w,h);drawEditorOverlay(st,w,h);return;}
    st.lastRenderKey=renderKey;
    const revision=++st.tileRevision,needed=new Set();
    const coverW=w/renderScale,coverH=h/renderScale;
    const minX=Math.floor((c.x-coverW/2)/TILE)-1,maxX=Math.floor((c.x+coverW/2)/TILE)+1,minY=Math.floor((c.y-coverH/2)/TILE)-1,maxY=Math.floor((c.y+coverH/2)/TILE)+1;
    const activeClasses=new Set(['native-osm-base',...(mode==='topo'?['native-topo-tile']:mode==='satellite'?['native-satellite-tile']:[]),...(terrain?['native-terrain-tile']:[]),...(trails?['native-trail-tile']:[])]);
    function remove(key,tile){tile.img.onload=tile.img.onerror=null;tile.img.remove();st.tiles.delete(key);}
    function place(tile){
      const scale=Math.pow(2,tileZoom-tile.z),size=TILE*scale;
      tile.img.style.left=(tile.x*size-c.x+w/2)+'px';
      tile.img.style.top=(tile.y*size-c.y+h/2)+'px';
      tile.img.style.width=size+'px';tile.img.style.height=size+'px';
      tile.img.style.zIndex=String((tile.cls==='native-osm-base'?0:2)+(tile.revision===revision?1:0));
    }
    function diagnostics(){
      if(states.get(st.id)!==st)return;
      let loaded=0,errors=0,pending=0,baseReady=true;
      for(const key of needed){const tile=st.tiles.get(key);if(!tile)continue;
        if(tile.status==='loaded')loaded++;else if(tile.status==='error')errors++;else pending++;
        if(tile.layer===st.base&&tile.status!=='loaded')baseReady=false;
      }
      st.loaded=loaded;st.errors=errors;
      const diag=st.el.querySelector('.native-map-diag');
      if(diag)diag.textContent=`TILES ${loaded} / ERR ${errors}${pending?' / LOADING '+pending:''}`;
      if(baseReady)for(const [key,tile] of st.tiles)if(!needed.has(key))remove(key,tile);
      st.el.classList.toggle('standalone-map-error',!loaded&&!pending&&errors>0);
    }
    st.updateTileDiagnostics=diagnostics;
    function use(src,cls,layer,x,y){
      if(!src)return;
      const key=[cls,tileZoom,x,y].join('/');needed.add(key);
      let tile=st.tiles.get(key);
      if(tile?.status==='error'&&(force||Date.now()-tile.failedAt>10000)){remove(key,tile);tile=null;}
      if(!tile){
        const img=new Image();img.className='native-map-tile '+cls;img.alt='';img.draggable=false;img.referrerPolicy='strict-origin-when-cross-origin';
        tile={img,cls,layer,x,y,z:tileZoom,status:'pending',revision};st.tiles.set(key,tile);
        img.onload=()=>{tile.status='loaded';st.updateTileDiagnostics?.();};
        img.onerror=()=>{tile.status='error';tile.failedAt=Date.now();st.updateTileDiagnostics?.();};
        layer.appendChild(img);img.src=src;
      }
      tile.revision=revision;place(tile);
    }
    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      use(osmUrl(tileZoom,x,y),'native-osm-base',st.base,x,y);
      if(mode==='topo')use(topoUrl(tileZoom,x,y),'native-topo-tile',st.base,x,y);
      if(mode==='satellite')use(satelliteUrl(tileZoom,x,y),'native-satellite-tile',st.base,x,y);
      if(terrain)use(hillshadeUrl(tileZoom,x,y),'native-terrain-tile',st.terrain,x,y);
      if(trails&&tileZoom<=18)use(trailUrl(tileZoom,x,y),'native-trail-tile',st.trail,x,y);
    }
    for(const [key,tile] of st.tiles){
      if(needed.has(key))continue;
      // Keep at most one loaded fallback zoom; never keep pending obsolete
      // requests attached, or let a long pan grow the DOM without bound.
      if(!activeClasses.has(tile.cls)||tile.status!=='loaded'||Math.abs(tile.z-tileZoom)>1||tile.z===tileZoom){remove(key,tile);continue;}
      place(tile);
      const left=parseFloat(tile.img.style.left),top=parseFloat(tile.img.style.top),size=parseFloat(tile.img.style.width);
      if(left+size<0||top+size<0||left>w||top>h)remove(key,tile);
    }
    st.grid.classList.toggle('active',grid);
    drawOverlay(st,w,h);drawEditorOverlay(st,w,h);st.applyRestingCamera?.();diagnostics();
    const attrib=st.el.querySelector('.native-map-attrib');
    if(attrib)attrib.textContent=['© OpenStreetMap contributors',...(mode==='topo'?['OpenTopoMap']:[]),...(mode==='satellite'||terrain?['Esri']:[]),...(trails?['Waymarked Trails']:[])].join(' · ');
    const corner=st.el.querySelector('.native-map-corner');
    if(corner)corner.textContent=`${mode==='satellite'?'SAT':mode==='topo'?'TOPO + OSM':'OSM'} Z${st.zoom.toFixed(1)}${terrain?' // TERRAIN':''}${trails?' // HIKING':''}`;
    clearTimeout(st.failureTimer);
    st.failureTimer=setTimeout(()=>{if(states.get(st.id)===st&&st.loaded===0){const diag=st.el.querySelector('.native-map-diag');if(diag)diag.textContent='MAP TILES UNAVAILABLE — CHECK CONNECTION / OFFLINE PACK';}},3500);
  }

  function refresh(recenter=false){
    updateLabels();
    ['homeRealMap','realMap'].forEach(id=>ensure(id));
    for(const st of states.values()){
      const visible=isVisible(st);
      if(!visible&&!recenter)continue;
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

  const overlaySize=st=>{
    if(st.renderSize)return st.renderSize;
    const rect=st.el.getBoundingClientRect();
    return {w:Math.max(250,Math.round(rect.width||st.el.clientWidth||600)),h:Math.max(220,Math.round(rect.height||st.el.clientHeight||360))};
  };
  const redrawDataOverlay=()=>{
    states.forEach(st=>{if(!isVisible(st))return;const {w,h}=overlaySize(st);drawOverlay(st,w,h)});
  };
  document.addEventListener('fieldos:waypointschange',redrawDataOverlay);
  document.addEventListener('fieldos:trackchange',redrawDataOverlay);
  document.addEventListener('fieldos:positionchange',()=>{if(!liveEnabled)redrawDataOverlay()});

  document.addEventListener('fieldos:routechange',()=>{
    cachedRoute=null;
    states.forEach(st=>{
      st.routeFitted=false;
      if(!isVisible(st)){const {w,h}=overlaySize(st);drawOverlay(st,w,h)}
    });
    refresh(false);
  });

  function setLayers(settings={},recenter=false){
    const before=`${mode}|${trails}|${terrain}|${grid}`;
    if(['osm','topo','satellite'].includes(settings.mode))mode=settings.mode;
    if(typeof settings.trails==='boolean')trails=settings.trails;
    if(typeof settings.terrain==='boolean')terrain=settings.terrain;
    if(typeof settings.grid==='boolean')grid=settings.grid;
    localStorage.setItem(STORE_PREFIX+'map-source',mode);
    for(const [key,value] of [['hiking-routes',trails],['terrain-shade',terrain],['map-grid',grid]])localStorage.setItem(STORE_PREFIX+key,value?'on':'off');
    const changed=before!==`${mode}|${trails}|${terrain}|${grid}`;
    if(changed)invalidateFrames();
    emitState();
    if(changed||recenter)refresh(recenter);else updateLabels();
    return changed;
  }
  function invalidateFrames(){states.forEach(st=>{st.lastRenderKey='';st.lastTileBounds=''})}
  function setMode(next){
    mode=['osm','topo','satellite'].includes(next)?next:'topo';
    localStorage.setItem(STORE_PREFIX+'map-source',mode);
    states.forEach(st=>{st.zoom=Math.min(st.zoom,maxZoom())});invalidateFrames();
    emitState();refresh(false);
  }
  function setTrails(on){trails=!!on;localStorage.setItem(STORE_PREFIX+'hiking-routes',trails?'on':'off');invalidateFrames();emitState();refresh(false)}
  function setTerrain(on){terrain=!!on;localStorage.setItem(STORE_PREFIX+'terrain-shade',terrain?'on':'off');invalidateFrames();emitState();refresh(false)}
  function setGrid(on){grid=!!on;localStorage.setItem(STORE_PREFIX+'map-grid',grid?'on':'off');emitState();refresh(false)}
  function zoom(target,delta){const st=ensure(target)||ensure('realMap');if(!st)return;st.zoom=Math.max(2,Math.min(maxZoom(),st.zoom+delta));render(st)}
  function center(target){const st=ensure(target)||ensure('realMap');if(!st)return;st.center={...centerCandidate()};render(st)}

  function metersBetween(a,b){if(!a||!b)return Infinity;const r=Math.PI/180,dLat=(b.lat-a.lat)*r,dLon=(b.lon-a.lon)*r,la1=a.lat*r,la2=b.lat*r;const h=Math.sin(dLat/2)**2+Math.cos(la1)*Math.cos(la2)*Math.sin(dLon/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))}

  function applyPosition(p){
    const next={lat:p.coords.latitude,lon:p.coords.longitude};
    livePosition=next;locationAccuracy=Number.isFinite(p.coords.accuracy)?p.coords.accuracy:null;lastFixTime=Date.now();
    for(const id of ['homeRealMap','realMap']){
      const st=states.get(id);if(!st)continue;
      // GPS fixes commonly wander a few metres while stationary. Re-centering
      // and rebuilding the tile frame for every fix makes the map visibly pulse.
      const drift=metersBetween(st.center,next)??Infinity;
      if(!Number.isFinite(drift)||drift>Math.max(12,(locationAccuracy||0)*.65)){
        st.center={...next};
        if(isVisible(st)){st.rendered=true;render(st)}
      }else{const {w,h}=overlaySize(st);drawOverlay(st,w,h)}
    }
    updateLocationLabels();
    if(typeof window.applyFieldGeolocation==='function')window.applyFieldGeolocation(p,'PHONE GNSS');
  }

  function startLiveLocation(){
    if(watchId!=null)return;
    if(!navigator.geolocation){
      liveEnabled=false;localStorage.setItem(STORE_PREFIX+'live-location','off');updateLabels();
      const d=document.getElementById('mapSourceDiag');if(d)d.textContent='GEOLOCATION UNAVAILABLE';
      return;
    }
    liveEnabled=true;localStorage.setItem(STORE_PREFIX+'live-location','on');emitState();updateLabels();
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
    liveEnabled=false;localStorage.setItem(STORE_PREFIX+'live-location','off');emitState();
    updateLabels();refresh(false);
  }

  function toggleLiveLocation(){liveEnabled?stopLiveLocation():startLiveLocation()}

  function screenToLatLon(st,clientX,clientY){
    const rect=st.readLayout?.()||st.el.getBoundingClientRect(),w=Math.max(1,rect.width),h=Math.max(1,rect.height),c=world(st.center.lat,st.center.lon,st.zoom);
    return unworld(c.x+(clientX-rect.left-w/2),c.y+(clientY-rect.top-h/2),st.zoom);
  }
  function mount(id,opts={}){
    const st=ensure(id);if(!st)return null;
    if(opts.center&&Number.isFinite(+opts.center.lat)&&Number.isFinite(+opts.center.lon))st.center={lat:+opts.center.lat,lon:+opts.center.lon};
    if(Number.isFinite(+opts.zoom))st.zoom=Math.max(2,Math.min(maxZoom(),+opts.zoom));
    st.rendered=true;requestAnimationFrame(()=>render(st));return st;
  }
  function setView(id,centerPos,zoomLevel){
    const st=ensure(id);if(!st||!centerPos)return;
    if(Number.isFinite(+centerPos.lat)&&Number.isFinite(+centerPos.lon))st.center={lat:+centerPos.lat,lon:+centerPos.lon};
    if(Number.isFinite(+zoomLevel))st.zoom=Math.max(2,Math.min(maxZoom(),+zoomLevel));
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
  function setGeoOverlay(id,data){const st=ensure(id);if(!st)return;st.geoOverlay=data||null;const {w,h}=overlaySize(st);drawEditorOverlay(st,w,h)}
  function getView(id){const st=states.get(id);return st?{center:{...st.center},zoom:st.zoom}:null}
  function unmount(id){
    const st=states.get(id);if(!st)return false;
    clearTimeout(st.wheelTimer);clearTimeout(st.failureTimer);clearTimeout(st.settleTimer);cancelAnimationFrame(st.renderFrame);cancelAnimationFrame(st.gestureFrame);
    st.resizeObserver?.disconnect?.();
    if(st.onResize)window.removeEventListener('resize',st.onResize);
    st.el.removeEventListener('pointerdown',st.onPointerDown);
    st.el.removeEventListener('pointermove',st.onPointerMove);
    st.el.removeEventListener('pointerup',st.onPointerUp);
    st.el.removeEventListener('pointercancel',st.onPointerCancel);
    st.el.removeEventListener('wheel',st.onWheel);
    st.el.removeEventListener('dblclick',st.onDbl);
    for(const tile of st.tiles.values())tile.img.onload=tile.img.onerror=null;
    st.tiles.clear();st.updateTileDiagnostics=null;st.el.innerHTML='';states.delete(id);return true;
  }

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

  const locationUiVisible=()=>!!document.querySelector('#home.active,#map.active');
  window.FIELD_RUNTIME.every(()=>{if(!document.hidden&&locationUiVisible())updateLocationLabels()},1000);
  document.addEventListener('visibilitychange',()=>{if(!document.hidden){if(locationUiVisible())updateLocationLabels();refresh(false)}});

  document.addEventListener('fieldos:viewchange',e=>{
    const id=e.detail?.view==='map'?'realMap':e.detail?.view==='home'?'homeRealMap':null;
    if(!id)return;
    updateLocationLabels();
    requestAnimationFrame(()=>{
      const st=ensure(id);if(!st)return;st.rendered=true;
      const route=plannedRoute();
      if(!st.routeFitted&&route.length>1&&!liveEnabled){st.routeFitted=true;fitBounds(id,route,{padding:48,maxZoom:16});}
      else render(st);
    });
  });

  window.FIELD_MAP_ENGINE={
    refresh,setLayers,setMode,setTrails,setTerrain,setGrid,startLiveLocation,stopLiveLocation,toggleLiveLocation,zoom,center,
    mount,setView,fitBounds,setTapHandler,setGeoOverlay,getView,unmount,
    get mode(){return mode},get trails(){return trails},get terrain(){return terrain},get grid(){return grid},get live(){return liveEnabled}
  };

  const boot=()=>requestAnimationFrame(()=>{
    refresh(true);
    if(liveEnabled)startLiveLocation();
    setTimeout(()=>refresh(false),300);
  });
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();
