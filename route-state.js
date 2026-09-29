(() => {
  'use strict';

  // FIELD/OS route state bootstrap.
  // This is intentionally independent from app.js so the route planner remains
  // usable even if another FIELD/OS module fails during startup.
  const KEY='fieldos-v12-routePlan';
  const POS_KEY='fieldos-v12-last-position';
  const DEFAULT_POS={lat:44.4759,lon:-73.2121,alt:null,source:'FALLBACK POSITION'};

  const valid=p=>p&&Number.isFinite(Number(p.lat))&&Number.isFinite(Number(p.lon))&&Math.abs(Number(p.lat))<=90&&Math.abs(Number(p.lon))<=180;
  const cleanPoints=list=>(Array.isArray(list)?list:[]).filter(valid).map(p=>({lat:Number(p.lat),lon:Number(p.lon)}));

  function read(key,fallback){
    try{
      const raw=localStorage.getItem(key);
      if(raw==null)return fallback;
      const value=JSON.parse(raw);
      return value??fallback;
    }catch(err){
      console.warn('FIELD/OS route bootstrap read failed',err);
      return fallback;
    }
  }
  function write(key,value){
    try{
      localStorage.setItem(key,JSON.stringify(value));
      return true;
    }catch(err){
      console.warn('FIELD/OS route bootstrap write failed',err);
      return false;
    }
  }

  let plan=read(KEY,{});
  if(!plan||typeof plan!=='object'||Array.isArray(plan))plan={};
  plan={name:'FIELD ROUTE 01',points:[],gain:0,grade:0,terrain:'maintained',notes:'',...plan};
  plan.points=cleanPoints(plan.points);

  function persist(){
    write(KEY,plan);
    document.dispatchEvent(new CustomEvent('fieldos:routebootstrapchange',{detail:{points:plan.points.length}}));
  }

  const bridge={
    __bootstrap:true,
    getPoints(){
      return cleanPoints(plan.points);
    },
    setPoints(points=[]){
      plan={...plan,points:cleanPoints(points),updatedAt:new Date().toISOString()};
      persist();
      document.dispatchEvent(new CustomEvent('fieldos:routechange',{detail:{points:this.getPoints()}}));
    },
    getPlan(){
      return {
        ...plan,
        points:cleanPoints(plan.points),
        anchors:cleanPoints(plan.anchors)
      };
    },
    setMeta(meta={}){
      if(!meta||typeof meta!=='object'||Array.isArray(meta))return;
      plan={
        ...plan,
        ...meta,
        points:cleanPoints(meta.points??plan.points),
        anchors:cleanPoints(meta.anchors??plan.anchors),
        updatedAt:new Date().toISOString()
      };
      persist();
    },
    save(){
      plan={...plan,savedAt:new Date().toISOString()};
      persist();
      return this.getPlan();
    },
    current(){
      const live=window.FIELD_CURRENT_POSITION;
      if(valid(live))return {lat:Number(live.lat),lon:Number(live.lon),alt:live.alt??null,source:live.source||'FIELD POSITION'};
      const saved=read(POS_KEY,null);
      if(valid(saved))return {lat:Number(saved.lat),lon:Number(saved.lon),alt:saved.alt??null,source:saved.source||'LAST POSITION'};
      return {...DEFAULT_POS};
    },
    syncFromApp(nextPlan={}){
      if(!nextPlan||typeof nextPlan!=='object'||Array.isArray(nextPlan))return;
      plan={...plan,...nextPlan,points:cleanPoints(nextPlan.points??plan.points),anchors:cleanPoints(nextPlan.anchors??plan.anchors)};
      persist();
    }
  };

  if(!window.FIELD_ROUTE_STATE)window.FIELD_ROUTE_STATE=bridge;
  window.FIELD_ROUTE_BOOTSTRAP=bridge;
  document.dispatchEvent(new CustomEvent('fieldos:routestate-ready',{detail:{source:'bootstrap'}}));
})();
