import { send } from '../bridge.js';
import { createSessionCache, publicResource } from '../data/sessionCache.js';
import { setDataGateway } from './dataGateway.js';
import { catalogRequestDirect } from './catalog.js';
import { loadSessionManagers, realSessionEnabled } from './session.js';

export function createBrowserDataRuntime(panel) {
  const isolated = panel !== 'full';
  const enabled = isolated && window.IdelConfig?.dataMode !== 'standalone' && new URLSearchParams(location.search).get('data') !== 'standalone';
  if (!enabled) return { api: { role:'standalone' }, start() {}, dispose() {} };
  let stopped=false;
  if (panel === 'session') {
    const handling = new Set();
    const cache=createSessionCache({
      timeoutMs: window.IdelConfig?.dataRequestTimeoutMs || 15000,
      fetchResource: async (path,options) => path==='managers'&&!realSessionEnabled
        ? {items:await loadSessionManagers(options)} : catalogRequestDirect(path,options),
      onStatus: status => { if(!stopped){window.dispatchEvent(new CustomEvent('idel-cache-status',{detail:status}));send('data.cache.status',status)} },
    });
    setDataGateway((path,options)=>{
      if(options.token || (options.method&&options.method!=='GET')) return catalogRequestDirect(path,options);
      return cache.read(path);
    });
    async function handleRequest(packet) {
      const requestId=packet?.requestId;
      if(stopped||typeof requestId!=='string'||!/^[a-zA-Z0-9_.-]{1,128}$/.test(requestId))return false;
      if(handling.has(requestId))return true;
      handling.add(requestId);
      let response;
      try { publicResource(packet.path); response={ok:true,data:await cache.read(packet.path)}; }
      catch { response={ok:false,error:'Данные пока недоступны. Повторите загрузку в BrowserSession.'}; }
      if(stopped){handling.delete(requestId);return false}
      const text=JSON.stringify(response),size=8000,total=Math.ceil(text.length/size);
      for(let index=0;index<total;index++) send('data.response',{requestId,index,total,chunk:text.slice(index*size,(index+1)*size)});
      handling.delete(requestId);
      return true;
    }
    return {
      api:{role:'owner',getStatus:cache.status,read:cache.read,retry:cache.retry,handleRequest},
      start(){const config=window.IdelConfig||{};return cache.start(config.galleryApi?{galleryPath:`presentation/gallery?residentialComplex=${encodeURIComponent(config.galleryComplexId||148)}`}:{})},
      dispose(){stopped=true;cache.dispose();setDataGateway(null)},
    };
  }

  const requests=new Map();let sequence=0;
  const instance=`${panel}-${Date.now()}-${Math.random().toString(36).slice(2,10)}`;
  function request(path,{signal,token,method='GET'}={}) {
    if(token||method!=='GET')return Promise.reject(new Error('Личные операции выполняет BrowserSession; токен нельзя передавать через общий канал.'));
    publicResource(path);
    if(signal?.aborted)return Promise.reject(new DOMException('Запрос отменён.','AbortError'));
    if(stopped)return Promise.reject(new Error('Browser закрыт.'));
    return new Promise((resolve,reject)=>{
      const requestId=`${instance}-${++sequence}`;
      const finish=(error,data)=>{
        const entry=requests.get(requestId);if(!entry)return;
        clearTimeout(entry.timer);clearInterval(entry.resend);signal?.removeEventListener('abort',entry.abort);requests.delete(requestId);
        if(error)reject(error);else resolve(data);
      };
      const abort=()=>finish(new DOMException('Запрос отменён.','AbortError'));
      const timer=setTimeout(()=>finish(new Error('Нет ответа BrowserSession. Проверьте передачу data.request/data.response в Unreal.')),window.IdelConfig?.dataBridgeTimeoutMs||120000);
      const resend=setInterval(()=>send('data.request',{requestId,path}),2000);
      requests.set(requestId,{finish,abort,timer,resend,chunks:[],total:null,bytes:0});
      signal?.addEventListener('abort',abort,{once:true});
      send('data.request',{requestId,path});
    });
  }
  function receive(packet) {
    const entry=requests.get(packet?.requestId);if(!entry)return false;
    const {index,total,chunk}=packet;
    if(!Number.isInteger(total)||total<1||total>4096||!Number.isInteger(index)||index<0||index>=total||typeof chunk!=='string'||chunk.length>8000||(entry.total!==null&&entry.total!==total)){
      entry.finish(new Error('Неверный ответ хранилища.'));return false;
    }
    entry.total=total;
    if(entry.chunks[index]!==undefined){if(entry.chunks[index]!==chunk)entry.finish(new Error('Повреждён ответ хранилища.'));return false}
    entry.bytes+=chunk.length;
    if(entry.bytes>16000000){entry.finish(new Error('Ответ хранилища слишком большой.'));return false}
    entry.chunks[index]=chunk;
    if(entry.chunks.filter(x=>x!==undefined).length===total){
      try{const response=JSON.parse(entry.chunks.join(''));entry.finish(response.ok?null:new Error(response.error||'Не удалось загрузить данные.'),response.data)}
      catch{entry.finish(new Error('Не удалось разобрать ответ хранилища.'))}
    }
    return true;
  }
  setDataGateway(request);
  return {api:{role:'consumer',read:request,receive,getStatus:()=>({role:'consumer',pending:requests.size})},start(){},dispose(){stopped=true;for(const entry of [...requests.values()])entry.finish(new Error('Browser закрыт.'));setDataGateway(null)}};
}
