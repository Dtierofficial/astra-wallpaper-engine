const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
test('real SDK harness: connect, library, apply, reset, monitor and clear',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-plugin-'));
  process.env.ASTRA_WE_DATA_DIR=path.join(root,'prefs');
  process.env.ASTRA_WE_DISABLE_MONITOR='1';
  const wp=path.join(root,'steamapps/workshop/content/431960/100');fs.mkdirSync(wp,{recursive:true});
  fs.writeFileSync(path.join(wp,'test.mp4'),'video');fs.writeFileSync(path.join(wp,'project.json'),JSON.stringify({title:'Test video',type:'video',file:'test.mp4'}));
  const {app}=require('../src/index');const {Harness}=require('astra-plugin-sdk/testing');
  const h=await Harness.create(app).start();
  try{
    const {call}=require('../src/index');
    await app.definition.onConfigChanged({steam_path:root});
    await app.definition.ui.onCall.connect();
    const s=await call('state');assert.equal(s.entries.length,1);assert.equal(s.entries[0].supported,true);
    await call('apply',{id:'0'});assert.ok((await call('backgroundState')).playback.url);
    await call('playback',{id:'0',volume:.3,speed:1.5,fit:'contain'});assert.equal((await call('state')).playback.speed,1.5);
    await call('resetPlayback',{id:'0'});assert.equal((await call('state')).playback.speed,1);
    await call('monitor',{value:'Monitor1'});assert.equal((await call('state')).monitor,'Monitor1');
    await assert.rejects(call('monitor',{value:'../bad'}));
    await call('favorite',{id:'0'});assert.equal((await call('state')).favorites.length,1);
    await app.definition.onLanguageChanged('ru-RU');assert.equal((await call('state')).language,'ru');
    await call('language',{value:'en'});assert.equal((await call('state')).language,'en');
    await app.definition.onLanguageChanged('ru');assert.equal((await call('state')).language,'en');
    await call('language',{value:'auto'});assert.equal((await call('state')).language,'ru');
    await app.definition.onLanguageChanged('de');assert.equal((await call('state')).language,'en');
    await call('clear');assert.equal((await call('backgroundState')).playback,null);
    assert.ok(fs.existsSync(path.join(root,'prefs/settings.json')));
  }finally{await h.shutdown();fs.rmSync(root,{recursive:true,force:true});}
});
