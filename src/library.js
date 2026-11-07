const fs = require('node:fs');
const path = require('node:path');
const {execFileSync} = require('node:child_process');
const os=require('node:os');

function json(file) { return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function inside(root, file) {
  const rel = path.relative(fs.realpathSync(root), fs.realpathSync(file));
  return rel !== '..' && !rel.startsWith('..' + path.sep) && !path.isAbsolute(rel);
}
function discover(custom = '') {
  let steam = custom;
  if (!steam && process.platform === 'win32') {
    try { steam = execFileSync('reg.exe', ['query', 'HKCU\\Software\\Valve\\Steam', '/v', 'SteamPath'], {encoding:'utf8', windowsHide:true}).match(/SteamPath\s+REG_SZ\s+(.+)/)?.[1].trim(); } catch {}
  }
  if(!steam&&process.platform==='win32'){
    try{steam=execFileSync('reg.exe',['query','HKLM\\SOFTWARE\\WOW6432Node\\Valve\\Steam','/v','InstallPath'],{encoding:'utf8',windowsHide:true}).match(/InstallPath\s+REG_SZ\s+(.+)/)?.[1].trim();}catch{}
  }
  if(!steam&&process.platform!=='win32'){
    const candidates=[path.join(os.homedir(),'.local/share/Steam'),path.join(os.homedir(),'.steam/steam'),path.join(os.homedir(),'.var/app/com.valvesoftware.Steam/.local/share/Steam')];
    steam=candidates.find(candidate=>fs.existsSync(path.join(candidate,'steamapps')))||candidates[0];
  }
  steam ||= path.join(process.env['ProgramFiles(x86)']||process.env.ProgramFiles||'C:/Program Files (x86)','Steam');
  const libraries = new Set([steam]);
  try { for (const match of fs.readFileSync(path.join(steam,'steamapps/libraryfolders.vdf'),'utf8').matchAll(/"path"\s+"([^"]+)"/g)) libraries.add(match[1].replace(/\\\\/g,'\\')); } catch {}
  let engine = '';
  const roots = [];
  for (const lib of libraries) {
    const workshop = path.join(lib,'steamapps/workshop/content/431960');
    if (fs.existsSync(workshop)) roots.push(workshop);
    let install = 'wallpaper_engine';
    try { install = fs.readFileSync(path.join(lib,'steamapps/appmanifest_431960.acf'),'utf8').match(/"installdir"\s+"([^"]+)"/i)?.[1] || install; } catch {}
    const candidate = path.join(lib,'steamapps/common', install);
    if (fs.existsSync(candidate)) { engine = candidate; const local = path.join(candidate,'projects/myprojects'); if (fs.existsSync(local)) roots.push(local); }
  }
  return {steam, engine, roots:[...new Map(roots.map(p=>[path.resolve(p).toLowerCase(),p])).values()]};
}
function scan(locations) {
  const entries = [], errors = [];
  for (const root of locations.roots) {let dirs;try{dirs=fs.readdirSync(root,{withFileTypes:true});}catch(e){errors.push(`${root}: ${e.message}`);continue;}for (const dir of dirs) {
    if (!dir.isDirectory()) continue;
    const folder = path.join(root,dir.name), project = path.join(folder,'project.json');
    try {
      if (!inside(root,project)) continue;
      const p = json(project), type = String(p.type || 'unknown').toLowerCase();
      const media = path.resolve(folder,String(p.file || ''));
      const preview = path.resolve(folder,String(p.preview || 'preview.jpg'));
      const fileExists=fs.existsSync(media)&&fs.statSync(media).isFile()&&inside(folder,media);
      const kind=fileExists&&type==='video'&&/\.(mp4|webm|ogv)$/i.test(media)?'video':
        fileExists&&type==='web'&&/\.html?$/i.test(media)?'web':
        fileExists&&type!=='scene'&&/\.(png|jpe?g|webp|gif|bmp)$/i.test(media)?'image':null;
      entries.push({id: String(entries.length), workshopId:dir.name, title:String(p.title || dir.name), type,kind,
        tags: Array.isArray(p.tags) ? p.tags.filter(t=>typeof t==='string') : [], rating:p.contentrating || 'Unknown', folder,
        preview: fs.existsSync(preview) && inside(folder,preview) ? preview : null,
        media: fs.existsSync(media) && inside(folder,media) ? media : null,
        properties:p.general?.properties || {}, modified:fs.statSync(project).mtimeMs,
        supported:!!kind});
    } catch(e) { if (fs.existsSync(project)) errors.push(`${dir.name}: ${e.message}`); }
  }}
  return {entries, errors};
}
function settings(engine, entry, monitor = 'Monitor0') {
  let config = {};
  try { config = json(path.join(engine,'config.json')); } catch {}
  const users = Object.entries(config).filter(([,v]) => v && typeof v === 'object' && v.wproperties);
  const preferred = users.find(([name]) => name.toLowerCase() === String(process.env.USERNAME || '').toLowerCase()) || users[0];
  const user = preferred?.[1] || {};
  const match = Object.entries(user.wproperties || {}).find(([file]) => path.dirname(file.replaceAll('/',path.sep)).toLowerCase() === entry.folder.toLowerCase());
  const saved = match?.[1]?.[monitor] || {};
  const properties = structuredClone(entry.properties);
  for (const [key,value] of Object.entries(saved)) if (properties[key]) properties[key].value = value?.value ?? value;
  const finite=(v,f)=>Number.isFinite(Number(v))?Number(v):f;
  return {properties, saved, monitor, monitors:Object.keys(match?.[1] || {}), source:match?.[1]?.[monitor] ? 'Wallpaper Engine' : 'author',fps:Math.max(1,Math.min(120,finite(user.general?.user?.fps,30))),
    playback:{volume:Math.max(0,Math.min(100,finite(saved.volume,0)))/100, speed:Math.max(.25,Math.min(4,finite(saved.playbackrate,1))), fit:'cover'}};
}
module.exports = {json, inside, discover, scan, settings};
