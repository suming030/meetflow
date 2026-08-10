/* MeetFlow — 회의 타임라인
   소유자: 디자인 B

   ────────────────────────────────────────────────────────────
   이 파일은 비어 있습니다. 여기에 작업하세요.

   왜 새 파일인가:
     4명이 동시에 작업하기 때문에, 이미 있는 파일을 고치면 머지할 때 충돌이 납니다.
     새 파일에만 쓰면 충돌이 나지 않습니다.
     index.html에는 이미 연결해 두었으니 그 파일은 건드리지 마세요.

   만들 것:
     1차 → 2차 → 3차 회의가 세로로 이어지는 화면.
     이 서비스의 차별점("회의가 쌓일수록 프로젝트가 선명해진다")을
     사용자 눈에 보이게 하는 가장 중요한 화면입니다.

   쓸 수 있는 데이터 — 전역 변수 history (최신 회의가 [0]):
     [
       {
         id,                  회의 문서 ID
         date,                "2026-08-05T12:00:00.000Z"
         summary,             AI가 쓴 2~3문장 요약
         items: [             그 회의에서 새로 정해진 업무
           { id, task, assignee, deadline, status, priority, carryNote }
         ],
         carriedOver: [       지난 회의에서 이어진 업무에 대한 AI 판단
           { id, task, resolved, note, newDeadline }
         ],
         gaps: [ "예산 논의가 빠졌어요" ],   AI가 짚은 놓친 부분
         createdByName        분석을 돌린 사람 이름
       }
     ]

   상태값: status 는 'todo' | 'doing' | 'done'
           전역 상수 ST 에 라벨·색·아이콘이 정의돼 있습니다 (js/state.js).

   참고할 만한 기존 코드:
     js/dashboard.js 의 renderBriefing() — 패널과 D-day 카드를 그리는 방식
     js/meetings.js 의 carryOverHTML()   — 이어받은 업무를 보여주는 방식

   화면에 그리는 곳:
     index.html 의 <div class="tab" id="tab-timeline"> 안
     사이드바 메뉴도 이미 추가돼 있습니다 (🕒 회의 타임라인)
   ──────────────────────────────────────────────────────────── */

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

  /* history는 최신순([0]이 최신)이라, 1차부터 위→아래로 보이도록 뒤집는다. */
  const chrono = [...history].reverse();
  const total  = chrono.length;

  TL_MEETINGS = {}; /* pfx → {meeting, no} — 회의록 모달에서 다시 찾아 쓴다 */

  wrap.innerHTML = chrono.map((m, idx)=>{
    const no      = idx+1;
    const isLast  = idx===total-1;
    const dateStr = (m.date||'').slice(0,10);
    const items   = m.items||[];
    const pfx     = 'tl'+no;
    TL_MEETINGS[pfx] = {meeting:m, no};

    return `
      <div style="display:flex;gap:16px;align-items:stretch;">
        <div style="display:flex;flex-direction:column;align-items:center;width:36px;flex-shrink:0;">
          <div style="width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--pk),var(--pk-dark));color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;flex-shrink:0;box-shadow:0 3px 10px rgba(124,58,237,.25);">${no}</div>
          ${!isLast?`<div style="flex:1;width:2px;background:var(--bd-s);margin:4px 0;min-height:24px;"></div>`:''}
        </div>
        <div style="flex:1;min-width:0;padding-bottom:${isLast?'0':'20px'};">
          <div class="panel">
            <div class="panel-hd">
              <div class="panel-ttl">🕒 ${no}차 회의${isLast?' <span class="bdg b-person" style="margin-left:6px;">✨ 최신</span>':''}</div>
              <div style="font-size:12px;color:var(--muted);">${dateStr?`📅 ${dateStr}`:''}${m.createdByName?` · 👤 ${m.createdByName} 분석`:''}</div>
            </div>
            <div style="display:flex;gap:8px;flex-wrap:wrap;">
              ${items.length?`
                <div class="tl-toggle-chip" onclick="toggleTlBlock('items-${pfx}')">🆕 새로 생긴 업무 ${items.length}개 <span class="tl-chev" id="tl-chev-items-${pfx}">▸</span></div>
                <div class="tl-toggle-chip" onclick="toggleTlBlock('analysis-${pfx}')">📊 분석 결과 <span class="tl-chev" id="tl-chev-analysis-${pfx}">▸</span></div>`:''}
              <div class="tl-toggle-chip" onclick="openMinutes('${pfx}')">📄 회의록 보기</div>
            </div>
            ${items.length?`
              <div class="ac-grid" id="tl-items-${pfx}" style="display:none;margin-top:10px;">${items.map((it,i)=>acHTML(it,i,pfx)).join('')}</div>
              <div id="tl-analysis-${pfx}" style="display:none;margin-top:10px;">
                <div class="metrics" style="margin-bottom:14px;">${metricsHTML(calcStats(items),pfx)}</div>
                ${prioChartHTML(items)}
              </div>`:''}
            ${m.summary?`<div style="font-size:14px;line-height:1.85;color:var(--text);background:var(--pk-bg);padding:14px 16px;border-radius:10px;${items.length?'margin-top:14px;':''}">${m.summary}</div>`:''}
          </div>
          ${carryOverHTML(m)}
        </div>
      </div>`;
  }).join('');
}

