/* Windsor Rooms: deterministic schedule-only recommendations, comparison, exports. */
(function(root,factory){
  const mod=factory();
  if(typeof module==='object'&&module.exports)module.exports=mod;
  if(typeof document!=='undefined'&&root.WD)mod.mount(root.WD,document);
})(typeof window!=='undefined'?window:{},function(){
'use strict';
const DAYS=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','"':'&quot;',"'":'&#39;'}[c]));
function toMinutes(time){
  if(!/^\d{2}:\d{2}$/.test(time||''))return NaN;
  const [h,m]=time.split(':').map(Number);
  return h>=0&&h<24&&m>=0&&m<60?h*60+m:NaN;
}
function formatMinutes(x){return String(Math.floor(x/60)).padStart(2,'0')+':'+String(x%60).padStart(2,'0');}
function validISODate(value){
  if(!/^\d{4}-\d{2}-\d{2}$/.test(value||''))return false;
  const d=new Date(value+'T12:00:00Z');
  return !isNaN(d.valueOf())&&d.toISOString().slice(0,10)===value;
}
function weekday(date){return DAYS[new Date(date+'T12:00:00Z').getUTCDay()];}
function eventsForDate(events,date){
  if(!validISODate(date))return [];
  const day=weekday(date);
  return events.filter(r=>r[0]==='exam'?r[4]===date:(r[0]==='class'&&r[3]===day&&r[5]<=date&&r[6]>=date));
}
function freeWindows(events,from,to,min=1){
  const a=toMinutes(from),b=toMinutes(to),threshold=Number(min);
  if(!Number.isFinite(a)||!Number.isFinite(b)||a>=b||!Number.isFinite(threshold)||threshold<1)return [];
  const ranges=events.map(x=>[toMinutes(x[7]),toMinutes(x[8])])
    .filter(([x,y])=>Number.isFinite(x)&&Number.isFinite(y)&&x<y&&x<b&&y>a)
    .map(([x,y])=>[Math.max(a,x),Math.min(b,y)]).sort((u,v)=>u[0]-v[0]||u[1]-v[1]);
  const union=[];
  for(const [x,y] of ranges){
    const last=union[union.length-1];
    if(last&&x<=last[1])last[1]=Math.max(last[1],y);else union.push([x,y]);
  }
  const free=[];let cursor=a;
  for(const [x,y] of union){if(x-cursor>=threshold)free.push({start:formatMinutes(cursor),end:formatMinutes(x),minutes:x-cursor});cursor=Math.max(cursor,y);}
  if(b-cursor>=threshold)free.push({start:formatMinutes(cursor),end:formatMinutes(b),minutes:b-cursor});
  return free;
}
function closestFollowing(events,end){
  const target=toMinutes(end);
  const after=events.filter(e=>toMinutes(e[7])>=target).sort((a,b)=>toMinutes(a[7])-toMinutes(b[7]));
  return after.length?{time:after[0][7],course:after[0][9],type:after[0][0]}:null;
}
function evaluateRoom(db,key,query){
  const [building,room]=key.split('|');
  const all=db.events.filter(e=>e[1]===building&&e[2]===room);
  const today=eventsForDate(all,query.date);
  const min=Number(query.minMinutes)||45;
  const free=freeWindows(today,query.from,query.to,min);
  const regular=all.some(e=>e[0]==='class');
  const official=db.hardware.labs.find(x=>x.building===building&&x.room===room);
  const csOfficial=db.compLab.summary.confirmedGeneralCSLabs.includes(key);
  const lab=db.compLab.sites.find(x=>x.building===building&&x.room===room);
  const restrictions=official?.accessLevel||'unknown';
  const limited=['law-only','business-limited','cs-majors','staff-only','engineering-reserved','nursing-limited'].includes(restrictions);
  const classification=csOfficial?'verified-cs':lab?.classification==='ordinary-classroom'?'ordinary-classroom':lab?.classification==='cs-teaching-lab-unverified-workstations'?'lab-unverified':official?'other-computer-facility':'other-room';
  const verified=csOfficial;
  const dependable=regular&&verified;
  const chosen=free.slice().sort((a,b)=>b.minutes-a.minutes||a.start.localeCompare(b.start))[0]||null;
  return {key,building,room,official,lab,classification,verified,regular,dependable,limited,restrictions,
    gaps:free,chosen,next:chosen?closestFollowing(today,chosen.end):null,events:today,
    status:!chosen?'occupied-or-short':db.info.coverage==='COMP_ONLY'?'partial-coverage':!regular?'unknown-schedule':verified?'candidate':'unverified-computer',totalSections:lab?.sectionCount||0};
}
function rankCandidates(db,keys,query){
  const all=keys.map(key=>evaluateRoom(db,key,query));
  const priority={candidate:0,'partial-coverage':1,'unverified-computer':2,'unknown-schedule':3,'occupied-or-short':4};
  return all.sort((a,b)=>priority[a.status]-priority[b.status]||
    Number(b.verified)-Number(a.verified)||
    Number(!!b.regular)-Number(!!a.regular)||
    (b.chosen?.minutes||0)-(a.chosen?.minutes||0)||
    (b.official?.capacity||0)-(a.official?.capacity||0)||
    a.key.localeCompare(b.key));
}
function createCSV(rows){
  return rows.map(row=>row.map(x=>'"'+String(x??'').replaceAll('"','""').replaceAll('\r',' ').replaceAll('\n',' ')+'"').join(',')).join('\r\n')+'\r\n';
}
function mount(db,doc){
 const $=id=>doc.getElementById(id);
 if(!$('smartSearch'))return;
 const confirmed=db.compLab.summary.confirmedGeneralCSLabs;
 const partial=db.info.coverage==='COMP_ONLY';
 const comp=db.compLab.sites.map(s=>s.building+'|'+s.room);
 const school=db.hardware.labs.map(s=>s.building+'|'+s.room);
 const roomKeys=new Set([...comp,...confirmed,...school, ...db.rooms.map(r=>r.join('|'))]);
 const compare=new Set();
 let calculated=[];
 const selectedDate=()=>$('date').value;
 const currentQuery=()=>({date:selectedDate(),from:$('from').value,to:$('to').value,minMinutes:Number($('smartMin').value)});
 const locType=k=>db.hardware.labs.find(x=>x.building+'|'+x.room===k);
 const keysForScope=()=>{
   const v=$('smartScope').value;
   const keys=v==='verified'?confirmed:v==='comp'?comp:v==='facilities'?[...new Set([...confirmed,...school])]:[...roomKeys];
   const building=$('building').value;
   return keys.filter(k=>!building||k.startsWith(building+'|'));
 };
 const typeLabel=r=>r.classification==='verified-cs'?'已确认 CS 工作站':r.classification==='ordinary-classroom'?'普通 LAB 教室':r.classification==='lab-unverified'?'LAB · 电脑待核实':r.classification==='other-computer-facility'?'其他电脑设施':'一般教室';
 const showRoom=k=>{
   const api=window.WindsorRoomsAPI;
   if(api?.selectRoom){api.selectRoom(k);$('weekly').scrollIntoView({behavior:'smooth',block:'start'});}
 };
 const makeCard=r=>{
   const name=esc(r.building+' · '+r.room);
   const cls=r.status==='candidate'?'smart-positive':r.status==='occupied-or-short'?'smart-busy':'smart-warning';
   const title=r.status==='candidate'?'课表候选':r.status==='partial-coverage'?'仅 COMP 排课 · 其他占用未知':r.status==='occupied-or-short'?'时段不足':r.status==='unknown-schedule'?'没有完整常规排课':'设备/权限待核实';
   const gap=r.chosen?(partial?'COMP 未见课程：':'已知空档：')+esc(r.chosen.start+'–'+r.chosen.end)+' · '+r.chosen.minutes+'分钟':'所选时段不足 '+$('smartMin').value+' 分钟';
   const next=r.next?'下一已知安排 '+esc(r.next.time+' '+r.next.course):'当天没有更晚的已知安排';
   const info=r.classification==='ordinary-classroom'?'当前教室并无学生工作站证据':r.classification==='lab-unverified'?'COMP LAB 课程地点，工作站未核实':r.official?.access||'实际门禁与临时预约情况尚不明确';
   const caution=r.verified?'官方确认配备学生工作站 · 仍需确认门禁与临时占用':'不属于已证实的 CS 通用学生工作站机房';
   return '<article class="smart-card '+cls+'"><div class="smart-head"><b>'+name+'</b><span class="pill '+(r.status==='candidate'?'good':r.status==='occupied-or-short'?'busy':'caution')+'">'+title+'</span></div>'+
    '<p>'+esc(typeLabel(r))+'　'+esc(r.official?.capacity?r.official.capacity+' 台设备':'数量待核实')+'</p>'+
    '<div class="smart-gap">'+gap+'</div><p class="subtext">'+next+'</p>'+
    '<p class="smart-caution">'+esc(info)+'</p><p class="subtext">'+caution+'</p>'+
    '<div class="smart-actions"><button type="button" data-smart-room="'+esc(r.key)+'" class="btn secondary tiny">查看周课表</button>'+
    '<label class="smart-compare"><input type="checkbox" data-compare="'+esc(r.key)+'" '+(compare.has(r.key)?'checked':'')+'/> 对比</label></div></article>';
 };
 function renderCompare(){
   const arr=[...compare].filter(x=>roomKeys.has(x));const target=$('smartCompare');
   if(!arr.length){target.innerHTML='<p class="subtext">选择最多 3 间教室，比较选定日期的 07:00–23:00 占用分布。</p>';return}
   const query=currentQuery(),date=query.date;
   const timeStart=420,timeEnd=1380,timeLen=timeEnd-timeStart;
   const markup=arr.map(key=>{
     const c=evaluateRoom(db,key,query);
     const bars=c.events.map(e=>{
       const a=Math.max(timeStart,toMinutes(e[7])),b=Math.min(timeEnd,toMinutes(e[8]));
       if(!(b>a))return '';
       return '<span class="compare-busy '+(e[0]==='exam'?'exam':'')+'" style="left:'+((a-timeStart)/timeLen*100).toFixed(3)+'%;width:'+((b-a)/timeLen*100).toFixed(3)+'%" title="'+esc(e[9]+' '+e[7]+'–'+e[8])+'"></span>';
     }).join('');
     return '<div class="compare-row"><b>'+esc(c.building+' '+c.room)+'</b><span>'+esc(typeLabel(c))+'</span><div class="compare-track">'+bars+'</div><span class="subtext">'+(partial?'仅标出已知 COMP 课，其他课程和考试未知':c.regular?'灰色仅表示无已知排课':'此房间缺少常规课程数据')+'</span></div>';
   }).join('');
   target.innerHTML='<div class="compare-times"><span>07:00</span><span>11:00</span><span>15:00</span><span>19:00</span><span>23:00</span></div>'+markup+'<div class="smart-actions"><button class="btn ghost tiny" type="button" id="clearSmartCompare">清除对比</button><button class="btn secondary tiny" type="button" id="exportSmartCSV">下载当日占用 CSV</button></div>';
   $('clearSmartCompare').onclick=()=>{compare.clear();renderSmart();};
   $('exportSmartCSV').onclick=()=>{
     const rows=[['Building','Room','Date','Type','Start','End','Course','Section','Instructor']];
     for(const key of arr){const c=evaluateRoom(db,key,query);for(const e of c.events){
       const prof=db.faculty[e[12]]||[];
       rows.push([c.building,c.room,query.date,e[0],e[7],e[8],e[9],e[11],prof.join(' / ')]);
     }}
     download('windsor-rooms-compare-'+date+'.csv',createCSV(rows),'text/csv;charset=utf-8');
   };
 }
 function download(name,text,type){
   const blob=new Blob([text],{type}),url=URL.createObjectURL(blob),a=doc.createElement('a');
   a.href=url;a.download=name;doc.body.append(a);a.click();a.remove();
   setTimeout(()=>URL.revokeObjectURL(url),5000);
 }
 function renderSmart(){
   const q=currentQuery();const min=Number(q.minMinutes);
   if(!validISODate(q.date)||!Number.isFinite(toMinutes(q.from))||!Number.isFinite(toMinutes(q.to))||toMinutes(q.from)>=toMinutes(q.to)){
      $('smartCount').textContent='请设置有效的日期和时间';$('smartResults').innerHTML='';renderCompare();return;
   }
   calculated=rankCandidates(db,keysForScope(),q);
   const selected=calculated.filter(c=>c.status==='candidate');
   const uncertain=calculated.filter(c=>c.status==='unverified-computer'||c.status==='unknown-schedule');
   const short=calculated.filter(c=>c.status==='occupied-or-short');
   $('smartCount').textContent=partial?'仅 COMP 部分课表：'+calculated.length+' 个地点。其他课程及考试未纳入，全部“空档”都不能当作真实空闲。':selected.length+' 间有已知连续空档的 CS 工作站机房 · '+uncertain.length+' 间资料或硬件待核实 · '+short.length+' 间时段不足';
   const only=$('smartHideUncertain').checked;
   const filtered=only?calculated.filter(c=>c.status==='candidate'||c.status==='occupied-or-short'||(c.status==='partial-coverage'&&c.verified)):calculated;
   $('smartResults').innerHTML=filtered.length?filtered.map(makeCard).join(''):'<div class="subtext">当前条件下没有可显示的候选教室。调整时间或开启待核实地点。</div>';
   renderCompare();
 }
 $('smartSearch').addEventListener('click',e=>{
   const btn=e.target.closest('[data-smart-room]');if(btn)showRoom(btn.dataset.smartRoom);
 });
 $('smartSearch').addEventListener('change',e=>{
   if(e.target.matches('[data-compare]')){const key=e.target.dataset.compare;
     if(e.target.checked){if(compare.size>=3){e.target.checked=false;return window.alert('最多比较 3 间教室')}compare.add(key)}
     else compare.delete(key);renderCompare();
   }
 });
 for(const id of ['smartScope','smartMin','smartHideUncertain'])$(id).addEventListener('change',renderSmart);
 for(const id of ['date','from','to','building'])$(id).addEventListener('change',renderSmart);
 $('btnReset').addEventListener('click',renderSmart);
 $('smartRefresh').onclick=renderSmart;
 window.WindsorRoomsSmart={render:renderSmart,evaluateRoom,keySet:roomKeys};
 renderSmart();
 }
 return {toMinutes,formatMinutes,validISODate,eventsForDate,freeWindows,closestFollowing,evaluateRoom,rankCandidates,mount};
});
