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
  for(const width of [320,390,768,1024]){
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
  }
  assert.deepEqual(fatal,[],fatal.join('\n'));
 }finally{await browser?.close();await new Promise(resolve=>server.close(resolve))}
})().catch(e=>{console.error(e);process.exitCode=1;server.close()});
