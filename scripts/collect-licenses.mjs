import fs from 'node:fs';
import path from 'node:path';

const rootPkg=JSON.parse(fs.readFileSync('package.json','utf8'));
const runtime=JSON.parse(fs.readFileSync('scripts/runtime-lock.json','utf8'));
const queue=Object.keys(rootPkg.dependencies||{});
const seen=new Map();

while(queue.length){
  const name=queue.shift();
  if(seen.has(name))continue;
  const dir=path.resolve('node_modules',name);
  if(!fs.existsSync(path.join(dir,'package.json')))throw Error(`Missing installed package: ${name}`);
  const pkg=JSON.parse(fs.readFileSync(path.join(dir,'package.json'),'utf8'));
  seen.set(name,{dir,pkg});
  for(const dep of Object.keys(pkg.dependencies||{})){
    if(!seen.has(dep))queue.push(dep);
  }
}

const output='ui/legal';fs.mkdirSync(output,{recursive:true});
const blocks=[],rows=[];
for(const name of [...seen.keys()].sort()){
  const {dir,pkg}=seen.get(name);
  const licenseFiles=fs.readdirSync(dir).filter(file=>/^(?:licen[cs]e|copying|notice)(?:[.-].*)?$/i.test(file)&&fs.statSync(path.join(dir,file)).isFile()).sort();
  if(!licenseFiles.length)throw Error(`Missing license text for ${pkg.name}`);
  rows.push(`| ${pkg.name} | ${pkg.version} | ${pkg.license||'See license text'} |`);
  for(const file of licenseFiles){
    const source=fs.readFileSync(path.join(dir,file),'utf8').replace(/\r\n/g,'\n');
    blocks.push(`\n${'='.repeat(72)}\n${pkg.name}@${pkg.version} — ${file}\n${'='.repeat(72)}\n${source}\n`);
  }
}
fs.writeFileSync(path.join(output,'THIRD-PARTY-LICENSES.txt'),blocks.join(''),'utf8');
fs.writeFileSync(path.join(output,'NOTICE.md'),`# Third-party notices

The plugin's own code and original artwork are copyright © 2026 DtieR, MIT.
Dependencies keep their own licenses; MIT does not relicense them.

**AstraPlugins — a Minice project — https://minice.ai**

The unmodified astra-plugin-sdk 0.7.3 is distributed under MPL-2.0.
Its source is available at https://github.com/mihailinl/AstraPlugins/tree/master/astra-plugin-sdk-ts and as the pinned npm package astra-plugin-sdk@0.7.3.
Its original NOTICE is reproduced in the complete license text below, including historical references to other repository licenses.

| Component | Version | Declared license |
|---|---|---|
${rows.join('\n')}

Complete license and notice texts: [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).

## Bundled Node.js runtime

Node.js ${runtime.version} for Windows x64 is redistributed unmodified from the official Node.js release.
It is licensed under MIT with additional third-party terms for compiled-in components.
The complete upstream notice is included in [NODE-LICENSE.txt](NODE-LICENSE.txt).
Binary source: ${runtime.binary.url}
SHA-256: \`${runtime.binary.sha256}\`.
Source code: https://github.com/nodejs/node/tree/v${runtime.version}
The pinned download metadata is also included in \`dist/runtime/runtime.json\`.
Nothing is downloaded or installed at plugin startup, and no system Node.js installation is changed.

Build-only tools (.NET SDK and reference assemblies, esbuild, Playwright, Bun) are not redistributed as plugin runtimes. The native helper is built from this repository's C# source and uses the Windows .NET Framework 4.8 runtime.

Wallpaper Engine, Steam, Astra and Minice are names of their respective owners. This independent integration is not an official product or endorsement. No wallpaper files or proprietary Astra source are bundled.
`,'utf8');
console.log(`Preserved notices for ${rows.length} production packages.`);
