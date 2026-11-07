const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const {randomBytes} = require('node:crypto');
const {inside} = require('./library');
const MIME = {'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.gif':'image/gif','.webp':'image/webp','.bmp':'image/bmp','.svg':'image/svg+xml','.mp4':'video/mp4','.webm':'video/webm','.ogv':'video/ogg'};
function byteRange(value, size) {
  if (!value) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(value);
  if (!m || (!m[1] && !m[2]) || !size) throw Error('range');
  const start = m[1] ? Number(m[1]) : Math.max(0,size-Number(m[2]));
  const end = m[1] ? (m[2] ? Math.min(size-1,Number(m[2])) : size-1) : size-1;
  if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= size || (!m[1] && Number(m[2]) === 0)) throw Error('range');
  return {start,end};
}
async function startServer(api, uiRoot) {
  const token = randomBytes(24).toString('hex');
  const server = http.createServer(async (req,res) => {
    try {
      const url = new URL(req.url,'http://localhost');
      const parts = url.pathname.split('/').filter(Boolean);
      if (parts.shift() !== token) {res.writeHead(404).end();return;}
      if (req.headers.host !== `127.0.0.1:${server.address().port}`) {res.writeHead(403).end();return;}
      if (!['GET','HEAD','POST'].includes(req.method)) {res.writeHead(405).end();return;}
      res.setHeader('Cache-Control','no-store');
      res.setHeader('X-Content-Type-Options','nosniff');
      res.setHeader('Referrer-Policy','no-referrer');
      if (parts[0] === 'api' && parts[1] === 'state' && req.method === 'GET') {
        res.setHeader('Content-Type','application/json'); res.end(JSON.stringify(api.state())); return;
      }
      if (parts[0] === 'api' && parts[1] === 'call' && req.method === 'POST') {
        const origin = req.headers.origin;
        if (origin && origin !== `http://${req.headers.host}`) {res.writeHead(403).end();return;}
        let body = ''; for await (const b of req) {body += b; if (body.length > 32768) {res.writeHead(413).end(); return;}}
        const {method,params} = JSON.parse(body);
        const result = await api.call(method,params || {});
        res.setHeader('Content-Type','application/json');res.end(JSON.stringify(result));return;
      }
      if (!['GET','HEAD'].includes(req.method)) {res.writeHead(405).end();return;}
      let file;
      if (parts[0] === 'media') {
        const entry = api.entry(parts[1]);
        file = entry && (parts[2] === 'preview' ? entry.preview : parts[2] === 'video' && entry.kind==='video' ? entry.media : parts[2]==='image'&&entry.kind==='image'?entry.media:null);
        if (!file || !inside(entry.folder,file)) {res.writeHead(404).end();return;}
      } else {
        file = path.resolve(uiRoot,parts.join('/') || 'index.html');
        if (!fs.existsSync(file) || !inside(uiRoot,file)) {res.writeHead(404).end();return;}
      }
      const size = fs.statSync(file).size;
      let range;
      try {range = byteRange(req.headers.range,size);} catch {res.writeHead(416,{'Content-Range':`bytes */${size}`}).end();return;}
      res.setHeader('Content-Type', MIME[path.extname(file).toLowerCase()] || 'application/octet-stream');
      res.setHeader('Accept-Ranges','bytes');
      res.setHeader('Content-Length',range ? range.end-range.start+1 : size);
      if (range) res.setHeader('Content-Range',`bytes ${range.start}-${range.end}/${size}`);
      res.writeHead(range ? 206 : 200);
      if (req.method === 'HEAD' || !size) {res.end();return;}
      const stream = fs.createReadStream(file,range || {});
      res.on('close',()=>stream.destroy()); stream.on('error',()=>res.destroy());stream.pipe(res);
    } catch(e) { if (!res.headersSent) res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:e.message})); }
  });
  await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
  return {server,base:`http://127.0.0.1:${server.address().port}/${token}/`};
}
module.exports = {startServer,byteRange};
