/* MeetFlow — 프로젝트 마무리 (회고 문서)

   프로젝트가 끝났을 때 회의 전체를 한 번에 정리한다.
   사람마다 맡은 역할·실제로 한 일·배운 점을 뽑아주는 것이 핵심이다.
   근거는 회의 기록과 업무 담당자 배정이라, 담당자가 지정돼 있을수록 결과가 좋아진다.

   결과는 프로젝트 문서에 저장한다(project.wrapup). AI 호출이 비싸서
   열 때마다 다시 부르지 않고, 사용자가 "다시 정리"를 눌렀을 때만 새로 만든다. */

let wrapupBusy = false;

/* ──── 열기/닫기 ──── */

function openWrapup(){
  if(!currentProject){ toast('프로젝트를 먼저 선택해주세요.','error'); return; }
  const el = ensureWrapupOverlay();
  el.classList.add('show');

  if(currentProject.wrapup) renderWrapup(currentProject.wrapup);
  else                      renderWrapupIntro();
}
function closeWrapup(){
  document.getElementById('wrapup-overlay')?.classList.remove('show');
}

/** 회고 모달을 만든다(최초 1회). index.html은 건드리지 않고 JS로 붙인다. */
function ensureWrapupOverlay(){
  let el=document.getElementById('wrapup-overlay');
  if(el) return el;
  el=document.createElement('div');
  el.id='wrapup-overlay';
  el.className='overlay';
  el.onclick=e=>{ if(e.target.id==='wrapup-overlay') closeWrapup(); };
  el.innerHTML=`
    <div class="minutes-box">
      <div class="minutes-hd">
        <div style="font-weight:700;font-size:14px;">🎬 프로젝트 마무리</div>
        <div style="display:flex;gap:8px;" id="wrapup-actions"></div>
      </div>
      <div class="minutes-body" id="wrapup-body"></div>
    </div>`;
  document.body.appendChild(el);
  return el;
}
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeWrapup(); });

function setWrapupActions(html){
  const el=document.getElementById('wrapup-actions');
  if(el) el.innerHTML=html+`<button class="btn-ghost" onclick="closeWrapup()">✕ 닫기</button>`;
}

/* ──── 화면들 ──── */

/** 아직 만든 적 없을 때 — 무엇을 만들지 먼저 알려주고 시작하게 한다. */
function renderWrapupIntro(){
  const meets=history.length;
  const people=wrapupPeople();
  setWrapupActions('');

  document.getElementById('wrapup-body').innerHTML=`
    <div style="text-align:center;padding:10px 0 4px;">
      <div style="font-size:44px;margin-bottom:10px;">🎬</div>
      <h2 style="font-size:19px;margin-bottom:8px;">프로젝트를 마무리할까요?</h2>
      <p style="font-size:13.5px;color:var(--muted);line-height:1.8;">
        지금까지 쌓인 회의 <b>${meets}건</b>을 모아<br>
        사람마다 맡은 역할과 배운 점을 정리해드려요.
      </p>
    </div>

    <div class="wrap-stat">
      <div class="wrap-stat-c"><div class="wrap-stat-v">${meets}</div><div class="wrap-stat-l">회의</div></div>
      <div class="wrap-stat-c"><div class="wrap-stat-v">${history.flatMap(m=>m.items||[]).length}</div><div class="wrap-stat-l">업무</div></div>
      <div class="wrap-stat-c"><div class="wrap-stat-v">${people.length}</div><div class="wrap-stat-l">참여자</div></div>
    </div>

    ${people.length
      ? `<div class="wrap-note">정리 대상: ${people.map(p=>`<span class="bdg b-person">👤 ${esc2(p)}</span>`).join(' ')}</div>`
      : `<div class="wrap-warn">
           <b>담당자가 지정된 업무가 없어요.</b><br>
           사람별 정리는 업무 담당자를 근거로 만들어져요. 그냥 진행하면 전체 요약만 나옵니다.
           Action Items에서 담당자를 채우면 훨씬 좋아져요.
         </div>`}

    ${meets===0
      ? `<div class="wrap-warn">분석된 회의가 없어서 정리할 내용이 없어요.</div>`
      : `<div style="text-align:center;margin-top:22px;">
           <button class="btn-pk" onclick="runWrapup()">✨ 회고 문서 만들기</button>
           <div style="font-size:11.5px;color:var(--hint);margin-top:10px;">AI 호출을 한 번 사용해요</div>
         </div>`}`;
}

/** 이번 프로젝트에서 업무를 맡은 적 있는 사람 목록 */
function wrapupPeople(){
  return [...new Set(history.flatMap(m=>(m.items||[]).map(i=>i.assignee)))]
    .filter(n=>n&&n!=='미지정');
}

