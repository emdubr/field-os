'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const files=[
 ['vendor/leaflet/leaflet.js',75000],
 ['vendor/leaflet/leaflet.css',7500],
 ['vendor/pmtiles/pmtiles.js',25000],
 ['vendor/protomaps-leaflet/protomaps-leaflet.js',40000],
 ['vendor/leaflet/images/marker-icon.png',100]
];
for(const [name,minimum] of files){
 const size=fs.statSync(path.join(root,name)).size;
 assert.ok(size>minimum,name+' must contain official local map-library bytes, not a placeholder: '+size);
}
const licenses=fs.readFileSync(path.join(root,'vendor/LICENSES.md'),'utf8');
for(const name of ['leaflet@1.9.4','pmtiles@4.5.0','protomaps-leaflet@5.1.0'])
 assert.ok(licenses.includes(name),'license notice must record pinned source: '+name);
const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),
 sw=fs.readFileSync(path.join(root,'sw.js'),'utf8'),
 app=fs.readFileSync(path.join(root,'app.js'),'utf8');
assert.match(html,/href="vendor\/leaflet\/leaflet.css"/);
assert.match(html,/src="vendor\/leaflet\/leaflet.js"/);
assert.doesNotMatch(html,/<script[^>]+src="https?:\/\//);
for(const name of files.slice(0,4).map(([name])=>name)){
 assert.ok(sw.includes("'./"+name+"'"),'offline worker must precache '+name);
}
assert.ok(app.includes("'./vendor/pmtiles/pmtiles.js'"));
assert.ok(app.includes("'./vendor/protomaps-leaflet/protomaps-leaflet.js'"));
console.log('PASS pinned first-party map runtime bytes, licenses and entirely local first-launch script links');