/** 회의 카드 안 토글 블록("새로 생긴 업무" / "분석 결과")을 접었다 펼친다. */
function toggleTlBlock(key){
  const box=document.getElementById('tl-'+key);
  const chev=document.getElementById('tl-chev-'+key);
  if(!box) return;
  const show=box.style.display==='none';
  box.style.display=show?(box.classList.contains('ac-grid')?'flex':'block'):'none';
  if(chev) chev.textContent=show?'▾':'▸';
}

/* ────────────────────────────────────────────────────────────
   회의록 보기 — 지금 있는 데이터(요약·업무·이어진 일·놓친 부분)만으로
   문서 형태 간이 회의록을 만든다. 참석자·장소·안건별 논의내용처럼
   AI가 아직 추출하지 않는 정보는 넣지 않는다(기능 C의 gemini.js 스키마
   확장이 먼저 필요 — js/timeline.js만으로는 만들 수 없는 부분).
   ──────────────────────────────────────────────────────────── */
let TL_MEETINGS = {};

function minutesDocHTML(m, no){
  const dateStr = (m.date||'').slice(0,10);
  const items   = m.items||[];
  const carried = m.carriedOver||[];
  const gaps    = m.gaps||[];
  const done    = carried.filter(c=>c.resolved);
  const still   = carried.filter(c=>!c.resolved);

  const infoRow=(k,v)=>`
    <tr>
      <td style="background:var(--pk-bg);font-weight:700;padding:9px 14px;border:1px solid var(--bd);width:100px;">${k}</td>
      <td style="padding:9px 14px;border:1px solid var(--bd);">${v}</td>
    </tr>`;

  const itemRows = items.length ? items.map(it=>`
    <tr>
      <td style="padding:8px 12px;border:1px solid var(--bd);">${it.task}</td>
      <td style="padding:8px 12px;border:1px solid var(--bd);">${it.assignee||'미지정'}</td>
      <td style="padding:8px 12px;border:1px solid var(--bd);">${it.deadline||'미정'}</td>
      <td style="padding:8px 12px;border:1px solid var(--bd);">${ST.lbl[it.status||'todo']}</td>
    </tr>`).join('') : `<tr><td colspan="4" style="padding:12px;text-align:center;color:var(--muted);border:1px solid var(--bd);">이번 회의에서 새로 생긴 업무가 없어요.</td></tr>`;

  return `
    <h2 style="text-align:center;font-size:18px;margin-bottom:18px;">${no}차 회의록</h2>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
      ${infoRow('회의 차수', `${no}차 회의`)}
      ${infoRow('일자', dateStr||'미정')}
      ${infoRow('분석자', m.createdByName||'-')}
    </table>

    ${m.summary?`
      <h3 style="font-size:14px;margin-bottom:8px;">📝 요약</h3>
      <p style="font-size:13px;line-height:1.8;margin-bottom:24px;">${m.summary}</p>`:''}

    <h3 style="font-size:14px;margin-bottom:8px;">✅ 이번 회의에서 새로 생긴 업무</h3>
    <table style="width:100%;border-collapse:collapse;margin-bottom:24px;font-size:13px;">
      <tr style="background:var(--pk-bg);">
        <th style="padding:8px 12px;border:1px solid var(--bd);text-align:left;">업무</th>
        <th style="padding:8px 12px;border:1px solid var(--bd);text-align:left;width:90px;">담당자</th>
        <th style="padding:8px 12px;border:1px solid var(--bd);text-align:left;width:100px;">마감일</th>
        <th style="padding:8px 12px;border:1px solid var(--bd);text-align:left;width:70px;">상태</th>
      </tr>
      ${itemRows}
    </table>

    ${carried.length?`
      <h3 style="font-size:14px;margin-bottom:8px;">🔗 지난 회의에서 이어진 업무</h3>
      ${done.length?`
        <p style="font-size:12px;font-weight:700;margin:8px 0 4px;">이번 회의에서 마무리됨</p>
        <ul style="font-size:13px;line-height:1.8;margin:0 0 10px;padding-left:20px;">
          ${done.map(c=>`<li>${c.task}${c.note?` — ${c.note}`:''}</li>`).join('')}
        </ul>`:''}
      ${still.length?`
        <p style="font-size:12px;font-weight:700;margin:8px 0 4px;">아직 진행 중</p>
        <ul style="font-size:13px;line-height:1.8;margin:0 0 24px;padding-left:20px;">
          ${still.map(c=>`<li>${c.task}${c.note?` — ${c.note}`:''}${c.newDeadline?` (새 마감일 ${c.newDeadline})`:''}</li>`).join('')}
        </ul>`:''}`:''}

    ${gaps.length?`
      <h3 style="font-size:14px;margin-bottom:8px;">🔍 AI가 짚은 놓친 부분</h3>
      <ul style="font-size:13px;line-height:1.8;padding-left:20px;">
        ${gaps.map(g=>`<li>${g}</li>`).join('')}
      </ul>`:''}`;
}

