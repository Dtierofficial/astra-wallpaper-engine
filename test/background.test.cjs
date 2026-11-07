const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
test('background releases media when hidden and restores on visibility',async()=>{
  const events={},windowEvents={};let removed=0,paused=0,loads=0,created=0;
  const document={hidden:false,head:{append(){}},body:{prepend(){}},getElementById:()=>({style:{}}),addEventListener:(n,fn)=>events[n]=fn,
    createElement:()=>{created++;return {style:{},paused:true,addEventListener(){},pause(){paused++;},removeAttribute(){},load(){loads++;},remove(){removed++;},play(){this.paused=false;return Promise.resolve();}};}};
  const context=vm.createContext({document,location:{hostname:'127.0.0.1',href:'http://127.0.0.1/token/background.html'},window:{addEventListener:(n,f)=>windowEvents[n]=f},URL,console,
    setInterval:()=>1,clearInterval(){},fetch:async()=>({ok:true,json:async()=>({dim:30,playback:{key:'abc',url:'http://127.0.0.1/video',volume:0,speed:1,fit:'cover'}})})});
  vm.runInContext(fs.readFileSync('ui/i18n.js','utf8'),context);
  context.WEI18n=context.window.WEI18n;
  vm.runInContext(fs.readFileSync('ui/background.js','utf8'),context);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));await flush();assert.equal(created,1);
  document.hidden=true;events.visibilitychange();assert.equal(removed,1);assert.equal(paused,1);assert.equal(loads,1);
  document.hidden=false;events.visibilitychange();await flush();assert.equal(created,2);
  windowEvents.pagehide();assert.equal(removed,2);
});

test('Astra layer is placed below controls and restored on clear, hide and restart',async()=>{
  const events={},windowEvents={},videos=[],store={},variables={'--z-plugin-front':'300'},statuses=[],bridgeEvents={};
  let playback={key:'fixture',url:'http://127.0.0.1/test.webm',volume:0,speed:1,fit:'cover'},nativeVisible=true;
  let tick;
  const document={hidden:false,head:{append(){}},body:{prepend(){}},getElementById:()=>({style:{}}),addEventListener:(name,fn)=>events[name]=fn,
    createElement:()=>{const player={style:{},paused:true,addEventListener(){},pause(){this.paused=true;},removeAttribute(){},load(){},remove(){this.removed=true;},play(){this.paused=false;return Promise.resolve();}};videos.push(player);return player;}};
  const astra={
    callBackend:async(method,params)=>{
      if(method==='connect')return {base:'http://127.0.0.1/token/'};
      if(method==='backgroundState')return {playback,dim:35,window:{supported:true,visible:nativeVisible}};
      if(method==='rendererStatus'){statuses.push(params);return {ok:true};}
      throw Error(method);
    },
    getData:async key=>store[key]||'',setData:async(key,value)=>{store[key]=value;},
    on:(name,fn)=>{bridgeEvents[name]=fn;},
    getCssVariables:async()=>({...variables}),setCssVariable:async(key,value)=>{variables[key]=value;}
  };
  const context=vm.createContext({document,location:{hostname:'astra-plugin.localhost'},window:{astra,addEventListener:(name,fn)=>windowEvents[name]=fn},console,
    setInterval:fn=>{tick=fn;return 1;},clearInterval(){}});
  vm.runInContext(fs.readFileSync('ui/i18n.js','utf8'),context);
  context.WEI18n=context.window.WEI18n;
  vm.runInContext(fs.readFileSync('ui/background.js','utf8'),context);
  const flush=()=>new Promise(resolve=>setImmediate(resolve));
  await flush();assert.equal(variables['--z-plugin-front'],'1');assert.equal(statuses.at(-1).phase,'playing');
  document.hidden=true;events.visibilitychange();await flush();assert.equal(videos[0].removed,true);assert.equal(variables['--z-plugin-front'],'300');
  document.hidden=false;events.visibilitychange();await flush();assert.equal(videos.length,2);assert.equal(variables['--z-plugin-front'],'1');
  nativeVisible=false;await tick();assert.equal(videos[1].removed,true);assert.equal(statuses.at(-1).phase,'paused');assert.equal(variables['--z-plugin-front'],'300');
  nativeVisible=true;await tick();assert.equal(videos.length,3);assert.equal(statuses.at(-1).phase,'playing');
  bridgeEvents.windowVisibility({supported:true,visible:false});assert.equal(videos[2].removed,true);await flush();assert.equal(variables['--z-plugin-front'],'300');
  bridgeEvents.windowVisibility({supported:true,visible:true});await flush();assert.equal(videos.length,4);
  playback=null;await tick();assert.equal(variables['--z-plugin-front'],'300');assert.equal(videos[3].removed,true);assert.equal(statuses.at(-1).phase,'idle');
  windowEvents.pagehide();await flush();assert.equal(variables['--z-plugin-front'],'300');
});
