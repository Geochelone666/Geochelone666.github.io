(()=>{'use strict';
const $=id=>document.getElementById(id),D=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],DC=['周日','周一','周二','周三','周四','周五','周六'];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const official=WD.hardware,examRecords=WD.events,rooms=WD.rooms;
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const roomMeta=new Map([...official.labs,...official.rooms].map(r=>[r.building+'|'+r.room,r]));
const priority=official.labs.map(r=>r.building+'|'+r.room);
const storageName='windsor-rooms-local-inspections-v3';
const notes=(()=>{try{return JSON.parse(localStorage.getItem(storageName))||{}}catch{return {}}})();
const dayByName=weekday=>DC[D.indexOf(weekday)];
const getLocalDate=()=>{const now=new Date();const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'2026-11-13'};
const initial=getLocalDate();
$('date').value=initial>'2026-12-22'?'2026-11-13':initial<'2026-09-01'?'2026-11-13':initial;
$('mCourses').textContent=WD.info.courses;
$('mRooms').textContent=rooms.length;
$('mLabs').textContent=official.labs.length;
$('mEvents').textContent=WD.info.classes.toLocaleString();
const faculty=new Map(Object.entries(WD.faculty||{}));
const courseMap=new Map();for(const r of examRecords){
 const k=r[1]+'|'+r[2];if(!courseMap.has(k))courseMap.set(k,[]);courseMap.get(k).push(r);
}
const byRoomDate=(key,date)=>{const list=courseMap.get(key)||[];const day=D[new Date(date+'T12:00:00').getDay()];return list.filter(e=>e[0]==='exam'?e[4]===date:(e[3]===day&&date>=e[5]&&date<=e[6]));};
const byRoomWeek=(key,day)=>{const list=courseMap.get(key)||[];return list.filter(e=>e[0]==='class'&&e[3]===day);};
const overlaps=(e,from,to)=>e[7]<to&&e[8]>from;
const current=()=>({date:$('date').value,from:$('from').value,to:$('to').value,building:$('building').value,q:$('keyword').value.trim().toLowerCase().split(/\s+/).filter(Boolean)});
const classProf=e=>{const v=faculty.get(String(e[12]));return v?.length?v.join(' / '):'任课教师暂未核实'};
const keyOf=r=>r[0]+'|'+r[1];
const isTrueLab=key=>priority.includes(key);
const hasRegular=key=>(courseMap.get(key)||[]).some(x=>x[0]==='class');
function statusFor(key,settings){
 const ev=byRoomDate(key,settings.date);const active=ev.filter(x=>overlaps(x,settings.from,settings.to));
 if(active.length)return {kind:'busy',label:active.some(x=>x[0]==='exam')?'考试占用':'课程占用',events:active};
 if(!hasRegular(key))return {kind:'caution',label:'未找到常规排课',events:[]};
 return {kind:'good',label:'课表未占用',events:[]};
}
function toast(message){const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(window.__toastTimeout);window.__toastTimeout=setTimeout(()=>el.style.display='none',2800)}
const opt=(v,text)=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(text)+'</option>';
$('building').innerHTML=opt('','所有楼宇')+[...new Set(rooms.map(r=>r[0]))].sort().map(x=>opt(x,x)).join('');
let mode='labs',selected='Erie Hall|3119';
function selectMode(m){mode=m;for(const [id,v] of [['filterLabs','labs'],['filterFocus','focus'],['filterAll','all']]){$(id).classList.toggle('active',v===m);}renderResults();}
const relevant=()=>{let a=mode==='labs'?rooms.filter(r=>isTrueLab(keyOf(r))):mode==='focus'?rooms.filter(r=>['Erie Hall','Lambton Tower'].includes(r[0])):[...rooms];
 const s=current();if(s.building)a=a.filter(r=>r[0]===s.building);if(s.q.length)a=a.filter(r=>{const k=keyOf(r);const profile=roomMeta.get(k);const txt=[r.join(' '),profile?.name||'',profile?.short||'',profile?.gpu||'',...(courseMap.get(k)||[]).map(x=>x[9]+' '+x[13]+' '+(faculty.get(String(x[12]))||[]).join(' '))].join(' ').toLowerCase();return s.q.every(q=>txt.includes(q));});
 return a.sort((a,b)=>{const ap=priority.indexOf(keyOf(a)),bp=priority.indexOf(keyOf(b));return (ap<0?999:ap)-(bp<0?999:bp)||((a[0]==='Erie Hall'?0:a[0]==='Lambton Tower'?1:2)-(b[0]==='Erie Hall'?0:b[0]==='Lambton Tower'?1:2))||a[0].localeCompare(b[0])||a[1].localeCompare(b[1],undefined,{numeric:true})});};
function knownGaps(key,date){
 if(!hasRegular(key))return [];
 const events=byRoomDate(key,date).sort((a,b)=>a[7].localeCompare(b[7]));
 const gaps=[],start='08:00',end='22:00';let cursor=start;
 for(const r of events){if(r[8]<=start||r[7]>=end)continue;const a=r[7]>start?r[7]:start,b=r[8]<end?r[8]:end;
 if(a>cursor)gaps.push([cursor,a]);if(b>cursor)cursor=b;
 }
 if(cursor<end)gaps.push([cursor,end]);
 return gaps.filter(([a,b])=>(Number(b.slice(0,2))*60+Number(b.slice(3)))-(Number(a.slice(0,2))*60+Number(a.slice(3)))>=45);
}
function labCard(key){
 const p=current(),[building,room]=key.split('|'),m=roomMeta.get(key),s=statusFor(key,p);
 const chips=[m.capacity?m.capacity+' 台':'台数未公布',m.gpu&&!m.gpu.startsWith('未')?m.gpu.includes('A2000')?'双 NVIDIA A2000':m.gpu:'GPU 待核实',m.ram||m.cpu||'配置待核实'].slice(0,3);
 const gaps=knownGaps(key,p.date).slice(0,2);const emptyHint=hasRegular(key)?('已知空档：'+(gaps.length?gaps.map(x=>x.join('–')).join(' / '):'该日没有 ≥45 分钟空档')):'未收录常规课程时间：开放情况需现场确认';
 return '<article class="lab-card '+(selected===key?'selected':'')+'" data-room="'+escapeHTML(key)+'" role="button" tabindex="0">'+
 '<div class="lab-head"><div><div class="location">'+escapeHTML(building.toUpperCase())+' · '+escapeHTML(room)+'</div><div class="lab-name">'+escapeHTML(m.name)+'</div></div><span class="pill '+s.kind+'">'+escapeHTML(s.label)+'</span></div>'+
 '<div class="lab-sub">'+escapeHTML(m.short)+' · '+escapeHTML(m.access)+'</div><div class="lab-sub"><b>'+escapeHTML(emptyHint)+'</b></div>'+
 '<div class="spec-chips">'+chips.map(x=>'<b>'+escapeHTML(x)+'</b>').join('')+'</div></article>';
}
function renderResults(){
 const s=current(),valid=s.date&&s.from&&s.to&&s.from<s.to,arr=relevant(),allLabs=official.labs.map(x=>keyOf([x.building,x.room]));
 const show=allLabs.filter(k=>arr.some(a=>keyOf(a)===k));
 $('labCards').innerHTML=show.length?show.map(labCard).join(''):'<p class="muted">此筛选下没有重点计算机机房。</p>';
 $('focusCount').textContent=show.length+' 间核心机房';
 const stats={busy:0,good:0,caution:0};
 const markup=arr.map(x=>{
  const k=keyOf(x),m=roomMeta.get(k),st=valid?statusFor(k,s):{kind:'caution',label:'日期或时间无效'};
  stats[st.kind]=(stats[st.kind]||0)+1;
  const term=(courseMap.get(k)||[]).filter(t=>t[0]==='class').length;
  return '<tr><td><button class="link-room" data-open="'+escapeHTML(k)+'">'+escapeHTML(x[0]+' '+x[1])+'</button></td><td>'+escapeHTML(m?.short||(x[0]==='Erie Hall'||x[0]==='Lambton Tower'?'教室 / 设备待核实':'普通教室或专用实验室'))+'</td><td><span class="pill '+st.kind+'">'+escapeHTML(st.label)+'</span></td><td><span class="dim">'+term+' 条/周</span>　<button class="btn tiny secondary" data-open="'+escapeHTML(k)+'">查看</button></td></tr>';
 }).join('');
 $('roomRows').innerHTML=markup||'<tr><td colspan="4">此范围没有找到匹配的房间。</td></tr>';
 $('allCount').textContent=arr.length+' 间 · '+stats.good+' 间课表未占用';
 if(!valid)toast('开始时间必须早于结束时间');
}
function groupEvents(events){
 const groups=new Map();
 for(const e of events){
  const k=e[7]+'|'+e[8]+'|'+e[0];
  if(!groups.has(k))groups.set(k,{start:e[7],end:e[8],type:e[0],courses:new Set(),names:new Set(),teachers:new Set(),sections:new Set(),raw:[]});
  const g=groups.get(k);g.courses.add(e[9]);g.names.add(e[13]);g.sections.add(e[10]+' '+e[11]);if(e[0]==='class')g.teachers.add(classProf(e));g.raw.push(e);
 }
 return [...groups.values()].sort((a,b)=>a.start.localeCompare(b.start)||a.end.localeCompare(b.end));
}
function daySlots(key,date){
 const events=groupEvents(byRoomDate(key,date));
 if(!hasRegular(key)&&!events.length)return[{unknown:true,start:'07:00',end:'23:00'}];
 let cursor='07:00',items=[];
 for(const g of events){
  if(g.start>cursor&&cursor<'23:00')items.push({free:true,start:cursor,end:g.start});
  items.push({free:false,...g});if(g.end>cursor)cursor=g.end;
 }
 if(cursor<'23:00')items.push({free:true,start:cursor,end:'23:00'});
 return items;
}
function roomTitle(key){const parts=key.split('|');return parts[0]+' · '+parts[1]}
function weekDates(date){const d=new Date(date+'T12:00:00Z');const n=d.getUTCDay()||7;d.setUTCDate(d.getUTCDate()-n+1);return weekdays.map((_,i)=>{const v=new Date(d.getTime());v.setUTCDate(d.getUTCDate()+i);return v.toISOString().slice(0,10)});}
function renderWeek(){
 $('selectedTitle').textContent=roomTitle(selected);
 const meta=roomMeta.get(selected),r=courseMap.get(selected)||[],classes=r.filter(x=>x[0]==='class');
 $('selectedSub').textContent=(meta?.name||meta?.short||'教室排课')+' · '+[...new Set(classes.map(x=>x[12]))].length+' 个不同班级';
 const queryDate=$('date').value,dates=weekDates(queryDate);
 $('weeklyGrid').innerHTML=weekdays.map((d,i)=>{
  const actualDate=dates[i],slots=daySlots(selected,actualDate),isCurrent=actualDate===queryDate,occupied=slots.filter(s=>!s.free&&!s.unknown).length;
  return '<div class="day '+(isCurrent?'current':'')+'"><div class="dayname">'+escapeHTML(dayByName(d))+'<small>'+escapeHTML(actualDate.slice(5))+' · '+occupied+' 项</small></div>'+slots.map(s=>s.unknown?'<div class="slot"><div class="when">无可靠课表</div><div class="teacher">开放和实际占用需现场确认</div></div>':s.free?
   '<div class="slot free"><div class="when">'+escapeHTML(s.start+'–'+s.end)+'</div>无已知固定课程</div>':
   '<div class="slot '+(s.type==='exam'?'exam':'')+'"><div class="when">'+escapeHTML(s.start+'–'+s.end)+'</div><div class="course">'+escapeHTML([...s.courses].join(' / '))+'</div><div class="teacher">'+escapeHTML([...s.names].filter(Boolean).join(' / '))+'</div><div class="teacher">教师：'+escapeHTML([...s.teachers].join(' / '))+'</div><div class="teacher">'+escapeHTML([...s.sections].join(', '))+'</div></div>'
  ).join('')+'</div>';
 }).join('');
 $('weekCaption').textContent=dates[0]+' ～ '+dates[6]+' · '+(classes.length?'按本周日期核对':'缺少常规课程数据');
 const todayEvents=groupEvents(byRoomDate(selected,queryDate));
 $('dateEvents').innerHTML=todayEvents.length?todayEvents.map(g=>
  '<div class="event-card"><div class="when">'+escapeHTML(g.start+'–'+g.end)+' <span class="pill '+(g.type==='exam'?'caution':'')+'">'+(g.type==='exam'?'考试':'课程')+'</span></div><div class="description"><b>'+escapeHTML([...g.courses].join(' / '))+'</b></div><div>'+escapeHTML([...g.names].filter(Boolean).join(' / '))+'</div><div class="muted">'+(g.type==='exam'?'考试安排':escapeHTML([...g.teachers].join(' / ')))+'</div></div>'
 ).join(''):'<div class="muted">这一天没有已知课程或考试记录，实际开放情况仍需现场确认。</div>';
}
const fields=['deviceCount','model','cpu','gpu','memory','os','access','notes','checked'];
function saveNotes(){try{localStorage.setItem(storageName,JSON.stringify(notes));return true}catch{toast('本地存储不可用，请先导出备份');return false}}
function fillNote(){
 const d=notes[selected]||{};for(const f of fields)$(f).value=d[f]||'';
 $('localStatus').textContent=d.checked?'你的最后核实日期：'+d.checked+'。本记录只在此浏览器保存。':'尚未填写现场记录。学校公开设备信息与个人核实记录互不覆盖。';
}
function detailItem(label,value){return '<div class="detail-cell"><small>'+escapeHTML(label)+'</small><b>'+escapeHTML(value||'暂未公布')+'</b></div>'}
function renderHardware(){
 const m=roomMeta.get(selected);
 $('hardwareName').textContent=roomTitle(selected);
 $('hardwareSubtitle').textContent=m?.name||'尚未收录明确的学生工作站设备资料';
 $('sourceFlag').textContent=m?'有校方来源':'硬件待核实';
 $('officialSpecs').innerHTML=[
  detailItem('类型',m?.short||'机房类型待确认'),
  detailItem('设备数量',m?.capacity?String(m.capacity)+' 台':'未公布'),
  detailItem('电脑型号',m?.vendor?m.vendor+' · '+m.model:m?.model||'未公布'),
  detailItem('CPU',m?.cpu||'未公布'),
  detailItem('GPU',m?.gpu||'未公布'),
  detailItem('RAM',m?.ram||'未公布'),
  detailItem('操作系统',m?.os||'未公布'),
  detailItem('开放/限制',m?.access||'请现场确认')
 ].join('');
 $('officialSource').innerHTML=(m?.notes?'<div>'+escapeHTML(m.notes)+'</div>':'当前未取得这间教室的工作站型号资料。')+
 (m?.source?'<a href="'+escapeHTML(m.source)+'" target="_blank" rel="noopener noreferrer">查看官方来源</a>':'');
 fillNote();
}
function selectRoom(key){
 if(!rooms.some(r=>keyOf(r)===key))return;
 selected=key;renderResults();renderWeek();renderHardware();
}
for(const [id,m] of [['filterLabs','labs'],['filterFocus','focus'],['filterAll','all']])$(id).onclick=()=>selectMode(m);
$('btnReset').onclick=()=>{$('date').value=initial>'2026-12-22'?'2026-11-13':initial;$('from').value='13:00';$('to').value='15:00';$('building').value='';$('keyword').value='';selectMode('labs');renderWeek()};
for(const k of ['date','from','to','building','keyword'])$(k).addEventListener('change',()=>{renderResults();if(k==='date')renderWeek()});
$('keyword').addEventListener('input',()=>renderResults());
$('labCards').addEventListener('click',e=>{const el=e.target.closest('[data-room]');if(el){selectRoom(el.dataset.room);$('weekly').scrollIntoView({behavior:'smooth',block:'start'})}});
$('labCards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest('[data-room]');if(el){e.preventDefault();selectRoom(el.dataset.room)}}});
$('roomRows').addEventListener('click',e=>{const el=e.target.closest('[data-open]');if(el){selectRoom(el.dataset.open);$('weekly').scrollIntoView({behavior:'smooth',block:'start'})}});
document.querySelectorAll('[data-scroll]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.scroll).scrollIntoView({behavior:'smooth',block:'start'})});
$('jumpSpecs').onclick=()=>$('inventory').scrollIntoView({behavior:'smooth'});
$('jumpFilters').onclick=()=>$('filters').scrollIntoView({behavior:'smooth',block:'start'});
$('hardwareForm').addEventListener('submit',e=>{
 e.preventDefault();let d={};for(const f of fields)d[f]=$(f).value.trim();
 d.savedAt=new Date().toISOString();notes[selected]=d;
 if(saveNotes()){fillNote();toast('现场记录已保存到此浏览器')}
});
$('clearNote').onclick=()=>{if(!notes[selected])return;delete notes[selected];if(saveNotes()){fillNote();toast('已清除这间教室的个人记录')}};
$('exportNotes').onclick=()=>{
 const blob=new Blob([JSON.stringify({kind:'windsor-rooms-inspections',version:1,exportedAt:new Date().toISOString(),rooms:notes},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='windsor-room-device-notes-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('已生成设备记录备份');
};
$('importNotes').onclick=()=>$('importFile').click();
$('importFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(!f)return;
 try{const obj=JSON.parse(await f.text());if(obj.kind!=='windsor-rooms-inspections'||!obj.rooms||typeof obj.rooms!=='object')throw new Error('文件格式不符合本工具');
 for(const [key,n] of Object.entries(obj.rooms)){if(!rooms.some(r=>keyOf(r)===key)||!n||typeof n!=='object')continue;notes[key]={};for(const fld of fields)notes[key][fld]=String(n[fld]||'').slice(0,fld==='notes'?1200:160);notes[key].savedAt=n.savedAt||new Date().toISOString();}
 if(saveNotes()){fillNote();toast('已导入备份记录')}}catch(err){toast('导入失败：'+err.message)}
 e.target.value='';
});
selectRoom(selected);
})();
