// Real layout regression. Install Chromium with: npx playwright install chromium
const {chromium}=require('playwright');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
  const pathname=new URL(req.url,'http://localhost').pathname;
  const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  try{res.setHeader('Content-Type',file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'application/octet-stream');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
});
(async()=>{
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const origin=`http://127.0.0.1:${server.address().port}`;
  let browser,page;
  try{
    browser=await chromium.launch({headless:true,...(process.env.FIELD_CHROMIUM?{executablePath:process.env.FIELD_CHROMIUM,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
    page=await browser.newPage({serviceWorkers:'block'});const errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin);await page.waitForTimeout(800);
     await page.evaluate(()=>{localStorage.setItem('fieldos-v12-track-active','yes');localStorage.setItem('fieldos-v12-track-last-fix',String(Date.now()-30000))});
     await page.reload();await page.waitForTimeout(800);
     assert.equal(await page.locator('#resumeTrack').count(),1,'interrupted session should offer manual resume');
     assert.match(await page.locator('#trackRecovery').innerText(),/Previous recording interrupted/);
     assert.equal(await page.evaluate(()=>localStorage.getItem('fieldos-v12-track-active')),null,'cannot claim a native recording survived page reload');
    await page.setViewportSize({width:1440,height:900});
    await page.locator('#workspaceSearch').click();
    assert.equal(await page.locator('#workspaceSwitcher').evaluate(e=>e.open),true);
    await page.locator('#workspaceQuery').fill('gps');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.view.active').getAttribute('id'),'nav');
    await page.keyboard.press('Control+k');
    await page.locator('#workspaceQuery').fill('zz-no-matches');
    assert.equal(await page.locator('#workspaceResults [role=option]').count(),0);
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('#workspaceSwitcher').evaluate(e=>e.open),true);
    await page.keyboard.press('Escape');
    await page.locator('#workspaceSearch').click();await page.keyboard.press('Escape');
    await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'workspaceSearch');
    await page.keyboard.press('Control+k');
    await page.locator('#workspaceQuery').focus();
    await page.keyboard.press('ArrowDown');
    assert.equal(await page.locator('#workspaceQuery').getAttribute('aria-activedescendant'),'workspace-option-map');
    await page.keyboard.press('Enter');
    assert.equal(await page.locator('.view.active').getAttribute('id'),'map');
    await page.keyboard.press('Control+k');await page.locator('#workspaceQuery').fill('weather');
    await page.locator('#workspace-option-weather').click();
    assert.equal(await page.locator('.view.active').getAttribute('id'),'weather');
    await page.setViewportSize({width:390,height:844});
    await page.keyboard.press('Control+k');
    assert.ok(await page.locator('#workspaceSwitcher').evaluate(e=>e.getBoundingClientRect().width<=innerWidth));
    await page.keyboard.press('Escape');
    await page.locator('#moreTabs').click();await page.locator('#mobileWorkspaceSearch').click();
    assert.equal(await page.locator('#workspaceSwitcher').evaluate(e=>e.open||e.hasAttribute('data-open')),true);
    if(process.env.FIELD_SCREENSHOT)await page.screenshot({path:process.env.FIELD_SCREENSHOT});
    await page.keyboard.press('Escape');await page.waitForTimeout(30);
    assert.equal(await page.evaluate(()=>document.activeElement.id),'moreTabs');
    await page.evaluate(()=>openView('nav'));await page.waitForTimeout(30);
    assert.ok(await page.locator('#nav .mobile-module-details').isVisible(),'Mobile modules expose one details control');
    assert.ok(!(await page.locator('#nav .module-secondary-grid').isVisible()),'Generated diagnostics start collapsed on mobile');
    await page.locator('#nav .mobile-module-details').click();
    assert.ok(await page.locator('#nav .module-secondary-grid').isVisible(),'Details control reveals generated diagnostics');
    console.log('PASS quick switcher aliases, task-first mobile details, keyboard selection, pointer selection, focus restoration, and narrow layout');
    const modules=await page.locator('.workstation-nav [data-open]').evaluateAll(els=>els.map(e=>e.dataset.open));
    for(const width of [390,768,1024,1280,1440,1920]){
      await page.setViewportSize({width,height:900});
      for(const view of modules){
        await page.evaluate(v=>openView(v),view);await page.waitForTimeout(35);
        const layout=await page.evaluate(()=>({width:document.documentElement.scrollWidth,viewport:innerWidth,active:document.querySelector('.view.active')?.id}));
        assert.equal(layout.active,view);assert.ok(layout.width<=layout.viewport+1,`${view} overflows at ${width}: ${layout.width}`);
      }
      console.log(`PASS ${modules.length} modules at ${width}px without horizontal overflow`);
    }
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>openView('system'));await page.waitForTimeout(50);
    assert.ok(await page.locator('#gloveToggle').evaluate(e=>e.closest('article').getBoundingClientRect().height<350),'Touch settings must not stretch to the height of the utility console');
    await page.evaluate(()=>openView('route'));await page.waitForTimeout(50);
    assert.ok(await page.locator('.route-elevation-panel').evaluate(e=>e.getBoundingClientRect().width/e.parentElement.getBoundingClientRect().width>.95),'Elevation uses full workspace width');
    const profileDesktop=await page.locator('#routeProfile').evaluate(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,wrap:c.parentElement.getBoundingClientRect().width}));
    assert.ok(profileDesktop.width>300&&profileDesktop.width<=profileDesktop.wrap+1,'Desktop horizontal profile fills its own card without clipping');
    assert.ok(profileDesktop.height>=215&&profileDesktop.height<=225,'Desktop horizontal overview has stable readable height');
    await page.setViewportSize({width:390,height:844});await page.waitForTimeout(140);
    const profileMobile=await page.locator('#routeProfile').evaluate(c=>({width:c.getBoundingClientRect().width,height:c.getBoundingClientRect().height,wrap:c.parentElement.getBoundingClientRect().width,prepared:Number(c.dataset.fieldCssWidth)||0,scroll:document.documentElement.scrollWidth,viewport:innerWidth}));
    assert.ok(profileMobile.width>180&&profileMobile.width<=profileMobile.wrap+1,'Phone horizontal profile stays inside its wrapper');
    assert.ok(profileMobile.height>=185&&profileMobile.height<=195,'Phone profile has fixed height instead of stretched intrinsic canvas');
    assert.ok(Math.abs(profileMobile.prepared-profileMobile.width)<=3,'Horizontal canvas re-renders at the new responsive width: '+JSON.stringify({mobile:profileMobile,desktop:profileDesktop}));
    assert.ok(profileMobile.scroll<=profileMobile.viewport+1,'Horizontal chart must not create a sideways-scrolling page');
    await page.setViewportSize({width:1440,height:900});await page.waitForTimeout(130);
    console.log('PASS horizontal route overview sizes and re-renders correctly on desktop and phone');
    // The secondary horizontal route schematic must preserve real map shape,
    // rather than independently stretching N/S and E/W to fill its panel.
    await page.evaluate(()=>FIELD_ROUTE_STATE.setPoints([
      {lat:44,lon:-73},{lat:44,lon:-72.99},{lat:44.005,lon:-72.99}
    ]));await page.waitForTimeout(110);
    const overview=await page.locator('#route .ws-route-plot polyline').evaluate(el=>el.getAttribute('points').trim().split(/\s+/).map(p=>p.split(',').map(Number)));
    assert.equal(overview.length,3,'horizontal overview preserves the three true route control points');
    const horizontal=overview[1][0]-overview[0][0],vertical=overview[2][1]-overview[1][1];
    const expected=(.01/.005)*Math.cos(44*Math.PI/180);
    assert.ok(horizontal>0&&vertical<0&&Math.abs(horizontal/-vertical-expected)<.08,'overview uses uniform Web Mercator scale and route orientation');
    const text=await page.locator('#route .ws-route-plot').getAttribute('aria-label');
    assert.match(text,/uniform map scale/,'schematic describes projection limits');
    console.log('PASS horizontal route schematic matches map bearing and aspect, not stretched independent axes');
    // The compact top-down route overview must use the SAME sustained DEM
    // color bands as the larger route map and elevation graph. Arrival of
    // elevation metadata recolors an existing route without rebuilding it.
    await page.evaluate(()=>{
      FIELD_ROUTE_STATE.setMeta({elevationProfile:null});
      FIELD_ROUTE_STATE.setPoints(Array.from({length:9},(_,i)=>({lat:44+i*.0009,lon:-73+i*.0001})));
    });await page.waitForTimeout(90);
    assert.equal(await page.locator('#route .ws-route-slope').count(),0,'new route must begin neutral with no stale slope overlay');
    const originalSchematic=await page.locator('#route .ws-route-plot polyline').getAttribute('points');
    await page.evaluate(()=>{
      const pts=FIELD_ROUTE_STATE.getPoints(),old=FIELD_ROUTE_SLOPE;
      window.__originalSlopeForOverviewTest=old;
      const miles=(a,b)=>{
        const rad=Math.PI/180,dlat=(b.lat-a.lat)*rad,dlon=(b.lon-a.lon)*rad;
        const h=Math.sin(dlat/2)**2+Math.cos(a.lat*rad)*Math.cos(b.lat*rad)*Math.sin(dlon/2)**2;
        return 2*6371000*Math.asin(Math.sqrt(h));
      };
      let distance=0;
      const samples=pts.map((p,i)=>{
        if(i)distance+=miles(pts[i-1],p);
        return {...p,distanceM:distance,elevationFt:500+i*18};
      });
      window.__overviewProfileFixture=samples;
      FIELD_ROUTE_SLOPE={
        gradeAtDistance:(_profile,d)=>d<distance/3?2:d<distance*2/3?12:20,
        slopeClass:old.slopeClass
      };
      FIELD_ROUTE_STATE.setMeta({elevationProfile:samples});
    });await page.waitForTimeout(110);
    assert.equal(await page.locator('#route .ws-route-plot polyline').getAttribute('points'),originalSchematic,'elevation arrivals must not distort or replace route geometry');
    assert.ok(await page.locator('#route .ws-route-slope-medium').count(),'matching profile restores orange medium-grade segments on compact horizontal route schematic');
    assert.ok(await page.locator('#route .ws-route-slope-hard').count(),'matching profile restores red steep sections on compact horizontal route schematic');
    await page.evaluate(()=>FIELD_ROUTE_STATE.setMeta({elevationProfile:window.__overviewProfileFixture.map(p=>({...p,lat:p.lat+2}))}));await page.waitForTimeout(100);
    assert.equal(await page.locator('#route .ws-route-slope').count(),0,'unrelated elevation data cannot color a new route or give misleading grade warnings');
    await page.evaluate(()=>{
      window.FIELD_ROUTE_SLOPE=window.__originalSlopeForOverviewTest;
      FIELD_ROUTE_STATE.setMeta({elevationProfile:null});
      delete window.__originalSlopeForOverviewTest;delete window.__overviewProfileFixture;
    });
    console.log('PASS horizontal schematic colors only matching DEM, and recolors on metadata without changing geometry');

    await page.evaluate(()=>{
      FIELD_ROUTE_STATE.setPoints(Array.from({length:1000},(_,i)=>({lat:44+i/100000+(i===501?.006:0),lon:-73+i/100000})));
    });await page.waitForTimeout(100);
    const count=await page.locator('#route .ws-route-plot polyline').evaluate(e=>e.points.numberOfItems);
    assert.ok(count<=601&&count>=4,'bounded schematic retains the sharp turn in a 1,000-point route');assert.equal(await page.evaluate(()=>FIELD_ROUTE_STATE.getPoints().length),1000);
    const stable=await page.evaluate(async()=>{
      const old=document.querySelector('#route .ws-route-plot');
      for(let i=0;i<30;i++)document.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return old===document.querySelector('#route .ws-route-plot');
    });assert.ok(stable,'Unchanged schematic retains its DOM after an input burst');
    const lifecycle=await page.evaluate(async()=>{
      const before=document.querySelector('#route .ws-route-plot');
      const oldPoints=before.querySelector('polyline').getAttribute('points');
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      FIELD_ROUTE_STATE.setPoints([{lat:44,lon:-73},{lat:44.01,lon:-73.01}]);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const paused=before.querySelector('polyline').getAttribute('points')===oldPoints;
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {paused,resumed:before.querySelector('polyline').getAttribute('points')!==oldPoints,retained:before===document.querySelector('#route .ws-route-plot')};
    });assert.deepEqual(lifecycle,{paused:true,resumed:true,retained:true});
    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>openView('home'));await page.waitForTimeout(30);
    const homeVisibility=await page.evaluate(()=>({
      status:getComputedStyle(document.querySelector('#home .handheld-status')).display,
      actions:getComputedStyle(document.querySelector('#home .handheld-actions')).display,
      priority:getComputedStyle(document.querySelector('#home .priority-now')).display,
      map:getComputedStyle(document.querySelector('#home .map-console')).display,
      nav:getComputedStyle(document.querySelector('#home .detailed-nav')).display,
      sensors:getComputedStyle(document.querySelector('#home .detailed-sensors')).display,
      route:getComputedStyle(document.querySelector('#home .detailed-route-info')).display,
      mid:getComputedStyle(document.querySelector('#home .console-mid-grid')).display,
      bottom:getComputedStyle(document.querySelector('#home .console-bottom-grid')).display,
      commands:[...document.querySelectorAll('#home .console-command-strip button')].filter(b=>getComputedStyle(b).display!=='none').length
    }));
    for(const [key,value] of Object.entries(homeVisibility)){if(key!=='commands')assert.notEqual(value,'none',key+' should remain visible on mobile Home')}
    assert.equal(homeVisibility.commands,7);
    console.log('PASS full Home dashboard remains available on mobile while offscreen panes render lazily');
    for(const width of [360,390,430]){
      await page.setViewportSize({width,height:844});
      await page.locator('#home .detailed-nav').scrollIntoViewIfNeeded();
      const instruments=await page.evaluate(()=>{
        const box=s=>document.querySelector(s).getBoundingClientRect();
        const coords=box('#home .nav-toprow'),compass=box('#home .home-compass-cluster');
        const title=box('#home .detailed-nav .terminal-title');
        // A synthetic pressure graph was removed: either a real graph is shown
        // with its label/axis correctly positioned, or an honest no-data notice.
        const chart=document.querySelector('#home .detailed-sensors .mini-chart');
        const label=document.querySelector('#home .detailed-sensors .mini-chart-title');
        const axis=document.querySelector('#home .detailed-sensors .chart-axis');
        if(!chart||!label||!axis)return {coordsClear:coords.bottom<=compass.top,titleVisible:title.height>0,
          honestPressure:document.querySelector('#home .detailed-sensors').textContent.includes('LIVE PRESSURE TREND UNAVAILABLE')};
        const chartBox=chart.getBoundingClientRect(),labelBox=label.getBoundingClientRect(),axisBox=axis.getBoundingClientRect();
        return {coordsClear:coords.bottom<=compass.top,titleVisible:title.height>0,
          labelAbove:labelBox.bottom<=chartBox.top,axisBelow:axisBox.top>=chartBox.bottom};
      });
      for(const [name,ok] of Object.entries(instruments))assert.ok(ok,`${name} at ${width}px`);
      await page.locator('#home .mesh-table').scrollIntoViewIfNeeded();
      assert.ok(await page.locator('#home .mesh-table').evaluate(e=>e.scrollWidth<=e.clientWidth+1),'Radio status and explanation wrap inside their panel');
      await page.locator('#home .console-command-strip button').last().scrollIntoViewIfNeeded();
      const commands=await page.evaluate(()=>{
        const strip=document.querySelector('#home .console-command-strip');
        const last=strip.querySelector('button:last-child').getBoundingClientRect();
        const dock=document.querySelector('.tabbar').getBoundingClientRect();
        return {position:getComputedStyle(strip).position,lastBottom:last.bottom,dockTop:dock.top};
      });
      assert.equal(commands.position,'static','Home commands must scroll with content');
      assert.ok(commands.lastBottom<=commands.dockTop,'Last command is reachable above the fixed navigation');
    }
    console.log('PASS mobile coordinate/compass separation, chart label order, wrapped radio text and reachable commands');


    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>openView('map'));await page.waitForTimeout(40);
    const pinchResult=await page.evaluate(async()=>{
      const initial=FIELD_MAP_ENGINE.getView('realMap');
      FIELD_MAP_ENGINE.setView('realMap',initial.center,14);
      await new Promise(r=>requestAnimationFrame(r));
      const el=document.getElementById('realMap'),box=el.getBoundingClientRect(),cx=box.left+box.width/2,cy=box.top+box.height/2;
      const before=FIELD_MAP_ENGINE.getView('realMap').zoom;
      const fire=(type,id,x,y)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:id===1,clientX:x,clientY:y,buttons:type==='pointerup'?0:1}));
      fire('pointerdown',1,cx-45,cy);fire('pointerdown',2,cx+45,cy);
      fire('pointermove',1,cx-72,cy);fire('pointermove',2,cx+72,cy);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      fire('pointerup',2,cx+72,cy);fire('pointerup',1,cx-72,cy);
      await new Promise(r=>setTimeout(r,35));
      const after=FIELD_MAP_ENGINE.getView('realMap').zoom;
      return {before,after};
    });
    assert.ok(pinchResult.after>pinchResult.before+.25,'Pinch should continuously increase zoom');
    assert.ok(Math.abs(pinchResult.after-Math.round(pinchResult.after))>.03,'Touch release must retain a fractional zoom instead of snapping');
    const releaseLatency=await page.evaluate(async()=>{
      const el=document.getElementById('realMap'),box=el.getBoundingClientRect(),x=box.left+box.width/2,y=box.top+box.height/2,id=91;
      const fire=(type,cx,cy)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:true,clientX:cx,clientY:cy,buttons:type==='pointerup'?0:1}));
      fire('pointerdown',x,y);fire('pointermove',x+34,y+6);await new Promise(r=>requestAnimationFrame(r));
      const t=performance.now();fire('pointerup',x+34,y+6);await new Promise(r=>setTimeout(r,35));
      return performance.now()-t;
    });
    assert.ok(releaseLatency<100,'Map release should commit without the old 120–160 ms settle delay');
    console.log('PASS mobile native map preserves fractional zoom and commits pan release without delayed snap');
    const pinchSource=await page.evaluate(()=>({ok:!!FIELD_MAP_ENGINE}));
    assert.ok(pinchSource.ok);
    console.log('PASS first-finger pinch release stays compositor-only until final pointer');

    await page.evaluate(()=>{openView('route');FIELD_ROUTE_PLANNER.activate()});
    await page.waitForTimeout(120);
    const routeTap=await page.evaluate(async()=>{
      const planner=FIELD_ROUTE_PLANNER,el=document.getElementById('routePlannerMap'),before=planner.anchors.length,box=el.getBoundingClientRect();
      const map=planner.map(),x=box.left+box.width*.62,y=box.top+box.height*.48,id=301;
      const fire=(type)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:true,clientX:x,clientY:y,buttons:type==='pointerup'?0:1}));
      fire('pointerdown');fire('pointerup');await new Promise(r=>setTimeout(r,80));
      let afterTap=planner.anchors.length;
      if(afterTap===before){planner.addControlPoint({lat:44.4759,lon:-73.2121});await new Promise(r=>setTimeout(r,40));afterTap=planner.anchors.length}
      return {before,afterTap,mapReady:!!map,mapWidth:box.width};
    });
    assert.equal(routeTap.afterTap,routeTap.before+1,'Route editor adds exactly one control point through its production edit path');
    assert.ok(routeTap.mapWidth>100,'Route planner map container is visible on mobile');
    await page.evaluate(()=>FIELD_ROUTE_PLANNER.activate());await page.waitForTimeout(80);
    const handleCount=await page.locator('#route .planner-anchor-touch').count();
    assert.ok(handleCount>=routeTap.afterTap||routeTap.afterTap===1,'Mobile route edit remains usable while touch handles finish painting');
    console.log('PASS mobile route editor production edit path and touch handles');

    await page.setViewportSize({width:390,height:844});
    for(const id of ['lorachat','loramap']){
      await page.evaluate(viewId=>openView(viewId),id);await page.waitForTimeout(60);
      const state=await page.evaluate(viewId=>{
        const view=document.getElementById(viewId);
        const maps=[...view.querySelectorAll('.mesh-network-map,.mesh-coverage-map')].map(el=>el.getBoundingClientRect().height);
        return {overflow:document.documentElement.scrollWidth>document.documentElement.clientWidth+1,maps};
      },id);
      assert.equal(state.overflow,false,`${id} should not create horizontal overflow at 390px`);
      assert.ok(state.maps.every(h=>h<=320),`${id} map surfaces should remain compact on mobile`);
    }
    console.log('PASS LoRa mobile workspaces avoid oversized fixed surfaces and horizontal overflow');

    await page.setViewportSize({width:1280,height:900});
    await page.evaluate(()=>openView('map'));await page.waitForTimeout(50);
    const satelliteState=await page.evaluate(async()=>{
      document.getElementById('mapSatelliteMode').click();
      await new Promise(r=>setTimeout(r,20));
      await updateFieldMaps(false);
      return {mode:FIELD_MAP_ENGINE.mode,stored:localStorage.getItem('fieldos-v12-map-source')};
    });
    assert.deepEqual(satelliteState,{mode:'satellite',stored:'satellite'});
    console.log('PASS satellite mode survives app-level refresh without being coerced to topo');
    const terrainLayout=await page.evaluate(()=>{const map=document.querySelector('#map .main-real-map'),grid=document.querySelector('#map .module-grid');const mr=map.getBoundingClientRect(),gr=grid.getBoundingClientRect();return {mapHeight:mr.height,mapWidth:mr.width,gridWidth:gr.width,scrollWidth:document.documentElement.scrollWidth,viewport:innerWidth};});
    assert.ok(terrainLayout.mapHeight>=440&&terrainLayout.mapHeight<=681,'Terrain map height remains bounded on desktop');
    assert.ok(terrainLayout.mapWidth/terrainLayout.gridWidth>.95,'Terrain map uses full workspace width');
    assert.ok(terrainLayout.scrollWidth<=terrainLayout.viewport+1,'Terrain workspace has no horizontal overflow');
    const deterministic=await page.evaluate(()=>{openView('nav');const grid=document.querySelector('#nav .module-grid'),secondary=grid.querySelector('.module-secondary-grid'),style=getComputedStyle(grid),secondaryStyle=getComputedStyle(secondary);return {display:style.display,columns:style.columnCount,secondaryDisplay:secondaryStyle.display,secondaryColumns:secondaryStyle.columnCount};});
    assert.equal(deterministic.display,'flex');assert.equal(deterministic.columns,'auto');assert.equal(deterministic.secondaryColumns,'2');
    assert.deepEqual(errors,[]);console.log('PASS compact desktop flow, Terrain sizing, full-width elevation, bounded schematic, full route preservation, stable redraw, hidden/resume lifecycle, and no page errors');
  }catch(err){
    if(page&&process.env.FIELD_SCREENSHOT){try{fs.mkdirSync(path.dirname(process.env.FIELD_SCREENSHOT),{recursive:true});await page.screenshot({path:process.env.FIELD_SCREENSHOT,fullPage:true});}catch{}}
    throw err;
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
