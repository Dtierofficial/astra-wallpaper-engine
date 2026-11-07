'use strict';

// Astra 0.2.7 paints its own wallpaper above background.behind. The front
// contribution is lowered to z=1 through the public bridge: after the native
// wallpaper (also z=1), before the app's content (z=2) and navigation (z=10).
// Remember the host's value, and restore it when our player is not active.
let base = '', timer, video, key = '', busy = false, closed = false;
let stackApplied = false, stackOriginal = null, generation = 0;
let image=null,imageReady=false,webFrame=null,webPlayback=null,webReady=false,webRevision='',audioUnsubscribe=null,language='en',nativeVisible=true;
const text=(key,params)=>WEI18n.t(language,key,params);
const STACK_KEY = 'wallpaper-engine.original-front-z';

async function backend(method, params = {}) {
  if (window.astra) {
    const result = await window.astra.callBackend(method, params);
    return typeof result === 'string' ? JSON.parse(result) : result;
  }
  const response = await fetch(base + 'api/call', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({method, params})
  });
  const result = await response.json();
  if (!response.ok || result.error) throw Error(result.error || 'Нет связи с плагином');
  return result;
}

async function report(phase, message, sourceKey = key) {
  try { await backend('rendererStatus', {phase, message, key: sourceKey}); } catch {}
}

function release() {
  generation++;
  if (video) {
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
    video = null;
  }
  if(image){image.removeAttribute('src');image.remove();image=null;}imageReady=false;
  if(webFrame){webFrame.contentWindow?.postMessage({type:'we-pause'},'*');webFrame.removeAttribute('src');webFrame.remove();webFrame=null;}
  if(typeof audioUnsubscribe==='function')audioUnsubscribe();audioUnsubscribe=null;
  webPlayback=null;webReady=false;webRevision='';
  key = '';
  document.getElementById('dim').style.background = 'transparent';
}

async function placeLayer() {
  if (!window.astra || stackApplied) return;
  const saved = await window.astra.getData(STACK_KEY);
  const variables = await window.astra.getCssVariables();
  stackOriginal = saved || variables['--z-plugin-front'] || '300';
  await window.astra.setData(STACK_KEY, stackOriginal);
  await window.astra.setCssVariable('--z-plugin-front', '1');
  stackApplied = true;
}

async function restoreLayer() {
  if (!window.astra) return;
  const saved = stackOriginal || await window.astra.getData(STACK_KEY);
  if (saved) {
    await window.astra.setCssVariable('--z-plugin-front', saved);
    await window.astra.setData(STACK_KEY, '');
  }
  stackApplied = false;
  stackOriginal = null;
}

async function connect() {
  if (!window.astra && location.hostname === '127.0.0.1') {
    base = new URL('./', location.href).href;
    return;
  }
  if (!window.astra) await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'http://astra-plugin.localhost/bridge/astra-bridge.js';
    script.onload = resolve;
    script.onerror = () => reject(Error(text('bridgeError')));
    document.head.append(script);
  });
  const connection=await backend('connect');base=connection.base;language=connection.language||language;
  if(window.astra?.on)window.astra.on('windowVisibility',status=>{
    nativeVisible=!status.supported||status.visible;
    if(!nativeVisible){const source=key;release();restoreLayer().catch(()=>{});report('paused',text('nativeHidden'),source);}
    else visibility();
  });
}

function updateWeb(){
  if(!webFrame||!webPlayback||!webReady)return;
  const payload={properties:webPlayback.properties,fps:webPlayback.fps,volume:webPlayback.volume};
  const revision=JSON.stringify(payload);
  if(revision!==webRevision){webRevision=revision;webFrame.contentWindow?.postMessage({type:'we-properties',payload},'*');}
}
window.addEventListener('message',event=>{
  if(!webFrame||event.source!==webFrame.contentWindow||!event.data)return;
  if(event.data.type==='we-ready'){webReady=true;updateWeb();report('playing',text('rendererWeb'));}
  if(event.data.type==='we-audio-subscribe'&&!audioUnsubscribe&&window.astra?.requestAudioData){
    audioUnsubscribe=window.astra.requestAudioData(data=>{
      if(!webFrame||document.hidden||closed)return;
      const bands=Array.isArray(data)?data:data?.bands;
      if(!Array.isArray(bands))return;
      // Astra may expose fewer bands than WE; interpolate, duplicate channels.
      const channel=Array.from({length:64},(_,i)=>Math.max(0,Math.min(1,Number(bands[Math.min(bands.length-1,Math.floor(i*bands.length/64))])||0)));
      webFrame.contentWindow?.postMessage({type:'we-audio',bands:[...channel,...channel]},'*');
    });
  }
});

