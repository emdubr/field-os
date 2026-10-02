/* FIELD/OS canvas sizing shared by fallback and native elevation renderers.
 * Drawing coordinates stay in CSS px; backing store scales up for retina screens.
 */
(()=>{
 'use strict';
 if(window.FIELD_CANVAS)return;
 const originals=new WeakMap();
 function prepare(canvas,context,label=''){
  if(!canvas||!context)return null;
  let baseline=originals.get(canvas);
  if(!baseline){
   baseline={w:Math.max(1,Number(canvas.getAttribute('width'))||720),
     h:Math.max(1,Number(canvas.getAttribute('height'))||220)};
   originals.set(canvas,baseline);
  }
  const rect=canvas.getBoundingClientRect?.()||{};
  const cssWidth=Math.max(1,Math.round(Number(rect.width)>4?rect.width:Number(canvas.clientWidth)>4?canvas.clientWidth:baseline.w));
  const cssHeight=Math.max(1,Math.round(Number(rect.height)>4?rect.height:Number(canvas.clientHeight)>4?canvas.clientHeight:baseline.h));
  const dpr=Math.max(1,Math.min(3,Number(window.devicePixelRatio)||1));
  const width=Math.max(1,Math.round(cssWidth*dpr)),height=Math.max(1,Math.round(cssHeight*dpr));
  if(canvas.width!==width)canvas.width=width;
  if(canvas.height!==height)canvas.height=height;
  context.setTransform?.(dpr,0,0,dpr,0,0);
  canvas.dataset.fieldCssWidth=String(cssWidth);
  canvas.dataset.fieldCssHeight=String(cssHeight);
  canvas.setAttribute('role','img');
  if(label)canvas.setAttribute('aria-label',label);
  return {w:cssWidth,h:cssHeight,dpr};
 }
 window.FIELD_CANVAS={prepare};
})();
