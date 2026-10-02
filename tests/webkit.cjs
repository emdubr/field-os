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
  assert.deepEqual(fatal,[],fatal.join('\n'));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
