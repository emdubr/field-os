'use strict';
const fs=require('node:fs'),vm=require('node:vm'),path=require('node:path'),assert=require('node:assert/strict');
const {JSDOM}=require('jsdom');
(async()=>{
 const html='<div id="offlineFlightStatus"></div><div id="offlineFlightDetails"></div><button id="runOfflineFlightCheck"></button>';
 const dom=new JSDOM(html,{url:'https://field.test/field-os/index.html',
  runScripts:'outside-only',pretendToBeVisual:true});
 try{
  const w=dom.window;
  let points=[{lat:44.47,lon:-73.21},{lat:44.48,lon:-73.22},{lat:44.49,lon:-73.23}];
  w.FIELD_ROUTE_STATE={getPoints:()=>points};
  let worker={id:1};
  Object.defineProperty(w.navigator,'serviceWorker',{configurable:true,value:{get controller(){return worker}}});
  Object.defineProperty(w.navigator,'storage',{configurable:true,value:{persisted:async()=>false}});
  Object.defineProperty(w,'caches',{value:{open:async()=>({match:async()=>({ok:true})})}});
  w.L={};
  w.protomapsL={leafletLayer:()=>({})};
  const header={tileType:1,minLon:-74,minLat:44,maxLon:-73,maxLat:45,minZoom:0,maxZoom:3,centerLon:-73.25,centerLat:44.5};
  w.pmtiles={FileSource:class{},PMTiles:class{
    async getHeader(){return header}
    async getZxy(){return {data:new Uint8Array([0x1a,0x00])}}
  }};
  const file=new w.File([new Uint8Array([1,2,3])],'test-vector.pmtiles');
  w.FIELD_OFFLINE_MAPS={active:async()=>({id:'saved',name:'test-vector.pmtiles',blob:file})};
  vm.runInContext(fs.readFileSync(path.join(__dirname,'..','offline-check.js'),'utf8'),dom.getInternalVMContext());
  const check=w.FIELD_AIRPLANE_CHECK;
  assert.equal(check.archiveHeader(header).ok,true);
  assert.equal(check.archiveHeader({...header,tileType:2}).ok,false,
    'raster PMTiles must not be accepted by the current vector renderer');
  assert.equal(check.archiveHeader({...header,maxLon:-80}).ok,false);
  const result=await check.run();
  assert.equal(result.ready,true,JSON.stringify(result.rows));
  assert.equal(result.samples,3);
  assert.equal(check.isCurrent(),true);
  assert.match(w.document.getElementById('offlineFlightStatus').textContent,/AIRPLANE TEST REQUIRED/);
  points=[...points,{lat:44.6,lon:-73.4}];
  assert.equal(check.isCurrent(),false,'changing the trip route invalidates earlier tile sample verification');
  worker=null;
  const offline=await check.run();
  assert.equal(offline.ready,false,'the presence of stored files does not prove an active service worker');
  assert.match(w.document.getElementById('offlineFlightStatus').textContent,/NOT READY/);
  console.log('PASS archive tile type validation, route tile sampling, route edit invalidation and worker preflight');
 }finally{dom.window.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
