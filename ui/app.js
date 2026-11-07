'use strict';
const $=id=>document.getElementById(id);
// Astra is the source of truth, not the browser/Windows locale. Until its
// handshake completes, show only a neutral English loading screen.
let base='',data=null,selected=null,currentTab='all',toastTimer,language='en',languageTimer;
const t=(key,params)=>WEI18n.t(language,key,params);
function toast(text){$('toast').textContent=text;$('toast').hidden=false;clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').hidden=true,5000);}
function node(tag,cls,text){const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n;}
function localize(){
  document.documentElement.lang=language;
  for(const el of document.querySelectorAll('[data-i18n]'))el.textContent=t(el.dataset.i18n);
  for(const [id,key]of [['language','language'],['search','search'],['type','typeLabel'],['sort','sortLabel'],['size','tileSize'],['grid','installed']])$(id).setAttribute('aria-label',t(key));
  $('search').placeholder=t('search');
  if(data)$('language').value=data.languagePreference;
}
async function connect(){
  if(!window.astra&&location.hostname==='127.0.0.1'){base=new URL('./',location.href).href;return;}
  if(!window.astra)await new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='http://astra-plugin.localhost/bridge/astra-bridge.js';s.onload=resolve;s.onerror=()=>reject(Error(t('previewHint')));document.head.append(s);});
  const result=await window.astra.callBackend('connect',{});const obj=typeof result==='string'?JSON.parse(result):result;base=obj.base;language=obj.language||language;
}
async function call(method,params={}){
  if(window.astra){const result=await window.astra.callBackend(method,params);return typeof result==='string'?JSON.parse(result):result;}
  const res=await fetch(base+'api/call',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({method,params})});
  const out=await res.json();if(!res.ok||out.error)throw Error(out.error||t('networkError'));return out;
}
function render(){
  if(!data)return;
  language=data.language;localize();
  $('count').textContent=data.entries.length;$('connection').textContent='● '+t('connected',{version:data.version});
  const q=$('search').value.toLocaleLowerCase();
  const items=data.entries.filter(e=>(currentTab!=='favorites'||data.favorites.includes(e.key))&&($('type').value==='all'||(e.kind||e.type)===$('type').value)&&(!$('compatible').checked||e.supported)&&`${e.title} ${e.tags.join(' ')}`.toLocaleLowerCase().includes(q));
  items.sort($('sort').value==='date'?(a,b)=>b.modified-a.modified:(a,b)=>a.title.localeCompare(b.title));
  $('results').textContent=t('results',{shown:items.length,total:data.entries.length});$('empty').hidden=items.length>0;
  const fragment=document.createDocumentFragment(),scroll=$('grid').scrollTop;
  for(const e of items){
    const tile=node('button',`tile${selected===e.id?' selected':''}`);tile.setAttribute('role','listitem');tile.setAttribute('aria-label',e.title);tile.dataset.id=e.id;
    if(e.preview){const img=node('img');img.src=e.preview;img.loading='lazy';img.alt='';tile.append(img);}else{const image=node('div');image.style.height='104px';tile.append(image);}
    tile.append(node('span','badge',(e.kind||e.type).toUpperCase()));if(data.favorites.includes(e.key))tile.append(node('span','star','★'));
    tile.append(node('span','caption',e.title));
    const meta=node('span','meta');meta.append(node('span',e.supported?'installed':'unsupported',t(e.kind==='video'?'playableVideo':e.kind==='image'?'playableImage':e.kind==='web'?'playableWeb':'catalogOnly')),node('span','',data.active===e.id?t('active'):'✓ '+t('downloaded')));tile.append(meta);
    tile.onclick=()=>inspect(e.id);fragment.append(tile);
  }
  $('grid').replaceChildren(fragment);$('grid').scrollTop=scroll;$('roots').replaceChildren(...data.roots.map(p=>node('code','',p)));
  $('status').textContent=t('status',{playable:data.entries.filter(e=>e.supported).length,total:data.entries.length})+(data.errors.length?t('errors',{count:data.errors.length}):'');
  $('native-status').textContent=t(!data.window.supported?'nativeUnknown':data.window.visible?'nativeVisible':'nativeHidden');
}
function range(parent,label,min,max,value,step){
  const row=node('label','field'),title=node('span','',label),input=node('input'),out=node('output','',String(value));
  input.type='range';input.min=min;input.max=max;input.step=step;input.value=value;input.setAttribute('aria-label',label);input.oninput=()=>out.value=input.value;row.append(title,input,out);parent.append(row);return input;
}
function safeAction(action){return async()=>{try{await action();}catch(e){toast(e.message);}};}
async function inspect(id,keepInspector=false){
  selected=id;const inspectorScroll=keepInspector?$('inspector').scrollTop:0;
  for(const tile of $('grid').children)tile.classList.toggle('selected',tile.dataset.id===id);
  try{
    const d=await call('details',{id});if(selected!==id)return;
    const frag=document.createDocumentFragment();if(d.preview){const img=node('img','hero');img.src=d.preview;img.alt=d.title;frag.append(img);}
    const box=node('div','details');box.append(node('h1','',d.title),node('div','tags',`${(d.kind||d.type).toUpperCase()} · ${d.tags.join(' · ')} · ${d.rating==='Unknown'?t('ratingUnknown'):d.rating}`));
    let consent;
    if(d.kind==='web'){
      box.append(node('p','warning',t('webWarning')));
      if(!d.trustedWeb){const label=node('label','consent-row');consent=node('input');consent.type='checkbox';label.append(consent,node('span','',t('webConsent')));box.append(label);}
    }
    const row=node('div','apply-row'),apply=node('button','primary',data.active===id?t('applied'):t('apply')),fav=node('button','',data.favorites.includes(d.key)?'★':'☆');
    apply.disabled=!d.supported;
    apply.onclick=safeAction(async()=>{
      if(consent&&!consent.checked)throw Error(t('webConsentRequired'));
      data=await call('apply',{id,trustWeb:consent?.checked===true});render();inspect(id,true);toast(t('selected'));
      const deadline=Date.now()+8000;
      const check=async()=>{try{const s=await call('state');const r=s.renderer;if(s.active!==id)return;if(r?.key===d.key&&r.phase==='playing'&&Date.now()-r.at<6000)toast(t('playing'));else if(r?.phase==='error')toast(r.message);else if(Date.now()<deadline)setTimeout(check,800);else toast(r?.message||t('noRenderer'));}catch(e){toast(e.message);}};
      setTimeout(check,800);
    });
    fav.setAttribute('aria-label',t('favoriteToggle'));fav.onclick=safeAction(async()=>{data=await call('favorite',{id});render();inspect(id,true);});row.append(apply,fav);box.append(row);
    if(!d.supported)box.append(node('p','warning',t('unsupported')));
    if(d.supported){
      box.append(node('h2','section-title',t('playbackTitle')));const cfg={...d.playback,...d.override};
      const volume=d.kind!=='image'?range(box,t('volume'),0,100,Math.round(cfg.volume*100),1):null;
      const speed=d.kind==='video'?range(box,t('speed'),.25,4,cfg.speed,.05):null;
      const fit=node('select');for(const key of ['cover','contain','fill']){const opt=node('option','',t(key));opt.value=key;fit.append(opt);}fit.value=cfg.fit;fit.setAttribute('aria-label',t('fit'));const fitRow=node('label','field',t('fit'));fitRow.append(fit);box.append(fitRow);
      const save=node('button','',t('save'));save.onclick=safeAction(async()=>{data=await call('playback',{id,volume:volume?Number(volume.value)/100:cfg.volume,speed:speed?Number(speed.value):cfg.speed,fit:fit.value});toast(t('saved'));});box.append(save);
      const reset=node('button','',t('reset'));reset.style.marginTop='8px';reset.onclick=safeAction(async()=>{data=await call('resetPlayback',{id});await inspect(id,true);toast(t('propertiesReset'));});box.append(reset);
      const dim=range(box,t('dim'),0,90,data.dim,1);dim.onchange=safeAction(async()=>{data=await call('dim',{value:Number(dim.value)});});
    }
    box.append(node('h2','section-title',t('weSettings')),node('p','muted',`${d.source==='author'?'WE':d.source} · ${d.monitor}${d.kind==='web'?'':' · '+t('readOnly')}`));
    const monitor=node('select');for(const value of new Set([data.monitor,'Monitor0','Monitor1',...d.monitors])){const option=node('option','',value);option.value=value;monitor.append(option);}monitor.value=data.monitor;monitor.setAttribute('aria-label',t('monitor'));monitor.onchange=safeAction(async()=>{data=await call('monitor',{value:monitor.value});inspect(id,true);});box.append(monitor);
    const props=node('div','property-list'),editors={};
    for(const [key,p]of Object.entries(d.properties)){
      const r=node('div','property'),label=key==='schemecolor'?t('schemeColor'):p.text||key;r.append(node('span','',label));
      const value=d.propertyOverrides[key]??p.value;
      if(d.kind==='web'&&['bool','slider','color','textinput','combo'].includes(p.type)){
        const input=node(p.type==='combo'?'select':'input');input.setAttribute('aria-label',label);
        if(p.type==='combo')for(const option of p.options||[]){const n=node('option','',option.label||String(option.value));n.value=String(option.value);input.append(n);}
        else input.type=p.type==='bool'?'checkbox':p.type==='slider'?'number':'text';
        if(p.type==='bool')input.checked=!!value;else input.value=String(value??'');
        if(p.type==='slider'){input.min=p.min??0;input.max=p.max??100;input.step=p.step??1;}
        editors[key]=()=>p.type==='bool'?input.checked:p.type==='slider'?Number(input.value):p.type==='combo'?(p.options||[]).find(o=>String(o.value)===input.value)?.value??input.value:input.value;
        r.append(input);
      }else r.append(node('code','',String(value??'—')));
      props.append(r);
    }
    if(!props.children.length)props.append(node('p','muted',t('noProperties')));box.append(props);
    if(Object.keys(editors).length){const save=node('button','',t('useProperties'));save.onclick=safeAction(async()=>{data=await call('properties',{id,values:Object.fromEntries(Object.entries(editors).map(([key,get])=>[key,get()]))});toast(t('propertiesSaved'));});box.append(save);}
    box.append(node('p','muted',t('propertiesNote')));frag.append(box);$('inspector').replaceChildren(frag);$('inspector').scrollTop=inspectorScroll;
  }catch(e){toast(e.message);}
}
async function refresh(){data=await call('refresh');render();if(selected)await inspect(selected,true);}
for(const id of ['search','type','sort','compatible'])$(id).addEventListener('input',()=>{if(data){$('grid').scrollTop=0;render();}});
$('size').oninput=()=>document.documentElement.style.setProperty('--tile',$('size').value+'px');
for(const b of document.querySelectorAll('[data-tab]'))b.onclick=()=>{currentTab=b.dataset.tab;document.querySelectorAll('[data-tab]').forEach(el=>el.classList.toggle('active',el===b));$('library').hidden=currentTab==='settings';$('settings').hidden=currentTab!=='settings';render();};
$('refresh').onclick=safeAction(refresh);$('rescan').onclick=safeAction(refresh);
$('clear').onclick=safeAction(async()=>{data=await call('clear');render();if(selected)await inspect(selected,true);toast(t('cleared'));});
$('language').onchange=safeAction(async()=>{data=await call('language',{value:$('language').value});render();if(selected)await inspect(selected,true);});
function reveal(){
  document.documentElement.removeAttribute('data-language-loading');
  $('boot-status').hidden=true;
}
connect().then(async()=>{
  data=await call('state');render();reveal();
  languageTimer=setInterval(async()=>{if(document.hidden)return;try{const s=await call('state');if(s.language!==language){data=s;render();if(selected)inspect(selected,true);}else $('native-status').textContent=t(!s.window.supported?'nativeUnknown':s.window.visible?'nativeVisible':'nativeHidden');}catch{}},2500);
}).catch(e=>{localize();reveal();$('connection').textContent=t('noConnection');$('results').textContent=e.message;toast(e.message);});
window.addEventListener('pagehide',()=>clearInterval(languageTimer));
