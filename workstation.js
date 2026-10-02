/* FIELD/OS v3.85: home-style workspaces with density parity across modules. */
(() => {
  const modules=[['home','OVERVIEW'],['map','TERRAIN MAP'],['nav','NAVIGATION'],['route','ROUTE PLANNER'],['trailreturn','RETURN TO TRAIL'],['waypoints','WAYPOINTS'],['track','TRACK RECORDER'],['trip','TRIP PLAN'],['mission','MISSION MODE'],['survival','FIELD MANUAL'],['weather','WEATHER INTELLIGENCE'],['comms','COMMS / MESH'],['lorachat','LORA CHAT'],['loramap','LORA MAP'],['sensors','SENSORS'],['log','FIELD LOG'],['power','POWER'],['system','SYSTEM'],['lost','LOST MODE'],['sos','EMERGENCY / SOS']];
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val=id=>document.getElementById(id)?.textContent?.trim()||'—';
  const input=id=>document.getElementById(id)?.value||'NOT SET';
  const rows=items=>`<dl class="ws-readouts">${items.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;
  const actions=items=>`<div class="ws-actions">${items.map(([view,label])=>`<button data-open="${view}">${esc(label)}</button>`).join('')}</div>`;
  const table=(heads,data)=>`<div class="ws-table-wrap"><table class="ws-table"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const note=t=>`<p class="ws-note">${esc(t)}</p>`;
  const card=(title,label,body)=>`<article class="panel ws-card"><div class="panel-title"><span>♙ ${esc(String(title).toUpperCase())}</span><span class="tiny">${esc(label)}</span></div>${body}</article>`;
  const nav=document.createElement('nav');nav.className='workstation-nav';nav.setAttribute('aria-label','Desktop field modules');
  nav.innerHTML=`<div class="ws-brand">TAP V2<span>FIELD / OS <b>3.85</b></span></div><div class="ws-nav-label">WORKSPACE / MODULES</div>${modules.map(([id,label],i)=>`<button data-open="${id}" data-module="${id}"><span>${String(i+1).padStart(2,'0')}</span>${label}</button>`).join('')}<footer>
    <div class="ws-footer-line"><span>POSITION</span><b class="ws-nav-pos">DEMO</b></div>
    <div class="ws-footer-line"><span>ROUTE</span><b class="ws-nav-route">NONE</b></div>
    <div class="ws-footer-line"><span>TRACK</span><b class="ws-nav-track">IDLE</b></div>
    <div class="ws-footer-line"><span>MARKS</span><b class="ws-nav-marks">0</b></div>
    <div class="ws-footer-line"><span>HARDWARE</span><b>NOT CONNECTED</b></div>
    <span class="ws-clock"></span>
  </footer>`;
  document.getElementById('app').prepend(nav);
  // Offline keyboard launcher; native dialog supplies focus trapping and Escape.
  const launcher=document.createElement('button');
  launcher.type='button';launcher.className='ws-launcher';launcher.id='workspaceSearch';
  launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls','workspaceSwitcher');launcher.setAttribute('aria-expanded','false');
  launcher.innerHTML='<span>FIND A MODULE</span><kbd>Ctrl / ⌘ K</kbd>';
  nav.querySelector('.ws-brand').after(launcher);
  const mobileLauncher=document.createElement('button');mobileLauncher.type='button';mobileLauncher.id='mobileWorkspaceSearch';mobileLauncher.className='mobile-workspace-search';mobileLauncher.textContent='FIND MODULE';mobileLauncher.setAttribute('aria-haspopup','dialog');mobileLauncher.setAttribute('aria-controls','workspaceSwitcher');mobileLauncher.setAttribute('aria-expanded','false');
  const sheetHead=document.querySelector('.tab-sheet-head');if(sheetHead)sheetHead.insertBefore(mobileLauncher,sheetHead.querySelector('.switcher-close,#closeTabSheet')||null);
  const switcher=document.createElement('dialog');switcher.id='workspaceSwitcher';switcher.className='workspace-switcher';
  switcher.setAttribute('aria-labelledby','workspaceSwitcherTitle');
  switcher.innerHTML='<div class="switcher-heading"><h2 id="workspaceSwitcherTitle">Go to workspace</h2><button type="button" class="switcher-close" aria-label="Close workspace search">ESC</button></div><label for="workspaceQuery">Find a module or task</label><input id="workspaceQuery" type="search" autocomplete="off" placeholder="Try route, weather, GPS, notes…" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="workspaceResults"><p id="workspaceResultStatus" role="status"></p><div id="workspaceResults" role="listbox" aria-label="Matching workspaces"></div><p class="switcher-hint">↑ ↓ to select · Enter to open · Esc to close</p>';
  document.body.append(switcher);
  const query=switcher.querySelector('input'),resultList=switcher.querySelector('#workspaceResults');
  const aliases={home:'dashboard overview',map:'offline maps places search satellite layers',nav:'gps location compass coordinates',route:'planner elevation distance trail eta',trailreturn:'return trail intercept',waypoints:'marks base camp water',track:'recorder gpx recording',trip:'plan checklist packing check in',mission:'pack readiness expedition',survival:'manual guides reference',weather:'forecast rain wind snow avalanche',comms:'mesh radio communications',lorachat:'lora meshtastic mesh messages inbox chat store forward',loramap:'lora meshtastic node map radio coverage rssi snr group recovery',sensors:'pressure temperature signal',log:'journal notes events',power:'battery energy display',system:'settings theme storage recovery diagnostics',lost:'recovery lost return',sos:'emergency help'};
  let matches=[],selected=0,returnFocus=null;
  function selectMatch(index){
    selected=matches.length?(index+matches.length)%matches.length:0;
    [...resultList.children].forEach((el,i)=>el.setAttribute('aria-selected',String(i===selected)));
    const active=resultList.children[selected];
    if(active){query.setAttribute('aria-activedescendant',active.id);active.scrollIntoView({block:'nearest'});}
    else query.removeAttribute('aria-activedescendant');
  }
  function findModules(){
    const terms=query.value.trim().toLowerCase().split(/\s+/).filter(Boolean);
    matches=modules.filter(([id,label])=>terms.every(t=>(label+' '+(aliases[id]||'')).toLowerCase().includes(t)));
    resultList.replaceChildren(...matches.map(([id,label],i)=>{
      const option=document.createElement('div');option.id='workspace-option-'+id;
      option.setAttribute('role','option');option.dataset.resultIndex=i;
      const name=document.createElement('strong');name.textContent=label;
      const description=document.createElement('span');description.textContent=id===document.querySelector('.view.active')?.id?'CURRENT WORKSPACE':'OPEN WORKSPACE';
      option.append(name,description);return option;
    }));
    switcher.querySelector('#workspaceResultStatus').textContent=matches.length?matches.length+' workspaces':'No matches. Try a module name such as map or route.';
    selectMatch(0);
  }
  function switcherOpen(){return switcher.open||switcher.hasAttribute('data-open')}
  function setSwitcherExpanded(on){
    const value=on?'true':'false';launcher.setAttribute('aria-expanded',value);mobileLauncher.setAttribute('aria-expanded',value);query.setAttribute('aria-expanded',value);
  }
  function closeSwitcher(){
    setSwitcherExpanded(false);
    if(switcher.open&&typeof switcher.close==='function')switcher.close();
    else{switcher.removeAttribute('data-open');switcher.removeAttribute('open');switcher.dispatchEvent(new Event('close'))}
  }
  function showSwitcher(focusReturn=document.activeElement){
    if(switcherOpen())return;
    returnFocus=focusReturn;query.value='';
    try{if(typeof switcher.showModal==='function')switcher.showModal();else throw new Error('dialog unsupported')}
    catch{switcher.setAttribute('open','');switcher.setAttribute('data-open','fallback')}
    setSwitcherExpanded(true);findModules();requestAnimationFrame(()=>query.focus({preventScroll:true}));
  }
  function activateMatch(index){
    const item=matches[index];if(!item)return;
    returnFocus=document.getElementById('screen');closeSwitcher();openView(item[0]);
  }
  launcher.addEventListener('click',showSwitcher);
  mobileLauncher.addEventListener('click',()=>{const focusReturn=moreTabs||launcher;closeTabSheet();showSwitcher(focusReturn);});
  switcher.querySelector('.switcher-close').addEventListener('click',closeSwitcher);
  switcher.addEventListener('close',()=>{
    setSwitcherExpanded(false);
    const target=returnFocus;returnFocus=null;
    requestAnimationFrame(()=>{if(target?.isConnected)target.focus({preventScroll:true})});
  });
  switcher.addEventListener('click',e=>{
    const option=e.target.closest('[data-result-index]');
    if(option)activateMatch(Number(option.dataset.resultIndex));
    else if(e.target===switcher){const r=switcher.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)closeSwitcher();}
  });
  switcher.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();closeSwitcher();}});
  document.addEventListener('pointerdown',e=>{
    if(!switcher.hasAttribute('data-open'))return;
    if(e.target!==launcher&&e.target!==mobileLauncher&&!switcher.contains(e.target))closeSwitcher();
  },true);
  query.addEventListener('input',findModules);
  query.addEventListener('keydown',e=>{
    if(e.isComposing)return;
    if(e.key==='ArrowDown'||e.key==='ArrowUp'){e.preventDefault();selectMatch(selected+(e.key==='ArrowDown'?1:-1));}
    else if(e.key==='Enter'){e.preventDefault();activateMatch(selected);}
  });
  document.addEventListener('keydown',e=>{
    if((e.ctrlKey||e.metaKey)&&e.key.toLowerCase()==='k'&&!e.altKey&&!e.isComposing){e.preventDefault();if(switcherOpen())closeSwitcher();else showSwitcher();}
  });
  const specs={
    map:[['Route geometry','SCHEMATIC','plot'],['Position solution','SOURCE / AGE','position'],['Active route','PLANNER DATA','route'],['Saved marks','LOCAL DATABASE','marks'],['Map coverage','AVAILABILITY','coverage'],['Recording summary','BREADCRUMBS','record'],['Navigation shortcuts','FIELD TOOLS','navtools']],
    comms:[['Radio connection','TRANSPORT','radio'],['Node roster','ILLUSTRATIVE / DEMO','mesh'],['Packet delivery','CURRENT SESSION','delivery'],['Location payload','CURRENT SOURCE','position'],['Channel configuration','NOT CONNECTED','channel'],['Communications workflow','LOCAL TOOLS','commtools']],
    lorachat:[['Radio connection','TRANSPORT','radio'],['Packet delivery','CURRENT SESSION','delivery'],['Location payload','CURRENT SOURCE','position'],['Channel configuration','DEVICE / CHANNEL','channel'],['Communications workflow','LOCAL TOOLS','commtools']],
    loramap:[['Node roster','MESH TELEMETRY','mesh'],['Position source','CURRENT SOURCE','position'],['Route geometry','REFERENCE','plot'],['Map coverage','LOCAL SYSTEM','coverage'],['Device availability','CONNECTION STATUS','hardware'],['Communication status','TRANSPORT','radio']],
    nav:[['Position solution','SOURCE / AGE','position'],['Active route','PLANNER DATA','route'],['Route geometry','SCHEMATIC','plot'],['Base reference','CALCULATED','base'],['Route intercept','CALCULATED','intercept'],['Recording summary','BREADCRUMBS','record'],['Trip timing','LOCAL PLAN','timing'],['Navigation workspace','RELATED TOOLS','navtools']],
    route:[['Leg schedule','CALCULATED','legs'],['Route geometry','SCHEMATIC','plot'],['Navigation source','SOURCE / AGE','position'],['Stored marks','REFERENCE','marks'],['Base reference','CALCULATED','base'],['Trip timing','LOCAL PLAN','timing'],['Recording summary','BREADCRUMBS','record'],['Route workflow','RELATED TOOLS','navtools']],
    trailreturn:[['Route intercept','CALCULATED','intercept'],['Route geometry','SCHEMATIC','plot'],['Position solution','SOURCE / AGE','position'],['Route definition','PLANNER DATA','route'],['Base reference','CALCULATED','base'],['Recording summary','LOCAL TRACK','record'],['Field tools','RELATED MODULES','navtools']],
    waypoints:[['Mark inventory','LOCAL DATABASE','inventory'],['Saved marks','LOCAL DATABASE','marks'],['Position to save','SOURCE / AGE','position'],['Route overview','SCHEMATIC','plot'],['Base reference','SELECTED BASE','base'],['Recording summary','BREADCRUMBS','record'],['Trip context','CURRENT PLAN','context'],['Waypoint workflow','LOCAL TOOLS','marktools']],
    track:[['Track sample ledger','RECENT POINTS','samples'],['Position source','SOURCE / AGE','position'],['Route geometry','REFERENCE','plot'],['Recording health','LOCAL SESSION','record'],['Storage inventory','LOCAL DATA','storage'],['Track workflow','RELATED TOOLS','tracktools']],
    weather:[['Field status','LIVE / SOURCE','status'],['Position source','SOURCE / AGE','position'],['Offline forecast cache','LOCAL SYSTEM','coverage'],['Trip timing','LOCAL PLAN','timing'],['Device availability','CONNECTION STATUS','hardware'],['Weather workflow','FIELD TOOLS','navtools']],
    sensors:[['Position source','SOURCE / AGE','position'],['Sensor bridge','HARDWARE STATUS','hardware'],['Clock module','PLANNED UPGRADE','rtc'],['Device power','AVAILABILITY','batteries'],['Display / wake state','LOCAL DEVICE','display'],['Recording load','CURRENT SESSION','record'],['Radio bridge','TRANSPORT','radio'],['Offline capability','LOCAL SYSTEM','coverage']],
    survival:[['Reference index','LOCAL LIBRARY','manual'],['Field context','PLANNING','context'],['Position reference','SOURCE / AGE','position'],['Equipment readiness','CHECKLIST','kit'],['Emergency tools','RELATED MODULES','emergencytools']],
    trip:[['Trip context','CURRENT PLAN','context'],['Route snapshot','PLANNER DATA','route'],['Equipment readiness','CHECKLIST','kit'],['Trip timing','LOCAL REMINDERS','timing'],['Route geometry','SCHEMATIC','plot'],['Position reference','SOURCE / AGE','position'],['Base reference','CALCULATED','base'],['Recording summary','BREADCRUMBS','record']],
    mission:[['Trip context','CURRENT PLAN','context'],['Route snapshot','PLANNER DATA','route'],['Offline coverage','LOCAL SYSTEM','coverage'],['Equipment readiness','CHECKLIST','kit'],['Trip timing','CHECK-IN / RETURN','timing'],['Position reference','SOURCE / AGE','position'],['Device availability','CONNECTION STATUS','hardware'],['Mission workflow','FIELD TOOLS','navtools']],
    log:[['Entry inventory','LOCAL RECORDS','logstats'],['Recent activity','SAVED EVENTS','events'],['Position reference','SOURCE / AGE','position'],['Trip context','CURRENT PLAN','context'],['Storage inventory','LOCAL DATA','storage'],['Field workflow','RELATED MODULES','logtools']],
    power:[['Device power sources','AVAILABILITY','batteries'],['Display state','LOCAL PREFERENCES','display'],['Recording load','CURRENT SESSION','record'],['Local data inventory','STORAGE','storage'],['Trip timing load','LOCAL PLAN','timing'],['Position source','SOURCE / AGE','position'],['Hardware bridge','CONNECTION STATUS','hardware'],['Power workflow','RELATED MODULES','powertools']],
    system:[['Runtime information','LOCAL BROWSER','runtime'],['Storage inventory','LOCAL DATA','storage'],['Hardware integration','CONNECTION STATUS','hardware'],['Offline coverage','CAPABILITIES','coverage'],['Display state','LOCAL DEVICE','display'],['Position source','SOURCE / AGE','position'],['Radio transport','CONNECTION STATUS','radio'],['Clock module','PLANNED UPGRADE','rtc']],
    lost:[['Position reference','SOURCE / AGE','position'],['Route geometry','SCHEMATIC','plot'],['Base reference','CALCULATED','base'],['Route intercept','CALCULATED','intercept'],['Trip timing','LOCAL PLAN','timing'],['Communication status','TRANSPORT','radio'],['Support modules','FIELD TOOLS','emergencytools']],
    sos:[['Communication status','TRANSPORT','radio'],['Position reference','SOURCE / AGE','position'],['Trip context','LOCAL PLAN','context'],['Base reference','CALCULATED','base'],['Device availability','CONNECTION STATUS','hardware'],['Check-in state','LOCAL REMINDER','timing'],['Support modules','FIELD TOOLS','emergencytools']]
  };
  for(const id of Object.keys(specs)) specs[id].push(['Field status','LIVE / SOURCE','status']);
  let plotHtml=null;
  function plot(){
    if(plotHtml!==null)return plotHtml;
    if(routePoints.length<2)return note('Plot at least two points in Route Planner to show a route diagram.')+actions([['route','OPEN ROUTE PLANNER']]);
    // Match the real map's Web Mercator geometry with ONE uniform scale.
    // The former diagram stretched latitude and longitude independently,
    // distorting turns and making this horizontal overview disagree with the
    // route planner. Unwrap longitude so dateline crossings stay continuous.
    const projected=[];let lastLon=null,minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    for(const p of routePoints){
      let lon=p.lon;
      if(lastLon!==null){
        while(lon-lastLon>180)lon-=360;
        while(lon-lastLon< -180)lon+=360;
      }
      lastLon=lon;
      const lat=Math.max(-85.05112878,Math.min(85.05112878,p.lat))*Math.PI/180;
      const x=(lon+180)/360,y=(1-Math.log(Math.tan(Math.PI/4+lat/2))/Math.PI)/2;
      projected.push({x,y});minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
    }
    const spanX=maxX-minX,spanY=maxY-minY;
    const uniformScale=Math.min(spanX>1e-14?352/spanX:Infinity,spanY>1e-14?172/spanY:Infinity);
    const scale=Number.isFinite(uniformScale)?uniformScale:1;
    const offsetX=(400-spanX*scale)/2,offsetY=(220-spanY*scale)/2;
    const screen=projected.map(p=>[offsetX+(p.x-minX)*scale,offsetY+(p.y-minY)*scale]);

    // Pixel-error simplification retains actual bends rather than throwing
    // away every Nth point. The full route remains in navigation/storage.
    const simplify=tolerance=>{
      const selected=new Set([0,screen.length-1]),stack=[[0,screen.length-1]],limit=tolerance*tolerance;
      while(stack.length){
        const [a,b]=stack.pop();if(b-a<2)continue;
        const p=screen[a],q=screen[b],dx=q[0]-p[0],dy=q[1]-p[1],den=dx*dx+dy*dy;
        let winner=-1,best=limit;
        for(let k=a+1;k<b;k++){
          const v=screen[k],t=den?Math.max(0,Math.min(1,((v[0]-p[0])*dx+(v[1]-p[1])*dy)/den)):0;
          const ex=v[0]-p[0]-dx*t,ey=v[1]-p[1]-dy*t,d=ex*ex+ey*ey;
          if(d>best){best=d;winner=k;}
        }
        if(winner>=0){selected.add(winner);stack.push([a,winner],[winner,b]);}
      }
      return [...selected].sort((a,b)=>a-b);
    };
    let tolerance=.3,indices=simplify(tolerance);
    while(indices.length>600&&tolerance<256){tolerance*=1.65;indices=simplify(tolerance);}
    // Pathological zigzag tracks can still exceed 600 vertices after the
    // standard tolerance pass. A bounded binary search enforces the SVG cap
    // while keeping the maximum possible number of meaningful turns.
    if(indices.length>600){
      let low=tolerance,high=512,selected=simplify(high);
      for(let pass=0;pass<9;pass++){
        const mid=(low+high)/2,candidate=simplify(mid);
        if(candidate.length<=600){high=mid;selected=candidate}
        else low=mid;
      }
      indices=selected;
    }
    const pts=indices.map(i=>screen[i]);
    let gradedPaths='',hasGrades=false;
    const plan=window.FIELD_ROUTE_STATE?.getPlan?.(),samples=plan?.elevationProfile,grader=window.FIELD_ROUTE_SLOPE;
    if(grader?.gradeAtDistance&&grader?.slopeClass&&Array.isArray(samples)&&samples.length>1&&
       [samples[0],samples.at(-1)].every(p=>Number.isFinite(p?.lat)&&Number.isFinite(p?.lon))){
      // Grade is rendered only for the same route that produced the DEM.
      // Unrelated/stale profiles must NEVER color a newly edited route.
      const cumulative=[0];
      for(let i=1;i<routePoints.length;i++)
        cumulative.push(cumulative[i-1]+haversineMiles(routePoints[i-1],routePoints[i])*1609.344);
      const total=cumulative.at(-1),sampleTotal=Number(samples.at(-1)?.distanceM);
      const profileMatches=total>10&&Number.isFinite(sampleTotal)&&Math.abs(sampleTotal-total)/total<.06&&
        haversineMiles(samples[0],routePoints[0])*1609.344<60&&
        haversineMiles(samples.at(-1),routePoints.at(-1))*1609.344<60;
      if(profileMatches){
        const paths={easy:[],medium:[],hard:[]};
        for(let i=1;i<indices.length;i++){
          const start=indices[i-1],end=indices[i],mid=(cumulative[start]+cumulative[end])/2;
          const grade=grader.gradeAtDistance({samples},mid);
          // Flat segments retain the ordinary route line, like the main map.
          if(!Number.isFinite(grade)||Math.abs(grade)<3)continue;
          const key=grader.slopeClass(grade).key;
          if(!paths[key])continue;
          const path=screen.slice(start,end+1).map(([x,y],j)=>
            `${j?'L':'M'}${x.toFixed(2)},${y.toFixed(2)}`).join('');
          paths[key].push(path);
        }
        gradedPaths=['easy','medium','hard'].filter(key=>paths[key].length).map(key=>
          `<path class="ws-route-slope ws-route-slope-${key}" d="${paths[key].join('')}"/>`).join('');
        hasGrades=!!gradedPaths;
      }
    }
    return plotHtml=`<svg class="ws-route-plot" viewBox="0 0 400 220" role="img" aria-label="Top-down schematic of actual route geometry with uniform map scale; not a terrain map"><path d="M0 55H400M0 110H400M0 165H400M100 0V220M200 0V220M300 0V220" stroke="currentColor" opacity=".16"/><polyline points="${pts.map(p=>p.map(n=>n.toFixed(2)).join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>${gradedPaths}${pts.filter((_,i)=>i===0||i===pts.length-1).map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="5" fill="currentColor"/><text x="${Math.min(x+9,330)}" y="${Math.max(y-10,16)}">${i?'END':'START'}</text>`).join('')}<text x="12" y="18">N ↑ / ROUTE SCHEMATIC</text></svg>`+rows([['LENGTH',`${routeMiles().toFixed(2)} mi`],['POINTS',routePoints.length]])+note(hasGrades?'Green / orange / red indicate estimated sustained DEM grade. Verify actual trail conditions independently.':'Geometry only; uniform map projection preserves turns and aspect. No terrain or obstacle information.');
  }
  const bodies={
    status:()=>rows([
      ['POSITION',currentNavPosition.source||'DEMO GNSS'],
      ['ACCURACY',Number.isFinite(currentAccuracy)?`±${Math.round(currentAccuracy)} m`:'—'],
      ['FIX AGE',fmtAge(fixAge)],
      ['ROUTE',routePoints.length>=2?`${routePoints.length} pts / ${routeMiles().toFixed(2)} mi`:'NOT LOADED'],
      ['BASE',waypoints.some(w=>w.type==='BASE')?'SAVED':'NOT SET'],
      ['TRACK',recordedTrack.length?`${recordedTrack.length} samples`:'IDLE'],
      ['MARKS',waypoints.length],
      ['DAYLIGHT',val('mobileDaylight')]
    ])+note(currentNavPosition.source?.includes('DEMO')?'Position is simulated until a real phone or TAP source is connected.':'Live position source active; verify accuracy and fix age before relying on it.'),
    position:()=>rows([['SOURCE',currentNavPosition.source||'DEMO GNSS'],['LATITUDE',currentNavPosition.lat.toFixed(6)],['LONGITUDE',currentNavPosition.lon.toFixed(6)],['ALTITUDE',`${currentNavPosition.alt??'—'} ft`],['ACCURACY',`${currentAccuracy} m`],['FIX AGE',fmtAge(fixAge)],['FRESHNESS',fixAge>180?'STALE':'RECENT']])+note('Demo coordinates remain active until a real position is acquired.'),
    route:()=>rows([['NAME',input('routeName')],['DISTANCE',val('routeDistance')],['GAIN',val('routeGainOut')],['EFFORT',val('routeDifficulty')],['EST. TIME',val('routeTime')],['POINTS',routePoints.length]])+actions([['route','EDIT ROUTE'],['trip','TRIP PLAN']]),
    marks:()=>table(['NAME','TYPE','LAT / LON'],waypoints.slice(0,6).map(w=>[w.name,w.type,`${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}`]))+(waypoints.length?'':note('No saved waypoints. Add a position to build your field reference.'))+actions([['waypoints','MANAGE MARKS']]),
    inventory:()=>rows([['TOTAL',waypoints.length],...['BASE','CAMP','WATER','HAZARD','JUNCTION','NOTE'].map(t=>[t,waypoints.filter(w=>w.type===t).length])]),
    base:()=>rows([['DISTANCE',val('rtbDistance')],['BEARING',val('rtbBearing')],['REFERENCE',val('rtbTrack')],['ALTITUDE',val('rtbAlt')]])+actions([['nav','RETURN TO BASE'],['waypoints','BASE WAYPOINTS']]),
    intercept:()=>rows([['TRAIL OFFSET',val('rttDistance')],['BEARING',val('rttBearing')],['ROUTE',val('rttRouteName')],['NEAREST LEG',val('rttPoint')]])+actions([['trailreturn','INTERCEPT DETAILS']]),
    record:()=>rows([['STATE',val('trackState')],['DISTANCE',`${val('trackDistance')} mi`],['SAMPLES',recordedTrack.length],['DURATION',val('trackDuration')],['ACCURACY',val('trackAccuracy')],['LAST POINT',recordedTrack.at(-1)?.time||'NONE']])+actions([['track','OPEN RECORDER']]),
    samples:()=>table(['TIME','LATITUDE','LONGITUDE'],recordedTrack.slice(-6).map(p=>[p.time||'—',p.lat.toFixed(5),p.lon.toFixed(5)]))+(recordedTrack.length?'':note('No recorded samples. Start a GPS track to populate this ledger.')),
    legs:()=>table(['LEG','DISTANCE','BEARING'],routePoints.slice(1,9).map((p,i)=>[`${i+1} → ${i+2}`,`${(haversineMiles(routePoints[i],p)).toFixed(2)} mi`,`${Math.round(bearingDeg(routePoints[i],p))}°`])),
    coverage:()=>rows([['APP INTERFACE','CACHED AFTER LOAD'],['ROUTES / NOTES','LOCAL BROWSER'],['ONLINE BASEMAP','OPENTOPOMAP + OSM'],['OFFLINE BASEMAP','PMTILES / INDEXEDDB'],['MAP MODE',navigator.onLine?'ONLINE CAPABLE':'OFFLINE'],['HARDWARE FEED','NOT CONNECTED']])+note('Official OSM raster tiles are interactive-online only. Downloaded offline maps use regional PMTiles archives stored in this browser.'),
    radio:()=>rows([['TAP V2','NOT CONNECTED'],['TRANSPORT','DEMO ONLY'],['DELIVERY ACK','UNAVAILABLE'],['ENCRYPTION','NOT VERIFIED'],['REMOTE SOS','NOT AVAILABLE']])+note('Messages in this prototype do not leave the browser.'),
    mesh:()=>{const nodes=window.FIELD_MESH?.state?.nodes||[];return nodes.length?table(['NODE','RSSI','HOPS','STATUS'],nodes.slice(0,8).map(n=>[n.name||n.id,Number.isFinite(Number(n.rssi))?Math.round(Number(n.rssi))+' dBm':'—',Number.isFinite(Number(n.hops))?String(n.hops):'—',n.lastHeard?Math.max(0,Math.round((Date.now()-Number(n.lastHeard))/1000))+'s ago':'CACHED'])):note('Waiting for Meshtastic node telemetry. Connect TAP V2 or load cached mesh data.');},
    delivery:()=>rows([['EDITOR LENGTH',`${document.getElementById('messageInput').value.length} characters`],['PACKET SOURCE','LOCAL TEXT EDITOR'],['REMOTE RECIPIENT','NONE'],['ACKNOWLEDGED','0'],['QUEUE','NOT CONNECTED']]),
    channel:()=>rows([['CHANNEL','DEMO'],['FREQUENCY','NOT CONFIGURED'],['MODEM','NOT CONNECTED'],['KEY STATUS','NOT CONFIGURED'],['DEVICE SETTINGS','UNAVAILABLE']])+actions([['system','DEVICE LINKS']]),
    hardware:()=>table(['MODULE','STATE'],[['TAP V2','NOT CONNECTED'],['GNSS / IMU / BARO','DEMO FEED'],['RAK12002 RTC','PLANNED'],['SENSOR-2 RADAR','PLANNED'],['THERMAL / LOW-LIGHT','PLANNED']])+note('Sensor values shown by the prototype are not measurements from connected hardware.'),
    rtc:()=>rows([['MODULE','RAK12002'],['INSTALLATION','PLANNED'],['CLOCK SOURCE','PHONE / COMPUTER'],['HARDWARE SYNC','UNAVAILABLE'],['LOCAL TIME',new Date().toLocaleTimeString()]])+note('RTC synchronization will require the physical module and a device bridge.'),
    manual:()=>rows([['GUIDES',guides.length],['CATEGORIES',categories.length-1],['STORAGE','BUNDLED WITH APP'],['SEARCH','TITLE / BODY'],['ACCESS','OFFLINE AFTER LOAD']])+note('Use the searchable reference index to open a complete entry.'),
    kit:()=>{const checked=essentials.filter((_,i)=>essentialsState[i]).length;return `<div class="ws-metric">${checked}<small> / ${essentials.length} PACKED</small></div><meter min="0" max="${essentials.length}" value="${checked}"></meter>`+rows(essentials.map((e,i)=>[e,essentialsState[i]?'PACKED':'CHECK']))+actions([['trip','EDIT CHECKLIST']]);},
    timing:()=>rows([['EXPECTED RETURN',input('tripReturn').replace(/(?<=\d)T(?=\d)/,' ')],['INTERVAL',`${input('checkinInterval')} min`],['COUNTDOWN',val('checkinCountdown')],['STATUS',val('mobileCheckin')]])+note('Local reminders do not notify another person automatically.')+actions([['trip','CHECK-IN PLAN']]),
    context:()=>rows([['TRIP',input('tripName')],['TRAILHEAD',input('tripBase')],['RETURN',input('tripReturn').replace(/(?<=\d)T(?=\d)/,' ')],['ROUTE',input('routeName')],['POSITION SOURCE',currentNavPosition.source]])+actions([['trip','EDIT PLAN'],['log','FIELD NOTES']]),
    storage:()=>rows([['WAYPOINTS',waypoints.length],['TRACK SAMPLES',recordedTrack.length],['LOG ENTRIES',fieldLog.length],['ROUTE POINTS',routePoints.length],['CLOUD SYNC','OFF'],['LOCATION','THIS BROWSER']])+note('Export important records before clearing browser data.')+actions([['system','EXPORT / STORAGE']]),
    logstats:()=>rows([['TOTAL ENTRIES',fieldLog.length],['DRAFT LENGTH',`${document.getElementById('logInput').value.length} characters`],['TIMESTAMPS','LOCAL RECORDS'],['SYNC','DISABLED'],['EXPORT','JSON']]),
    events:()=>fieldLog.slice(-5).reverse().map(e=>`<div class="ws-event"><b>${esc(e.type||'NOTE')}</b><span>${esc(e.text||e.message||'Saved entry')}</span></div>`).join('')||note('No saved events yet. Record a note or save a route to populate the journal.'),
    batteries:()=>rows([['PHONE / COMPUTER',val('mobileBattery')],['TAP V2','UNAVAILABLE'],['SENSOR-2','UNAVAILABLE'],['HARDWARE RESERVE','NOT MEASURED'],['CHARGING',val('mobilePowerState')]])+note('The browser battery reading may be unavailable on some devices.'),
    display:()=>rows([['THEME',document.body.dataset.theme||'green'],['POWER MODE',storageGet(STORE_PREFIX+'power')||'normal'],['WAKE LOCK',fieldWakeLock?'ACTIVE':'OFF'],['SCREEN',`${innerWidth} × ${innerHeight}`],['VISIBILITY',document.visibilityState]])+actions([['system','DISPLAY THEME']]),
    runtime:()=>rows([['RELEASE','FIELD/OS 3.85'],['SECURE CONTEXT',isSecureContext?'YES':'NO'],['SERVICE WORKER','serviceWorker' in navigator?'SUPPORTED':'UNSUPPORTED'],['GEOLOCATION','geolocation' in navigator?'SUPPORTED':'UNSUPPORTED'],['WAKE LOCK','wakeLock' in navigator?'SUPPORTED':'UNSUPPORTED'],['TIME ZONE',Intl.DateTimeFormat().resolvedOptions().timeZone]]),
    plot,
    navtools:()=>actions([['map','TERRAIN MAP'],['route','ROUTE PLANNER'],['trailreturn','RETURN TO TRAIL'],['waypoints','SAVED WAYPOINTS'],['track','TRACK RECORDER'],['lost','LOST MODE']])+note('Use your route, saved base, and position source together when reviewing a return path.'),
    commtools:()=>actions([['lorachat','LORA CHAT'],['loramap','LORA MAP'],['trip','CHECK-IN PLAN'],['system','DEVICE STATUS']])+note('Chat and map share the same mesh transport and cached telemetry state.'),
    marktools:()=>actions([['map','MAP VIEW'],['nav','NAVIGATION'],['route','ROUTE PLANNER'],['log','FIELD NOTES']])+note('Select a saved waypoint to inspect its bearing and distance. Export the list from Saved Waypoints.'),
    tracktools:()=>actions([['route','PLANNED ROUTE'],['nav','ROUTE WATCH'],['log','TRACK NOTES'],['power','DISPLAY / POWER']])+note('Export the recorded track as GPX from the recorder. Phone background recording remains device dependent.'),
    emergencytools:()=>actions([['lost','LOST WORKFLOW'],['survival','FIELD MANUAL'],['nav','POSITION / RETURN'],['power','POWER CONTROL'],['trip','TRIP PLAN']])+note('The app cannot send a real SOS. Use a working phone or certified emergency device.'),
    logtools:()=>actions([['waypoints','SAVE A MARK'],['trip','TRIP CONTEXT'],['sensors','SENSOR PANEL'],['track','TRACK RECORDER']])+note('Entries and position marks remain in this browser until exported.'),
    powertools:()=>actions([['system','DISPLAY THEME'],['track','RECORDER'],['trip','CHECK-IN TIMER'],['sensors','SENSOR STATUS']])+note('Conservation settings affect the interface only; hardware power control is not connected.')
  };
  // Use the existing controls and their original DOM nodes, preserving their listeners.
  for(const view of views.filter(v=>v.id!=='home')){
    const head=view.querySelector('.view-head');
    // Minimal/specialized modes (for example Breadcrumb Nav) intentionally
    // omit the workstation header and must keep their stripped layout intact.
    if(!head)continue;
    const grid=document.createElement('div');grid.className='module-grid';
    [...view.children].filter(c=>c!==head).forEach(child=>{
      if(child.matches('.grid.two-col')&&!child.id){[...child.children].forEach(c=>grid.append(c));child.remove();}
      else grid.append(child);
    });view.append(grid);
    if(view.id==='route'){
      const elevation=grid.querySelector('.route-elevation-panel');
      const performance=grid.querySelector('.route-performance-panel');
      if(elevation&&performance)performance.after(elevation);
    }
    const consoleBar=document.createElement('div');
    consoleBar.className='module-console-header';
    consoleBar.innerHTML='<strong>TAP V2 // <span class="ws-console-name">FIELD MODULE</span> <em>v3.85</em></strong><span class="ws-console-mode">OFFLINE MODE</span><span class="ws-console-pos">GPS: DEMO</span><span class="ws-console-track">TRACK: IDLE</span><span class="ws-console-clock">--:--:--</span><span class="ws-console-battery">▰▰▰▱ <b>'+val('mobileBattery')+'</b></span>';
    const band=document.createElement('div');band.className='module-band';band.innerHTML='<span class="ws-band-sector">SECTOR VT-021</span><span class="ws-band-module">MODULE</span><span class="ws-band-pos">POSITION</span><span class="ws-band-route">ROUTE</span><span class="ws-band-clock">--:--:--</span>';
    head.after(consoleBar);consoleBar.after(band);
    const secondary=document.createElement('div');secondary.className='module-secondary-grid';
    for(const [title,label,type] of specs[view.id]||[]){const holder=document.createElement('div');holder.className='module-slot';holder.dataset.panelType=type;holder.innerHTML=card(title,label,'');secondary.append(holder);}
    if(secondary.childElementCount){
      const details=document.createElement('button');details.type='button';details.className='mobile-module-details';details.textContent='SHOW DETAILS';details.setAttribute('aria-expanded','false');
      details.addEventListener('click',()=>{const open=secondary.classList.toggle('mobile-details-open');details.setAttribute('aria-expanded',String(open));details.textContent=open?'HIDE DETAILS':'SHOW DETAILS';if(open)scheduleRefresh()});
      grid.append(details);grid.append(secondary);
    }
    // Generated diagnostic/readout cards live in their own compact flow so
    // different card heights cannot create blank paired-grid rows.
  }
  const updateHtml=(el,html)=>window.FIELD_RUNTIME.patch(el,html);
  function refreshHome(){
    const set=(selector,html)=>{const el=document.querySelector('#home '+selector);updateHtml(el,html);};
    set('.route-info-split',bodies.route());
    set('.detailed-nav .terminal-title',`NAVIGATION <span>${esc(currentNavPosition.source)}</span>`);
    set('.nav-readout',`${esc(currentNavPosition.lat.toFixed(5))}°<br>${esc(currentNavPosition.lon.toFixed(5))}°<br>${hasTrustedMapPosition()?'±'+Math.round(currentAccuracy)+' m accuracy':'Demo position'}`);
    set('.nav-stats',rows([['SPEED',val('navStripSpeed')],['HEADING',val('navStripHeading')],['ROUTE',val('routeDistance')],['SOURCE',hasTrustedMapPosition()?'PHONE / GNSS':'SIMULATED']]));
    set('.waypoint-table-rich',table(['NAME','TYPE','COORDINATES'],waypoints.slice(0,6).map(w=>[w.name,w.type,`${w.lat.toFixed(4)}, ${w.lon.toFixed(4)}`]))+(waypoints.length?'':note('No saved waypoints. Add a base, camp, or trail junction.')));
    set('.waypoint-console .terminal-title',`WAYPOINTS <span>${waypoints.length} SAVED</span>`);
    set('.track-rich',bodies.record());
    set('.event-lines',bodies.events());
    set('.trip-console > p',bodies.context());
    set('.mesh-table',bodies.radio());
    const returns=document.querySelectorAll('#home .return-console > p');
    if(returns[0])returns[0].textContent=`Nearest route: ${val('rttDistance')} · Bearing: ${val('rttBearing')}`;
    if(returns[1])returns[1].textContent=`Route start: ${val('rtbDistance')} · Bearing: ${val('rtbBearing')}`;
    set('.map-footer',`<span>TRACK ${esc(val('trackState'))}</span><span>ROUTE ${routePoints.length>1?routeMiles().toFixed(2)+' mi':'NONE'}</span><span>POSITION ${esc(currentNavPosition.source)}</span>`);
    document.querySelectorAll('#home .track-meter,#home .trip-progress').forEach(el=>el.hidden=true);
  }
  function refresh(shellOnly=false){
    if(document.hidden)return;
    const active=document.querySelector('.view.active');if(!active)return;
    if(!shellOnly&&active.id==='home')refreshHome();
    nav.querySelectorAll('[data-module]').forEach(b=>{b.classList.toggle('selected',b.dataset.module===active.id);if(b.dataset.module===active.id)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');});
    const now=new Date();
    nav.querySelector('.ws-clock').textContent=now.toLocaleTimeString();
    const src=(currentNavPosition.source||'DEMO GNSS').replace(/\s+/g,' ');
    const routeState=routePoints.length>=2?`${routeMiles().toFixed(1)} MI`:'NONE';
    const trackState=recordedTrack.length?`${recordedTrack.length} PTS`:'IDLE';
    const posNode=nav.querySelector('.ws-nav-pos'); if(posNode) posNode.textContent=src.includes('DEMO')?'DEMO':`±${Math.round(currentAccuracy)}M`;
    const routeNode=nav.querySelector('.ws-nav-route'); if(routeNode) routeNode.textContent=routeState;
    const trackNode=nav.querySelector('.ws-nav-track'); if(trackNode) trackNode.textContent=trackState;
    const marksNode=nav.querySelector('.ws-nav-marks'); if(marksNode) marksNode.textContent=waypoints.length;
    const moduleLabel=modules.find(([id])=>id===active.id)?.[1]||active.id.toUpperCase();
    const setBand=(sel,value)=>{const el=active.querySelector(sel);if(el)el.textContent=value;};
    setBand('.ws-band-module',moduleLabel);
    setBand('.ws-band-pos',`POS ${src.includes('DEMO')?'DEMO':`±${Math.round(currentAccuracy)}M`} / ${fmtAge(fixAge)}`);
    setBand('.ws-band-route',`ROUTE ${routeState}`);
    setBand('.ws-band-clock',now.toLocaleTimeString());
    const setConsole=(sel,value)=>{const el=active.querySelector(sel);if(el)el.textContent=value;};
    setConsole('.ws-console-name',moduleLabel);
    setConsole('.ws-console-mode',navigator.onLine?'ONLINE / LOCAL DATA':'OFFLINE');
    setConsole('.ws-console-pos',`GPS: ${src.includes('DEMO')?'DEMO':`±${Math.round(currentAccuracy)}M`} / ${fmtAge(fixAge)}`);
    setConsole('.ws-console-track',`TRACK: ${trackState}`);
    setConsole('.ws-console-clock',now.toLocaleTimeString());
    const cb=active.querySelector('.ws-console-battery b'); if(cb) cb.textContent=val('mobileBattery');
    if(!shellOnly)active.querySelectorAll('.module-slot').forEach(slot=>{if(innerWidth<768&&!slot.closest('.mobile-details-open'))return;const body=bodies[slot.dataset.panelType];if(!body)return;let content=slot.querySelector('.ws-card-body');if(!content){content=document.createElement('div');content.className='ws-card-body';slot.firstElementChild.append(content);}const html=body();updateHtml(content,html);});
  }
  // Coalesce input, navigation, and resize bursts into one paint. Hidden tabs
  // resume from current state rather than rebuilding workstation cards in the background.
  let refreshFrame=0;
  function scheduleRefresh(){
    if(document.hidden||refreshFrame)return;
    refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh();});
  }
  document.addEventListener('fieldos:routechange',()=>{plotHtml=null;scheduleRefresh();});
  document.addEventListener('fieldos:routemetadatachange',()=>{plotHtml=null;scheduleRefresh()});
  document.addEventListener('fieldos:slopeclassifierready',()=>{plotHtml=null;scheduleRefresh()});
  document.addEventListener('fieldos:positionchange',scheduleRefresh);
  document.addEventListener('fieldos:trackchange',scheduleRefresh);
  document.addEventListener('fieldos:meshroster',scheduleRefresh);
  document.addEventListener('fieldos:telemetry',scheduleRefresh);
  document.addEventListener('click',e=>{if(e.target.closest('button,[data-open],[data-module],[data-result-index]'))scheduleRefresh()});
  document.addEventListener('change',scheduleRefresh);
  document.addEventListener('input',e=>{if(e.target instanceof Element&&e.target.matches('input[type="range"],input[type="number"],select'))scheduleRefresh()});
  document.addEventListener('visibilitychange',()=>{
    if(document.hidden){cancelAnimationFrame(refreshFrame);refreshFrame=0;}
    else scheduleRefresh();
  });
  document.addEventListener('fieldos:viewchange',e=>{
    const name=e.detail?.view||document.querySelector('.view.active')?.id||'home';
    nav.querySelectorAll('[data-module]').forEach(b=>{
      const active=b.dataset.module===name;
      b.classList.toggle('selected',active);
      if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
    });
    scheduleRefresh();
  });
  // Time-only workstation bands do not justify rebuilding every module card.
  // Refresh the active shell on minute boundaries; state changes remain event-driven.
  window.FIELD_RUNTIME.every(()=>{if(!document.hidden)refresh(true)},60000);refresh();
  window.addEventListener('resize',()=>{if(innerWidth>=1024)closeTabSheet();scheduleRefresh();},{passive:true});
})();

