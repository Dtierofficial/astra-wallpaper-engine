import fs from 'node:fs';
import path from 'node:path';

const rootPkg=JSON.parse(fs.readFileSync('package.json','utf8'));
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
fs.writeFileSync(path.join(output,'NOTICE.md'),`# Third-party notices\n\nThe plugin's own code and original artwork are copyright © 2026 DtieR, MIT.\nDependencies keep their own licenses; MIT does not relicense them.\n\n**AstraPlugins — a Minice project — https://minice.ai**\n\nThe unmodified astra-plugin-sdk 0.7.3 is distributed under MPL-2.0.\nIts source is available at https://github.com/mihailinl/AstraPlugins/tree/master/astra-plugin-sdk-ts and as the pinned npm package astra-plugin-sdk@0.7.3.\nIts original NOTICE is reproduced in the complete license text below, including historical references to other repository licenses.\n\n| Component | Version | Declared license |\n|---|---|---|\n${rows.join('\n')}\n\nComplete license and notice texts: [THIRD-PARTY-LICENSES.txt](THIRD-PARTY-LICENSES.txt).\n\nBuild-only tools (Node.js, .NET SDK and reference assemblies, esbuild, Playwright, Bun) are not redistributed as plugin runtimes. The native helper is built from this repository's C# source.\n\nWallpaper Engine, Steam, Astra and Minice are names of their respective owners. This independent integration is not an official product or endorsement. No wallpaper files or proprietary Astra source are bundled.\n`,'utf8');
console.log(`Preserved notices for ${rows.length} production packages.`);
