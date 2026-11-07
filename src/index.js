const fs = require('node:fs');
const path = require('node:path');
const {plugin} = require('astra-plugin-sdk');
const {discover,scan,settings,json} = require('./library');
const {startServer} = require('./server');
const {startWebServer}=require('./web-server');
const {startWindowMonitor}=require('./window-monitor');
const i18n=require('../ui/i18n');
const VERSION=require('../package.json').version;
const ROOT = path.resolve(__dirname,'..');
const os=require('node:os');
const dataDir=process.platform==='win32'?path.join(process.env.LOCALAPPDATA||os.homedir(),'AstraWallpaperEngine'):path.join(process.env.XDG_STATE_HOME||path.join(os.homedir(),'.local/state'),'astra-wallpaper-engine');
const stateFile = path.join(process.env.ASTRA_WE_DATA_DIR || dataDir,'settings.json');
let prefs = {active:null, favorites:[], overrides:{}, properties:{},trustedWeb:[],language:'auto', monitor:'Monitor0', dim:35};
try {prefs = {...prefs,...json(stateFile)};} catch {}
let locations = discover(), library = scan(locations), transport;
let astraLanguage='en',monitorService=null,webService=null,webKey=null,webStarting=null;
const language=()=>prefs.language==='auto'?i18n.normalize(astraLanguage):i18n.normalize(prefs.language);
const text=(key,params)=>i18n.t(language(),key,params);
function fail(key){throw Error(text(key));}
let rendererStatus={phase:'waiting',message:i18n.t('en','noRenderer'),at:0};
let lastDiagnostic='';
function writeRendererDiagnostic(status) {
  const signature=JSON.stringify({phase:status.phase,message:status.message,key:status.key});
  if(signature===lastDiagnostic)return;
  try {
    fs.mkdirSync(path.dirname(stateFile),{recursive:true});
    fs.writeFileSync(path.join(path.dirname(stateFile),'renderer-status.json'),JSON.stringify({version:VERSION,...status},null,2));
    lastDiagnostic=signature;
  } catch {}
}
function persist() {fs.mkdirSync(path.dirname(stateFile),{recursive:true});const temp=stateFile+'.tmp';fs.writeFileSync(temp,JSON.stringify(prefs,null,2));fs.renameSync(temp,stateFile);}
function entry(id) {return library.entries.find(e=>e.id===id);}
function publicEntry(e) {return {id:e.id,key:e.folder,title:e.title,type:e.type,kind:e.kind,tags:e.tags,rating:e.rating,supported:e.supported,modified:e.modified,
  preview:e.preview ? `${transport.base}media/${e.id}/preview` : null};}
