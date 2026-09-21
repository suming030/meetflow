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
/* openCal은 js/google.js에 있다.
   원래 여기서 구글 캘린더 링크만 열었지만, Calendar API로 실제 등록하는
   버전으로 대체됐다. 같은 이름을 두 파일에 두면 로드 순서에 따라 동작이
   바뀌므로 이쪽 정의는 제거한다. */
function closeCal(){ document.getElementById('cal-overlay').classList.remove('show'); }

/* ──── 회의 차수 ────
   history는 최신순([0]이 최신)이라 차수는 뒤에서부터 센다. */
function meetingNo(m){
  const i=history.indexOf(m);
  return i<0?null:history.length-i;
}
