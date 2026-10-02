/* Shared FIELD/OS geolocation authority.
 * One browser GPS watch fans out raw samples to the map and track recorder.
 * Browser watchPosition does not guarantee a sampling frequency.
 */
(()=>{
 'use strict';
 if(window.FIELD_GEO_HUB)return;
 const subscribers=new Map();let id=0,watchId=null,mode='normal',config='';
 const options=()=>{
  const recording=[...subscribers.values()].some(x=>x.role==='track');
  return recording?{enableHighAccuracy:true,maximumAge:1000,timeout:15000}:
    mode==='low'||mode==='emergency'?
      {enableHighAccuracy:false,maximumAge:15000,timeout:30000}:
      {enableHighAccuracy:true,maximumAge:1000,timeout:15000};
 };
 let lastPosition=null;
 function fanout(position){
  lastPosition=position;
  for(const s of subscribers.values())try{s.onPosition(position)}catch(error){console.error('FIELD/OS GPS subscriber',error)}
 }
 function onError(error){
  for(const s of subscribers.values())try{s.onError?.(error)}catch(err){console.error('FIELD/OS GPS error subscriber',err)}
 }
 function reconcile(){
  if(!subscribers.size){
   if(watchId!=null&&navigator.geolocation){navigator.geolocation.clearWatch(watchId);watchId=null;}
   config='';return;
  }
  if(!navigator.geolocation){onError(Error('Geolocation unsupported'));return;}
  const opts=options(),next=JSON.stringify(opts);
  if(watchId!=null&&config===next)return;
  const previous=watchId;watchId=null;
  if(previous!=null)navigator.geolocation.clearWatch(previous);
  config=next;
  try{watchId=navigator.geolocation.watchPosition(fanout,onError,opts)}
  catch(error){watchId=null;onError(error)}
 }
 function subscribe(onPosition,onErrorFn,{role='map'}={}){
  if(typeof onPosition!=='function')throw TypeError('Position callback required');
  const key=++id;subscribers.set(key,{onPosition,onError:onErrorFn,role});
  reconcile();
  return key;
 }
 function unsubscribe(key){subscribers.delete(key);reconcile()}
 function setPowerMode(next){mode=next==='low'||next==='emergency'?next:'normal';reconcile()}
 document.addEventListener('visibilitychange',()=>{
  // Track recording can continue while page is backgrounded on supported devices;
  // browsers (particularly iOS) may still suspend location delivery.
  if(!document.hidden)reconcile();
 },{passive:true});
 window.FIELD_GEO_HUB={subscribe,unsubscribe,setPowerMode,get count(){return subscribers.size},
  get active(){return watchId!=null},get lastPosition(){return lastPosition}};
})();
