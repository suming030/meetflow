/* MeetFlow — 공용 유틸 (토스트 / D-day / 캘린더 모달)
   소유자: 공용 */

/* ──── 유틸 ──── */
function ddayHTML(diff){
  if(diff<0)  return `<span class="dl-dday dd-urg">D+${Math.abs(diff)}</span>`;
  if(diff===0)return `<span class="dl-dday dd-urg">D-DAY</span>`;
  if(diff<=3) return `<span class="dl-dday dd-urg">D-${diff}</span>`;
  if(diff<=7) return `<span class="dl-dday dd-soon">D-${diff}</span>`;
  return       `<span class="dl-dday dd-ok">D-${diff}</span>`;
}
function groupBy(items){
  const g={};
  items.forEach(it=>{ const n=it.assignee||'미지정'; if(!g[n]) g[n]=[]; g[n].push(it); });
  return g;
}
function esc(s){ return encodeURIComponent(s||''); }
function setLoading(on){
  const btn=document.getElementById('anlz-btn'); btn.disabled=on;
  document.getElementById('spin').style.display=on?'block':'none';
  document.getElementById('btn-txt').textContent=on?'분석 중...':'✨ AI 분석 시작';
}
function showErr(msg){ document.getElementById('err-banner').style.display='flex'; document.getElementById('err-msg').textContent=msg; }
function hideErr(){ document.getElementById('err-banner').style.display='none'; }
function toast(msg,type=''){
  const w=document.getElementById('toast-wrap'), t=document.createElement('div');
  t.className='toast '+type; t.textContent=msg; w.appendChild(t);
  setTimeout(()=>t.remove(),3200);
}

/* 캘린더 */
function openCal(te,dl,ae){
  const task=decodeURIComponent(te), as=decodeURIComponent(ae);
  document.getElementById('cal-task-name').textContent=(as?as+' – ':'')+task;
  const title=esc((as?as+' – ':'')+task);
  const ds=dl?dl.replace(/-/g,'')+'T090000Z/'+dl.replace(/-/g,'')+'T100000Z':'';
  document.getElementById('cal-google').href=`https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${ds}&details=${esc(task)}`;
  document.getElementById('cal-overlay').classList.add('show');
}
function closeCal(){ document.getElementById('cal-overlay').classList.remove('show'); }
