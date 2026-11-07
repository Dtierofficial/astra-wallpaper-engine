const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {startWebServer}=require('../src/web-server');
const {scan}=require('../src/library');

test('Web content server is read-only, scoped to a single project, sandboxed and range-aware',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-web-'));
  const folder=path.join(root,'project');fs.mkdirSync(folder);
  fs.writeFileSync(path.join(folder,'index.html'),'<html><head></head><body>fixture</body></html>');
  fs.writeFileSync(path.join(folder,'app.js'),'window.fixture=true;');
  fs.writeFileSync(path.join(folder,'a.mp4'),'0123456789');
  fs.writeFileSync(path.join(root,'private.txt'),'private');
  const service=await startWebServer({folder,media:path.join(folder,'index.html')},'window.compat=true;');
  try{
    const base=new URL('./',service.url).href;
    const html=await fetch(service.url);assert.match(await html.text(),/window.compat=true/);
    const csp=html.headers.get('content-security-policy');assert.match(csp,/sandbox allow-scripts/);assert.match(csp,/connect-src 'self'/);assert.match(csp,/frame-src 'none'/);
    assert.equal((await fetch(base+'api/call',{method:'POST',body:'{}'})).status,405);
    assert.equal((await fetch(base+'..%5Cprivate.txt')).status,404);
    assert.equal((await fetch(base+'%2e%2e%2Fprivate.txt')).status,404);
    assert.equal((await fetch(base+'../private.txt')).status,404);
    assert.equal((await fetch(new URL('/api/state',service.url))).status,404);
    assert.equal(await (await fetch(base+'a.mp4',{headers:{Range:'bytes=2-4'}})).text(),'234');
    assert.equal((await fetch(base+'a.mp4',{headers:{Range:'bytes=30-'}})).status,416);
  }finally{service.close();fs.rmSync(root,{recursive:true,force:true});}
});

test('catalog detects loose images and Web documents but never marks PKG as playable',()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-kind-'));
  try{
    for(const [id,type,file]of [['1','web','index.html'],['2','image','image.png'],['3','scene','scene.pkg']]){
      const dir=path.join(root,id);fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,file),'fixture');
      fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify({type,file}));
    }
    const entries=scan({roots:[root]}).entries;
    assert.equal(entries.find(e=>e.workshopId==='1').kind,'web');
    assert.equal(entries.find(e=>e.workshopId==='2').kind,'image');
    assert.equal(entries.find(e=>e.workshopId==='3').supported,false);
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
