const {spawn}=require('node:child_process');
const path=require('node:path');

function startWindowMonitor(binary=path.join(__dirname,'window-monitor.exe'),onChange=()=>{}) {
  let status={supported:false,visible:true,at:0},closed=false,child;
  if(process.platform==='win32') {
    child=spawn(binary,[String(process.pid)],{windowsHide:true,stdio:['ignore','pipe','ignore']});
    let buffer='';
    child.stdout.on('data',chunk=>{
      buffer+=chunk.toString();
      const lines=buffer.split(/\r?\n/);buffer=lines.pop().slice(-100);
      for(const line of lines)if(line==='visible'||line==='hidden'){
        const changed=!status.supported||status.visible!==(line==='visible');
        status={supported:true,visible:line==='visible',at:Date.now()};
        if(changed)Promise.resolve(onChange({...status})).catch(()=>{});
      }
    });
    child.on('error',()=>{status.supported=false;});
    child.on('exit',()=>{if(!closed)status.supported=false;});
  }
  return {
    state(){return {...status,supported:status.supported&&Date.now()-status.at<3500};},
    close(){closed=true;child?.kill();}
  };
}
module.exports={startWindowMonitor};
