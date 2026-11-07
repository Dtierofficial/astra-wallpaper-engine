const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {scan,settings,inside}=require('../src/library');
const {byteRange,startServer}=require('../src/server');
test('byte ranges: suffix, bounded, invalid',()=>{
  assert.deepEqual(byteRange('bytes=0-4',10),{start:0,end:4});
  assert.deepEqual(byteRange('bytes=-3',10),{start:7,end:9});
  assert.deepEqual(byteRange('bytes=5-',10),{start:5,end:9});
  for(const r of ['bytes=10-','bytes=-0','bytes=4-2','bytes=0-1,4-5','bytes=-'])assert.throws(()=>byteRange(r,10));
});
test('scan and imported settings; file containment; authenticated server',async()=>{
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-test-'));
  try{
    const dir=path.join(root,'123');fs.mkdirSync(dir);
    fs.writeFileSync(path.join(dir,'a.mp4'),'0123456789');
    fs.writeFileSync(path.join(dir,'project.json'),JSON.stringify({title:'Example',type:'Video',file:'a.mp4',general:{properties:{test:{value:1}}}}));
    fs.writeFileSync(path.join(root,'config.json'),JSON.stringify({tester:{wproperties:{[path.join(dir,'a.mp4').replaceAll('\\','/')]:{Monitor0:{volume:42,test:3}}}}}));
    const lib=scan({roots:[root]});assert.equal(lib.entries.length,1);assert.equal(lib.entries[0].supported,true);
    const cfg=settings(root,lib.entries[0]);assert.equal(cfg.playback.volume,.42);assert.equal(cfg.properties.test.value,3);
    assert.equal(inside(dir,path.join(root,'config.json')),false);
    const {server,base}=await startServer({state:()=>({ok:true}),entry:()=>lib.entries[0],call:()=>({ok:true})},dir);
    try{
      assert.equal((await fetch(new URL('/api/state',base))).status,404);
      const r=await fetch(base+'media/0/video',{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(await r.text(),'2345');
      assert.equal((await fetch(base+'media/0/video',{headers:{Range:'bytes=50-'}})).status,416);
      assert.equal((await fetch(base+'api/call',{method:'POST',headers:{Origin:'https://evil.invalid'},body:'{}'})).status,403);
    }finally{server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}
  }finally{fs.rmSync(root,{recursive:true,force:true});}
});
