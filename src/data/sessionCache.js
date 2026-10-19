const copy = value => value === undefined ? null : JSON.parse(JSON.stringify(value));
const types = ['apartment', 'parking', 'storage'];
export const cacheChapters = ['project', 'architecture', 'park', 'courtyard', 'entrance', 'location'];
const statuses = ['available', 'reserved', 'sold'];
const statusQuery = () => statuses.map(s => `status[]=${s}`).join('&');

export function publicResource(path) {
  if (typeof path !== 'string' || path.length > 4096 || /^[/\\]|:|#/.test(path)) throw new Error('Недопустимый ресурс кэша.');
  const url = new URL(path, 'https://cache.invalid/');
  const name = url.pathname.slice(1);
  if (!['managers', 'sections', 'presentation/chapters', 'presentation/objects', 'presentation/gallery', 'properties', 'properties/filters'].includes(name) && !/^properties\/(apartment|parking|storage)\/[1-9]\d*$/.test(name)) throw new Error('Ресурс не относится к общему кэшу.');
  const pairs = [...url.searchParams].sort(([a,av],[b,bv]) => a.localeCompare(b) || av.localeCompare(bv));
  const query = new URLSearchParams(pairs).toString();
  return { name, params: url.searchParams, key: name + (query ? '?' + query : '') };
}

export function createSessionCache({ fetchResource, onStatus = () => {}, timeoutMs = 15000 }) {
  const data = new Map(), pending = new Map(), tasks = new Map(), queue = [];
  let running = false, started = false, disposed = false;
  const active = new Set();
  function status() {
    return { started, running, tasks: [...tasks].map(([key,value]) => ({ key, ...value })) };
  }
  const report = () => onStatus(copy(status()));
  async function fetchOne(path) {
    const controller = new AbortController(); active.add(controller);
    let timer;
    try {
      return await Promise.race([
        fetchResource(path, { signal: controller.signal }),
        new Promise((_, reject) => { timer = setTimeout(() => { controller.abort(); reject(new Error('Превышено время загрузки.')); }, timeoutMs); }),
      ]);
    } finally { clearTimeout(timer); active.delete(controller); }
  }
  async function pump() {
    if (running || disposed) return;
    running = true;
    while (queue.length && !disposed) {
      const job = queue.shift();
      tasks.set(job.key, { state: 'loading', error: '', updatedAt: null }); report();
      try {
        const value = await job.load();
        if (disposed) throw new Error('Хранилище закрыто.');
        data.set(job.key, copy(value));
        tasks.set(job.key, { state: 'ready', error: '', updatedAt: new Date().toISOString() });
        job.resolve(copy(value));
      } catch {
        // Never include credentials or server response bodies in status/log events.
        tasks.set(job.key, { state: 'error', error: 'Не удалось загрузить данные. Повторите запрос.', updatedAt: null });
        job.reject(new Error('Не удалось загрузить данные. Повторите запрос.'));
      } finally { pending.delete(job.key); report(); }
    }
    running = false; report();
  }
  function enqueue(key, load) {
    if (disposed) return Promise.reject(new Error('Хранилище закрыто.'));
    if (data.has(key)) return Promise.resolve(copy(data.get(key)));
    if (pending.has(key)) return pending.get(key).then(copy);
    const promise = new Promise((resolve,reject) => queue.push({ key, load, resolve, reject }));
    pending.set(key,promise); tasks.set(key,{state:'queued',error:'',updatedAt:null});
    // Start after all startup jobs have been enqueued in their declared order.
    queueMicrotask(pump);
    return promise;
  }
  function readRaw(path) {
    const {key,name}=publicResource(path);
    return enqueue(key, async () => {
      const result = await fetchOne(path);
      if (name === 'properties/filters') {
        if (!result?.options || !result?.bounds) throw new Error('Неверные фильтры.');
      } else if (!Array.isArray(result?.items)) throw new Error('Неверные данные.');
      return result;
    });
  }
  function catalogue(type) {
    if (!types.includes(type)) return Promise.reject(new Error('Неверный тип объекта.'));
    return enqueue('catalogue:' + type, async () => {
      const items=[], ids=new Set();
      for (let page=1;page<=10000;page++) {
        const result=await fetchOne(`properties?type=${type}&limit=100&page=${page}&${statusQuery()}`);
        if (!Array.isArray(result?.items) || typeof result?.meta?.hasNext !== 'boolean') throw new Error('Неверный каталог.');
        for(const item of result.items) {
          if (!Number.isSafeInteger(item?.id) || item.type!==type || ids.has(item.id)) throw new Error('Неверный объект каталога.');
          ids.add(item.id);items.push(item);
        }
        if (!result.meta.hasNext) return {items};
        if (!result.items.length) throw new Error('Пустая страница каталога.');
      }
      throw new Error('Слишком много страниц.');
    });
  }
  async function read(path) {
    const {name,params}=publicResource(path);
    if (name==='properties') {
      const type=params.get('type')||'apartment';
      return queryCatalogue((await catalogue(type)).items,params);
    }
    const detail=/^properties\/(apartment|parking|storage)\/([1-9]\d*)$/.exec(name);
    if (detail) {
      const item=(await catalogue(detail[1])).items.find(x=>x.id===Number(detail[2]));
      if (!item) throw new Error('Объект отсутствует в каталоге.');
      return {item:copy(item)};
    }
    // target/category are projections of the complete preloaded chapter.
    if (name==='presentation/objects') {
      const chapter=params.get('chapter');
      if (!cacheChapters.includes(chapter)) throw new Error('Неверный раздел.');
      const result=await readRaw(`presentation/objects?chapter=${chapter}`);
      const items=result.items.filter(x=>(!params.has('target')||x.target===params.get('target'))&&(!params.has('category')||x.category===params.get('category')));
      return {...result,items,meta:{...result.meta,total:items.length}};
    }
    return readRaw(path);
  }
  function start({galleryPath}={}) {
    if (started) return Promise.resolve(status());
    started=true;
    const jobs=[readRaw('managers'),readRaw('presentation/chapters'),readRaw('sections')];
    for(const chapter of cacheChapters) jobs.push(readRaw(`presentation/objects?chapter=${chapter}`));
    for(const type of types) jobs.push(readRaw(`properties/filters?type=${type}&${statusQuery()}`),catalogue(type));
    if(galleryPath) jobs.push(readRaw(galleryPath));
    return Promise.allSettled(jobs).then(status);
  }
  async function retry() {
    const jobs=[];
    for(const [key,task] of tasks) if(task.state==='error') jobs.push(key.startsWith('catalogue:')?catalogue(key.slice(10)):readRaw(key));
    await Promise.allSettled(jobs);return status();
  }
  function dispose() { disposed=true; for(const controller of active) controller.abort(); for(const job of queue.splice(0))job.reject(new Error('Хранилище закрыто.')); }
  return {start,read,status,retry,dispose};
}

function queryCatalogue(source,params) {
  const allowed=new Set(['type','page','limit','status[]','section','number','areaFrom','areaTo','priceFrom','priceTo','features[]','rooms[]','studio','floorFrom','floorTo','level','size','sort','order']);
  for(const key of params.keys())if(!allowed.has(key))throw new Error('Неизвестный фильтр.');
  const page=Number(params.get('page')||1),limit=Number(params.get('limit')||20);
  if(!Number.isInteger(page)||page<1||!Number.isInteger(limit)||limit<1||limit>100)throw new Error('Неверная страница.');
  const wanted=params.getAll('status[]');
  const items=source.filter(item=>{
    if(!(wanted.length?wanted:['available']).includes(item.status))return false;
    if(params.has('section')&&item.section?.id!==Number(params.get('section')))return false;
    if(params.has('number')&&String(item.number)!==params.get('number'))return false;
    for(const key of ['area','price','floor'])for(const side of ['From','To'])if(params.has(key+side)) {
      const value=item[key],bound=Number(params.get(key+side));
      if(value===null||value===undefined||!Number.isFinite(bound)||(side==='From'?value<bound:value>bound))return false;
    }
    const rooms=params.getAll('rooms[]').map(Number),room=item.apartment?.isStudio?0:item.apartment?.rooms;
    if(rooms.length&&!rooms.includes(room))return false;
    if(params.has('studio')&&!!item.apartment?.isStudio!==(params.get('studio')==='true'))return false;
    const features=(item.features||[]).map(x=>typeof x==='object'?x.id:x);
    if(!params.getAll('features[]').every(x=>features.includes(Number(x))))return false;
    if(params.has('level')&&item.parking?.level!==Number(params.get('level')))return false;
    if(params.has('size')&&item.parking?.size!==params.get('size'))return false;
    return true;
  });
  const sort=params.get('sort')||'price',order=params.get('order')==='desc'?-1:1;
  if(!['price','area','floor','number','id','level','size'].includes(sort))throw new Error('Неверная сортировка.');
  items.sort((a,b)=>{const av=a[sort]??a.parking?.[sort]??null,bv=b[sort]??b.parking?.[sort]??null;return av===bv?a.id-b.id:av===null?1:bv===null?-1:order*(av<bv?-1:1)});
  return {items:copy(items.slice((page-1)*limit,page*limit)),meta:{total:items.length,page,limit,totalPages:Math.max(1,Math.ceil(items.length/limit)),hasNext:page*limit<items.length}};
}
