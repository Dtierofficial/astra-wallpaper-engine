const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
const os=require('node:os');
const path=require('node:path');
const {createHash}=require('node:crypto');

test('runtime download is pinned, cached, and rejects corrupted downloads',async()=>{
  const {pinnedFile,verifyDownload}=await import('../scripts/bundle-runtime.mjs');
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'we-runtime-'));
  const bytes=Buffer.from('fake runtime for integrity tests');
  const pin={url:'https://example.invalid/node.exe',size:bytes.length,sha256:createHash('sha256').update(bytes).digest('hex')};
  const file=path.join(root,'runtime/node.exe');
  let requests=0;
  const download=async()=>{requests++;return new Response(bytes);};
  try {
    await pinnedFile(file,pin,download);
    assert.deepEqual(await fs.readFile(file),bytes);
    await pinnedFile(file,pin,download);
    assert.equal(requests,1,'a verified cache needs no network');
    const corrupt=Buffer.alloc(bytes.length,120);
    await fs.writeFile(file,corrupt);
    await assert.rejects(pinnedFile(file,pin,async()=>new Response(corrupt)),/SHA-256 mismatch/);
    assert.deepEqual(await fs.readFile(file),corrupt,'a bad download must not be committed');
    await pinnedFile(file,pin,download);
    assert.deepEqual(await fs.readFile(file),bytes,'a corrupt cache is replaced by verified bytes');
    assert.throws(()=>verifyDownload(Buffer.from('short'),pin),/size mismatch/);
    await fs.unlink(file);
    await assert.rejects(pinnedFile(file,pin,async()=>new Response(Buffer.alloc(pin.size+1))),/exceeded pinned size/);
    await assert.rejects(pinnedFile(file,pin,async()=>new Response('',{status:503})),/HTTP 503/);
    await assert.rejects(fs.stat(file+'.tmp'),{code:'ENOENT'});
  } finally {await fs.rm(root,{recursive:true,force:true});}
});

test('plugin uses only the bundled Node entry and pins runtime licensing',async()=>{
  const lock=JSON.parse(await fs.readFile(path.join(__dirname,'../scripts/runtime-lock.json'),'utf8'));
  const manifest=await fs.readFile(path.join(__dirname,'../plugin.toml'),'utf8');
  assert.match(manifest,/command = "\.\/dist\/runtime\/node\.exe"/);
  assert.match(manifest,/runtimes = \[\]/);
  assert.match(manifest,/executables = \["dist\/runtime\/node\.exe", "dist\/window-monitor\.exe"\]/);
  assert.equal(lock.platform,'win32');assert.equal(lock.arch,'x64');
  assert.equal(new URL(lock.binary.url).hostname,'nodejs.org');
  assert.match(lock.binary.url,new RegExp(`/v${lock.version.replaceAll('.','\\.')}/win-x64/node.exe$`));
  for(const pin of [lock.binary,lock.license]){
    assert.match(pin.sha256,/^[a-f0-9]{64}$/);
    assert.ok(pin.size>0);assert.equal(new URL(pin.url).protocol,'https:');
  }
});
