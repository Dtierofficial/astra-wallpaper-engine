// Regression reproduction using sandboxed iframes and the installed 0.2.7
// bridge. No daemon credentials, DevTools ports or weakened browser security.
const {chromium, expect} = require('@playwright/test');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const http = require('node:http');
const assetType=file=>({'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.html':'text/html'})[path.extname(file)]||'application/octet-stream';

async function main() {
  const bridgePath = path.resolve(process.env.ASTRA_WE_BRIDGE_FIXTURE||'test/fixtures/astra-bridge.js');
  const pluginRoot=path.resolve(process.env.ASTRA_WE_PLUGIN_DIR||'.');
  const uiRoot=path.join(pluginRoot,'ui');
  const backend=process.env.ASTRA_WE_PLUGIN_DIR?path.join(pluginRoot,'dist/index.js'):path.join(pluginRoot,'src/index.js');
  if (!fs.existsSync(bridgePath)) throw Error('Bridge test fixture missing');
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'we-e2e-'));
  process.env.ASTRA_WE_DATA_DIR = path.join(root, 'prefs');
  process.env.ASTRA_WE_DISABLE_MONITOR='1';
  const browser = await chromium.launch({headless:true});
  let app, harness, hostServer;
  try {
    const page = await browser.newPage({viewport:{width:1100,height:760},locale:'ru-RU'});
    const media = await page.evaluate(async () => {
      const canvas = document.createElement('canvas');
      canvas.width = 320; canvas.height = 180;
      const ctx = canvas.getContext('2d');
      const stream = canvas.captureStream(10);
      const recorder = new MediaRecorder(stream, {mimeType:'video/webm;codecs=vp8'});
      const chunks = [];
      const done = new Promise(resolve => {recorder.ondataavailable = event => chunks.push(event.data);recorder.onstop = resolve;});
      recorder.start();
      for (let i=0;i<5;i++) {
        ctx.fillStyle = i%2 ? '#156599' : '#31afc5';ctx.fillRect(0,0,320,180);
        ctx.fillStyle = 'white';ctx.font = '24px sans-serif';ctx.fillText('Astra · test wallpaper',25,90);
        await new Promise(resolve => setTimeout(resolve,100));
      }
      recorder.stop();await done;stream.getTracks().forEach(track=>track.stop());
      return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
    });
    const workshop = path.join(root,'steamapps/workshop/content/431960');
    fs.mkdirSync(workshop,{recursive:true});
    const svg = '<svg xmlns="http://www.w3.org/2000/svg" width="320" height="180"><rect width="320" height="180" fill="#156599"/><text x="20" y="90" fill="white" font-size="22">Test wallpaper</text></svg>';
    for (let i=0;i<155;i++) {
      const folder=path.join(workshop,String(1000+i));fs.mkdirSync(folder);
      fs.writeFileSync(path.join(folder,'preview.svg'),svg);
      fs.writeFileSync(path.join(folder,'video.webm'),Buffer.from(media));
      fs.writeFileSync(path.join(folder,'project.json'),JSON.stringify({title:`Wallpaper ${String(i).padStart(3,'0')}`,type:'video',file:'video.webm',preview:'preview.svg',tags:['Test']}));
    }
    const webFolder=path.join(workshop,'2000');fs.mkdirSync(webFolder);
    fs.writeFileSync(path.join(webFolder,'index.html'),`<!doctype html><html><head><link rel="stylesheet" href="style.css"></head><body><div id="value">waiting</div><div id="data"></div><script src="app.js"></script></body></html>`);
    fs.writeFileSync(path.join(webFolder,'style.css'),'body{background:rgb(34,0,85);margin:0}');
    fs.writeFileSync(path.join(webFolder,'app.js'),`window.wallpaperPropertyListener={applyUserProperties:p=>document.getElementById('value').textContent=String(p.amount.value)};fetch('data.json').then(r=>r.json()).then(d=>document.getElementById('data').textContent=d.ok);`);
    fs.writeFileSync(path.join(webFolder,'data.json'),JSON.stringify({ok:'local assets work'}));
    fs.writeFileSync(path.join(webFolder,'preview.svg'),svg);
    fs.writeFileSync(path.join(webFolder,'project.json'),JSON.stringify({title:'Web fixture',type:'web',file:'index.html',preview:'preview.svg',general:{properties:{amount:{type:'slider',value:7,min:0,max:100,text:'Amount'}}}}));
    const imageFolder=path.join(workshop,'2001');fs.mkdirSync(imageFolder);
    const pixel=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jZ1kAAAAASUVORK5CYII=','base64');
    fs.writeFileSync(path.join(imageFolder,'image.png'),pixel);
    fs.writeFileSync(path.join(imageFolder,'project.json'),JSON.stringify({title:'Image fixture',type:'image',file:'image.png',preview:'image.png'}));
    ({app} = require(backend));
    const {call} = require(backend);
    const {Harness} = require('astra-plugin-sdk/testing');
    harness = await Harness.create(app).start();
    await app.definition.onLanguageChanged('en');
    await app.definition.onConfigChanged({steam_path:root});
    const {base} = await app.definition.ui.onCall.connect();
    let startupBlocked=true,releaseStartup;
    const startupGate=new Promise(resolve=>{releaseStartup=resolve;});
    await page.exposeFunction('pluginCall',async(method,params)=>{
      if(method==='state'&&startupBlocked)await startupGate;
      return call(method,params);
    });
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    page.on('console',msg=>{if(msg.type()==='error')console.error('BROWSER:',msg.text());});
    page.on('requestfailed',req=>console.error('REQUEST:',req.url(),req.failure()?.errorText));
    await page.route('http://astra-plugin.localhost/**',async route=>{
      const url = new URL(route.request().url());
      let file;
      if (url.pathname==='/bridge/astra-bridge.js') file=bridgePath;
      else if(url.pathname.startsWith('/wallpaper-engine/')) file=path.resolve(uiRoot,url.pathname.slice('/wallpaper-engine/'.length));
      if(!file || !fs.existsSync(file)) return route.fulfill({status:200,contentType:'text/css',body:''});
      const contentType=assetType(file);
      await route.fulfill({path:file,contentType});
    });
    // Controlled replay of our own generated files only. Chromium's newest
    // Local Network Access policy denies network loads from opaque frames;
    // that permission is intentionally NOT granted/disabled here. This test
    // verifies rendering/layout/bridge semantics, not real WebView networking.
    await page.route(base+'**',async route=>{
      const relative=new URL(route.request().url()).pathname.split('/').slice(2);
      if(relative[0]==='media') {
        const isVideo=relative[2]==='video',isImage=relative[2]==='image';
        return route.fulfill({contentType:isVideo?'video/webm':isImage?'image/png':'image/svg+xml',body:isVideo?Buffer.from(media):isImage?pixel:svg});
      }
      const file=path.resolve(uiRoot,relative.join('/'));
      if(!fs.existsSync(file))return route.fulfill({status:404,body:''});
      return route.fulfill({path:file,contentType:assetType(file)});
    });
    // A real local server is required here: request interception on a fake
    // hostname does not establish its network address space. No LNA/CORS
    // permission is overridden and browser security stays enabled.
    for(const name of ['index.html','background.html'])await page.route(base+name,async route=>{
      const html=fs.readFileSync(path.join(uiRoot,name),'utf8').replace('<head>','<head><script src="http://astra-plugin.localhost/bridge/astra-bridge.js"></script>');
      await route.fulfill({contentType:'text/html',body:html});
    });
    hostServer=http.createServer((req,res)=>res.writeHead(200,{'Content-Type':'text/html'}).end(`<!doctype html><html><head><style>
      :root{--z-plugin-front:300;--color-shell-bg:#17181b}html,body{margin:0;height:100%;background:var(--color-shell-bg);overflow:hidden}
      #root{height:100%;display:flex;flex-direction:column}.main-layout{position:relative;display:flex;flex:1;min-height:0;background:var(--color-shell-bg)}
      .main-layout__threads-wrap{position:fixed;inset:0;z-index:1;background:#451e70}
      .main-layout__content{position:fixed;inset:60px 0 0;z-index:2;pointer-events:none}
      #panel{width:100%;height:100%;border:none;pointer-events:auto}#home{pointer-events:auto;color:white;background:#222a;position:fixed;top:35%;left:25%;padding:30px;border:0}
      #nav{position:fixed;z-index:10;top:10px;left:16px}#front{position:fixed;inset:0;z-index:var(--z-plugin-front);pointer-events:none}#background{width:100%;height:100%;border:none;background:transparent}
    </style></head><body><div id="root"><div class="main-layout"><div class="main-layout__threads-wrap"></div><div id="nav"><button id="show-home">Home</button><button id="show-panel">Plugin</button><button id="hide-player">Hide UI</button></div><main class="main-layout__content"><button id="home" hidden>Astra UI is clickable</button><iframe id="panel" sandbox="allow-scripts allow-forms" src="${base}index.html"></iframe></main></div><div id="front"><iframe id="background" sandbox="allow-scripts allow-forms" src="${base}background.html"></iframe></div></div>
    <script>
    const store={},documents=new Map();
    window.addEventListener('message',async event=>{
      const frame=[...document.querySelectorAll('iframe')].find(f=>f.contentWindow===event.source);if(!frame)return;
      const msg=event.data;if(msg.type==='astra-bridge-ready'){documents.set(frame,msg.documentId);return;}
      if(msg.type!=='astra-bridge-request'||(msg.documentId&&msg.documentId!==documents.get(frame)))return;
      let result=null,error=null;
      try{const p=msg.params||{};switch(msg.method){
        case 'callBackend':result= p.method==='connect'?{base:${JSON.stringify(base)}}:await window.pluginCall(p.method,p.params);break;
        case 'getData':result=store[p.key]||null;break;
        case 'setData':store[p.key]=p.value;result=true;break;
        case 'getCssVariables':result={'--z-plugin-front':getComputedStyle(document.documentElement).getPropertyValue('--z-plugin-front').trim()};break;
        case 'setCssVariable':document.documentElement.style.setProperty(p.name,p.value);result=true;break;
        default:throw Error('Unknown bridge method: '+msg.method);
      }}catch(e){error=e.message;}
      event.source.postMessage({type:'astra-bridge-response',id:msg.id,result,error},'*');
    });
    document.getElementById('show-home').onclick=()=>{document.getElementById('panel').hidden=true;document.getElementById('home').hidden=false;};
    document.getElementById('show-panel').onclick=()=>{document.getElementById('panel').hidden=false;document.getElementById('home').hidden=true;};
    </script></body></html>`));
    await new Promise(resolve=>hostServer.listen(0,'127.0.0.1',resolve));
    await page.goto(`http://127.0.0.1:${hostServer.address().port}/`);
    const panel=page.frameLocator('#panel');
    // A Russian Windows/browser locale must not cause a Russian first paint
    // in an English Astra. Hold the first state reply to inspect loading.
    await expect(panel.locator('#boot-status')).toBeVisible();
    await expect(panel.locator('#boot-status')).toContainText('Connecting…');
    await expect(panel.locator('[data-tab="settings"]')).toHaveCSS('visibility','hidden');
    startupBlocked=false;releaseStartup();
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Settings');
    await expect(panel.locator('html')).toHaveAttribute('lang','en');
    await expect(panel.locator('#boot-status')).toBeHidden();
    await expect.poll(()=>panel.locator('.brand-icon').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    expect((await call('state')).languagePreference).toBe('auto');
    // The inverse combination: English browser, Russian Astra on startup.
    await page.addInitScript(()=>Object.defineProperty(navigator,'language',{get:()=> 'en-US'}));
    await app.definition.onLanguageChanged('ru');
    await page.reload();
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Настройки');
    await expect(panel.locator('html')).toHaveAttribute('lang','ru');
    await expect(panel.locator('.tile')).toHaveCount(157);
    await expect.poll(()=>panel.locator('.tile img').first().evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    for (const viewport of [{width:1100,height:760},{width:800,height:500},{width:560,height:660}]) {
      await page.setViewportSize(viewport);
      const metrics=await panel.locator('#grid').evaluate(grid=>({height:grid.clientHeight,scroll:grid.scrollHeight,tile:grid.firstElementChild.getBoundingClientRect().height,body:document.body.scrollHeight,viewport:innerHeight}));
      expect(metrics.tile).toBeGreaterThan(135);expect(metrics.height).toBeGreaterThan(80);expect(metrics.scroll).toBeGreaterThan(metrics.height);expect(metrics.body).toBeLessThanOrEqual(metrics.viewport+1);
    }
    await page.setViewportSize({width:1000,height:700});
    await panel.getByRole('listitem',{name:'Wallpaper 154',exact:true}).click();
    const gridScroll=await panel.locator('#grid').evaluate(el=>el.scrollTop);
    expect(gridScroll).toBeGreaterThan(500);
    await expect(panel.locator('#inspector h1')).toHaveText('Wallpaper 154');
    await panel.getByRole('button',{name:'Применить в Astra',exact:true}).click();
    expect(await panel.locator('#grid').evaluate(el=>el.scrollTop)).toBeGreaterThan(500);
    await expect.poll(async()=> (await call('state')).renderer.phase).toBe('playing');
    const background=page.frameLocator('#background');
    await expect.poll(()=>background.locator('video').evaluate(v=>v.currentTime)).toBeGreaterThan(0);
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.getElementById('front')).zIndex)).toBe('1');
    await page.locator('#show-home').click();
    await expect(page.locator('#home')).toBeVisible();
    await page.locator('#home').click(); // player never covers/blocks host controls
    fs.mkdirSync('diagnostics/screenshots',{recursive:true});
    await page.screenshot({path:'diagnostics/screenshots/host-background.png'});
    await page.locator('#show-panel').click();
    // Inspector has an independent scroll container and its apply action
    // remains within the viewport while viewing the bottom properties.
    await panel.locator('#inspector').evaluate(el=>{el.scrollTop=el.scrollHeight;});
    const actionBounds=await panel.locator('.apply-row').evaluate(el=>el.getBoundingClientRect().toJSON());
    expect(actionBounds.top).toBeGreaterThanOrEqual(0);
    expect(actionBounds.bottom).toBeLessThan(640);
    await page.screenshot({path:'diagnostics/screenshots/gallery-scrolled.png'});
    await panel.locator('#language').selectOption('en');
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Settings');
    await page.reload();
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Settings');
    await expect(panel.locator('#language')).toHaveValue('en');
    await panel.locator('[data-tab="settings"]').click();
    await expect(panel.locator('#settings h1')).toHaveText('Connection settings');
    await panel.locator('[data-tab="all"]').click();
    await panel.locator('#language').selectOption('auto');
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Настройки');
    await app.definition.onLanguageChanged('de');
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Settings',{timeout:6000});
    await app.definition.onLanguageChanged('ru');
    await expect(panel.locator('[data-tab="settings"]')).toHaveText('Настройки',{timeout:6000});
    const state=await call('state'),webEntry=state.entries.find(e=>e.kind==='web'),imageEntry=state.entries.find(e=>e.kind==='image');
    let blocked=false;try{await call('apply',{id:webEntry.id});}catch{blocked=true;}expect(blocked).toBe(true);
    const webState=await call('apply',{id:webEntry.id,trustWeb:true});
    const webURL=webState.playback.url;
    await page.route(new URL('./',webURL).href+'**',async route=>{
      const response=await fetch(route.request().url());
      const headers=Object.fromEntries(response.headers);delete headers['content-length'];
      await route.fulfill({status:response.status,headers,body:Buffer.from(await response.arrayBuffer())});
    });
    await expect.poll(()=>background.locator('iframe').count()).toBe(1);
    const author=background.frameLocator('iframe');
    await expect(author.locator('#value')).toHaveText('7');
    await expect(author.locator('#data')).toHaveText('local assets work');
    expect(await author.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor)).toBe('rgb(34, 0, 85)');
    expect(await author.locator('#value').evaluate(()=>typeof window.astra)).toBe('undefined');
    await call('properties',{id:webEntry.id,values:{amount:42}});
    await expect(author.locator('#value')).toHaveText('42');
    await call('apply',{id:imageEntry.id});
    await expect.poll(()=>background.locator('iframe').count()).toBe(0);
    await expect.poll(()=>background.locator('img').evaluate(img=>img.complete&&img.naturalWidth>0)).toBe(true);
    await call('clear');
    await expect.poll(()=>background.locator('video').count()).toBe(0);
    await expect.poll(()=>page.evaluate(()=>getComputedStyle(document.getElementById('front')).zIndex)).toBe('300');
    expect(errors).toEqual([]);
    console.log('PASS: brand icon loads; Astra language wins over browser language on first paint; English-only loading; saved override; live language changes and English fallback; 157 cards at 3 viewport sizes; video/image/Web playback; Web consent and properties; inspector scrolling; host layering.');
  } finally {
    if(harness) await harness.shutdown();
    await browser.close();
    if(hostServer){hostServer.closeAllConnections();await new Promise(resolve=>hostServer.close(resolve));}
    fs.rmSync(root,{recursive:true,force:true});
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
