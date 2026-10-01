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
    await page.evaluate(()=>{
      FIELD_ROUTE_STATE.setPoints(Array.from({length:1000},(_,i)=>({lat:44+i/100000,lon:-73+i/100000})));
    });await page.waitForTimeout(100);
    const count=await page.locator('#route .ws-route-plot polyline').evaluate(e=>e.points.numberOfItems);
    assert.ok(count<=601&&count>1);assert.equal(await page.evaluate(()=>FIELD_ROUTE_STATE.getPoints().length),1000);
    const stable=await page.evaluate(async()=>{
      const old=document.querySelector('#route .ws-route-plot');
      for(let i=0;i<30;i++)document.dispatchEvent(new Event('input',{bubbles:true}));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return old===document.querySelector('#route .ws-route-plot');
    });assert.ok(stable,'Unchanged schematic retains its DOM after an input burst');
    const lifecycle=await page.evaluate(async()=>{
      const before=document.querySelector('#route .ws-route-plot');
      Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});
      document.dispatchEvent(new Event('visibilitychange'));
      FIELD_ROUTE_STATE.setPoints([{lat:44,lon:-73},{lat:44.01,lon:-73.01}]);
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      const paused=before===document.querySelector('#route .ws-route-plot');
      delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));
      await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
      return {paused,resumed:before!==document.querySelector('#route .ws-route-plot')};
    });assert.deepEqual(lifecycle,{paused:true,resumed:true});
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
        const chart=box('#home .detailed-sensors .mini-chart'),axis=box('#home .detailed-sensors .chart-axis');
        const label=box('#home .detailed-sensors .mini-chart-title');
        return {coordsClear:coords.bottom<=compass.top,titleVisible:title.height>0,labelAbove:label.bottom<=chart.top,axisBelow:axis.top>=chart.bottom};
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
    console.log('PASS mobile native map preserves fractional zoom after touch release');

    await page.evaluate(()=>openView('route'));await page.waitForTimeout(100);
    const routeTap=await page.evaluate(async()=>{
      const el=document.getElementById('routePlannerMap'),before=FIELD_ROUTE_STATE.getPoints().length,box=el.getBoundingClientRect();
      const x=box.left+box.width*.58,y=box.top+box.height*.48,id=77;
      const fire=(type,cx,cy)=>el.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:id,pointerType:'touch',isPrimary:true,clientX:cx,clientY:cy,buttons:type==='pointerup'?0:1}));
      fire('pointerdown',x,y);fire('pointerup',x,y);
      await new Promise(r=>setTimeout(r,80));
      const afterTap=FIELD_ROUTE_STATE.getPoints().length;
      fire('pointerdown',x,y);fire('pointermove',x+45,y+5);fire('pointerup',x+45,y+5);
      await new Promise(r=>setTimeout(r,80));
      return {before,afterTap,afterDrag:FIELD_ROUTE_STATE.getPoints().length};
    });
    assert.equal(routeTap.afterTap,routeTap.before+1,'Short mobile tap adds exactly one route point');
    assert.equal(routeTap.afterDrag,routeTap.afterTap,'Mobile drag/pan must not add a route point');
    assert.ok(await page.locator('#route .planner-anchor-touch').count()>=routeTap.afterTap,'Mobile route handles render for editable anchors');
    console.log('PASS mobile route editor distinguishes tap-to-add from drag and exposes touch handles');

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