/** 회의록 모달을 만든다(최초 1회). index.html은 건드리지 않고 JS로 직접 붙인다. */
function ensureMinutesOverlay(){
  let el=document.getElementById('tl-minutes-overlay');
  if(el) return el;
  el=document.createElement('div');
  el.id='tl-minutes-overlay';
  el.className='overlay';
  el.onclick=e=>{ if(e.target.id==='tl-minutes-overlay') closeMinutes(); };
  el.innerHTML=`
    <div class="minutes-box">
      <div class="minutes-hd">
        <div style="font-weight:700;font-size:14px;">📄 회의록</div>
        <div style="display:flex;gap:8px;">
          <button class="btn-ghost" onclick="printMinutes()">🖨️ 인쇄 / PDF 저장</button>
          <button class="btn-ghost" onclick="closeMinutes()">✕ 닫기</button>
        </div>
      </div>
      <div class="minutes-body" id="tl-minutes-body"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}
function openMinutes(pfx){
  const entry=TL_MEETINGS[pfx];
  if(!entry) return;
  const overlay=ensureMinutesOverlay();
  document.getElementById('tl-minutes-body').innerHTML=minutesDocHTML(entry.meeting, entry.no);
  overlay.classList.add('show');
}
function closeMinutes(){
  document.getElementById('tl-minutes-overlay')?.classList.remove('show');
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMinutes(); });

/** 회의록 내용만 새 창에 띄워서 브라우저 인쇄 대화상자로 PDF 저장까지 이어지게 한다. */
function printMinutes(){
  const html=document.getElementById('tl-minutes-body').innerHTML;
  const w=window.open('', '_blank', 'width=800,height=1000');
  if(!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>회의록</title>
    <style>body{font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;color:#15173A;margin:36px;}
    table{border-color:#E3E6F5;} td,th{border-color:#E3E6F5 !important;}</style>
    </head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(), 300);
}
