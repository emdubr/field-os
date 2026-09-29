(() => {
  'use strict';

  const STORE_PREFIX='fieldos-v1.2-';
  const DEFAULT_CENTER={lat:44.4759,lon:-73.2121};
  const TILE=256;
  const states=new Map();
  let mode=(localStorage.getItem(STORE_PREFIX+'map-source')==='osm')?'osm':'topo';
  let trails=localStorage.getItem(STORE_PREFIX+'hiking-routes')!=='off';
  let livePosition=null;
  let locationAccuracy=null;

  const clampLat=lat=>Math.max(-85.05112878,Math.min(85.05112878,Number(lat)||0));
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

  function targetForButton(btn){
    return btn.dataset.mapTarget || (btn.closest('#home')?'homeRealMap':'realMap');
  }
  function centerCandidate(){return livePosition||DEFAULT_CENTER}

  function updateLabels(){
    const kind=mode==='osm'?'STREET OSM':'HIKING TOPO';
    const suffix=livePosition?'GNSS':'AWAITING FIX';
    const h=document.getElementById('homeMapModeLabel'); if(h)h.textContent=`${kind} / ${suffix}`;
    const m=document.getElementById('mapModeLabel'); if(m)m.textContent=`${kind} / ${suffix}`;
    const d=document.getElementById('mapSourceDiag'); if(d)d.textContent=`${kind} ENGINE READY`;
    document.getElementById('mapTopoMode')?.classList.toggle('active',mode==='topo');
    document.getElementById('mapOsmMode')?.classList.toggle('active',mode==='osm');
    document.getElementById('mapTrailLayer')?.classList.toggle('active',trails);
    document.getElementById('homeTopoMode')?.classList.toggle('active',mode==='topo');
    document.getElementById('homeTrailLayer')?.classList.toggle('active',trails);
  }

  function ensure(id){
    if(states.has(id))return states.get(id);
    const el=document.getElementById(id);
    if(!el)return null;
    el.hidden=false;
    el.innerHTML='<div class="native-map-base"></div><div class="native-map-trails"></div><svg class="native-map-overlay" xmlns="http://www.w3.org/2000/svg"></svg><div class="native-map-corner">FIELD/OS MAP</div><div class="native-map-attrib">© OpenStreetMap contributors · OpenTopoMap · Waymarked Trails</div><div class="native-map-diag">TILES 0 / ERR 0</div>';
    const st={
      id,el,
      base:el.querySelector('.native-map-base'),
      trail:el.querySelector('.native-map-trails'),
      overlay:el.querySelector('.native-map-overlay'),
      center:{...centerCandidate()},zoom:14,
      loaded:0,errors:0,token:0,
      pointers:new Map(),dragStart:null,pinchStart:null
    };

    const resetTransform=()=>{
      st.base.style.transform='';
      st.trail.style.transform='';
      st.overlay.style.transform='';
    };

    st.onPointerDown=e=>{
      if(e.button!==undefined&&e.button>0)return;
      e.preventDefault();
      st.el.setPointerCapture?.(e.pointerId);
      st.pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
      if(st.pointers.size===1){
        st.dragStart={x:e.clientX,y:e.clientY,center:{...st.center}};
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
        st.base.style.transform=t;st.trail.style.transform=t;st.overlay.style.transform=t;
      }else if(st.pointers.size===2&&st.pinchStart){
        const p=[...st.pointers.values()],dist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y);
        const ratio=dist/Math.max(1,st.pinchStart.dist);
        const delta=Math.round(Math.log2(ratio));
        const max=mode==='osm'?19:17;
        const next=Math.max(2,Math.min(max,st.pinchStart.zoom+delta));
        const corner=st.el.querySelector('.native-map-corner');
        if(corner)corner.textContent=`PINCH Z${next}`;
      }
    };
    st.onPointerUp=e=>{
      const old=[...st.pointers.values()];
      st.pointers.delete(e.pointerId);
      if(st.pinchStart&&old.length>=2){
        const p=old,dist=Math.hypot(p[1].x-p[0].x,p[1].y-p[0].y),ratio=dist/Math.max(1,st.pinchStart.dist);
        const delta=Math.round(Math.log2(ratio)),max=mode==='osm'?19:17;
        st.zoom=Math.max(2,Math.min(max,st.pinchStart.zoom+delta));
        st.pinchStart=null;st.dragStart=null;resetTransform();render(st);return;
      }
      if(st.dragStart){
        const dx=e.clientX-st.dragStart.x,dy=e.clientY-st.dragStart.y;
        const c=world(st.dragStart.center.lat,st.dragStart.center.lon,st.zoom);
        st.center=unworld(c.x-dx,c.y-dy,st.zoom);
      }
      st.dragStart=null;st.el.classList.remove('native-map-dragging');resetTransform();render(st);
    };
    st.onWheel=e=>{
      e.preventDefault();
      const max=mode==='osm'?19:17;
      st.zoom=Math.max(2,Math.min(max,st.zoom+(e.deltaY<0?1:-1)));
      render(st);
    };
    st.onDbl=e=>{
      e.preventDefault();
      const max=mode==='osm'?19:17;
      st.zoom=Math.min(max,st.zoom+1);render(st);
    };

    el.addEventListener('pointerdown',st.onPointerDown);
    el.addEventListener('pointermove',st.onPointerMove);
    el.addEventListener('pointerup',st.onPointerUp);
    el.addEventListener('pointercancel',st.onPointerUp);
    el.addEventListener('wheel',st.onWheel,{passive:false});
    el.addEventListener('dblclick',st.onDbl);
    states.set(id,st);
    return st;
  }

  function drawOverlay(st,w,h){
    const svg=st.overlay;
    const c=world(st.center.lat,st.center.lon,st.zoom);
    const parts=[];
    if(livePosition){
      const p=world(livePosition.lat,livePosition.lon,st.zoom);
      const x=p.x-c.x+w/2,y=p.y-c.y+h/2;
      const mpp=Math.max(.01,156543.03392*Math.cos(livePosition.lat*Math.PI/180)/Math.pow(2,st.zoom));
      const r=Math.max(5,Math.min(90,(locationAccuracy||8)/mpp));
      parts.push(`<circle cx="${x}" cy="${y}" r="${r}" class="native-accuracy-ring"/>`);
      parts.push(`<circle cx="${x}" cy="${y}" r="7" class="native-self-marker"/>`);
      parts.push(`<path d="M ${x} ${y-14} l -5 9 h 10 z" class="native-self-arrow"/>`);
    }
    svg.setAttribute('viewBox',`0 0 ${w} ${h}`);
    svg.innerHTML=parts.join('');
  }

  function setFallback(st,message){
    st.base.innerHTML='';
    st.trail.innerHTML='';
    const diag=st.el.querySelector('.native-map-diag');
    if(diag)diag.textContent=message;
    const corner=st.el.querySelector('.native-map-corner');
    if(corner)corner.textContent='MAP NETWORK ERROR';
    st.el.classList.add('standalone-map-error');
  }

  function render(st){
    if(!st)return;
    st.el.classList.remove('standalone-map-error');
    const token=++st.token;
    const rect=st.el.getBoundingClientRect();
    const w=Math.max(250,Math.round(rect.width||st.el.clientWidth||600));
    const h=Math.max(220,Math.round(rect.height||st.el.clientHeight||360));
    const max=mode==='osm'?19:17;
    st.zoom=Math.max(2,Math.min(max,Math.round(st.zoom)));
    const c=world(st.center.lat,st.center.lon,st.zoom);
    const minX=Math.floor((c.x-w/2)/TILE)-1,maxX=Math.floor((c.x+w/2)/TILE)+1;
    const minY=Math.floor((c.y-h/2)/TILE)-1,maxY=Math.floor((c.y+h/2)/TILE)+1;
    const bf=document.createDocumentFragment(),tf=document.createDocumentFragment();
    st.loaded=0;st.errors=0;
    const diag=st.el.querySelector('.native-map-diag');
    const updateDiag=()=>{if(token===st.token&&diag)diag.textContent=`TILES ${st.loaded} / ERR ${st.errors}`;};
    const loaded=()=>{if(token!==st.token)return;st.loaded++;updateDiag();};
    const failed=()=>{if(token!==st.token)return;st.errors++;updateDiag();};

    for(let y=minY;y<=maxY;y++)for(let x=minX;x<=maxX;x++){
      const left=x*TILE-c.x+w/2,top=y*TILE-c.y+h/2;
      const make=(src,cls,frag)=>{
        if(!src)return;
        const img=new Image();img.className='native-map-tile '+cls;img.alt='';img.draggable=false;
        img.style.left=left+'px';img.style.top=top+'px';img.onload=loaded;img.onerror=failed;img.src=src;frag.appendChild(img);
      };
      make(osmUrl(st.zoom,x,y),'native-osm-base',bf);
      if(mode==='topo')make(topoUrl(st.zoom,x,y),'native-topo-tile',bf);
      if(trails&&st.zoom<=18)make(trailUrl(st.zoom,x,y),'native-trail-tile',tf);
    }
    st.base.replaceChildren(bf);st.trail.replaceChildren(tf);drawOverlay(st,w,h);
    const corner=st.el.querySelector('.native-map-corner');
    if(corner)corner.textContent=`${mode==='topo'?'TOPO + OSM':'OSM'} Z${st.zoom}${trails?' // HIKING':''}`;
    updateDiag();
    setTimeout(()=>{
      if(token!==st.token)return;
      if(st.loaded===0)setFallback(st,'0 TILES LOADED — CHECK INTERNET / CONTENT BLOCKER');
      else {
        const main=document.getElementById('mapSourceDiag');
        if(main)main.textContent=`${mode==='topo'?'TOPO/OSM':'OSM'} — ${st.loaded} TILES`;
      }
    },3500);
  }

  function refresh(recenter=false){
    updateLabels();
    for(const id of ['homeRealMap','realMap']){
      const st=ensure(id);if(!st)continue;
      if(recenter||!st.rendered)st.center={...centerCandidate()};
      st.rendered=true;render(st);
    }
  }

  function setMode(next){
    mode=next==='osm'?'osm':'topo';
    localStorage.setItem(STORE_PREFIX+'map-source',mode);
    states.forEach(st=>{st.zoom=Math.min(st.zoom,mode==='osm'?19:17)});
    refresh(false);
  }
  function toggleTrails(){
    trails=!trails;
    localStorage.setItem(STORE_PREFIX+'hiking-routes',trails?'on':'off');
    refresh(false);
  }
  function zoom(target,delta){
    const st=ensure(target)||ensure('realMap');if(!st)return;
    const max=mode==='osm'?19:17;
    st.zoom=Math.max(2,Math.min(max,st.zoom+delta));render(st);
  }
  function center(target){
    const st=ensure(target)||ensure('realMap');if(!st)return;
    st.center={...centerCandidate()};render(st);
  }
  function requestLocation(){
    const diag=document.getElementById('mapSourceDiag');
    if(!navigator.geolocation){if(diag)diag.textContent='GEOLOCATION UNAVAILABLE';return;}
    if(diag)diag.textContent='REQUESTING LIVE LOCATION…';
    navigator.geolocation.getCurrentPosition(
      p=>{
        livePosition={lat:p.coords.latitude,lon:p.coords.longitude};
        locationAccuracy=Number.isFinite(p.coords.accuracy)?p.coords.accuracy:null;
        states.forEach(st=>{st.center={...livePosition}});
        refresh(true);
      },
      e=>{if(diag)diag.textContent='LOCATION ERROR: '+String(e.message||e.code).slice(0,42)},
      {enableHighAccuracy:true,timeout:12000,maximumAge:3000}
    );
  }

  function handleAction(btn){
    const action=btn.dataset.mapAction,target=targetForButton(btn);
    if(action==='topo')setMode('topo');
    else if(action==='osm')setMode('osm');
    else if(action==='trails')toggleTrails();
    else if(action==='zoom-in')zoom(target,1);
    else if(action==='zoom-out')zoom(target,-1);
    else if(action==='center')center(target);
    else if(action==='location')requestLocation();
  }

  document.addEventListener('click',e=>{
    const btn=e.target.closest?.('[data-map-action]');
    if(!btn)return;
    e.preventDefault();
    e.stopPropagation();
    e.stopImmediatePropagation?.();
    handleAction(btn);
  },true);

  window.addEventListener('resize',()=>{clearTimeout(window.__fieldMapResizeTimer);window.__fieldMapResizeTimer=setTimeout(()=>refresh(false),100)},{passive:true});

  window.FIELD_MAP_ENGINE={refresh,requestLocation,setMode,toggleTrails,zoom,center,get mode(){return mode},get trails(){return trails}};

  // If permission was already granted, use it without prompting.
  try{
    navigator.permissions?.query?.({name:'geolocation'}).then(r=>{if(r.state==='granted')requestLocation()}).catch(()=>{});
  }catch{}

  const boot=()=>requestAnimationFrame(()=>{refresh(true);setTimeout(()=>refresh(false),300)});
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',boot,{once:true});else boot();
})();