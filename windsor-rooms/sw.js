/* Windsor Rooms offline shell: only cache assets under /windsor-rooms/.
   Never cache school login pages, third-party requests, or personal notes. */
const CACHE_NAME='windsor-rooms-v6-20261126-exam23';
const CACHE_PREFIX='windsor-rooms-v';
const APP_FILES=['./','./index.html','./styles.css','./app.js','./smart.js','./data.json.gz','./winter2027.json.gz','./manifest.webmanifest','./icon.svg','./quality.json','./exam-changes-20261123.json','./labs.csv','./comp-labs.csv','./winter-comp-labs.csv'];
self.addEventListener('install',event=>{
 event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_FILES)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',event=>{
 event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith(CACHE_PREFIX)&&k!==CACHE_NAME).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch',event=>{
 const request=event.request,url=new URL(request.url);
 if(request.method!=='GET'||url.origin!==self.location.origin||!url.pathname.startsWith(new URL(self.registration.scope).pathname))return;
 event.respondWith((async()=>{
  const cache=await caches.open(CACHE_NAME);
  try{
   const response=await fetch(request);
   if(response.ok){await cache.put(request,response.clone()).catch(()=>{});}
   return response;
  }catch{
   const cached=await cache.match(request,{ignoreSearch:true});
   if(cached)return cached;
   if(request.mode==='navigate')return (await cache.match('./index.html'))||Response.error();
   return Response.error();
  }
 })());
});
