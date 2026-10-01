/* FIELD/OS v3.67: home-style workspaces with density parity across modules. */
(() => {
  const modules=[['home','OVERVIEW'],['map','TERRAIN MAP'],['nav','NAVIGATION'],['route','ROUTE PLANNER'],['trailreturn','RETURN TO TRAIL'],['waypoints','WAYPOINTS'],['track','TRACK RECORDER'],['trip','TRIP PLAN'],['mission','MISSION MODE'],['survival','FIELD MANUAL'],['weather','WEATHER INTELLIGENCE'],['comms','COMMS / MESH'],['sensors','SENSORS'],['log','FIELD LOG'],['power','POWER'],['system','SYSTEM'],['lost','LOST MODE'],['sos','EMERGENCY / SOS']];
  const esc=v=>String(v??'—').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const val=id=>document.getElementById(id)?.textContent?.trim()||'—';
  const input=id=>document.getElementById(id)?.value||'NOT SET';
  const rows=items=>`<dl class="ws-readouts">${items.map(([a,b])=>`<div><dt>${esc(a)}</dt><dd>${esc(b)}</dd></div>`).join('')}</dl>`;
  const actions=items=>`<div class="ws-actions">${items.map(([view,label])=>`<button data-open="${view}">${esc(label)}</button>`).join('')}</div>`;
  const table=(heads,data)=>`<div class="ws-table-wrap"><table class="ws-table"><thead><tr>${heads.map(h=>`<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${data.map(r=>`<tr>${r.map(c=>`<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
  const note=t=>`<p class="ws-note">${esc(t)}</p>`;
  const card=(title,label,body)=>`<article class="panel ws-card"><div class="panel-title"><span>♙ ${esc(String(title).toUpperCase())}</span><span class="tiny">${esc(label)}</span></div>${body}</article>`;
  const nav=document.createElement('nav');nav.className='workstation-nav';nav.setAttribute('aria-label','Desktop field modules');
  nav.innerHTML=`<div class="ws-brand">TAP V2<span>FIELD / OS <b>3.67</b></span></div><div class="ws-nav-label">WORKSPACE / MODULES</div>${modules.map(([id,label],i)=>`<button data-open="${id}" data-module="${id}"><span>${String(i+1).padStart(2,'0')}</span>${label}</button>`).join('')}<footer>
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
  launcher.setAttribute('aria-haspopup','dialog');launcher.setAttribute('aria-controls','workspaceSwitcher');
  launcher.innerHTML='<span>FIND A MODULE</span><kbd>Ctrl / ⌘ K</kbd>';
  nav.querySelector('.ws-brand').after(launcher);
  const switcher=document.createElement('dialog');switcher.id='workspaceSwitcher';switcher.className='workspace-switcher';
  switcher.setAttribute('aria-labelledby','workspaceSwitcherTitle');
  switcher.innerHTML='<div class="switcher-heading"><h2 id="workspaceSwitcherTitle">Go to workspace</h2><button type="button" class="switcher-close" aria-label="Close workspace search">ESC</button></div><label for="workspaceQuery">Find a module or task</label><input id="workspaceQuery" type="search" autocomplete="off" placeholder="Try route, weather, GPS, notes…" role="combobox" aria-autocomplete="list" aria-expanded="true" aria-controls="workspaceResults"><p id="workspaceResultStatus" role="status"></p><div id="workspaceResults" role="listbox" aria-label="Matching workspaces"></div><p class="switcher-hint">↑ ↓ to select · Enter to open · Esc to close</p>';
  document.body.append(switcher);
  const query=switcher.querySelector('input'),resultList=switcher.querySelector('#workspaceResults');
  const aliases={home:'dashboard overview',map:'offline maps places search satellite layers',nav:'gps location compass coordinates',route:'planner elevation distance trail eta',trailreturn:'return trail intercept',waypoints:'marks base camp water',track:'recorder gpx recording',trip:'plan checklist packing check in',mission:'pack readiness expedition',survival:'manual guides reference',weather:'forecast rain wind snow avalanche',comms:'mesh messages radio inbox',sensors:'pressure temperature signal',log:'journal notes events',power:'battery energy display',system:'settings theme storage recovery diagnostics',lost:'recovery lost return',sos:'emergency help'};
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
  function closeSwitcher(){
    if(switcher.open&&typeof switcher.close==='function')switcher.close();
    else{switcher.removeAttribute('data-open');switcher.removeAttribute('open');switcher.dispatchEvent(new Event('close'))}
  }
  function showSwitcher(){
    if(switcherOpen())return;
    returnFocus=document.activeElement;query.value='';
    try{if(typeof switcher.showModal==='function')switcher.showModal();else throw new Error('dialog unsupported')}
    catch{switcher.setAttribute('open','');switcher.setAttribute('data-open','fallback')}
    findModules();requestAnimationFrame(()=>query.focus({preventScroll:true}));
  }
  function activateMatch(index){
    const item=matches[index];if(!item)return;
    returnFocus=document.getElementById('screen');closeSwitcher();openView(item[0]);
  }
  launcher.addEventListener('click',showSwitcher);
  switcher.querySelector('.switcher-close').addEventListener('click',closeSwitcher);
  switcher.addEventListener('close',()=>{if(returnFocus?.isConnected)returnFocus.focus({preventScroll:true});});
  switcher.addEventListener('click',e=>{
    const option=e.target.closest('[data-result-index]');
    if(option)activateMatch(Number(option.dataset.resultIndex));
    else if(e.target===switcher){const r=switcher.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)switcher.close();}
  });
  switcher.addEventListener('keydown',e=>{if(e.key==='Escape'&&!e.isComposing){e.preventDefault();e.stopPropagation();closeSwitcher();}});
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
    let minLa=Infinity,minLo=Infinity,maxLa=-Infinity,maxLo=-Infinity;
    for(const p of routePoints){minLa=Math.min(minLa,p.lat);maxLa=Math.max(maxLa,p.lat);minLo=Math.min(minLo,p.lon);maxLo=Math.max(maxLo,p.lon);}
    const dLa=maxLa-minLa||.001,dLo=maxLo-minLo||.001;
    // Bound schematic markup, while retaining full geometry for route calculations.
    const stride=Math.max(1,Math.ceil((routePoints.length-1)/599));
    const pts=routePoints.filter((_,i)=>i%stride===0||i===routePoints.length-1).map(p=>[24+(p.lon-minLo)/dLo*352,196-(p.lat-minLa)/dLa*172]);
    return plotHtml=`<svg class="ws-route-plot" viewBox="0 0 400 220" role="img" aria-label="Schematic diagram of the planned route, not a terrain map"><path d="M0 55H400M0 110H400M0 165H400M100 0V220M200 0V220M300 0V220" stroke="currentColor" opacity=".16"/><polyline points="${pts.map(p=>p.join(',')).join(' ')}" fill="none" stroke="currentColor" stroke-width="2"/>${pts.filter((_,i)=>i===0||i===pts.length-1).map(([x,y],i)=>`<circle cx="${x}" cy="${y}" r="5" fill="currentColor"/><text x="${Math.min(x+9,330)}" y="${Math.max(y-10,16)}">${i?'END':'START'}</text>`).join('')}<text x="12" y="18">N ↑ / ROUTE SCHEMATIC</text></svg>`+rows([['LENGTH',`${routeMiles().toFixed(2)} mi`],['POINTS',routePoints.length]])+note('Route geometry only. Axes scaled independently; no terrain or obstacle information.');
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
    mesh:()=>table(['NODE','RSSI','HOPS','STATUS'],[['BASE-01','−72 dBm','1','DEMO'],['RIDGE-01','−85 dBm','2','DEMO'],['CAMP-01','−91 dBm','2','DEMO'],['RELAY-A','−96 dBm','3','DEMO']])+note('Illustrative roster. No radios have been discovered.'),
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
    runtime:()=>rows([['RELEASE','FIELD/OS 3.67'],['SECURE CONTEXT',isSecureContext?'YES':'NO'],['SERVICE WORKER','serviceWorker' in navigator?'SUPPORTED':'UNSUPPORTED'],['GEOLOCATION','geolocation' in navigator?'SUPPORTED':'UNSUPPORTED'],['WAKE LOCK','wakeLock' in navigator?'SUPPORTED':'UNSUPPORTED'],['TIME ZONE',Intl.DateTimeFormat().resolvedOptions().timeZone]]),
    plot,
    navtools:()=>actions([['map','TERRAIN MAP'],['route','ROUTE PLANNER'],['trailreturn','RETURN TO TRAIL'],['waypoints','SAVED WAYPOINTS'],['track','TRACK RECORDER'],['lost','LOST MODE']])+note('Use your route, saved base, and position source together when reviewing a return path.'),
    commtools:()=>actions([['trip','CHECK-IN PLAN'],['nav','COORDINATES'],['log','EVENT JOURNAL'],['system','DEVICE STATUS']])+note('Prepare a check-in locally and review the position source before copying it.'),
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
    consoleBar.innerHTML='<strong>TAP V2 // <span class="ws-console-name">FIELD MODULE</span> <em>v3.67</em></strong><span class="ws-console-mode">OFFLINE MODE</span><span class="ws-console-pos">GPS: DEMO</span><span class="ws-console-track">TRACK: IDLE</span><span class="ws-console-clock">--:--:--</span><span class="ws-console-battery">▰▰▰▱ <b>'+val('mobileBattery')+'</b></span>';
    const band=document.createElement('div');band.className='module-band';band.innerHTML='<span class="ws-band-sector">SECTOR VT-021</span><span class="ws-band-module">MODULE</span><span class="ws-band-pos">POSITION</span><span class="ws-band-route">ROUTE</span><span class="ws-band-clock">--:--:--</span>';
    head.after(consoleBar);consoleBar.after(band);
    for(const [title,label,type] of specs[view.id]||[]){const holder=document.createElement('div');holder.className='module-slot';holder.dataset.panelType=type;holder.innerHTML=card(title,label,'');grid.append(holder);}
    // v3.67: no implicit first-card hero. Full-width workstation surfaces are explicit in CSS/markup.
  }
  const renderedHtml=new WeakMap();
  function updateHtml(el,html){
    if(el&&renderedHtml.get(el)!==html){el.innerHTML=html;renderedHtml.set(el,html);}
  }
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
  function refresh(){
    if(document.hidden)return;
    const active=document.querySelector('.view.active');if(!active)return;
    if(active.id==='home')refreshHome();
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
    active.querySelectorAll('.module-slot').forEach(slot=>{const body=bodies[slot.dataset.panelType];if(!body)return;let content=slot.querySelector('.ws-card-body');if(!content){content=document.createElement('div');content.className='ws-card-body';slot.firstElementChild.append(content);}const html=body();updateHtml(content,html);});
  }
  // Coalesce input, navigation, and resize bursts into one paint. Hidden tabs
  // resume from current state rather than rebuilding workstation cards in the background.
  let refreshFrame=0;
  function scheduleRefresh(){
    if(document.hidden||refreshFrame)return;
    refreshFrame=requestAnimationFrame(()=>{refreshFrame=0;refresh();});
  }
  document.addEventListener('fieldos:routechange',()=>{plotHtml=null;scheduleRefresh();});
  document.addEventListener('fieldos:routemetadatachange',scheduleRefresh);
  document.addEventListener('click',scheduleRefresh);
  document.addEventListener('input',scheduleRefresh);
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
  setInterval(()=>{if(!document.hidden)scheduleRefresh()},5000);refresh();
  window.addEventListener('resize',()=>{if(innerWidth>=1024)closeTabSheet();scheduleRefresh();});
})();