/** AI를 불러 회고를 만들고 프로젝트에 저장한다. */
async function runWrapup(){
  if(wrapupBusy) return;
  if(!history.length){ toast('분석된 회의가 없어요.','error'); return; }
  wrapupBusy=true;
  setWrapupActions('');

  document.getElementById('wrapup-body').innerHTML=`
    <div style="text-align:center;padding:50px 0;">
      <div class="research-spin" style="margin:0 auto 18px;"></div>
      <div style="font-size:14px;font-weight:700;">회의 ${history.length}건을 읽고 있어요…</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">
        사람마다 맡은 역할과 배운 점을 정리하는 중이에요.
      </div>
    </div>`;

  try{
    const res=await callProjectWrapup(currentProject, history);
    res.createdAt=new Date().toISOString();
    currentProject.wrapup=res;
    renderWrapup(res);
    /* 다시 만들 때마다 AI를 쓰지 않도록 프로젝트에 저장해둔다 */
    try{
      await window.mfDb.saveProject(currentProject);
    }catch(e){
      console.error('[MeetFlow] 회고 저장 실패', e);
      toast('회고는 만들었지만 저장하지 못했어요. 새로고침하면 사라져요.','error');
    }
  }catch(e){
    console.error('[MeetFlow] 회고 생성 실패', e);
    const info=aiErrorInfo(e);
    setWrapupActions('');
    document.getElementById('wrapup-body').innerHTML=`
      <div class="empty">
        <div class="e-ico">${info.wait?'⏳':'🎬'}</div>
        <h3>${esc2(info.title)}</h3>
        <p>${esc2(info.desc)}</p>
        ${info.retry?`<button class="btn-out" onclick="runWrapup()">다시 시도</button>`:''}
      </div>`;
  }finally{
    wrapupBusy=false;
  }
}

/** 완성된 회고를 그린다. */
function renderWrapup(w){
  setWrapupActions(`
    <button class="btn-ghost" onclick="downloadWrapupWord()">📝 워드로 저장</button>
    <button class="btn-ghost" onclick="runWrapup()">↻ 다시 정리</button>`);

  const list=(arr)=>`<ul class="wrap-ul">${arr.map(x=>`<li>${esc2(x)}</li>`).join('')}</ul>`;

  document.getElementById('wrapup-body').innerHTML=`
    <h2 style="text-align:center;font-size:19px;margin-bottom:6px;">
      ${esc2(currentProject.name||'프로젝트')} 회고
    </h2>
    <div style="text-align:center;font-size:12px;color:var(--muted);margin-bottom:24px;">
      회의 ${history.length}건 · ${w.createdAt?w.createdAt.slice(0,10):''} 정리
    </div>

    <h3 class="wrap-h">📌 프로젝트 개요</h3>
    <p class="wrap-p">${esc2(w.overview||'')}</p>

    ${(w.members||[]).length?`
      <h3 class="wrap-h">👥 사람별 역할과 배운 점</h3>
      ${w.members.map(m=>`
        <div class="wrap-member">
          <div class="wrap-member-hd">
            <div class="fn-av ${avCls(m.name)}">${esc2(m.name[0]||'?')}</div>
            <div>
              <div class="wrap-member-name">${esc2(m.name)}</div>
              <div class="wrap-member-role">${esc2(m.role||'')}</div>
            </div>
          </div>
          ${(m.contributions||[]).length?`
            <div class="wrap-sub">한 일</div>${list(m.contributions)}`:''}
          ${(m.learned||[]).length?`
            <div class="wrap-sub">배운 점</div>${list(m.learned)}`:''}
        </div>`).join('')}`
      :`<div class="wrap-warn">업무에 담당자가 지정돼 있지 않아 사람별 정리를 만들지 못했어요.</div>`}

    ${(w.teamLearnings||[]).length?`
      <h3 class="wrap-h">🌱 팀이 배운 것</h3>${list(w.teamLearnings)}`:''}

    ${(w.keepNext||[]).length?`
      <h3 class="wrap-h">🎯 다음 프로젝트에서는</h3>${list(w.keepNext)}`:''}`;
}

/** 회고를 워드에서 열 수 있는 파일로 내려받는다(회의록 저장과 같은 방식). */
function downloadWrapupWord(){
  const el=document.getElementById('wrapup-body');
  if(!el) return;
  /* 워드는 CSS 변수를 모르므로 실제 색으로 바꾼다 — 회의록 내보내기와 같은 표를 쓴다 */
  const html=el.innerHTML.replace(/var\((--[a-z-]+)\)/g,
    (m,name)=>MINUTES_EXPORT_COLORS[name]||'inherit');
  const title=(currentProject?.name||'프로젝트')+' 회고';

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
      ul{margin:0 0 10pt;} li{margin-bottom:3pt;}
    </style></head><body>${html}</body></html>`;

  const blob=new Blob(['﻿',doc],{type:'application/msword'});
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url; a.download=title+'.doc';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('회고 문서를 내려받았어요.');
}
