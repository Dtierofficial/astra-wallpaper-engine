import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile,rename,rm} from 'node:fs/promises';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

export function verifyDownload(bytes,pin) {
  if(bytes.length!==pin.size)throw Error(`Runtime size mismatch: expected ${pin.size}, received ${bytes.length}`);
  const digest=createHash('sha256').update(bytes).digest('hex');
  if(digest!==pin.sha256)throw Error(`Runtime SHA-256 mismatch: expected ${pin.sha256}, received ${digest}`);
  return bytes;
}

export async function pinnedFile(destination,pin,fetcher=fetch) {
  try {verifyDownload(await readFile(destination),pin);return;} catch(error) {
    if(error.code!=='ENOENT'&&!error.message.startsWith('Runtime '))throw error;
  }
  const response=await fetcher(pin.url,{signal:AbortSignal.timeout(180000)});
  if(!response.ok)throw Error(`Runtime download failed: HTTP ${response.status} (${pin.url})`);
  const chunks=[];let size=0;
  for await(const chunk of response.body){
    size+=chunk.length;
    if(size>pin.size)throw Error(`Runtime download exceeded pinned size (${pin.url})`);
    chunks.push(chunk);
  }
  const bytes=verifyDownload(Buffer.concat(chunks),pin);
  await mkdir(path.dirname(destination),{recursive:true});
  const temporary=destination+'.tmp';
  try {await writeFile(temporary,bytes);await rename(temporary,destination);}
  finally {await rm(temporary,{force:true});}
}

export async function bundleRuntime(root=path.resolve(fileURLToPath(new URL('..',import.meta.url)))) {
  const lock=JSON.parse(await readFile(path.join(root,'scripts/runtime-lock.json'),'utf8'));
  await pinnedFile(path.join(root,'dist/runtime/node.exe'),lock.binary);
  // Node's complete license file includes the components compiled into node.exe.
  await pinnedFile(path.join(root,'ui/legal/NODE-LICENSE.txt'),lock.license);
  await writeFile(path.join(root,'dist/runtime/runtime.json'),JSON.stringify(lock,null,2)+'\n');
  console.log(`Bundled Node.js ${lock.version} (${lock.platform}-${lock.arch}); SHA-256 and license verified.`);
}

if(process.argv[1]&&import.meta.url===pathToFileURL(path.resolve(process.argv[1])).href)await bundleRuntime();
