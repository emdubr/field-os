/* Mapped junctions and conservative trail-name continuity. No network calls. */
(() => {
  'use strict';
  const valid=p=>p&&p.lat!=null&&p.lon!=null&&p.lat!==''&&p.lon!==''&&Number.isFinite(+p.lat)&&Number.isFinite(+p.lon)&&Math.abs(+p.lat)<=90&&Math.abs(+p.lon)<=180;
  const rad=n=>n*Math.PI/180;
  const meters=(a,b)=>{const h=Math.sin(rad(b.lat-a.lat)/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(rad(b.lon-a.lon)/2)**2;return 12742000*Math.asin(Math.min(1,Math.sqrt(h)))};
  const bearing=(a,b)=>(Math.atan2(Math.sin(rad(b.lon-a.lon))*Math.cos(rad(b.lat)),Math.cos(rad(a.lat))*Math.sin(rad(b.lat))-Math.sin(rad(a.lat))*Math.cos(rad(b.lat))*Math.cos(rad(b.lon-a.lon)))*180/Math.PI+360)%360;
  const cleanName=s=>String(s||'').trim().replace(/\s+/g,' ');
  const nameKey=s=>cleanName(s).toLocaleLowerCase();
  const label=s=>cleanName(s?.name)||cleanName(s?.ref)||(!/^UNNAMED\b/i.test(s?.label||'')?cleanName(s?.label):'');
  function continuity(sections=[]){
    const input=(Array.isArray(sections)?sections:[]).filter(s=>s&&Number.isFinite(+s.distanceM)&&+s.distanceM>0);
    const groups=[];let startM=0;
    for(let i=0;i<input.length;i++){
      const section=input[i],distanceM=+section.distanceM,name=label(section),last=groups.at(-1);
      // Retain every connector as its own row unless the same named trail resumes immediately.
      const nextName=label(input[i+1]);
      const inferred=!name&&distanceM<=50&&last?.name&&nextName&&nameKey(last.name)===nameKey(nextName);
      if(last&&((name&&nameKey(name)===nameKey(last.name))||inferred)){
        last.distanceM+=distanceM;last.endM+=distanceM;last.sectionCount++;if(inferred)last.connectorM+=distanceM;
      }else groups.push({name:name||null,label:name||'Unnamed mapped segment',startM,endM:startM+distanceM,distanceM,connectorM:0,sectionCount:1});
      startM+=distanceM;
    }
    return groups;
  }
  function junctionsForPath(graph,path=[],edgeTags=[]){
    let distanceM=0;const out=[];
    for(let i=0;i<path.length;i++){
      const point=path[i];if(i)distanceM+=meters(path[i-1],point);
      const unique=new Map((graph.adj.get(point.id)||[]).map(e=>[e.to,e]));
      if(unique.size<3)continue;
      const previous=path[i-1]?.id,next=path[i+1]?.id;
      const branches=[...unique.values()].map(e=>({nodeId:e.to,name:label(e.tags)||'Unnamed mapped branch',bearing:bearing(point,graph.nodes.get(e.to))}));
      const alternatives=branches.filter(e=>e.nodeId!==previous&&e.nodeId!==next);
      if(!alternatives.length)continue;
      out.push({id:String(point.id),lat:+point.lat,lon:+point.lon,distanceM,degree:unique.size,previousId:previous??null,nextId:next??null,branches,
        incoming:label(edgeTags[i-1])||null,outgoing:label(edgeTags[i])||null,
        incomingBearing:i?bearing(point,path[i-1]):null,outgoingBearing:path[i+1]?bearing(point,path[i+1]):null,alternatives});
    }
    return out;
  }
  const length=points=>(Array.isArray(points)?points:[]).reduce((sum,p,i,a)=>i&&valid(p)&&valid(a[i-1])?sum+meters(a[i-1],p):sum,0);
  function combine(legs=[]){let offset=0;const out=[];for(const leg of legs){for(const j of leg.result?.junctions||[]){const item={...j,distanceM:offset+j.distanceM},last=out.at(-1);if(last&&last.id===item.id&&Math.abs(last.distanceM-item.distanceM)<1){last.nextId=item.nextId;last.outgoing=item.outgoing;last.outgoingBearing=item.outgoingBearing;last.alternatives=(last.branches||[]).filter(b=>b.nodeId!==last.previousId&&b.nodeId!==last.nextId)}else out.push(item)}offset+=length(leg.result?.points)}return out}
  function reverseJunctions(junctions=[],total=0){return junctions.map(j=>({...j,distanceM:Math.max(0,total-j.distanceM),incoming:j.outgoing,outgoing:j.incoming,previousId:j.nextId,nextId:j.previousId,incomingBearing:j.outgoingBearing,outgoingBearing:j.incomingBearing})).sort((a,b)=>a.distanceM-b.distanceM)}
  function reverseLeg(result){const points=[...(result.points||[])].reverse();return {...result,points,trailSections:[...(result.trailSections||[])].reverse(),junctions:reverseJunctions(result.junctions||[],length(points)),startSnap:result.endSnap,endSnap:result.startSnap}}
  let projectionCache=new WeakMap();
  function routeSegments(points){
    const cached=projectionCache.get(points);if(cached)return cached;
    const out=[];let distanceM=0;
    for(let i=1;i<points.length;i++){
      const a=points[i-1],b=points[i];if(!valid(a)||!valid(b))continue;
      const dLat=b.lat-a.lat,dLon=b.lon-a.lon,segmentM=meters(a,b);
      out.push({a,dLat,dLon,distanceM,segmentM});distanceM+=segmentM;
    }
    projectionCache.set(points,out);return out;
  }
  function project(points,position){
    if(!valid(position)||!Array.isArray(points)||points.length<2)return null;
    let best={offsetM:Infinity,progressM:0};
    const scale=Math.cos(rad(position.lat));
    for(const s of routeSegments(points)){
      const x=s.dLon*scale,y=s.dLat,dx=(position.lon-s.a.lon)*scale,dy=position.lat-s.a.lat;
      const t=Math.max(0,Math.min(1,(dx*x+dy*y)/(x*x+y*y||1)));
      const offsetM=meters(position,{lat:s.a.lat+t*s.dLat,lon:s.a.lon+t*s.dLon});
      if(offsetM<best.offsetM)best={offsetM,progressM:s.distanceM+t*s.segmentM};
    }
    return best;
  }
  function next(plan={},position){
    const projection=project(plan.points||[],position);if(!projection)return null;
    const j=(Array.isArray(plan.junctions)?plan.junctions:[]).find(j=>j.distanceM>=projection.progressM-15);
    return j?{...j,distanceToM:Math.max(0,j.distanceM-projection.progressM),offsetM:projection.offsetM,near:projection.offsetM<=75&&j.distanceM-projection.progressM<=100}:null;
  }
  const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const text=(id,value)=>{const el=document.getElementById(id);if(el&&el.textContent!==value)el.textContent=value};
  function isLivePosition(p,now=Date.now()){const age=now-Number(p?.timestamp);return valid(p)&&p.timestamp!=null&&age>=0&&age<=120000&&!/DEMO|FALLBACK|LAST|ESTIMAT/i.test(p.source||'')&&!!p.source&&!(Number.isFinite(p.accuracy)&&p.accuracy>100)}
  let routeInfo=null;
  function invalidateRoute(){routeInfo=null;projectionCache=new WeakMap()}
  function render(){
    const plan=window.FIELD_ROUTE_STATE?.getPlan?.()||{},raw=window.FIELD_ROUTE_STATE?.current?.(),live=isLivePosition(raw);
    const key=[plan.updatedAt||'',plan.points?.length||0,plan.trailSections?.length||0,plan.junctions?.length||0].join('|');
    if(!routeInfo||routeInfo.key!==key){
      const groups=continuity(plan.trailSections),junctions=Array.isArray(plan.junctions)?plan.junctions:[];
      routeInfo={key,groups,junctions,points:Array.isArray(plan.points)?plan.points:[],hasTopology:Array.isArray(plan.junctions),rowsEl:null,listEl:null,
        continuityHtml:groups.length?groups.map(g=>`<div class="guidance-row"><b>${esc(g.label)}</b><span>${(g.startM/1609.344).toFixed(2)}–${(g.endM/1609.344).toFixed(2)} mi</span>${g.connectorM?`<small>Includes ${Math.round(g.connectorM)} m of unnamed connectors between matching named sections.</small>`:''}</div>`).join(''):'<p class="muted">Trail names appear after a snapped route is built. Direct and imported geometry may have no names.</p>',
        junctionHtml:junctions.slice(0,50).map(j=>`<div class="guidance-row"><b>${(j.distanceM/1609.344).toFixed(2)} mi · ${j.degree}-way junction</b><span>${j.nextId==null?'Arrive at route end':'Follow '+esc(j.outgoing||'plotted route')}</span><small>Other mapped branches: ${(j.alternatives||[]).map(a=>esc(a.name)).join(', ')}</small></div>`).join('')};
    }
    const {groups,junctions}=routeInfo,rows=document.getElementById('trailContinuityRows'),list=document.getElementById('junctionRows');
    if(rows&&routeInfo.rowsEl!==rows){rows.innerHTML=routeInfo.continuityHtml;routeInfo.rowsEl=rows}
    if(list&&routeInfo.listEl!==list){list.innerHTML=routeInfo.junctionHtml;routeInfo.listEl=list}
    const cue=live?next({points:routeInfo.points,junctions},raw):null;
    text('junctionState',!routeInfo.hasTopology?'NO TOPOLOGY DATA':!live?'ROUTE PREVIEW':cue?.near?'JUNCTION AHEAD':cue?'NEXT MAPPED JUNCTION':'NO FURTHER MAPPED JUNCTIONS');
    text('junctionInstruction',cue?`${cue.nextId==null?'Arrive at route end':'Follow '+(cue.outgoing||'the plotted route')} — ${Math.round(cue.distanceToM)} m along route`:`${junctions.length} mapped junction${junctions.length===1?'':'s'} on this route`);
    text('junctionDetail',cue?`${cue.degree} mapped branches. ${cue.offsetM>75?'Position is away from the route; along-route distance is only a reference.':'Check signs and the route line before choosing a branch.'}`:'Proximity guidance needs a recent live position with usable accuracy. Mapped topology can be incomplete.');
    document.getElementById('junctionPanel')?.classList.toggle('junction-near',!!cue?.near);
    return {groups,junctions,cue};
  }
  window.FIELD_GUIDANCE={isLivePosition,continuity,junctionsForPath,combine,reverseJunctions,reverseLeg,length,project,next,render};
  let pending=false;
  function schedule(){if(pending||document.hidden||!document.querySelector('#nav.active,#route.active'))return;pending=true;requestAnimationFrame(()=>{pending=false;render()})}
  for(const event of ['fieldos:routechange','fieldos:routemetadatachange'])document.addEventListener(event,()=>{invalidateRoute();schedule()});
  document.addEventListener('fieldos:positionchange',schedule);
  document.addEventListener('fieldos:viewchange',e=>{if(['nav','route'].includes(e.detail?.view))render()});
  window.FIELD_RUNTIME?.every(()=>{if(document.querySelector('#nav.active'))schedule()},5000);
  schedule();
})();