async function update() {
  if (closed || document.hidden || busy || !base) return;
  busy = true;
  try {
    const state = await backend('backgroundState');
    if (closed || document.hidden) return;
    language=state.language||language;
    nativeVisible=!state.window?.supported||state.window.visible;
    if(!nativeVisible){const sourceKey=state.playback?.key||key;release();await restoreLayer();await report('paused',text('nativeHidden'),sourceKey);return;}
    const playback = state.playback;
    if (!playback) {
      release();
      await restoreLayer();
      await report('idle', text('idle'));
      return;
    }
    await placeLayer();
    if (closed || document.hidden || !nativeVisible) { await restoreLayer(); return; }
    if (key !== playback.key) {
      release();
      if(playback.kind==='image'){
        image=document.createElement('img');image.alt='';
        const currentImage=image;
        image.addEventListener('load',()=>{if(image===currentImage){imageReady=true;report('playing',text('rendererImage'));}});
        image.addEventListener('error',()=>{if(image===currentImage)report('error',text('mediaError',{code:'image'}));});
        image.src=playback.url;
        document.body.prepend(image);key=playback.key;
      }else if(playback.kind==='web'){
        if(!playback.url)return;
        webFrame=document.createElement('iframe');webFrame.setAttribute('sandbox','allow-scripts');webFrame.referrerPolicy='no-referrer';webFrame.title='Web wallpaper';
        webFrame.src=playback.url;document.body.prepend(webFrame);key=playback.key;
      }else{
      const player = document.createElement('video');
      const sourceKey = playback.key;
      player.loop = true;
      player.playsInline = true;
      player.preload = 'auto';
      player.addEventListener('error', () => {
        if (video !== player) return;
        report('error', text('mediaError',{code:player.error?.code||'?'}), sourceKey);
      });
      video = player;
      key = sourceKey;
      player.muted = playback.volume === 0;
      player.src = playback.url;
      document.body.prepend(player);
      }
    }
    document.getElementById('dim').style.background = `rgba(0,0,0,${state.dim / 100})`;
    if(image){image.style.objectFit=playback.fit;if(imageReady)await report('playing',text('rendererImage'));return;}
    if(webFrame){webPlayback=playback;updateWeb();if(webReady)await report('playing',text('rendererWeb'));return;}
    const player = video, current = generation;
    player.volume = playback.volume;
    player.muted = playback.volume === 0;
    player.playbackRate = playback.speed;
    player.style.objectFit = playback.fit;
    if (player.paused) {
      try { await player.play(); }
      catch (error) {
        if (video !== player || current !== generation) return;
        if (!player.muted) { player.muted = true; await player.play(); }
        else throw error;
      }
    }
    if (video === player && current === generation && !document.hidden && !closed && nativeVisible) {
      await report('playing', text(player.muted?'rendererMuted':'rendererVideo'));
    }
  } catch (error) {
    const sourceKey = key;
    release();
    await restoreLayer().catch(() => {});
    await report('error', error.message, sourceKey);
  } finally { busy = false; }
}

function visibility() {
  clearInterval(timer);
  if (document.hidden || closed) {
    release();
    restoreLayer().catch(() => {});
    return;
  }
  update();
  timer = setInterval(update, 1500);
}
document.addEventListener('visibilitychange', visibility);
window.addEventListener('pagehide', () => { closed = true; visibility(); });
window.addEventListener('pageshow', () => { closed = false; visibility(); });
connect().then(visibility).catch(error => console.error('[wallpaper-engine background]', error));
