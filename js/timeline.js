/* MeetFlow — 회의 타임라인
   소유자: 디자인 B

   1차 → 2차 → 3차 회의가 세로로 이어지는 화면.
   "회의가 쌓일수록 프로젝트가 선명해진다"를 눈에 보이게 하는 화면이라
   history를 시간순(오래된 것부터)으로 뒤집어 위→아래로 흐르게 그린다.

   회의마다:
     - N차 회의 / 날짜 / 분석한 사람
     - AI 요약
     - 새로 생긴 업무 (items)            → dashboard.js의 acHTML() 재사용 (체크·상태 토글 그대로 동작)
     - 지난 회의에서 이어진 일 + 놓친 부분 → meetings.js의 carryOverHTML() 재사용
       (meeting 문서가 carriedOver/gaps를 이미 그 형태로 갖고 있어 그대로 넘기면 된다) */

/** 회의 타임라인을 그린다. renderAll()에서 자동으로 호출됩니다. */
function renderTimeline(){
  const wrap = document.getElementById('timeline-wrap');
  if(!wrap) return;

  if(!history.length){
    wrap.innerHTML = `
      <div class="panel">
        <div class="empty">
          <div class="e-ico">🕒</div>
          <h3>아직 분석된 회의가 없어요</h3>
          <p>회의를 분석하면 여기에 순서대로 쌓입니다.</p>
        </div>
      </div>`;
    return;
  }

  const chrono = [...history].reverse();   /* 오래된 회의가 위로 오게 */

  wrap.innerHTML = `
    <div>
      ${chrono.map((m,i)=>tlRowHTML(m,i,chrono.length)).join('')}
    </div>`;
}

function tlRowHTML(m,i,total){
  const num = i+1;
  const isLast = i===total-1;
  const newItems = m.items||[];
  const dateStr = tlDateFmt(m.date);

  return `
    <div style="display:flex;gap:16px;align-items:stretch;">
      <div style="display:flex;flex-direction:column;align-items:center;width:40px;flex-shrink:0;">
        <div style="width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;
          font-size:14px;font-weight:800;flex-shrink:0;border:2px solid var(--pk);
          background:${isLast?'var(--pk)':'var(--pk-bg)'};color:${isLast?'#fff':'var(--pk)'};">${num}</div>
        ${!isLast?`<div style="flex:1;width:2px;background:var(--bd-s);margin:4px 0;"></div>`:''}
      </div>
      <div style="flex:1;min-width:0;padding-bottom:${isLast?'0':'24px'};">
        <div class="panel"${isLast?' style="border-color:var(--bd-s);"':''}>
          <div class="panel-hd">
            <div class="panel-ttl">${num}차 회의${isLast?' <span class="bdg b-person">✨ 최신</span>':''}</div>
            <span style="font-size:12px;color:var(--muted);white-space:nowrap;">${dateStr}${m.createdByName?` · 👤 ${m.createdByName} 분석`:''}</span>
          </div>

          ${m.summary?`<div style="font-size:13px;line-height:1.75;color:var(--text);background:var(--pk-bg);padding:12px 14px;border-radius:10px;margin-bottom:${newItems.length?'14px':'0'};">${m.summary}</div>`:''}

          ${newItems.length?`
          <div class="m-lbl" style="margin-top:2px;">🆕 새로 생긴 업무 ${newItems.length}개</div>
          <div class="ac-grid">${newItems.map((it,idx)=>acHTML(it,idx,'tl'+i)).join('')}</div>`:''}
        </div>
        ${carryOverHTML(m)}
      </div>
    </div>`;
}

function tlDateFmt(iso){
  if(!iso) return '';
  try{ return new Date(iso).toLocaleDateString('ko-KR',{year:'numeric',month:'long',day:'numeric'}); }
  catch(_){ return ''; }
}
