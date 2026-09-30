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
  let browser;
  try{
    browser=await chromium.launch({headless:true,...(process.env.FIELD_CHROMIUM?{executablePath:process.env.FIELD_CHROMIUM,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader']}: {})});
    const page=await browser.newPage({serviceWorkers:'block'}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));
    await page.route('**/*',r=>r.request().url().startsWith(origin)?r.continue():r.abort());
    await page.goto(origin);await page.waitForTimeout(800);
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
    assert.deepEqual(errors,[]);console.log('PASS desktop card sizing, full-width elevation, bounded schematic, full route preservation, stable redraw, hidden/resume lifecycle, and no page errors');
  }finally{await browser?.close();server.close();}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
