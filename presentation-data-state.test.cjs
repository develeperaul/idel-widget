const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const page=await browser.newPage({viewport:{width:910,height:180}});
  let release;const gate=new Promise(r=>release=r);let fail=true;
  await page.route('**/api/**',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.endsWith('/presentation/chapters'))return route.fulfill({json:{items:[]}});
   if(u.pathname.endsWith('/sections'))return route.fulfill({json:{items:[]}});
   if(u.searchParams.get('chapter')==='project'){
    await gate;
    if(fail)return route.fulfill({status:503,json:{error:{message:'test unavailable'}}});
    return route.fulfill({json:{items:[{id:981,target:'server-only',name:'Объект только из API',description:['Настоящее описание']} ]}});
   }
   return route.fulfill({json:{items:[]}});
  });
  await page.goto(pathToFileURL(path.join(__dirname,'index.html')).href+'?mode=unreal&panel=navigation&data=standalone',{waitUntil:'domcontentloaded',timeout:120000});
  await page.getByRole('button',{name:'О проекте',exact:true}).click();
  await page.getByText('Загрузка объектов…',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-project-target]').count(),0,'no local objects while waiting');
  release();
  await page.getByRole('button',{name:'Повторить',exact:true}).waitFor();
  assert.equal(await page.locator('[data-project-target]').count(),0,'no fallback after failure');
  fail=false;await page.getByRole('button',{name:'Повторить',exact:true}).click();
  await page.getByRole('button',{name:'Объект только из API',exact:true}).waitFor();
  assert.equal(await page.locator('[data-project-target]').count(),1);
  await page.getByRole('button',{name:'Архитектура',exact:true}).click();
  await page.getByText('В этом разделе пока нет объектов.',{exact:true}).waitFor();
  assert.equal(await page.locator('[data-chapter-target]').count(),0,'empty API stays empty');
  console.log('PASS server-only presentation: loading has no placeholders, error/retry, API-only object, empty chapter');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
