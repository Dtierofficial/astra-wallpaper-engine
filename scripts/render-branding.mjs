import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {chromium} from 'playwright';
import path from 'node:path';

mkdirSync('docs/assets',{recursive:true});
const english=readFileSync('docs/assets/cover-en.svg','utf8');
const russian=english
  .replace('BY DtieR · AN UNOFFICIAL INTEGRATION','DtieR · НЕОФИЦИАЛЬНАЯ ИНТЕГРАЦИЯ')
  .replace('Your wallpapers.','Твои обои.').replace('Inside Astra.','Внутри Astra.')
  .replace('Browse your Wallpaper Engine library.','Твоя библиотека Wallpaper Engine.')
  .replace('Choose a background. Make Astra yours.','Выбирай фон. Создавай атмосферу.')
  .replace('VIDEO + IMAGES','ВИДЕО + ФОТО').replace('LOCAL FIRST','ЛОКАЛЬНО')
  .replace('Wallpaper Engine for Astra','Wallpaper Engine для Astra')
  .replace('Windows · Astra 0.2.7+ · Scene/PKG not supported','Windows · Astra 0.2.7+ · Сцены/PKG не поддерживаются')
  .replace('YOUR LIBRARY. YOUR ATMOSPHERE.','ТВОЯ БИБЛИОТЕКА. ТВОЯ АТМОСФЕРА.');
writeFileSync('docs/assets/cover-ru.svg',russian);
const browser=await chromium.launch();
try {
  const page=await browser.newPage({viewport:{width:1600,height:900},deviceScaleFactor:1});
  for(const [file,width,height,out]of [['icon.svg',64,64,'icon.png'],['icon.svg',512,512,'docs/assets/icon-512.png'],['docs/assets/cover-en.svg',1600,900,'docs/assets/cover-en.png'],['docs/assets/cover-ru.svg',1600,900,'docs/assets/cover-ru.png']]){
    await page.setViewportSize({width,height});
    await page.setContent(`<style>html,body{margin:0;background:transparent}img{display:block;width:100vw;height:100vh}</style><img alt="" src="data:image/svg+xml;base64,${Buffer.from(readFileSync(file)).toString('base64')}">`);
    await page.locator('img').evaluate(async image=>{await image.decode();});
    await page.screenshot({path:out,omitBackground:true});
    console.log(path.resolve(out));
  }
} finally{await browser.close();}
