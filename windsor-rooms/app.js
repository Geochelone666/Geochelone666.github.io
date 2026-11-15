(()=>{'use strict';
const $=id=>document.getElementById(id),D=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'],DC=['周日','周一','周二','周三','周四','周五','周六'];
const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const official=WD.hardware,examRecords=WD.events,rooms=WD.rooms;
const weekdays=['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const roomMeta=new Map([...official.labs,...official.rooms].map(r=>[r.building+'|'+r.room,r]));
const compSites=WD.compLab.sites,compSummary=WD.compLab.summary;
const compMap=new Map(compSites.map(r=>[r.building+'|'+r.room,r]));
const priority=compSummary.confirmedGeneralCSLabs;
const studentLabKeys=new Set(priority);
for(const c of compSites){
 const key=c.building+'|'+c.room;
 if(!roomMeta.has(key))roomMeta.set(key,{
  building:c.building,room:c.room,capacity:null,vendor:'',model:'没有已证实的学生工作站',cpu:'未证实',gpu:'未证实',ram:'未证实',os:'未证实',software:'',
  name:c.classification==='cs-teaching-lab-unverified-workstations'?'CS 教学 Lab（设备待核实）':'COMP LAB 普通教学教室',
  short:c.classification==='cs-teaching-lab-unverified-workstations'?'Lab 2103 · 学生电脑待核实':'普通教室 · 学生电脑未证实',
  access:c.classification==='cs-teaching-lab-unverified-workstations'?'学校资料称 Lab 2103，未确认公共进入与学生机型':'该房间用于 COMP LAB 教学，但不是已证实的电脑工作站机房',
  accessLevel:'unknown',confidence:'lab-schedule-not-hardware',type:'comp-lab-classroom',source:c.source,notes:c.evidence
 });
}
const storageName='windsor-rooms-local-inspections-v3';
const notes=(()=>{try{return JSON.parse(localStorage.getItem(storageName))||{}}catch{return {}}})();
const dayByName=weekday=>DC[D.indexOf(weekday)];
const getLocalDate=()=>{const now=new Date();const d=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Toronto',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);return /^\d{4}-\d{2}-\d{2}$/.test(d)?d:'2026-11-13'};
const initial=getLocalDate();
const termStart=WD.info.termStart||'2026-09-10',termEnd=WD.info.termEnd||'2026-12-22';
const defaultDate=initial<termStart||initial>termEnd?termStart:initial;
$('date').min=termStart;$('date').max=termEnd;$('date').value=defaultDate;
$('termHero').textContent=WD.info.termName||'Fall 2026';$('termLabel').textContent=WD.info.termName||'Fall 2026';
$('mCourses').textContent=compSummary.differentCOMPcourses;
$('mRooms').textContent=compSummary.labSites;
$('mLabs').textContent=priority.length;
$('mEvents').textContent=compSummary.uniqueLABSections;
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
 if(!hasRegular(key))return {kind:'caution',label:'缺少完整排课',events:[]};
 return {kind:'good',label:'课表未占用',events:[]};
}
function toast(message){const el=$('toast');el.textContent=message;el.style.display='block';clearTimeout(window.__toastTimeout);window.__toastTimeout=setTimeout(()=>el.style.display='none',2800)}
const opt=(v,text)=>'<option value="'+escapeHTML(v)+'">'+escapeHTML(text)+'</option>';
$('building').innerHTML=opt('','所有楼宇')+[...new Set(rooms.map(r=>r[0]))].sort().map(x=>opt(x,x)).join('');
let mode='comp',selected='Erie Hall|3119';
function selectMode(m){mode=m;for(const [id,v] of [['filterComp','comp'],['filterLabs','labs'],['filterFocus','focus'],['filterOther','other'],['filterAll','all']]){$(id).classList.toggle('active',v===m);}renderResults();}
const relevant=()=>{let a=mode==='comp'?rooms.filter(r=>compMap.has(keyOf(r))):mode==='labs'?rooms.filter(r=>studentLabKeys.has(keyOf(r))):mode==='other'?rooms.filter(r=>official.labs.some(l=>l.building+'|'+l.room===keyOf(r))):mode==='focus'?rooms.filter(r=>['Erie Hall','Lambton Tower'].includes(r[0])):[...rooms];
 const s=current();if(s.building)a=a.filter(r=>r[0]===s.building);if(s.q.length)a=a.filter(r=>{const k=keyOf(r);const profile=roomMeta.get(k);const txt=[r.join(' '),profile?.name||'',profile?.short||'',profile?.gpu||'',...(courseMap.get(k)||[]).map(x=>x[9]+' '+x[13]+' '+(faculty.get(String(x[12]))||[]).join(' '))].join(' ').toLowerCase();return s.q.every(q=>txt.includes(q));});
 return a.sort((a,b)=>{if(mode==='comp'){const aa=compMap.get(keyOf(a)),bb=compMap.get(keyOf(b));return (bb?.sectionCount||0)-(aa?.sectionCount||0)||a[0].localeCompare(b[0])||a[1].localeCompare(b[1],undefined,{numeric:true});}
 const ap=priority.indexOf(keyOf(a)),bp=priority.indexOf(keyOf(b));return (ap<0?999:ap)-(bp<0?999:bp)||((a[0]==='Erie Hall'?0:a[0]==='Lambton Tower'?1:2)-(b[0]==='Erie Hall'?0:b[0]==='Lambton Tower'?1:2))||a[0].localeCompare(b[0])||a[1].localeCompare(b[1],undefined,{numeric:true})});};
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
function displayStatus(key,s){
 const c=compMap.get(key);
 if(c&&s.kind==='good'&&c.classification==='ordinary-classroom')return {kind:'caution',label:'普通教室 / 无学生电脑证据'};
 if(c&&s.kind==='good'&&c.classification==='cs-teaching-lab-unverified-workstations')return {kind:'caution',label:'Lab 场地 / 电脑待核实'};
 return s;
}
function labCard(key){
 const p=current(),[building,room]=key.split('|'),m=roomMeta.get(key),s=displayStatus(key,statusFor(key,p)),comp=compMap.get(key);
 if(['law-only','cs-majors','business-limited'].includes(m.accessLevel)&&s.kind==='good'){s.kind='caution';s.label='限制使用'}
 if(['official-history','older-official','official-2022-23','official-family-partition'].includes(m.confidence)&&s.kind==='good'){s.kind='caution';s.label='使用待核实'}
 const chips=comp?[(comp.sectionCount+' 个 LAB Section'),comp.courses.join(' / '),comp.classification==='verified-student-workstations'?'CS 学生工作站机房':comp.classification==='cs-teaching-lab-unverified-workstations'?'校方称 Lab · 电脑需核实':'普通教室 · 非已证实学生电脑机房']:[m.capacity?m.capacity+' 台':m.capacityLowerBound?'至少 '+m.capacityLowerBound+' 台':'台数未公布',m.gpu&&!m.gpu.startsWith('未')?m.gpu.includes('A2000')?'双 NVIDIA A2000':m.gpu:'GPU 待核实',m.ram||m.cpu||'配置待核实'].slice(0,3);
 const gaps=knownGaps(key,p.date).slice(0,2);const emptyHint=hasRegular(key)?('已知空档：'+(gaps.length?gaps.map(x=>x.join('–')).join(' / '):'该日没有 ≥45 分钟空档')):'未收录常规课程时间：开放情况需现场确认';
 return '<article class="lab-card '+(selected===key?'selected':'')+'" data-room="'+escapeHTML(key)+'" role="button" tabindex="0">'+
 '<div class="lab-head"><div><div class="location">'+escapeHTML(building.toUpperCase())+' · '+escapeHTML(room)+'</div><div class="lab-name">'+escapeHTML(m.name)+'</div></div><span class="pill '+s.kind+'">'+escapeHTML(s.label)+'</span></div>'+
 '<div class="lab-sub">'+escapeHTML(m.short)+' · '+escapeHTML(m.access)+'</div><div class="lab-sub"><b>'+escapeHTML(emptyHint)+'</b></div><div class="lab-sub">'+escapeHTML(m.accessLevel==='law-only'?'仅 Law 学生':m.accessLevel==='cs-majors'?'仅 CS 专业':m.accessLevel==='engineering'?'工程学院设施':m.accessLevel==='business-limited'?'商学院教学/研究':m.accessLevel==='public'?'公共电脑区':m.accessLevel==='students'?'学生学习空间':'开放条件待核实')+'</div>'+
 '<div class="spec-chips">'+chips.map(x=>'<b>'+escapeHTML(x)+'</b>').join('')+'</div></article>';
}
function renderResults(){
 const s=current(),valid=s.date&&s.from&&s.to&&s.from<s.to,arr=relevant(),allLabs=official.labs.map(x=>keyOf([x.building,x.room]));
 const choice=mode==='comp'?compSites.map(c=>c.building+'|'+c.room):mode==='labs'?priority:mode==='other'?allLabs:mode==='focus'?[...new Set([...compSites.filter(c=>['Erie Hall','Lambton Tower'].includes(c.building)).map(c=>c.building+'|'+c.room),...priority.filter(x=>x.startsWith('Erie Hall|')||x.startsWith('Lambton Tower|'))])]:allLabs;
 const show=choice.filter(k=>arr.some(a=>keyOf(a)===k));
 $('labCards').innerHTML=show.length?show.map(labCard).join(''):'<p class="muted">此筛选下没有对应场地。</p>';
 $('focusCount').textContent=mode==='comp'?show.length+' 个本学期 LAB 场地 · 全部34个Section':mode==='labs'?show.length+' 间官方 CS 通用机房':show.length+' 条设施/场地记录';
 const stats={busy:0,good:0,caution:0};
 const markup=arr.map(x=>{
  const k=keyOf(x),m=roomMeta.get(k),st=valid?displayStatus(k,statusFor(k,s)):{kind:'caution',label:'日期或时间无效'};
  stats[st.kind]=(stats[st.kind]||0)+1;
  const term=(courseMap.get(k)||[]).filter(t=>t[0]==='class').length;const comp=compMap.get(k);const recordLabel=mode==='comp'&&comp?comp.sectionCount+' 个COMP LAB Section':term+' 条周排课记录';
  return '<tr><td><button class="link-room" data-open="'+escapeHTML(k)+'">'+escapeHTML(x[0]+' '+x[1])+'</button></td><td>'+escapeHTML(m?.short||(x[0]==='Erie Hall'||x[0]==='Lambton Tower'?'教室 / 设备待核实':'普通教室或专用实验室'))+'</td><td><span class="pill '+st.kind+'">'+escapeHTML(st.label)+'</span></td><td><span class="dim">'+escapeHTML(recordLabel)+'</span>　<button class="btn tiny secondary" data-open="'+escapeHTML(k)+'">查看</button></td></tr>';
 }).join('');
 $('roomRows').innerHTML=markup||'<tr><td colspan="4">此范围没有找到匹配的房间。</td></tr>';
 $('allCount').textContent=arr.length+' 个场地 · '+stats.good+' 个已知课表无占用';
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
 const pic=/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(d.photoData||'')?d.photoData:null;
 $('roomPhotoPreview').innerHTML=pic?'<img alt="现场设备照片" style="max-width:100%;max-height:230px;border-radius:8px" src="'+pic+'"/>':'暂无照片';
 $('roomPhoto').value='';
}
function detailItem(label,value){return '<div class="detail-cell"><small>'+escapeHTML(label)+'</small><b>'+escapeHTML(value||'暂未公布')+'</b></div>'}
function renderHardware(){
 const m=roomMeta.get(selected);
 $('hardwareName').textContent=roomTitle(selected);
 $('hardwareSubtitle').textContent=m?.name||'尚未收录明确的学生工作站设备资料';
 $('sourceFlag').textContent=m?(['official-history','older-official','official-2022-23'].includes(m.confidence)?'来源较旧 · 待核实':m.confidence==='official-family-partition'?'分区配置待核实':'有校方来源'):'硬件待核实';
 $('officialSpecs').innerHTML=[
  detailItem('类型',m?.short||'机房类型待确认'),
  detailItem('设备数量',m?.capacity?String(m.capacity)+' 台':m?.capacityLowerBound?'至少 '+m.capacityLowerBound+' 台':'未公布'),
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
for(const [id,m] of [['filterComp','comp'],['filterLabs','labs'],['filterFocus','focus'],['filterOther','other'],['filterAll','all']])$(id).onclick=()=>selectMode(m);
$('btnReset').onclick=()=>{$('date').value=defaultDate;$('from').value='13:00';$('to').value='15:00';$('building').value='';$('keyword').value='';selectMode('comp');renderWeek()};
for(const k of ['date','from','to','building','keyword'])$(k).addEventListener('change',()=>{renderResults();if(k==='date')renderWeek()});
$('keyword').addEventListener('input',()=>renderResults());
$('labCards').addEventListener('click',e=>{const el=e.target.closest('[data-room]');if(el){selectRoom(el.dataset.room);$('weekly').scrollIntoView({behavior:'smooth',block:'start'})}});
$('labCards').addEventListener('keydown',e=>{if(e.key==='Enter'||e.key===' '){const el=e.target.closest('[data-room]');if(el){e.preventDefault();selectRoom(el.dataset.room)}}});
$('roomRows').addEventListener('click',e=>{const el=e.target.closest('[data-open]');if(el){selectRoom(el.dataset.open);$('weekly').scrollIntoView({behavior:'smooth',block:'start'})}});
document.querySelectorAll('[data-scroll]').forEach(btn=>btn.onclick=()=>{document.querySelectorAll('.nav-link').forEach(x=>x.classList.remove('active'));btn.classList.add('active');$(btn.dataset.scroll).scrollIntoView({behavior:'smooth',block:'start'})});
function escapeCalendar(t){return String(t||'').replaceAll('\\','\\\\').replaceAll('\n','\\n').replaceAll(',','\\,').replaceAll(';','\\;')}
function dateForUTCCalendar(date,time){
 const [Y,M,D]=date.split('-').map(Number),[hh,mm]=time.split(':').map(Number);
 const dateAtNoon=new Date(Date.UTC(Y,M-1,D,12,0));
 const part=new Intl.DateTimeFormat('en-US',{timeZone:'America/Toronto',timeZoneName:'shortOffset'}).formatToParts(dateAtNoon).find(x=>x.type==='timeZoneName')?.value||'GMT-5';
 const match=part.match(/GMT([+-])(\d{1,2})(?::(\d{2}))?/);
 const offset=match?(match[1]==='-'?-1:1)*(Number(match[2])*60+Number(match[3]||0)):-300;
 const utc=new Date(Date.UTC(Y,M-1,D,hh,mm)-offset*60000);
 return utc.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');
}
function exportRoomICS(){
 const events=courseMap.get(selected)||[],lines=['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//Windsor Rooms//'+(WD.info.termName||'Fall 2026')+'//ZH','CALSCALE:GREGORIAN','METHOD:PUBLISH','X-WR-CALNAME:'+escapeCalendar('Windsor '+roomTitle(selected))];
 const todayStamp=new Date().toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');let count=0;
 function pushEvent(e,dt){
  const uid='windsor-rooms-'+String(e[12]||'exam')+'-'+dt+'-'+count+'@uwindsor.github.io';
  const professor=(faculty.get(String(e[12]))||[]).join(' / ');
  const name=e[9]+' '+e[10]+' '+e[11];
  const desc=[e[13],professor?'Instructor: '+professor:'', 'Classroom schedule snapshot, not live room availability. Verify closures and changes.'].filter(Boolean).join('\n');
  lines.push('BEGIN:VEVENT','UID:'+uid,'DTSTAMP:'+todayStamp,'DTSTART:'+dateForUTCCalendar(dt,e[7]),'DTEND:'+dateForUTCCalendar(dt,e[8]),'SUMMARY:'+escapeCalendar(name),'DESCRIPTION:'+escapeCalendar(desc),'LOCATION:'+escapeCalendar(roomTitle(selected)),'END:VEVENT');count++;
 }
 for(const e of events){
  if(e[0]==='exam'){if(e[4])pushEvent(e,e[4]);continue}
  if(e[0]!=='class'||!e[5]||!e[6])continue;
  const d=new Date(e[5]+'T12:00:00Z'),max=new Date(e[6]+'T12:00:00Z');
  for(let i=0;d<=max&&i<150;i++,d.setUTCDate(d.getUTCDate()+1)){
   if(D[d.getUTCDay()]===e[3])pushEvent(e,d.toISOString().slice(0,10));
  }
 }
 lines.push('END:VCALENDAR');
 const blob=new Blob([lines.join('\r\n')+'\r\n'],{type:'text/calendar;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');
 a.href=url;a.download='windsor-'+selected.replace(/[^a-zA-Z0-9]+/g,'-')+'-'+String(WD.info.termName||'Fall 2026').toLowerCase().replace(/[^a-z0-9]+/g,'')+'.ics';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('已导出 '+count+' 条课程/考试日历安排（请核实临时改课和节假日）');
}
$('exportRoomICS').onclick=exportRoomICS;
$('jumpSpecs').onclick=()=>$('inventory').scrollIntoView({behavior:'smooth'});
$('jumpFilters').onclick=()=>$('filters').scrollIntoView({behavior:'smooth',block:'start'});
$('hardwareForm').addEventListener('submit',e=>{
 e.preventDefault();let d={...(notes[selected]||{})};for(const f of fields)d[f]=$(f).value.trim();
 d.savedAt=new Date().toISOString();notes[selected]=d;
 if(saveNotes()){fillNote();toast('现场记录已保存到此浏览器')}
});
$('clearNote').onclick=()=>{if(!notes[selected])return;delete notes[selected];if(saveNotes()){fillNote();toast('已清除这间教室的个人记录')}};
$('exportNotes').onclick=()=>{
 const blob=new Blob([JSON.stringify({kind:'windsor-rooms-inspections',version:1,exportedAt:new Date().toISOString(),rooms:notes},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='windsor-room-device-notes-'+new Date().toISOString().slice(0,10)+'.json';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),5000);toast('已生成设备记录备份');
};
$('importNotes').onclick=()=>$('importFile').click();
$('roomPhoto').addEventListener('change',async e=>{
 const file=e.target.files?.[0];if(!file)return;
 if(file.size>12*1024*1024||!/^image\/(?:jpeg|png|webp)$/.test(file.type)){toast('请使用小于 12MB 的 JPG/PNG/WebP 照片');e.target.value='';return}
 try{
  const objUrl=URL.createObjectURL(file),pic=new Image();
  try{await new Promise((resolve,reject)=>{pic.onload=resolve;pic.onerror=reject;pic.src=objUrl})}finally{URL.revokeObjectURL(objUrl)}
  const scale=Math.min(1,1100/Math.max(pic.naturalWidth,pic.naturalHeight));
  const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(pic.naturalWidth*scale));canvas.height=Math.max(1,Math.round(pic.naturalHeight*scale));
  canvas.getContext('2d').drawImage(pic,0,0,canvas.width,canvas.height);
  let photo=canvas.toDataURL('image/jpeg',.72);
  if(photo.length>750000)photo=canvas.toDataURL('image/jpeg',.4);
  if(photo.length>750000)throw Error('照片太大，换一张或缩小尺寸');
  notes[selected]={...(notes[selected]||{}),photoData:photo,savedAt:new Date().toISOString()};
  if(saveNotes()){fillNote();toast('照片已压缩并保存在此浏览器，导出 JSON 可一并备份')}else toast('本地容量不足，请导出原有记录');
 }catch(err){toast('照片处理失败：'+err.message)}
 e.target.value='';
});
$('photoClear').onclick=()=>{if(!notes[selected]?.photoData)return;delete notes[selected].photoData;if(saveNotes()){fillNote();toast('照片已移除')}};
$('importFile').addEventListener('change',async e=>{
 const f=e.target.files[0];if(!f)return;
 try{const obj=JSON.parse(await f.text());if(obj.kind!=='windsor-rooms-inspections'||!obj.rooms||typeof obj.rooms!=='object')throw new Error('文件格式不符合本工具');
 for(const [key,n] of Object.entries(obj.rooms)){if(!rooms.some(r=>keyOf(r)===key)||!n||typeof n!=='object')continue;notes[key]={};for(const fld of fields)notes[key][fld]=String(n[fld]||'').slice(0,fld==='notes'?1200:160);notes[key].savedAt=n.savedAt||new Date().toISOString();
  if(typeof n.photoData==='string'&&n.photoData.length<800000&&/^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(n.photoData))notes[key].photoData=n.photoData;
 }
 if(saveNotes()){fillNote();toast('已导入备份记录')}}catch(err){toast('导入失败：'+err.message)}
 e.target.value='';
});
window.WindsorRoomsAPI={selectRoom,selectMode,renderWeek,renderResults};
selectRoom(selected);
})();
