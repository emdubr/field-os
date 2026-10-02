/* FIELD/OS offline GPX geometry worker.
 * Owns only serializable points, performs no network requests or browser DOM work.
 */
function simplifyGPXPoints(points,limit=500){
 if(points.length<=limit)return points;
 const ref=points.reduce((n,p)=>n+p.lat,0)/points.length*Math.PI/180;
 const mx=111320*Math.max(.2,Math.cos(ref)),my=110540;
 const project=p=>({x:p.lon*mx,y:p.lat*my});
 const projected=points.map(project);
 const simplify=tolerance=>{
   const keep=new Set([0,points.length-1]),stack=[[0,points.length-1]],tol2=tolerance*tolerance;
   while(stack.length){
     const [start,end]=stack.pop(),a=projected[start],b=projected[end],dx=b.x-a.x,dy=b.y-a.y,den=dx*dx+dy*dy;
     let best=tol2,choice=-1;
     for(let i=start+1;i<end;i++){
       const p=projected[i],t=den?Math.max(0,Math.min(1,((p.x-a.x)*dx+(p.y-a.y)*dy)/den)):0,
         ex=p.x-(a.x+t*dx),ey=p.y-(a.y+t*dy),dist2=ex*ex+ey*ey;
       if(dist2>best){best=dist2;choice=i}
     }
     if(choice>=0){keep.add(choice);stack.push([start,choice],[choice,end])}
   }
   return [...keep].sort((a,b)=>a-b);
 };
 // Elevation changes alone are not a license to discard a sharp map corner.
 let low=0,high=1,selected=simplify(high);
 while(selected.length>limit&&high<1e7){low=high;high*=2;selected=simplify(high)}
 for(let pass=0;pass<12&&selected.length<=limit;pass++){
   const mid=(low+high)/2,tryIndices=simplify(mid);
   if(tryIndices.length>limit)low=mid;else{high=mid;selected=tryIndices}
 }
 return selected.map(i=>points[i]);
}
self.addEventListener('message',event=>{
 const data=event.data||{},points=data.points,limit=Math.max(2,Math.min(5000,Number(data.limit)||500));
 if(!Array.isArray(points)||points.length<2||points.length>300000){
   self.postMessage({ok:false,error:'Invalid or too-large point array'});return;
 }
 if(points.some(p=>!p||!Number.isFinite(p.lat)||!Number.isFinite(p.lon))){
   self.postMessage({ok:false,error:'Invalid coordinate'});return;
 }
 try{
   const simplified=simplifyGPXPoints(points,limit);
   self.postMessage({ok:true,points:simplified,originalCount:points.length});
 }catch(error){self.postMessage({ok:false,error:String(error?.message||error).slice(0,120)})}
});
