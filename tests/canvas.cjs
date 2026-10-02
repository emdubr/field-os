const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {JSDOM}=require('jsdom');
const dom=new JSDOM('<!doctype html><canvas id="chart" width="720" height="220"></canvas>',{
 url:'https://field.test',runScripts:'outside-only',pretendToBeVisual:true
});
const w=dom.window,canvas=w.document.getElementById('chart'),transforms=[];
Object.defineProperty(w,'devicePixelRatio',{value:2,configurable:true});
canvas.getBoundingClientRect=()=>({width:360,height:110});
const context={setTransform(...a){transforms.push(a)}};
w.eval(fs.readFileSync(path.join(__dirname,'../canvas-utils.js'),'utf8'));
const first=w.FIELD_CANVAS.prepare(canvas,context,'Route graph');
assert.equal(first.w,360);assert.equal(first.h,110);assert.equal(first.dpr,2);
assert.equal(canvas.width,720);assert.equal(canvas.height,220);
assert.deepEqual(transforms.at(-1),[2,0,0,2,0,0]);
assert.equal(canvas.getAttribute('aria-label'),'Route graph');
assert.equal(canvas.getAttribute('role'),'img');
const again=w.FIELD_CANVAS.prepare(canvas,context,'Route graph');
assert.equal(again.w,360,'repeat draws should retain CSS dimensions');
assert.equal(canvas.width,720,'repeat draw must not progressively multiply backing store');
Object.defineProperty(w,'devicePixelRatio',{value:3,configurable:true});
w.FIELD_CANVAS.prepare(canvas,context);
assert.equal(canvas.width,1080);assert.equal(canvas.height,330);
assert.equal(w.document.querySelector('script'),null,'sizing helper has no external network dependencies');
dom.window.close();
console.log('PASS retina canvas backing sizes, stable CSS drawing units, aria labels, and repeat rendering');
