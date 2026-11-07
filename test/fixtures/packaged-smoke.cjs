// Copied outside the repository by packaged-runtime.py and run by the archive's
// own node.exe with filesystem permissions restricted to the test directory.
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const [install,root,project]=process.argv.slice(2);
assert.equal(process.permission.has('fs.read',path.join(project,'src/index.js')),false);
assert.equal(fs.existsSync(path.join(install,'node_modules')),false);
assert.equal(fs.existsSync(path.join(install,'src')),false);
assert.equal(process.execPath.toLowerCase(),path.join(install,'dist/runtime/node.exe').toLowerCase());
const lock=JSON.parse(fs.readFileSync(path.join(install,'dist/runtime/runtime.json'),'utf8'));
assert.equal(process.version,`v${lock.version}`);
const workshop=path.join(root,'Steam с пробелами/steamapps/workshop/content/431960');
function fixture(id,project,files){
  const dir=path.join(workshop,id);fs.mkdirSync(dir,{recursive:true});
  fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify(project));
  for(const [name,data]of Object.entries(files))fs.writeFileSync(path.join(dir,name),data);
}
fixture('100',{title:'Video',type:'video',file:'clip.webm'},{'clip.webm':'generated test video bytes'});
fixture('200',{title:'Image',type:'image',file:'image.png'},{'image.png':Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64')});
fixture('300',{title:'Web',type:'web',file:'index.html'},{'index.html':'<!doctype html><html><body>packaged web works</body></html>'});
fixture('400',{title:'Scene',type:'scene',file:'scene.pkg'},{'scene.pkg':'not playable'});
const {app,call}=require(path.join(install,'dist/index.js'));
const stateFile=path.join(process.env.ASTRA_WE_DATA_DIR,'settings.json');
const restarted=process.env.ASTRA_WE_TEST_RESTART==='1';
(async()=>{
  try{
    await app.definition.onStart({pushToUi:async()=>{}});
    await app.definition.onConfigChanged({steam_path:path.resolve(workshop,'../../../..')});
    const {base}=await app.definition.ui.onCall.connect();
    const state=await call('state');
    assert.equal(state.entries.length,4);
    if(restarted){assert.equal(state.language,'ru');assert.equal(state.favorites.length,1);}
    else {assert.equal(state.favorites.length,0);assert.equal(state.active,null);}
    const assets=['index.html','app.js','i18n.js','style.css','layout.css','brand.svg','background.html','background.js','web-compat.js','legal/NOTICE.md','legal/NODE-LICENSE.txt','legal/THIRD-PARTY-LICENSES.txt'];
    for(const file of assets)assert.equal((await fetch(new URL(file,base))).status,200,file);
    assert.equal((await fetch(new URL('brand.svg',base))).headers.get('content-type'),'image/svg+xml');
    const video=state.entries.find(e=>e.kind==='video');
    const image=state.entries.find(e=>e.kind==='image');
    const web=state.entries.find(e=>e.kind==='web');
    const scene=state.entries.find(e=>e.type==='scene');
    await assert.rejects(call('apply',{id:scene.id}));
    await call('apply',{id:video.id});
    assert.equal(await (await fetch((await call('backgroundState')).playback.url)).text(),'generated test video bytes');
    await call('apply',{id:image.id});
    assert.equal((await fetch((await call('backgroundState')).playback.url)).headers.get('content-type'),'image/png');
    await call('clear');
    if(!restarted)await assert.rejects(call('apply',{id:web.id}),/trust|довер/i);
    await call('apply',{id:web.id,trustWeb:true});
    assert.match(await (await fetch((await call('backgroundState')).playback.url)).text(),/packaged web works/);
    await app.definition.onLanguageChanged('ru-RU');
    await call('language',{value:'ru'});
    if(!restarted)await call('favorite',{id:video.id});
    assert.equal(JSON.parse(fs.readFileSync(stateFile,'utf8')).language,'ru');
    await call('clear');
    await app.definition.onConfigChanged({steam_path:path.join(root,'No Steam installed')});
    assert.equal((await call('state')).entries.length,0);
    console.log(JSON.stringify({pass:true,restarted,version:state.version,node:process.version,noSystemNode:true,noSourceAccess:true,assets:assets.length,mediaAndWeb:true,settings:true,missingSteamHandled:true}));
  }finally{await app.definition.onShutdown();}
})().catch(error=>{console.error(error);process.exitCode=1;});