function playbackState(){
  const active=library.entries.find(e=>e.folder===prefs.active);
  if(!active?.supported)return null;
  const imported=settings(locations.engine,active,prefs.monitor);
  const properties=structuredClone(imported.properties);
  for(const [key,value] of Object.entries(prefs.properties[active.folder]||{}))if(properties[key])properties[key].value=value;
  return {...imported.playback,...prefs.overrides[active.folder],kind:active.kind,
    url:active.kind==='web'?(webKey===active.folder?webService?.url:null):`${transport.base}media/${active.id}/${active.kind==='image'?'image':'video'}`,
    properties,propertyRevision:JSON.stringify(prefs.properties[active.folder]||{}),fps:imported.fps,key:active.folder};
}
function state() {
  const active = library.entries.find(e=>e.folder===prefs.active);
  return {entries:library.entries.map(publicEntry),favorites:prefs.favorites,active:active?.id || null,dim:prefs.dim,
    roots:locations.roots,errors:library.errors,monitor:prefs.monitor,renderer:rendererStatus,language:language(),languagePreference:prefs.language,version:VERSION,
    window:monitorService?.state()||{supported:false,visible:true},playback:playbackState()};
}
async function ensureWeb(){
  if(webStarting){await webStarting;return ensureWeb();}
  const active=library.entries.find(e=>e.folder===prefs.active);
  if(active?.kind!=='web'||!prefs.trustedWeb.includes(active.folder)){webService?.close();webService=null;webKey=null;return;}
  if(webKey===active.folder&&webService)return;
  webService?.close();webService=null;webKey=null;
  webStarting=startWebServer(active,fs.readFileSync(path.join(ROOT,'ui/web-compat.js'),'utf8'));
  try{webService=await webStarting;webKey=active.folder;}finally{webStarting=null;}
  if(prefs.active!==active.folder){webService.close();webService=null;webKey=null;}
}
async function call(method,p = {}) {
  if(!p || typeof p !== 'object' || Array.isArray(p)) fail('badParams');
  if(method==='backgroundState') {await ensureWeb();return {playback:playbackState(),dim:prefs.dim,language:language(),window:monitorService?.state()||{supported:false,visible:true}};}
  if(method==='rendererStatus') {if(!['idle','playing','paused','error'].includes(p.phase))fail('badRenderer');rendererStatus={phase:p.phase,message:String(p.message || '').slice(0,250),key:String(p.key || '').slice(0,1024),at:Date.now()};writeRendererDiagnostic(rendererStatus);return {ok:true};}
  if (method==='state') return state();
  if (method==='refresh') {library=scan(locations);return state();}
  if (method==='details') {const e=entry(p.id);if(!e)fail('notFound');return {...publicEntry(e),...settings(locations.engine,e,prefs.monitor),override:prefs.overrides[e.folder] || {},propertyOverrides:prefs.properties[e.folder]||{},trustedWeb:prefs.trustedWeb.includes(e.folder)};}
  if (method==='apply') {const e=entry(p.id);if(!e?.supported)fail('unsupportedError');if(e.kind==='web'&&!prefs.trustedWeb.includes(e.folder)){if(p.trustWeb!==true)fail('webConsentRequired');prefs.trustedWeb.push(e.folder);}prefs.active=e.folder;rendererStatus={phase:'waiting',message:text('waitRenderer'),key:e.folder,at:Date.now()};await ensureWeb();persist();return state();}
  if (method==='clear') {prefs.active=null;await ensureWeb();persist();return state();}
  if (method==='favorite') {const e=entry(p.id);if(!e)fail('notFound');prefs.favorites=prefs.favorites.includes(e.folder)?prefs.favorites.filter(k=>k!==e.folder):[...prefs.favorites,e.folder];persist();return state();}
  if (method==='playback') {
    const e=entry(p.id);if(!e?.supported)fail('unsupportedError');
    const volume=Number(p.volume),speed=Number(p.speed);
    if(!Number.isFinite(volume)||volume<0||volume>1||!Number.isFinite(speed)||speed<.25||speed>4||!['cover','contain','fill'].includes(p.fit))fail('badPlayback');
    prefs.overrides[e.folder]={volume,speed,fit:p.fit};persist();return state();
  }
  if(method==='language'){if(!['auto','ru','en'].includes(p.value))fail('badLanguage');prefs.language=p.value;persist();return state();}
  if(method==='properties'){
    const e=entry(p.id);if(e?.kind!=='web'||!p.values||typeof p.values!=='object'||Array.isArray(p.values))fail('badProperties');
    const values={};for(const [key,value]of Object.entries(p.values)){const definition=e.properties[key];if(!definition)fail('badProperties');
      if(definition.type==='bool'&&typeof value!=='boolean')fail('badProperties');
      if(definition.type==='slider'&&(!Number.isFinite(value)||value<Number(definition.min??-1e6)||value>Number(definition.max??1e6)))fail('badProperties');
      if(definition.type==='combo'&&!(definition.options||[]).some(o=>o.value===value))fail('badProperties');
      if(definition.type==='color'&&(typeof value!=='string'||!/^\s*(?:0(?:\.\d+)?|1(?:\.0+)?)\s+(?:0(?:\.\d+)?|1(?:\.0+)?)\s+(?:0(?:\.\d+)?|1(?:\.0+)?)\s*$/.test(value)))fail('badProperties');
      if(definition.type==='textinput'&&typeof value!=='string')fail('badProperties');
      if(typeof value==='string'&&value.length>4096)fail('badProperties');
      if(!['string','boolean','number'].includes(typeof value))fail('badProperties');values[key]=value;}
    prefs.properties[e.folder]=values;persist();return state();
  }
  if(method==='dim') {const value=Number(p.value);if(!Number.isFinite(value)||value<0||value>90)fail('badDim');prefs.dim=value;persist();return state();}
  if(method==='monitor') {if(!/^Monitor\d{1,2}$/.test(p.value))fail('badMonitor');prefs.monitor=p.value;persist();return state();}
  if(method==='resetPlayback') {const e=entry(p.id);if(!e)fail('notFound');delete prefs.overrides[e.folder];delete prefs.properties[e.folder];persist();return state();}
  fail('unknownCommand');
}
async function start() {if(!transport) transport=await startServer({state,call,entry},path.join(ROOT,'ui'));return transport;}
const app=plugin({id:'wallpaper-engine',
  onConfigChanged:async config=>{locations=discover(String(config.steam_path || ''));library=scan(locations);},
  onLanguageChanged:async value=>{astraLanguage=value;},
  onStart:async ctx=>{await start();if(!process.argv.includes('--preview')&&process.env.ASTRA_WE_DISABLE_MONITOR!=='1')monitorService=startWindowMonitor(path.join(ROOT,'dist/window-monitor.exe'),async status=>{try{await ctx.pushToUi('windowVisibility',status);}catch{}});},
  onShutdown:async()=>{monitorService?.close();webService?.close();transport?.server.close();transport?.server.closeAllConnections();},
  ui:{contributions:async()=>{await start();return [
    {id:'we-library',slot:'page.custom',label:'Wallpaper Engine',url:'index.html',pointerEvents:true},
    {id:'we-background',slot:'background.front',url:'background.html',transparent:true,pointerEvents:false,props:{audio:'true'}}
  ];},onCall:{connect:async()=>{await start();return {base:transport.base,language:language()};},...Object.fromEntries(['state','backgroundState','rendererStatus','refresh','details','apply','clear','favorite','playback','properties','language','resetPlayback','dim','monitor'].map(method=>[method,async p=>call(method,p || {})]))}},
  healthCheck:()=>({healthy:true,status:`${library.entries.length} wallpapers`})
});
if(require.main===module) {
  if(process.argv.includes('--preview')) start().then(t=>console.log(`Preview: ${t.base}`));else app.run();
}
module.exports={app,call,state};
