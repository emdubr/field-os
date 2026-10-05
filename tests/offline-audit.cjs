'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=fs.readFileSync(path.join(root,'field-tools.js'),'utf8');
(async()=>{
  const dom=new JSDOM(html,{url:'https://field.test/field-os/index.html',
    runScripts:'outside-only',pretendToBeVisual:true});
  try{
    const w=dom.window,current='https://field.test/field-os/app.js?v=3.85-offvendor1';
    const backup='https://unpkg.com/pmtiles@4.5.0/dist/pmtiles.js',
      primary='https://cdn.jsdelivr.net/npm/pmtiles@4.5.0/dist/pmtiles.js';
    const available=new Set([current,backup]);
    const cache={match:async url=>available.has(typeof url==='string'?url:url?.url)?{ok:true}:null,keys:async()=>[current,backup]};
    Object.defineProperty(w,'caches',{configurable:true,value:{
      keys:async()=>['field-os-v3-85-offvendor1'],open:async()=>cache
    }});
    let controller={id:'active'};
    Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{
      get controller(){return controller},
      getRegistration:async()=>({scope:'https://field.test/field-os/'})
    }});
    vm.runInContext(code,dom.getInternalVMContext(),{filename:'field-tools.js'});
    assert.ok(w.FIELD_BROWSER_RESILIENCE,'resilience checks must be available on browser startup');
    const audit=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
    assert.equal(audit.verified,true,'current worker plus current app shell can be verified');
    assert.ok(audit.backupLibraries.includes(primary),
      'pinned backup library satisfies primary vendor readiness');
    assert.ok(!audit.externalMissing.includes(primary),
      'offline audit must not mislabel usable backup as a missing map library');
    controller=null;
    const inactive=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
    assert.equal(inactive.verified,false,
      'cached files alone do not establish offline readiness without a controlling worker');
    assert.match(w.document.getElementById('browserCacheHealth').textContent,/NOT CONTROLLING/);
    console.log('PASS backup CDN audit and unverified status without controlling service worker');
  }finally{dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
