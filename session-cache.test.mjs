import assert from 'node:assert/strict';
import {createSessionCache} from './src/data/sessionCache.js';
let active=0,maxActive=0,fail=true;
const calls=[];
const apartment=(id)=>({id,type:'apartment',status:id===2?'sold':'available',number:String(id),price:id*100,area:id*10,floor:id,section:{id:21},features:[{id:7}],apartment:{rooms:id,isStudio:false}});
const cache=createSessionCache({timeoutMs:1000,fetchResource:async path=>{
 active++;maxActive=Math.max(maxActive,active);calls.push(path);
 try{
  await new Promise(r=>setTimeout(r,1));
  const u=new URL(path,'https://test.invalid/');
  if(u.pathname.endsWith('/presentation/objects')&&u.searchParams.get('chapter')==='park'&&fail)throw new Error('offline');
  if(u.pathname.endsWith('/properties/filters'))return {options:{},bounds:{}};
  if(u.pathname==='/properties'){
   const type=u.searchParams.get('type'),page=Number(u.searchParams.get('page'));
   return {items:type==='apartment'?[apartment(page)]:[{...apartment(type==='parking'?3:4),type}],meta:{hasNext:type==='apartment'&&page===1}};
  }
  return {items:[]};
 }finally{active--}
}});
await cache.start();
assert.equal(maxActive,1,'public network operations must be sequential');
assert.equal(calls[0],'managers');
assert.equal(cache.status().tasks.filter(t=>t.state==='error').length,1);
assert.ok(cache.status().tasks.some(t=>t.key==='catalogue:storage'&&t.state==='ready'),'failure must not stop later tasks');
const n=calls.length;
const filtered=await cache.read('properties?type=apartment&status[]=available&status[]=sold&section=21&features[]=7&rooms[]=2&limit=100&page=1');
assert.deepEqual(filtered.items.map(x=>x.id),[2]);
assert.equal((await cache.read('properties/apartment/2')).item.id,2);
assert.equal(calls.length,n,'filters and detail must use completed catalogue');
filtered.items[0].number='changed';
assert.equal((await cache.read('properties/apartment/2')).item.number,'2','returned data must be detached');
await cache.start();assert.equal(calls.length,n,'startup is idempotent');
fail=false;await cache.retry();assert.equal(calls.length,n+1,'retry only failed resources');
assert.equal(cache.status().tasks.every(t=>t.state==='ready'),true);
await assert.rejects(cache.read('https://other.invalid/api'));
await assert.rejects(cache.read('favorites'));
cache.dispose();
let badPage=true;
const partial=createSessionCache({fetchResource:async p=>{
 const page=new URL(p,'https://test.invalid').searchParams.get('page');
 if(page==='2'&&badPage)throw new Error('offline');
 return {items:[apartment(Number(page))],meta:{hasNext:page==='1'}};
}});
await assert.rejects(partial.read('properties?type=apartment'));
assert.equal(partial.status().tasks[0].state,'error','partial catalogue must not be published');
badPage=false;
assert.equal((await partial.read('properties?type=apartment&status[]=available&status[]=sold')).items.length,2);
partial.dispose();
const timeout=createSessionCache({timeoutMs:5,fetchResource:()=>new Promise(()=>{})});
await assert.rejects(timeout.read('managers'));
assert.equal(timeout.status().tasks[0].state,'error');timeout.dispose();
console.log('PASS session cache: sequential queue, failure isolation, retry, complete pagination, cached filters/detail, detached copies, timeout and resource allowlist');
