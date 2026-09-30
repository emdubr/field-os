const fs=require('node:fs'),vm=require('node:vm'),assert=require('node:assert/strict');
(async()=>{
 const handlers={},cached={shell:true},location={origin:'https://field.test',href:'https://field.test/field-os/sw.js'};let network=0,offline=false;
 const ctx={URL,Promise,self:{location,addEventListener:(name,fn)=>handlers[name]=fn},caches:{open:async()=>({match:async()=>cached}),match:async()=>cached},fetch:async()=>{network++;if(offline)throw Error('Offline');return {ok:false,network:true}}};
 vm.runInNewContext(fs.readFileSync(require('path').resolve(__dirname,'../sw.js'),'utf8'),ctx);
 const request=async path=>{let promise;handlers.fetch({request:{method:'GET',url:new URL(path,location.href).href},respondWith:p=>promise=p,waitUntil(){}});return await promise};
 assert.equal(await request('./field-tools.js?v=3.56'),cached);assert.equal(network,0);
 const page=await request('./');assert.equal(page.network,true);assert.equal(network,1);
 offline=true;assert.equal(await request('./'),cached);
 console.log('PASS versioned shell assets use cache without network; document navigation refreshes online and falls back offline');
})().catch(e=>{console.error(e);process.exitCode=1});
