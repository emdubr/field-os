'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
const root=path.resolve(__dirname,'..'),html=fs.readFileSync(path.join(root,'index.html'),'utf8');
const code=fs.readFileSync(path.join(root,'field-tools.js'),'utf8');
(async()=>{
 const dom=new JSDOM(html,{url:'https://field.test/field-os/index.html',
   runScripts:'outside-only',pretendToBeVisual:true});
 try{
  const w=dom.window,missing=new Set();
  let controlled={id:'current'};
  const match=async url=>{
   const href=typeof url==='string'?new URL(url,w.location.href).href:url?.url;
   return href?.startsWith('https://field.test/field-os/')&&!missing.has(href)?{ok:true}:null;
  };
  const cache={match,keys:async()=>['app shell']};
  Object.defineProperty(w,'caches',{configurable:true,value:{
   keys:async()=>['field-os-v3-85-airplane1'],open:async()=>cache
  }});
  Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{
   get controller(){return controlled},getRegistration:async()=>({scope:'https://field.test/field-os/'})
  }});
  vm.runInContext(code,dom.getInternalVMContext(),{filename:'field-tools.js'});
  let audit=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
  assert.equal(audit.verified,true);
  assert.equal(audit.missing.length,0,'all first-party core and vendor libraries cached');
  assert.equal(audit.externalMissing.length,0,'optional CDN aliases are no longer offline prerequisites');
  const local='https://field.test/field-os/vendor/pmtiles/pmtiles.js';
  missing.add(local);
  audit=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
  assert.equal(audit.verified,true,'worker may be current despite one missing vendor file');
  assert.ok(audit.missing.includes(local),'missing local PMTiles renderer must be reported');
  assert.match(w.document.getElementById('browserCacheHealth').textContent,/INCOMPLETE/);
  missing.clear();controlled=null;
  audit=await w.FIELD_BROWSER_RESILIENCE.cacheHealth();
  assert.equal(audit.verified,false,'a cached file alone is not verified without SW control');
  assert.match(w.document.getElementById('browserCacheHealth').textContent,/NOT CONTROLLING/);
  console.log('PASS first-party airplane vendor audit, missing local renderer and uncontrolled-worker safety');
 }finally{dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
