const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict'),path=require('node:path');
(async()=>{
 const handlers={},cached={shell:true},location={origin:'https://field.test',href:'https://field.test/field-os/sw.js'};
 let network=0,offline=false,exactShell=true;
 const cache={
   match:async(req,opts={})=>{
     const href=typeof req==='string'?req:req?.url||'';
     if(href==='./index.html'||href==='./'||href.endsWith('/index.html'))return cached;
     if(href.includes('field-tools.js'))return exactShell||opts.ignoreSearch?cached:null;
     return null;
   },
   put:async()=>{}
 };
 const ctx={
   URL,Promise,Response:{error:()=>({error:true})},
   self:{location,addEventListener:(name,fn)=>handlers[name]=fn},
   caches:{open:async()=>cache,match:(req,opts)=>cache.match(req,opts)},
   fetch:async()=>{network++;if(offline)throw Error('Offline');return {ok:false,network:true}}
 };
 const swText=fs.readFileSync(path.resolve(__dirname,'../sw.js'),'utf8'),html=fs.readFileSync(path.resolve(__dirname,'../index.html'),'utf8');
 vm.runInNewContext(swText,ctx);
 const version=(html.match(/app\.js\?v=([\d.]+)/)||[])[1];assert.ok(version,'index asset version missing');
 for(const asset of ['styles.css','workstation.css','route-state.js','app.js','workstation.js','map-engine.js','route-planner.js','field-intel.js','field-ops.js','field-tools.js'])assert.ok(swText.includes(`${asset}?v=${version}`),`service worker version drift: ${asset}`);
 const request=async(path,mode='same-origin')=>{let promise;handlers.fetch({request:{method:'GET',mode,url:new URL(path,location.href).href},respondWith:p=>promise=p,waitUntil(){}});return await promise};

 assert.equal(await request(`./field-tools.js?v=${version}`),cached);assert.equal(network,0);
 exactShell=false;offline=true;
 assert.equal(await request(`./field-tools.js?v=${version}`),cached,'versioned shell should recover via ignoreSearch cache match');assert.equal(network,1);
 offline=false;
 const page=await request('./','navigate');assert.equal(page.network,true);assert.equal(network,2);
 offline=true;assert.equal(await request('./','navigate'),cached);
 console.log('PASS service worker versions match index; exact and ignoreSearch shell cache paths work; navigation refreshes online and falls back offline');
})().catch(e=>{console.error(e);process.exitCode=1});
