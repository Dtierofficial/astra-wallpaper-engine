const {test}=require('node:test');
const assert=require('node:assert/strict');
const {spawn,execFileSync}=require('node:child_process');
const fs=require('node:fs');
const path=require('node:path');
const os=require('node:os');
const {startWindowMonitor}=require('../src/window-monitor');

test('native monitor observes a test window minimize, restore, hide and exit', {skip:process.platform!=='win32',timeout:20000},async t=>{
  const list=execFileSync('tasklist.exe',['/FI','IMAGENAME eq astraui.exe','/FO','CSV','/NH'],{encoding:'utf8',windowsHide:true});
  if(/"astraui\.exe"/i.test(list)){t.skip('Real Astra UI is open; do not disturb or confuse it with the fixture.');return;}
  const root=fs.mkdtempSync(path.join(os.tmpdir(),'we-window-'));
  const source=path.join(root,'fixture.cs'),binary=path.join(root,'astraui.exe');
  fs.writeFileSync(source,`using System;using System.Windows.Forms;
    class Fixture { [STAThread]static void Main(){
      Form f=new Form();f.Text="Wallpaper bridge visibility test";f.Width=360;f.Height=100;f.ShowInTaskbar=false;
      Timer timer=new Timer();timer.Interval=1600;int step=0;
      timer.Tick+=delegate{step++;if(step==1)f.WindowState=FormWindowState.Minimized;
        if(step==2){f.WindowState=FormWindowState.Normal;f.Show();}
        if(step==3)f.Hide();if(step==4)f.Close();};
      f.Shown+=delegate{timer.Start();};Application.Run(f);
    }}`);
  const compiler=path.join(process.env.WINDIR,'Microsoft.NET/Framework64/v4.0.30319/csc.exe');
  execFileSync(compiler,['/nologo','/target:winexe','/reference:System.Windows.Forms.dll',`/out:${binary}`,source],{windowsHide:true});
  const transitions=[];
  let fixture;
  const monitor=startWindowMonitor(path.resolve('dist/window-monitor.exe'),s=>transitions.push(s.visible));
  try{
    fixture=spawn(binary,[],{stdio:'ignore'});
    await new Promise((resolve,reject)=>{fixture.on('error',reject);fixture.on('exit',resolve);});
    assert.deepEqual(transitions.slice(-4),[true,false,true,false]);
    console.log('Native visibility transitions:',transitions);
  }finally{fixture?.kill();monitor.close();fs.rmSync(root,{recursive:true,force:true});}
});
