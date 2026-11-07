const http=require('node:http');
const fs=require('node:fs');
const path=require('node:path');
const {randomBytes}=require('node:crypto');
const {inside}=require('./library');
const {byteRange}=require('./server');

const TYPES={'.html':'text/html; charset=utf-8','.htm':'text/html; charset=utf-8','.js':'application/javascript; charset=utf-8','.mjs':'application/javascript; charset=utf-8',
  '.css':'text/css; charset=utf-8','.json':'application/json','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp',
  '.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.ogv':'video/ogg','.mp3':'audio/mpeg','.ogg':'audio/ogg','.wav':'audio/wav','.woff':'font/woff','.woff2':'font/woff2',
  '.ttf':'font/ttf','.wasm':'application/wasm','.frag':'text/plain','.vert':'text/plain','.glsl':'text/plain','.txt':'text/plain'};

// A separate server/origin, with no plugin APIs and no control token. This
// isolates author JavaScript from the library, backend and other wallpapers.
async function startWebServer(entry, compatibilityScript) {
  const token=randomBytes(24).toString('hex');
  const server=http.createServer((req,res)=>{
    try {
      if(req.headers.host!==`127.0.0.1:${server.address().port}`){res.writeHead(403).end();return;}
      if(!['GET','HEAD'].includes(req.method)){res.writeHead(405).end();return;}
      const rawPath=req.url.split('?')[0];
      const parts=rawPath.split('/');
      if(parts[1]!==token){res.writeHead(404).end();return;}
      const relative=parts.slice(2).map(decodeURIComponent).join('/');
      if(!relative||relative.split(/[\\/]/).some(p=>p==='..'||p==='.'||!p)||relative.includes(':')||/[\0-\x1f]/.test(relative)){res.writeHead(404).end();return;}
      const file=path.resolve(entry.folder,relative);
      const type=TYPES[path.extname(file).toLowerCase()];
      if(!type||!fs.existsSync(file)||!inside(entry.folder,file)||!fs.statSync(file).isFile()){res.writeHead(404).end();return;}
      res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
      // Opaque sandbox frames use origin null. This is only the selected
      // wallpaper's assets; never the plugin's API or unrestricted disk.
      res.setHeader('Access-Control-Allow-Origin','*');
      res.setHeader('Content-Security-Policy',"default-src 'none'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' blob:; font-src 'self' data:; connect-src 'self'; base-uri 'self'; form-action 'none'; object-src 'none'; frame-src 'none'; worker-src 'none'; sandbox allow-scripts");
      res.setHeader('Content-Type',type);
      if(file===entry.media) {
        if(fs.statSync(file).size>8*1024*1024){res.writeHead(413).end();return;}
        const html=fs.readFileSync(file,'utf8');
        const injected=`<script>${compatibilityScript.replace(/<\/script/gi,'<\\/script')}</script>`;
        const body=Buffer.from(/<head\b[^>]*>/i.test(html)?html.replace(/<head\b[^>]*>/i,match=>match+injected):injected+html);
        res.setHeader('Content-Length',body.length);res.writeHead(200);res.end(req.method==='HEAD'?undefined:body);return;
      }
      const size=fs.statSync(file).size;
      let range;try{range=byteRange(req.headers.range,size);}catch{res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
      res.setHeader('Accept-Ranges','bytes');res.setHeader('Content-Length',range?range.end-range.start+1:size);
      if(range)res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${size}`);
      res.writeHead(range?206:200);
      if(req.method==='HEAD'||!size){res.end();return;}
      const stream=fs.createReadStream(file,range||{});res.on('close',()=>stream.destroy());stream.on('error',()=>res.destroy());stream.pipe(res);
    }catch{if(!res.headersSent)res.writeHead(400);res.end();}
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  const relative=path.relative(entry.folder,entry.media).split(path.sep).map(encodeURIComponent).join('/');
  return {url:`http://127.0.0.1:${server.address().port}/${token}/${relative}`,close(){server.closeAllConnections();server.close();}};
}
module.exports={startWebServer};
