(function(){
  'use strict';
  // No Astra bridge or backend credential enters this isolated author frame.
  let current=null,audioListener=null;
  const localBase=location.href;
  const nativeFetch=window.fetch.bind(window);
  window.fetch=function(input,init){
    // Keep relative same-project fetches working in the opaque sandbox. Its
    // nominal origin is null, so Chromium cannot treat credentials mode
    // 'same-origin' as a usable project identity.
    const options={...init,credentials:'omit'};
    return nativeFetch(typeof input==='string'?new URL(input,localBase).href:input,options);
  };
  function invoke(){
    if(!current)return;
    const listener=window.wallpaperPropertyListener;
    listener?.applyUserProperties?.(current.properties||{});
    listener?.applyGeneralProperties?.({fps:current.fps||30});
    listener?.setPaused?.(false);
  }
  window.wallpaperRegisterAudioListener=function(callback){
    if(typeof callback==='function'){audioListener=callback;window.parent.postMessage({type:'we-audio-subscribe'},'*');}
  };
  // Authors sometimes assign their listener after load, e.g. an async module.
  let propertyListener;
  Object.defineProperty(window,'wallpaperPropertyListener',{configurable:true,get:()=>propertyListener,set:value=>{propertyListener=value;if(current)invoke();}});
  window.addEventListener('message',event=>{
    if(event.source!==window.parent||!event.data||typeof event.data!=='object')return;
    if(event.data.type==='we-properties'){
      current=event.data.payload;invoke();
      document.querySelectorAll('audio,video').forEach(el=>{el.volume=Math.max(0,Math.min(1,current.volume||0));el.muted=!current.volume;});
    }
    if(event.data.type==='we-audio'&&audioListener&&Array.isArray(event.data.bands))audioListener(event.data.bands);
    if(event.data.type==='we-pause')window.wallpaperPropertyListener?.setPaused?.(true);
  });
  window.addEventListener('load',()=>{invoke();window.parent.postMessage({type:'we-ready'},'*');});
})();
