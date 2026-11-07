const {test}=require('node:test');
const assert=require('node:assert/strict');
const {en,ru,normalize,t}=require('../ui/i18n');

test('Russian and English UI dictionaries have identical keys and placeholders',()=>{
  assert.deepEqual(Object.keys(en).sort(),Object.keys(ru).sort());
  for(const key of Object.keys(en)){
    assert.ok(en[key].trim()&&ru[key].trim(),key);
    assert.deepEqual((en[key].match(/\{\w+\}/g)||[]).sort(),(ru[key].match(/\{\w+\}/g)||[]).sort(),key);
  }
  assert.equal(normalize('ru-RU'),'ru');assert.equal(normalize('de-DE'),'en');
  assert.equal(t('en','results',{shown:1,total:2}),'Wallpapers: 1 / 2');
});
