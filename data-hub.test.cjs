const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const base=pathToFileURL(path.join(__dirname,'index.html')).href;
  const owner=await browser.newPage({viewport:{width:1920,height:1080}});
  const peers=[],errors=[],calls=[],packets=[];
  let failArchitecture=true,offline=false;
  const longDescription='Данные из общего кэша. '.repeat(900);
  owner.on('pageerror',e=>errors.push(e.message));
  owner.on('console',msg=>{
   if(!msg.text().startsWith('IDEL:'))return;
   let event;try{event=JSON.parse(msg.text().slice(5))}catch{return}
   if(event.method==='data.response'){
    packets.push(event.params);
    for(const p of peers)p.evaluate(x=>window.IdelData?.receive(x),event.params).catch(e=>errors.push(e.message));
   }
  });
  await owner.addInitScript(()=>{window.IdelConfig={realSession:false,dataRequestTimeoutMs:1000}});
  await owner.route('**/api/**',async route=>{
   const u=new URL(route.request().url());calls.push(u.pathname+u.search);
   if(offline)return route.abort();
   if(u.pathname.endsWith('/properties/filters'))return route.fulfill({json:{options:{section:[],rooms:[],features:[]},bounds:{}}});
   if(u.pathname.endsWith('/properties')){
    const type=u.searchParams.get('type'),page=Number(u.searchParams.get('page'));
    return route.fulfill({json:{items:type==='apartment'?[{id:page,type,status:'available',number:String(page),price:page*100,area:50,floor:page,section:{id:21},features:[],apartment:{rooms:page}}]:[],meta:{hasNext:type==='apartment'&&page===1}}});
   }
   if(u.pathname.endsWith('/presentation/chapters'))return route.fulfill({json:{items:[{id:133,chapter:'project',name:'О проекте',cameraCoordinates:'111'}]}});
   if(u.pathname.endsWith('/sections'))return route.fulfill({json:{items:[{id:21,target:'section-1',name:'Секция 1',description:[longDescription]}]}});
   const chapter=u.searchParams.get('chapter');
   if(chapter==='architecture'&&failArchitecture)return route.fulfill({status:503,json:{error:{message:'temporary'}}});
   return route.fulfill({json:{items:chapter==='project'?[{id:1741,target:'section-1',name:'Секция 1',description:[],cameraCoordinates:'222'}]:chapter==='entrance'?[{id:2,target:'new-room-from-api',name:'Новый МОП',description:['Готовое описание МОПа'],cameraCoordinates:'333'}]:[]}});
  });
  await owner.goto(base+'?mode=unreal&panel=session');
  await owner.waitForFunction(()=>window.IdelData?.getStatus().started&&!IdelData.getStatus().running&&IdelData.getStatus().tasks.length===15);
  let status=await owner.evaluate(()=>IdelData.getStatus());
  assert.equal(status.tasks.filter(t=>t.state==='error').length,1);
  assert.ok(status.tasks.some(t=>t.key==='catalogue:storage'&&t.state==='ready'));
  assert.equal(await owner.locator('.data-cache-status button').isVisible(),true);
  const beforeRetry=calls.length;failArchitecture=false;
  await owner.locator('.data-cache-status button').click();
  await owner.waitForFunction(()=>IdelData.getStatus().tasks.every(t=>t.state==='ready'));
  assert.equal(calls.length,beforeRetry+1);
  const preparedCalls=calls.length;
  // A login/reset must neither invalidate nor reload the common cache.
  await owner.locator('#start').click();await owner.locator('#guest').click();
  await owner.waitForFunction(()=>IdelSession.getState()?.mode==='guest');
  await owner.evaluate(()=>IdelSession.reset({save:false}));
  assert.equal(calls.length,preparedCalls);
  assert.equal(await owner.evaluate(()=>IdelData.getStatus().tasks.every(t=>t.state==='ready')),true);
  offline=true;
  async function peer(panel,width,height){
   const p=await browser.newPage({viewport:{width,height}});peers.push(p);
   p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/api/**',r=>{errors.push('Consumer made a direct API request');return r.abort()});
   p.on('console',msg=>{
    if(!msg.text().startsWith('IDEL:'))return;
    let e;try{e=JSON.parse(msg.text().slice(5))}catch{return}
    if(e.method==='data.request')owner.evaluate(x=>window.IdelData?.handleRequest(x),e.params).catch(e=>errors.push(e.message));
   });
   await p.goto(base+'?mode=unreal&panel='+panel,{waitUntil:'domcontentloaded',timeout:120000});return p;
  }
  const nav=await peer('navigation',910,180),desc=await peer('description',297,280);
  assert.equal(await desc.locator('.isolated-description').count(),0);
  await nav.evaluate(()=>{window.events=[];addEventListener('idel-command',e=>events.push(e.detail))});
  await nav.locator('[data-chapter="project"]').click();
  await nav.locator('[data-project-target="section-1"]').waitFor();
  await nav.locator('[data-project-target="section-1"]').click();
  const text=await nav.evaluate(()=>events.filter(e=>e.method==='ui.presentation.description').at(-1).params);
  assert.equal(text.title,'Секция 1');assert.equal(text.description[0],longDescription);
  await desc.evaluate(x=>IdelWidget.setState(x),text);
  await desc.getByRole('heading',{name:'Секция 1',exact:true}).waitFor();
  assert.ok(packets.some(x=>x.total>1),'large responses must be chunked');
  // Native Unreal point selects an API-only target without issuing a camera move again.
  await nav.evaluate(()=>events=[]);
  assert.equal(await nav.evaluate(()=>IdelWidget.selectObject({chapter:'entrance',target:'new-room-from-api'})),true);
  assert.equal(await nav.locator('[data-chapter-target="new-room-from-api"]').getAttribute('aria-pressed'),'true');
  assert.equal(await nav.evaluate(()=>events.some(e=>e.method==='scene.requestPresentationCamera')),false);
  const room=await nav.evaluate(()=>events.find(e=>e.method==='ui.presentation.description').params);
  await desc.evaluate(x=>IdelWidget.setState(x),room);await desc.getByText('Готовое описание МОПа',{exact:true}).waitFor();
  await desc.evaluate(()=>IdelWidget.setState({title:'Пустой объект',description:[' ',''],visible:false}));
  assert.equal(await desc.locator('.isolated-description').count(),0);
  const result=await nav.evaluate(()=>IdelData.read('properties?type=apartment&rooms[]=2&status[]=available&limit=100&page=1'));
  assert.deepEqual(result.items.map(x=>x.id),[2]);
  assert.equal((await nav.evaluate(()=>IdelData.read('properties/apartment/1'))).item.id,1);
  assert.equal(calls.length,preparedCalls,'offline consumers must read from the owner cache only');
  const invalid=await nav.evaluate(async()=>{try{await IdelData.read('favorites');return false}catch{return true}});assert.equal(invalid,true);
  await nav.screenshot({path:'/private/tmp/idel-cache-navigation.png',omitBackground:true});
  await desc.evaluate(()=>IdelWidget.setState({view:'project',title:'Секция 1',description:['Описание передано из общего хранилища.']}));
  await desc.screenshot({path:'/private/tmp/idel-cache-description.png',omitBackground:true});
  assert.deepEqual(errors,[]);
  console.log('PASS data hub: startup queue, isolated failure/retry, public cache survives logout, offline navigation/catalogue, no consumer fetch, chunk relay, native point sync, pure-text/empty description');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
