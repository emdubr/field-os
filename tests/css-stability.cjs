'use strict';
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=file=>fs.readFileSync(path.join(root,file),'utf8');
const css=read('styles.css'),ws=read('workstation.css'),app=read('app.js'),html=read('index.html'),sw=read('sw.js');
const desktopLandscape=css.match(/@media\(orientation:landscape\) and \(max-height:600px\) and \(min-width:1001px\)\{/g)||[];
assert.ok(desktopLandscape.length>=5,'desktop-only 1500px rules never apply to landscape phones');
assert.match(css, /@media \(orientation:portrait\) and \(max-width:600px\), \(orientation:landscape\) and \(max-width:1000px\) and \(max-height:600px\)/);
assert.match(ws, /@media\(max-width:767px\), \(orientation:landscape\) and \(max-width:1000px\) and \(max-height:600px\)/);
assert.doesNotMatch(css,/html,body\{max-width:100%;overflow-x:hidden\}/,'the document must not trap sticky top bars');
assert.match(css, /html,body\{max-width:100%;overflow-x:clip\}/);
assert.match(css,/color-scheme:dark;-webkit-text-size-adjust:100%;text-size-adjust:100%/);
assert.match(css,/\.sos-ring\{border-color:var\(--danger\)!important/);
assert.match(css,/\.terminal-input,\.terminal-area,select,input,textarea\{border-radius:0!important;background:var\(--panel2\)!important;border-color:var\(--line\)!important\}/);
assert.match(css,/body\[data-theme\] \.handheld-status button/);
assert.match(css,/\.handheld-actions button\{font-size:11px!important;min-height:44px!important\}/);
assert.match(css,/\.tab-sheet-head\{position:sticky;top:0;z-index:3\}/);
assert.match(css,/body:has\(#fieldActionNotice:not\(:empty\)\) \.field-update-notice/);
assert.match(css,/#home \.detail-console::after\{content:none!important\}/);
for(const [f,text] of [['index.html',html],['sw.js',sw]])for(const asset of ['app.js'])
 assert.ok(text.includes(asset+'?v=3.85-trailcache1'),f+' not cache-busting '+asset);
assert.match(app,/FIELD_APP_BUILD='3.85-trailcache1'/);
assert.match(app,/FIELD_EXPECTED_CACHE='field-os-v3-85-trailcache1'/);
assert.match(sw,/const CACHE='field-os-v3-85-trailcache1'/);
assert.match(sw,/plwheel\|cssfix/,'worker must clean up older disposable shells');
console.log('PASS CSS landscape guard, theme, SOS, sticky layout, readability, notice and PWA version invariants');

for(const local of ['vendor/leaflet/leaflet.css','vendor/leaflet/leaflet.js',
 'vendor/pmtiles/pmtiles.js','vendor/protomaps-leaflet/protomaps-leaflet.js']){
 assert.ok(sw.includes('./'+local),'service worker must include first-party '+local);
}
assert.match(html,/id="runOfflineFlightCheck"/);
assert.ok(html.includes('offline-check.js?v=3.85-trailcache1'));
assert.ok(sw.includes("'./offline-check.js?v=3.85-trailcache1'"));
