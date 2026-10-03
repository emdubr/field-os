const {webkit}=require('playwright'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://local.test').pathname,file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
 if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
 const ext=path.extname(file);res.setHeader('Content-Type',ext==='.js'?'application/javascript':ext==='.css'?'text/css':ext==='.html'?'text/html':'application/octet-stream');
 try{res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}
});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 let browser;
 try{
  browser=await webkit.launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:'block'});
  const origin='http://127.0.0.1:'+server.address().port;
  const fatal=[];
  page.on('pageerror',e=>fatal.push(e.message));
  await page.route('**/*',route=>route.request().url().startsWith(origin)?route.continue():route.abort());
  await page.goto(origin,{waitUntil:'load'});
  await page.waitForTimeout(900);
  for(const width of [320,360,390,430,768,1024]){
   await page.setViewportSize({width,height:width>=768?800:844});
   await page.waitForTimeout(100);
   const ui=await page.evaluate(()=>({
    active:document.querySelector('.view.active')?.id,
    bootHidden:document.getElementById('boot')?.classList.contains('hidden'),
    allViews:document.querySelectorAll('.view').length,
    horizontalOverflow:document.documentElement.scrollWidth-innerWidth
   }));
   assert.equal(ui.bootHidden,true,'bootstrap does not trap WebKit behind splash');
   assert.equal(ui.active,'home','first load opens home across Safari-class screen widths');
   assert.ok(ui.allViews>=12,'all FIELD/OS modules remain registered');
   assert.ok(ui.horizontalOverflow<=25,'page should not be unusably wider than WebKit viewport at '+width+'px');
   console.log('PASS WebKit '+width+'px startup and responsive layout');
   if(width<=430){
    const mobile=await page.evaluate(()=>{
      const box=selector=>{const el=document.querySelector(selector);if(!el)return null;const r=el.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,height:r.height,width:r.width,display:getComputedStyle(el).display}};
      const grid=document.querySelector('#home .console-command-strip');
      return {
        header:box('#app > .topbar'),build:box('#fieldBuildLabel'),dock:box('#app .tabbar'),
        tab:box('#app .tabbar .tab-btn'),map:box('#home .home-real-map'),
        actions:grid?getComputedStyle(grid).gridTemplateColumns.split(' ').length:0,
        viewport:innerWidth,docWidth:document.documentElement.scrollWidth
      };
    });
    assert.equal(mobile.header.display,'flex','legacy rules must not hide mobile top bar');
    assert.ok(mobile.header.height>=44&&mobile.header.top>=-1,'mobile header occupies a real safe-area row');
    assert.ok(mobile.header.right<=mobile.viewport+1&&mobile.build.width>10,'build label must be visible');
    assert.ok(mobile.dock.height>=54&&mobile.tab.height>=51,'bottom navigation buttons must fill the dock');
    assert.ok(mobile.dock.height-mobile.tab.height<=7,'no empty black strip at bottom of dock');
    assert.ok(mobile.map.height>=300,'the main map should be a usable mobile viewport');
    assert.ok(mobile.actions>=2&&mobile.docWidth<=mobile.viewport+1,'home actions fit without overflow');
    await page.evaluate(()=>openView('map'));await page.waitForTimeout(35);
    const layout=await page.evaluate(()=>{
      const header=document.querySelector('#app > .topbar').getBoundingClientRect(),
        title=document.querySelector('#map.view.active > .view-head').getBoundingClientRect(),
        panel=document.querySelector('#map .module-grid > .panel');
      return {headerBottom:header.bottom,titleTop:title.top,
        visibility:panel?getComputedStyle(panel).contentVisibility:null,
        screenTop:document.getElementById('screen').getBoundingClientRect().top,
        screenPadding:getComputedStyle(document.getElementById('screen')).paddingTop,
        viewTop:document.getElementById('map').getBoundingClientRect().top,
        viewPadding:getComputedStyle(document.getElementById('map')).paddingTop,
        statusDisplay:getComputedStyle(document.querySelector('#app > .status-strip')).display,
        statusHeight:document.querySelector('#app > .status-strip').getBoundingClientRect().height,
        overflow:document.documentElement.scrollWidth-innerWidth};
    });
    assert.ok(Math.abs(layout.titleTop-layout.headerBottom)<=13,'map title must not leave a phantom top-bar gap: '+JSON.stringify(layout));
    assert.equal(layout.visibility,'visible','active map panels must not reserve blank offscreen placeholders');
    assert.ok(layout.overflow<=1,'map screen must fit mobile width');
    await page.evaluate(()=>openView('route'));await page.waitForTimeout(35);
    await page.locator('#routePlannerMap').scrollIntoViewIfNeeded();
    const editor=await page.locator('#routePlannerMap').evaluate(el=>({w:el.getBoundingClientRect().width,h:el.getBoundingClientRect().height}));
    assert.ok(editor.w>250&&editor.h>=335,'route editor map retains its useful mobile viewport');
    await page.evaluate(()=>openView('home'));
    console.log('PASS WebKit '+width+'px mobile chrome, usable map, dock fill and real panel geometry');
   }
  }
  // Route elevation must remain responsive even with the optional external
  // Leaflet map library blocked: the chart is useful from saved offline data.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>openView('route'));
  await page.locator('#routeProfile').scrollIntoViewIfNeeded();
  await page.waitForTimeout(200);
  const horizontal=await page.locator('#routeProfile').evaluate(c=>({actual:c.getBoundingClientRect().width,prepared:Number(c.dataset.fieldCssWidth)||0,height:c.getBoundingClientRect().height,owner:!!window.FIELD_ROUTE_PLANNER?.ownsElevationProfile}));
  assert.ok(horizontal.owner,'native horizontal elevation renderer loads without external map library');
  assert.ok(horizontal.actual>180&&Math.abs(horizontal.actual-horizontal.prepared)<4,'offline WebKit route overview uses its actual phone width: '+JSON.stringify(horizontal));
  assert.ok(horizontal.height>=185&&horizontal.height<=195,'offline WebKit route overview preserves usable fixed chart height');
  console.log('PASS Safari-class horizontal elevation overview renders without external Leaflet');
  // Mobile landscape must use the native responsive layout, not the obsolete
  // 1500px desktop workspace whose JS scaling is disabled below 1001px.
  for(const [width,height] of [[667,375],[844,390],[932,430]]){
    await page.setViewportSize({width,height});
    await page.evaluate(()=>{openView('home');window.scrollTo(0,0)});
    await page.waitForTimeout(150);
    const phone=await page.evaluate(()=>{
      const style=selector=>getComputedStyle(document.querySelector(selector));
      const rect=selector=>document.querySelector(selector).getBoundingClientRect();
      return {
        console:rect('#home .detail-console'),header:rect('#app > .topbar'),
        headerDisplay:style('#app > .topbar').display,headerPosition:style('#app > .topbar').position,
        consolePosition:style('#home .detail-console').position,
        consoleTransform:style('#home .detail-console').transform,
        dockPosition:style('#app .tabbar').position,dock:rect('#app .tabbar'),
        smallFont:parseFloat(style('.handheld-status small').fontSize),
        actionFont:parseFloat(style('.handheld-actions button').fontSize),
        overflow:document.documentElement.scrollWidth-innerWidth,viewport:innerWidth
      };
    });
    assert.equal(phone.consolePosition,'relative','landscape phone must not keep absolute desktop console: '+JSON.stringify(phone));
    assert.ok(phone.console.width<=phone.viewport+2,'landscape home must fit actual phone width: '+JSON.stringify(phone));
    assert.equal(phone.consoleTransform,'none','phone landscape must not depend on a JS fit transform');
    assert.equal(phone.headerDisplay,'flex','landscape phone keeps visible top header');
    assert.equal(phone.headerPosition,'sticky','landscape header can stick during scroll');
    assert.equal(phone.dockPosition,'fixed','landscape nav must not scroll out of view');
    assert.ok(phone.dock.right<=width+2&&phone.dock.left>=-2,'landscape dock stays onscreen');
    assert.ok(phone.smallFont>=9&&phone.actionFont>=11,'field labels/buttons must stay readable');
    assert.ok(phone.overflow<=2,'landscape must not create horizontal document overflow');
    await page.locator('#moreTabs').click();
    await page.waitForTimeout(210);
    const more=await page.evaluate(()=>{
      const r=selector=>document.querySelector(selector).getBoundingClientRect();
      const sheet=document.querySelector('#tabSheet');sheet.scrollTop=90;
      return {sheet:r('#tabSheet'),head:r('#tabSheet .tab-sheet-head'),close:r('#closeTabSheet'),
        expanded:document.querySelector('#moreTabs').getAttribute('aria-expanded'),
        hasOpen:sheet.classList.contains('open'),visibility:getComputedStyle(sheet).visibility,
        display:getComputedStyle(sheet).display,
        transform:getComputedStyle(sheet).transform,pointer:getComputedStyle(sheet).pointerEvents,
        closeVisibility:getComputedStyle(document.querySelector('#closeTabSheet')).visibility};
    });
    console.log('WebKit More geometry '+width+'x'+height+' '+JSON.stringify(more));
    assert.equal(more.expanded,'true','landscape More panel opens');
    assert.equal(more.hasOpen,true,'More must retain open class after a sheet scroll');
    assert.equal(more.visibility,'visible','More drawer must be CSS visible when expanded');
    assert.equal(more.closeVisibility,'visible','More close control must be visible');
    assert.notEqual(more.display,'none','desktop breakpoint must not hide phone landscape More drawer');
    assert.ok(more.sheet.width>=width-4&&more.close.width>=40,'More drawer and close need real onscreen geometry');
    assert.ok(more.sheet.top>=-2&&more.close.top>=more.sheet.top-2&&more.close.bottom<=height,
      'short landscape screen must retain reachable sheet close control: '+JSON.stringify(more));
    await page.locator('#closeTabSheet').click({timeout:3000});
    console.log('PASS WebKit landscape '+width+'x'+height+' responsive map, sticky dock, readable controls and More close');
  }
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>openView('map'));
  await page.locator('#routeCorridorPadding').scrollIntoViewIfNeeded();
  // WebKit may defer inherited custom-property recalculation until the next
  // rendering opportunity; exercise real sequential theme switches rather
  // than changing all four body attributes in one JavaScript task.
  const oldTheme=await page.evaluate(()=>document.body.dataset.theme);
  const palette={};
  for(const mode of ['green','amber','mono','red']){
    await page.evaluate(theme=>{document.body.dataset.theme=theme},mode);
    await page.waitForTimeout(90);
    palette[mode]=await page.evaluate(()=>{
      const probe=document.createElement('span');
      probe.style.cssText='color:var(--danger);border:1px solid var(--line)';
      document.body.appendChild(probe);
      const ring=document.querySelector('.sos-ring'),
        input=document.getElementById('routeCorridorPadding');
      const result={
        danger:getComputedStyle(probe).color,sos:getComputedStyle(ring).borderTopColor,
        border:getComputedStyle(probe).borderTopColor,
        inputBorder:getComputedStyle(input).borderTopColor,
        inputBackground:getComputedStyle(input).backgroundColor,
        bodyTheme:document.body.dataset.theme,
        bodyLine:getComputedStyle(document.body).getPropertyValue('--line').trim(),
        inputLine:getComputedStyle(input).getPropertyValue('--line').trim()
      };
      probe.remove();return result;
    });
    assert.equal(palette[mode].bodyTheme,mode,'theme switch must reach body');
    console.log('PASS WebKit theme '+mode+': '+JSON.stringify(palette[mode]));
  }
  await page.evaluate(theme=>{document.body.dataset.theme=theme},oldTheme||'green');
  for(const [mode,theme] of Object.entries(palette)){
    assert.equal(theme.sos,theme.danger,mode+' SOS ring must be danger red, not theme accent');
    assert.equal(theme.inputBorder,theme.border,mode+' input border must follow theme border');
  }
  assert.notEqual(palette.green.inputBackground,palette.mono.inputBackground,'Mono inputs must not be green');
  assert.notEqual(palette.green.inputBackground,palette.amber.inputBackground,'Amber inputs must not be green');
  console.log('PASS Safari-class palette changes preserve danger red and actual themed form controls');
  assert.deepEqual(fatal,[],fatal.join('\n'));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
