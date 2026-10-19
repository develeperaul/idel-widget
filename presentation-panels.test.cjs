const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {pathToFileURL}=require('node:url');
const path=require('node:path');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:'chrome'});
 try{
  const errors=[];
  async function setup(width,height,panel){
   const p=await browser.newPage({viewport:{width,height}});p.on('pageerror',e=>errors.push(e.message));
   await p.route('**/api/**',r=>{
    const u=new URL(r.request().url()),chapter=u.searchParams.get('chapter');
    const items=u.pathname.endsWith('/presentation/chapters')?[{id:133,chapter:'project',cameraCoordinates:'111'}]
     :u.pathname.endsWith('/sections')?[{id:1,target:'section-1',name:'Секция 1',description:['Описание секции из API']}]
     :chapter==='project'?[{id:1741,target:'section-1',name:'Секция 1',description:[],cameraCoordinates:'222'},{id:1775,target:'courtyard-second-stage',name:'Двор второй очереди',description:[],cameraCoordinates:'111'}]
     :chapter==='entrance'?[{id:2,target:'playroom',name:'Детская игровая',roomLabel:'Помещение 1',description:['Описание МОП из API']}]:[];
    return r.fulfill({json:{items}});
   });
   await p.goto(pathToFileURL(path.join(__dirname,'index.html')).href+'?data=standalone&mode=unreal&panel='+panel,{waitUntil:'domcontentloaded',timeout:120000});
   await p.evaluate(()=>{window.commands=[];window.addEventListener('idel-command',e=>commands.push(e.detail))});return p;
  }
  const nav=await setup(910,180,'navigation');
  assert.equal(await nav.locator('[data-chapter]').count(),6);
  assert.equal(await nav.locator('.top,.bottom,.compass,.session-exit-button').count(),0);
  await nav.locator('[data-category="cafe"]').click();
  assert.equal(await nav.evaluate(()=>commands.at(-1).method),'ui.presentation.state');
  assert.equal(await nav.evaluate(()=>commands.at(-1).params.categories.includes('cafe')),false);
  await nav.locator('[data-chapter="project"]').click();
  await nav.locator('[data-project-target="section-1"]').waitFor();
  await nav.waitForFunction(()=>commands.some(c=>c.method==='scene.requestPresentationCamera'&&c.params.scope==='chapter'));
  assert.equal(await nav.evaluate(()=>commands.find(c=>c.method==='scene.requestPresentationCamera').params.cameraCoordinates),'111');
  assert.equal(await nav.locator('[data-project-target="section-1"]').count(),1);
  assert.equal(await nav.locator('.project-target[aria-pressed="true"]').count(),0,'no initial point selection');
  await nav.locator('[data-project-target="section-1"]').click();
  assert.equal(await nav.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.state').at(-1).params.projectTarget),'section-1');
  await nav.locator('[data-project-target="courtyard-second-stage"]').click();
  const camera=await nav.evaluate(()=>commands.filter(c=>c.method==='scene.requestPresentationCamera').at(-1).params);
  assert.equal(camera.scope,'object');assert.equal(camera.id,1775);assert.equal(camera.cameraCoordinates,'111');
  await nav.locator('[data-chapter="entrance"]').click();
  await nav.locator('[data-chapter-target="playroom"]').waitFor();
  assert.equal(await nav.locator('.project-target[aria-pressed="true"]').count(),0,'changing chapter clears the previous point');
  assert.equal(await nav.evaluate(()=>IdelWidget.getState().projectTarget),null);
  const snapshot=await nav.evaluate(()=>IdelWidget.getState());
  // Leaving a chapter clears its point and card; returning must stay unselected.
  await nav.locator('[data-chapter-target="playroom"]').click();
  await nav.locator('[data-chapter="location"]').click();
  await nav.waitForFunction(()=>commands.filter(c=>c.method==='ui.presentation.description').at(-1)?.params.visible===false);
  await nav.locator('[data-chapter="entrance"]').click();
  const cleared=await nav.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.description').at(-1).params);
  assert.equal(cleared.visible,false);assert.equal(cleared.target,null);
  assert.equal(await nav.locator('.project-target[aria-pressed="true"]').count(),0);
  await nav.locator('[data-chapter-target="playroom"]').click();
  assert.equal(await nav.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.description').at(-1).params.visible),true,'a new explicit click shows text');
  await nav.evaluate(()=>IdelWidget.setState({chapterTargets:{entrance:null}}));
  assert.equal(await nav.locator('.project-target[aria-pressed="true"]').count(),0,'null clears a relayed selection');
  await nav.locator('[data-chapter="project"]').click();
  await nav.waitForFunction(()=>commands.filter(c=>c.method==='ui.presentation.description').at(-1)?.params.view==='project');
  assert.equal(await nav.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.description').at(-1).params.visible),false,'returning to project does not restore its old point');
  assert.equal(await nav.evaluate(()=>IdelWidget.getState().projectTarget),null);
  const toolbar=await setup(340,120,'toolbar');
  await toolbar.evaluate(s=>IdelWidget.setState(s),snapshot);
  assert.equal(await toolbar.evaluate(()=>commands.length),0);
  await toolbar.locator('[data-action="ui.info"]').click();
  assert.equal(await toolbar.evaluate(()=>commands.some(c=>c.method==='ui.presentation.state')),true);
  assert.equal(await toolbar.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.state').at(-1).params.view),'home');
  await toolbar.locator('[data-action="ui.info"]').click();
  assert.equal(await toolbar.evaluate(()=>commands.filter(c=>c.method==='ui.presentation.state').at(-1).params.view),'location');
  const desc=await setup(297,280,'description');
  await desc.evaluate(s=>IdelWidget.setState({...s,title:'Детская игровая',description:['Описание МОП из API'],target:'playroom'}),snapshot);
  await desc.getByText('Описание МОП из API',{exact:true}).waitFor();
  assert.equal(await desc.evaluate(()=>commands.length),0,'setState must not echo commands');
  await desc.locator('[data-action="scene.requestInteriorView"]').click();
  assert.equal(await desc.evaluate(()=>commands.at(-1).params.target),'playroom');
  await desc.evaluate(()=>IdelWidget.setState({view:'location'}));
  assert.equal(await desc.locator('.isolated-description').count(),0);
  await desc.evaluate(()=>IdelWidget.setState({view:'project',title:'Секция 1',description:['Описание секции из API'],target:'section-1'}));
  await desc.getByText('Описание секции из API',{exact:true}).waitFor();
  for(const p of [nav,desc]){assert.equal(await p.evaluate(()=>getComputedStyle(document.body).backgroundColor),'rgba(0, 0, 0, 0)');assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false)}
  await nav.locator('img').evaluateAll(images=>Promise.all(images.map(i=>i.decode())));
  await nav.screenshot({path:'/private/tmp/idel-navigation-panel.png',omitBackground:true});
  await desc.screenshot({path:'/private/tmp/idel-description-panel.png',omitBackground:true});
  await nav.evaluate(()=>IdelWidget.setState({view:'home'}));
  assert.equal(await nav.locator('.location-controls').count(),0);
  assert.deepEqual(errors,[]);
  console.log('PASS presentation panels: chapters, API objects, infrastructure, state relay, description, no echo, bounds');
 }finally{await browser.close()}
})().catch(e=>{console.error(e);process.exit(1)});
