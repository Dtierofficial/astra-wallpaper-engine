import {build} from 'esbuild';
import {execFileSync} from 'node:child_process';
import {mkdirSync,copyFileSync} from 'node:fs';
import {bundleRuntime} from './bundle-runtime.mjs';
await build({entryPoints:['src/index.js'],bundle:true,platform:'node',format:'cjs',outfile:'dist/index.js'});
// The official release workflow builds JS plugins on Linux. Roslyn + the
// pinned reference-assemblies package can emit the same Windows/.NET Framework
// helper there without shipping a precompiled local binary or executing it.
execFileSync('dotnet',['build','native/WindowMonitor/WindowMonitor.csproj','--configuration','Release','--nologo'],{stdio:'inherit',windowsHide:true});
mkdirSync('dist',{recursive:true});
copyFileSync('native/WindowMonitor/bin/Release/net48/window-monitor.exe','dist/window-monitor.exe');
copyFileSync('icon.svg','ui/brand.svg');
await bundleRuntime();
// Keep dependency notices in the installed bundle as well as the repository.
execFileSync(process.execPath,['scripts/collect-licenses.mjs'],{stdio:'inherit'});
