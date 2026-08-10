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
      ? `<div class="wrap-note">
           <div style="margin-bottom:8px;">누구를 눌러보세요 — 그 사람의 경험만 자세히 정리해드려요</div>
           ${people.map((p,i)=>`<span class="bdg b-person wrap-person" onclick="openMemberWrapupAt(${i})">👤 ${esc2(p)}</span>`).join(' ')}
         </div>`
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

/* 이름을 onclick에 직접 넣으면 따옴표가 든 이름에서 깨지므로 번호로 넘긴다 */
let WRAPUP_PEOPLE = [];

/** 이번 프로젝트에서 업무를 맡은 적 있는 사람 목록 */
function wrapupPeople(){
  WRAPUP_PEOPLE = [...new Set(history.flatMap(m=>(m.items||[]).map(i=>i.assignee)))]
    .filter(n=>n&&n!=='미지정');
  return WRAPUP_PEOPLE;
}
function openMemberWrapupAt(i){
  const who=WRAPUP_PEOPLE[i];
  if(who) openMemberWrapup(who);
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
            <div style="flex:1;min-width:0;">
              <div class="wrap-member-name">${esc2(m.name)}</div>
              <div class="wrap-member-role">${esc2(m.role||'')}</div>
            </div>
            <span class="panel-lnk" onclick="openMemberWrapup('${esc2(m.name).replace(/'/g,'&#39;')}')">
              경험 자세히 →
            </span>
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

/* ════════════════════════════════
   개인 경험 정리 — 한 사람만 깊게
════════════════════════════════ */

let memberBusy = null;   /* 지금 만들고 있는 사람 이름 */

/** 저장해둔 개인 정리를 꺼낸다. */
function cachedMember(who){
  return (currentProject && currentProject.wrapupMembers && currentProject.wrapupMembers[who]) || null;
}

/** 참여자를 눌렀을 때 — 저장된 게 있으면 바로 보여주고, 없으면 만들지 물어본다. */
function openMemberWrapup(who){
  const cached=cachedMember(who);
  if(cached){ renderMemberWrapup(cached); return; }
  renderMemberIntro(who);
}

/** 아직 만든 적 없는 사람 — 무엇을 만들지 보여주고 시작하게 한다. */
function renderMemberIntro(who){
  setWrapupActions(`<button class="btn-ghost" onclick="backToWrapup()">← 뒤로</button>`);

  /* 근거가 얼마나 있는지 먼저 보여준다. 적으면 결과도 얇을 수밖에 없다. */
  const myTasks=history.flatMap(m=>(m.items||[]).filter(i=>i.assignee===who));
  const done=myTasks.filter(i=>i.status==='done').length;

  document.getElementById('wrapup-body').innerHTML=`
    <div style="text-align:center;padding:8px 0 4px;">
      <div class="fn-av ${avCls(who)}" style="width:56px;height:56px;font-size:22px;margin:0 auto 14px;">${esc2(who[0]||'?')}</div>
      <h2 style="font-size:19px;margin-bottom:8px;">${esc2(who)}님의 경험 정리</h2>
      <p style="font-size:13.5px;color:var(--muted);line-height:1.8;">
        회의 기록에서 ${esc2(who)}님이 맡은 일만 모아<br>
        역할·대표 경험·배운 점을 자기소개서에 쓸 수 있게 정리해드려요.
      </p>
    </div>

    <div class="wrap-stat">
      <div class="wrap-stat-c"><div class="wrap-stat-v">${myTasks.length}</div><div class="wrap-stat-l">맡은 업무</div></div>
      <div class="wrap-stat-c"><div class="wrap-stat-v">${done}</div><div class="wrap-stat-l">완료</div></div>
      <div class="wrap-stat-c"><div class="wrap-stat-v">${history.length}</div><div class="wrap-stat-l">전체 회의</div></div>
    </div>

    ${myTasks.length<2?`
      <div class="wrap-warn">
        맡은 업무 기록이 ${myTasks.length}건뿐이라 정리가 짧게 나올 수 있어요.
        없는 내용을 지어내지 않도록 만들어서, 기록이 적으면 결과도 적습니다.
      </div>`:''}

    <div style="text-align:center;margin-top:22px;">
      <button class="btn-pk" onclick="runMemberWrapup('${esc2(who).replace(/'/g,'&#39;')}')">✨ ${esc2(who)}님 경험 정리하기</button>
      <div style="font-size:11.5px;color:var(--hint);margin-top:10px;">AI 호출을 한 번 사용해요</div>
    </div>`;
}

/** 뒤로 — 전체 회고가 있으면 그걸로, 없으면 시작 화면으로 */
function backToWrapup(){
  if(currentProject && currentProject.wrapup) renderWrapup(currentProject.wrapup);
  else renderWrapupIntro();
}

async function runMemberWrapup(who){
  if(memberBusy) return;
  memberBusy=who;
  setWrapupActions(`<button class="btn-ghost" onclick="backToWrapup()">← 뒤로</button>`);

  document.getElementById('wrapup-body').innerHTML=`
    <div style="text-align:center;padding:50px 0;">
      <div class="research-spin" style="margin:0 auto 18px;"></div>
      <div style="font-size:14px;font-weight:700;">${esc2(who)}님이 한 일을 모으고 있어요…</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">
        회의 ${history.length}건에서 맡은 업무와 언급된 대목을 찾는 중이에요.
      </div>
    </div>`;

  try{
    const res=await callMemberWrapup(currentProject, history, who);
    currentProject.wrapupMembers=currentProject.wrapupMembers||{};
    currentProject.wrapupMembers[who]=res;
    renderMemberWrapup(res);
    try{
      await window.mfDb.saveProject(currentProject);
    }catch(e){
      console.error('[MeetFlow] 개인 정리 저장 실패', e);
      toast('정리는 만들었지만 저장하지 못했어요. 새로고침하면 사라져요.','error');
    }
  }catch(e){
    console.error('[MeetFlow] 개인 정리 실패', e);
    const info=aiErrorInfo(e);
    document.getElementById('wrapup-body').innerHTML=`
      <div class="empty">
        <div class="e-ico">${info.wait?'⏳':'👤'}</div>
        <h3>${esc2(info.title)}</h3>
        <p>${esc2(info.desc)}</p>
        ${info.retry?`<button class="btn-out" onclick="runMemberWrapup('${esc2(who).replace(/'/g,'&#39;')}')">다시 시도</button>`:''}
      </div>`;
  }finally{
    memberBusy=null;
  }
}

/** 완성된 개인 경험 정리를 그린다. */
function renderMemberWrapup(d){
  const safe=esc2(d.name).replace(/'/g,'&#39;');
  setWrapupActions(`
    <button class="btn-ghost" onclick="backToWrapup()">← 뒤로</button>
    <button class="btn-ghost" onclick="downloadMemberWord('${safe}')">📝 워드로 저장</button>
    <button class="btn-ghost" onclick="runMemberWrapup('${safe}')">↻ 다시 정리</button>`);

  const list=a=>`<ul class="wrap-ul">${a.map(x=>`<li>${esc2(x)}</li>`).join('')}</ul>`;

  document.getElementById('wrapup-body').innerHTML=`
    <div class="mem-hero">
      <div class="fn-av ${avCls(d.name)}" style="width:52px;height:52px;font-size:21px;">${esc2(d.name[0]||'?')}</div>
      <div>
        <div class="mem-name">${esc2(d.name)}</div>
        <div class="mem-role">${esc2(d.role||'')}</div>
      </div>
    </div>

    <p class="wrap-p" style="margin-bottom:4px;">${esc2(d.summary||'')}</p>

    ${d.skills.length?`
      <div class="mem-skills">${d.skills.map(s=>`<span class="mem-skill">${esc2(s)}</span>`).join('')}</div>`:''}

    ${d.timeline.length?`
      <h3 class="wrap-h">🗓️ 회차별로 한 일</h3>
      <div class="mem-tl">
        ${d.timeline.map(t=>`
          <div class="mem-tl-row">
            <div class="mem-tl-when">${esc2(t.when)}</div>
            <div class="mem-tl-what">${esc2(t.what)}</div>
          </div>`).join('')}
      </div>`:''}

    ${d.highlights.length?`
      <h3 class="wrap-h">⭐ 대표 경험</h3>
      ${d.highlights.map(h=>`
        <div class="mem-hl">
          <div class="mem-hl-ttl">${esc2(h.title)}</div>
          <div class="mem-hl-row"><span class="mem-hl-lbl">상황</span><span>${esc2(h.situation)}</span></div>
          <div class="mem-hl-row"><span class="mem-hl-lbl">행동</span><span>${esc2(h.action)}</span></div>
          <div class="mem-hl-row"><span class="mem-hl-lbl">결과</span><span>${esc2(h.result)}</span></div>
        </div>`).join('')}`:''}

    ${d.growth.length?`<h3 class="wrap-h">🌱 배운 점</h3>${list(d.growth)}`:''}

    ${d.selfIntro?`
      <h3 class="wrap-h">✍️ 자기소개서에 쓴다면</h3>
      <div class="mem-intro">
        <p>${esc2(d.selfIntro)}</p>
        <button class="btn-ghost" style="margin-top:12px;" onclick="copyText(this,'mem-intro-src')">📋 복사하기</button>
        <textarea id="mem-intro-src" style="position:absolute;left:-9999px;">${esc2(d.selfIntro)}</textarea>
      </div>
      <div class="research-note">AI가 기록을 바탕으로 쓴 초안이에요. 사실이 맞는지 확인하고 본인 말로 다듬어 쓰세요.</div>`:''}`;
}

/** 텍스트를 클립보드에 복사한다. */
function copyText(btn, srcId){
  const src=document.getElementById(srcId);
  if(!src) return;
  navigator.clipboard.writeText(src.value).then(()=>{
    const old=btn.textContent;
    btn.textContent='✅ 복사됐어요';
    setTimeout(()=>{ btn.textContent=old; },1600);
  }).catch(()=>toast('복사하지 못했어요.','error'));
}

/** 개인 경험 정리를 워드 파일로 내려받는다. */
function downloadMemberWord(who){
  const d=cachedMember(who);
  if(!d){ toast('먼저 경험 정리를 만들어주세요.','error'); return; }
  exportWordDoc(
    document.getElementById('wrapup-body').innerHTML,
    `${who} 경험정리 — ${currentProject?.name||'프로젝트'}`);
}

/** 화면에 그려진 HTML을 워드가 여는 .doc로 내려받는다. 회고와 개인 정리가 함께 쓴다.
    (회의록 저장과 같은 방식 — 워드는 CSS 변수를 모르므로 실제 색으로 바꿔서 내보낸다) */
function exportWordDoc(rawHtml, title){
  /* 복사용 숨은 textarea와 버튼은 문서에 들어가면 안 된다 */
  const tmp=document.createElement('div');
  tmp.innerHTML=rawHtml;
  tmp.querySelectorAll('textarea,button').forEach(el=>el.remove());

  const html=tmp.innerHTML.replace(/var\((--[a-z-]+)\)/g,
    (m,name)=>MINUTES_EXPORT_COLORS[name]||'inherit');

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
  toast('문서를 내려받았어요.');
}

/** 팀 전체 회고를 워드로 저장 */
function downloadWrapupWord(){
  const el=document.getElementById('wrapup-body');
  if(!el) return;
  exportWordDoc(el.innerHTML, (currentProject?.name||'프로젝트')+' 회고');
}
