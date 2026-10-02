const {chromium}=require('playwright'),assert=require('node:assert/strict');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 if(pathname==='/blank'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><title>seed</title>');return;}
 if(pathname==='/'){res.setHeader('Content-Type','text/html');res.end('<!doctype html><script defer src="/track-store.js"></script>');return;}
 if(pathname==='/track-store.js'){res.setHeader('Content-Type','application/javascript');res.end(fs.readFileSync(path.join(root,'track-store.js')));return;}
 res.writeHead(404).end();
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
 try{
  browser=await chromium.launch({headless:true});
  const page=await browser.newPage({serviceWorkers:'block'}),url='http://127.0.0.1:'+server.address().port;
  await page.goto(url+'/blank');
  await page.evaluate(()=>localStorage.setItem('fieldos-v12-track',JSON.stringify([
   {lat:44.1,lon:-73.1,time:'2026-10-01T00:00:00.000Z'},
   {lat:44.2,lon:-73.2,time:'2026-10-01T00:00:05.000Z'}
  ])));
  await page.goto(url+'/');
  const initial=await page.evaluate(async()=>{
   const result=await FIELD_TRACK_STORE.hydrate();
   return {length:result.points.length,persistent:result.persistent,legacy:localStorage.getItem('fieldos-v12-track')};
  });
  assert.equal(initial.length,2);assert.equal(initial.persistent,true);assert.equal(initial.legacy,null);
  await page.evaluate(async()=>{
   FIELD_TRACK_STORE.append({lat:44.3,lon:-73.3,time:'2026-10-01T00:00:10.000Z'});
   await FIELD_TRACK_STORE.flush();
   await FIELD_TRACK_STORE.snapshot();
   FIELD_TRACK_STORE.append({lat:44.4,lon:-73.4,time:'2026-10-01T00:00:15.000Z'});
   await FIELD_TRACK_STORE.flush();
  });
  await page.reload();
  const after=await page.evaluate(async()=>{
   const before=(await FIELD_TRACK_STORE.all()).length;
   const snap=await FIELD_TRACK_STORE.restore();
   const restored=await FIELD_TRACK_STORE.all();
   await FIELD_TRACK_STORE.clear();
   return {before,snapshot:snap.length,restored:restored.length,cleared:(await FIELD_TRACK_STORE.all()).length};
  });
  assert.deepEqual(after,{before:4,snapshot:3,restored:3,cleared:0});
  const longTrack=await page.evaluate(async()=>{
   const start=Date.parse('2026-10-01T00:00:00.000Z');
   const points=Array.from({length:5010},(_,i)=>({lat:44.1+i*.00001,lon:-73.1+i*.00001,
     time:new Date(start+i*1000).toISOString(),seq:i,totalMiles:i*.012}));
   await FIELD_TRACK_STORE.replace(points);
   const retained=await FIELD_TRACK_STORE.all();
   return {count:retained.length,start:retained[0],next:retained[1],last:retained.at(-1)};
  });
  assert.equal(longTrack.count,5000,'track store bounds older interior samples');
  assert.equal(longTrack.start.seq,0,'original trailhead must survive compaction');
  assert.ok(longTrack.next.seq>1,'oldest interior samples may be removed');
  assert.equal(longTrack.last.seq,5009);
  assert.ok(longTrack.last.totalMiles>60);
  console.log('PASS 5010-point IndexedDB track retains original trailhead and cumulative mileage');
  console.log('PASS real browser IndexedDB migration, append-only writes, crash-reload persistence, snapshot restore, clear');
 }finally{await browser?.close();await new Promise(r=>server.close(r));}
})().catch(err=>{console.error(err);process.exitCode=1;server.close()});
