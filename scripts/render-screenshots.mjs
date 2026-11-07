import {chromium} from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-shots-'));
process.env.ASTRA_WE_DATA_DIR=path.join(root,'prefs');
process.env.ASTRA_WE_DISABLE_MONITOR='1';
const workshop=path.join(root,'steamapps/workshop/content/431960');
fs.mkdirSync(workshop,{recursive:true});

// Original geometric sample art — never capture the user's downloaded library.
const samples=[
  ['101','Aurora Drift','video','aurora.webm',['Space','Ambient'],'#16597a','#8d61c7'],
  ['102','Neon Rain','video','rain.webm',['Cyber','Loop'],'#1a2d57','#48bde2'],
  ['103','Midnight Peaks','image','peaks.png',['Landscape','Minimal'],'#1f304f','#7b89e8'],
  ['104','Solar Pulse','web','index.html',['Audio','Shader'],'#38215c','#ce73b6'],
  ['105','Quiet Horizon','video','horizon.webm',['Nature','Calm'],'#154959','#6fd2c5'],
  ['106','Crystal Grid','scene','scene.pkg',['3D','Scene'],'#2d3147','#8c96b5'],
  ['107','Deep Orbit','video','orbit.webm',['Sci-Fi','4K'],'#121d3d','#667EEA'],
  ['108','Mist Valley','image','valley.png',['Illustration'],'#233c4b','#7bc6cc']
];
for(const [id,title,type,file,tags,c1,c2]of samples){
  const dir=path.join(workshop,id);fs.mkdirSync(dir);
  fs.writeFileSync(path.join(dir,'preview.svg'),`<svg xmlns="http://www.w3.org/2000/svg" width="480" height="300"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient></defs><rect width="480" height="300" fill="url(#g)"/><circle cx="115" cy="95" r="34" fill="#e6fbff" fill-opacity=".86"/><path d="M0 230 120 140l95 62 125-95 140 123v70H0Z" fill="#0f172a" fill-opacity=".46"/></svg>`);
  fs.writeFileSync(path.join(dir,file),'fixture');
  fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify({title,type,file,preview:'preview.svg',tags,contentrating:'Everyone',general:{properties:{schemecolor:{type:'color',text:'Scheme color',value:'0.44 0.88 0.96'}, bloom:{type:'bool',text:'Soft glow',value:true}}}}));
}
const {app,call}=require('../src/index');
await app.definition.onConfigChanged({steam_path:root});
const {base}=await app.definition.ui.onCall.connect();
await call('favorite',{id:'0'});await call('favorite',{id:'1'});await call('apply',{id:'0'});
const browser=await chromium.launch();
try{
  const page=await browser.newPage({viewport:{width:1280,height:760}});
  await page.goto(base+'index.html');
  for(const [lang,file]of [['en','docs/assets/gallery-en.png'],['ru','docs/assets/gallery-ru.png']]){
    await call('language',{value:lang});
    await page.reload();
    await page.locator('.tile').first().click();
    await page.waitForTimeout(150);
    await page.screenshot({path:file});
    console.log(path.resolve(file));
  }
}finally{
  await browser.close();
  await app.definition.onShutdown();
  fs.rmSync(root,{recursive:true,force:true});
}
