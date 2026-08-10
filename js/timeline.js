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
   회의록 보기 — 안건별 논의 내용(topics)을 본문으로 하고, 업무·이어진 일·
   놓친 부분을 덧붙여 문서 형태 회의록을 만든다.
   topics가 없는 과거 회의(스키마 확장 전에 분석된 것)는 요약+업무 표로 폴백한다.
   참석자·장소·회의 시간은 회의 텍스트에 없는 경우가 많아 AI가 지어낼 위험이
   있어 아직 넣지 않는다 — 넣는다면 업로드 화면에서 직접 입력받는 쪽이 안전하다.
   ──────────────────────────────────────────────────────────── */
let TL_MEETINGS = {};

function minutesDocHTML(m, no){
  const dateStr = (m.date||'').slice(0,10);
  const items   = m.items||[];
  const carried = m.carriedOver||[];
  const gaps    = m.gaps||[];
  const topics  = m.topics||[];
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

  /* 안건별 논의 내용 — 회의록의 본문. 요약만으로는 회의 전체를 알 수 없어서
     "무슨 얘기가 오갔는지"를 안건 단위로 펼쳐 보여준다. */
  const topicsBlock = topics.length ? `
    <h3 style="font-size:14px;margin-bottom:10px;">🗣️ 안건별 논의 내용</h3>
    ${topics.map((t,i)=>`
      <div style="margin-bottom:18px;">
        <div style="font-size:13px;font-weight:800;padding:8px 12px;background:var(--pk-bg);border-left:3px solid var(--pk);border-radius:0 6px 6px 0;margin-bottom:9px;">${i+1}. ${t.title}</div>
        ${(t.discussion||[]).length?`
          <ul style="font-size:13px;line-height:1.85;margin:0;padding-left:22px;">
            ${t.discussion.map(d=>`<li style="margin-bottom:4px;">${d}</li>`).join('')}
          </ul>`:`
          <p style="font-size:12.5px;color:var(--muted);padding-left:4px;">기록된 논의 내용이 없어요.</p>`}
      </div>`).join('')}
    <div style="height:8px;"></div>`
  : `
    <div style="font-size:12.5px;color:var(--muted);line-height:1.7;background:var(--bg);border:1px dashed var(--bd-s);border-radius:8px;padding:13px 15px;margin-bottom:24px;">
      이 회의는 안건별 논의 내용이 저장되기 전에 분석됐어요.<br>
      다시 분석하면 안건별 상세 회의록이 함께 만들어집니다.
    </div>`;

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

    ${topicsBlock}

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
          <button class="btn-ghost" onclick="downloadMinutesWord()">📝 워드로 저장</button>
          <button class="btn-ghost" onclick="printMinutes()">🖨️ 인쇄 / PDF 저장</button>
          <button class="btn-ghost" onclick="closeMinutes()">✕ 닫기</button>
        </div>
      </div>
      <div class="minutes-body" id="tl-minutes-body"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}
let TL_OPEN_NO=null;   /* 지금 열려 있는 회의록의 차수 — 내려받을 파일 이름에 쓴다 */

function openMinutes(pfx){
  const entry=TL_MEETINGS[pfx];
  if(!entry) return;
  const overlay=ensureMinutesOverlay();
  document.getElementById('tl-minutes-body').innerHTML=minutesDocHTML(entry.meeting, entry.no);
  TL_OPEN_NO=entry.no;
  overlay.classList.add('show');
}
function closeMinutes(){
  document.getElementById('tl-minutes-overlay')?.classList.remove('show');
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeMinutes(); });

/* 회의록 본문은 var(--pk-bg) 같은 CSS 변수로 색을 쓰는데, 인쇄 새 창과 워드 파일은
   base.css가 없어서 변수를 해석하지 못한다(워드는 CSS 변수 자체를 지원하지 않는다).
   내보낼 때만 실제 색으로 바꿔치기한다. --bd/--bd-s는 rgba라 흰 배경 기준 불투명색으로 환산. */
const MINUTES_EXPORT_COLORS={
  '--pk':'#4B6BFB', '--pk-dark':'#7C3AED', '--pk-mid':'#A5B0FC',
  '--pk-light':'#EEF0FE', '--pk-bg':'#F7F8FF',
  '--bg':'#F7F8FF', '--surface':'#FFFFFF',
  '--bd':'#EDF0FF', '--bd-s':'#D7DEFE',
  '--text':'#15173A', '--muted':'#5A5F87', '--hint':'#A8ADCC',
};
function minutesExportHTML(){
  const el=document.getElementById('tl-minutes-body');
  if(!el) return '';
  return el.innerHTML.replace(/var\((--[a-z-]+)\)/g,(m,name)=>MINUTES_EXPORT_COLORS[name]||'inherit');
}

/** 회의록 내용만 새 창에 띄워서 브라우저 인쇄 대화상자로 PDF 저장까지 이어지게 한다. */
function printMinutes(){
  const html=minutesExportHTML();
  const w=window.open('', '_blank', 'width=800,height=1000');
  if(!w) return;
  w.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8"><title>회의록</title>
    <style>body{font-family:'Pretendard','Apple SD Gothic Neo',sans-serif;color:#15173A;margin:36px;}
    table{border-color:#EDF0FF;} td,th{border-color:#EDF0FF !important;}</style>
    </head><body>${html}</body></html>`);
  w.document.close();
  w.focus();
  setTimeout(()=>w.print(), 300);
}

/** 회의록을 워드에서 열 수 있는 파일로 내려받는다.
    빌드 도구·외부 라이브러리 없이 하려고, 워드가 그대로 열 수 있는 HTML 문서를
    .doc로 저장하는 방식을 쓴다(mso 블록으로 A4·여백 지정). 워드에서 바로 편집된다. */
function downloadMinutesWord(){
  const html=minutesExportHTML();
  if(!html){ toast('내려받을 회의록이 없어요.','error'); return; }
  const title=(TL_OPEN_NO?TL_OPEN_NO+'차 ':'')+'회의록';
  const doc=`<html xmlns:o="urn:schemas-microsoft-com:office:office"
      xmlns:w="urn:schemas-microsoft-com:office:word"
      xmlns="http://www.w3.org/TR/REC-html40">
    <head><meta charset="utf-8"><title>${title}</title>
    <!--[if gte mso 9]><xml><w:WordDocument>
      <w:View>Print</w:View><w:Zoom>100</w:Zoom></w:WordDocument></xml><![endif]-->
    <style>
      @page{size:A4;margin:2cm;}
      body{font-family:'맑은 고딕','Malgun Gothic',sans-serif;font-size:11pt;color:#15173A;line-height:1.7;}
      h2{font-size:16pt;} h3{font-size:12.5pt;margin-top:16pt;}
      table{border-collapse:collapse;width:100%;}
      td,th{border:1px solid #C9CCE0 !important;padding:6pt 8pt;}
      ul{margin:0 0 10pt;} li{margin-bottom:3pt;}
    </style></head><body>${html}</body></html>`;

  /* 앞의 BOM이 없으면 워드가 한글을 깨진 인코딩으로 읽는다. */
  const blob=new Blob(['﻿',doc],{type:'application/msword'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=title+'.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('회의록을 내려받았어요. 워드로 열면 바로 편집할 수 있어요.');
}
