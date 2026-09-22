/* MeetFlow — 프로젝트 마무리 (회고 문서)
   담당: ⑤ 정리·내보내기 — 화면과 AI 프롬프트(맨 아래)를 이 파일이 함께 가진다.

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
        ${aiErrorDetailHtml(info)}
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
        ${aiErrorDetailHtml(info)}
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


/* ════════════════════════════════════════════════════════════════
   AI 프롬프트 — 원래 js/gemini.js에 있었다. 정리 양식을 고치는 사람이
   화면(위)과 프롬프트(아래)를 한 파일에서 같이 고칠 수 있도록 옮겼다.
   geminiRequest()는 gemini.js의 공용 도구다.
════════════════════════════════════════════════════════════════ */

/* ════════════════════════════════
   프로젝트 마무리 — 사람별 역할·기여·배운 점 정리

   회의가 쌓인 결과를 프로젝트가 끝나는 시점에 한 번 정리한다.
   업무 배정과 회의 내용이 이미 사람 단위로 남아 있으므로 그걸 근거로 쓴다.
════════════════════════════════ */

/**
 * @param {object} project  현재 프로젝트 {name, track}
 * @param {Array}  meets    회의 이력 (최신순)
 */
async function callProjectWrapup(project, meets){
  const chrono=[...meets].reverse();   /* 오래된 회의부터 읽어야 흐름이 보인다 */

  const meetingBlock=chrono.map((m,i)=>{
    const topics=(m.topics||[]).map(t=>`  · ${t.title}: ${(t.discussion||[]).slice(0,4).join(' / ')}`);
    return [
      `[${i+1}차 회의${m.date?` — ${m.date.slice(0,10)}`:''}]`,
      m.summary?`요약: ${m.summary}`:'',
      topics.length?`안건:\n${topics.join('\n')}`:''
    ].filter(Boolean).join('\n');
  }).join('\n\n');

  /* 사람별로 실제 맡았던 업무 — 역할과 기여를 판단할 근거가 된다 */
  const byPerson={};
  chrono.forEach((m,i)=>{
    (m.items||[]).forEach(it=>{
      const who=(it.assignee&&it.assignee!=='미지정')?it.assignee:null;
      if(!who) return;
      (byPerson[who]=byPerson[who]||[]).push(
        `- ${it.task} (${i+1}차 회의, ${ST.lbl[it.status||'todo']}${it.deadline?`, 마감 ${it.deadline}`:''})`);
    });
  });
  const names=Object.keys(byPerson);
  const peopleBlock=names.length
    ? Object.entries(byPerson).map(([n,ts])=>`[${n}]\n${ts.join('\n')}`).join('\n\n')
    : '(업무에 담당자가 지정된 기록이 없습니다.)';

  const prompt=`아래는 "${project.name||'이름 없는 프로젝트'}" 프로젝트(${TRACK_LBL[project.track]||'팀 프로젝트'})의
회의 ${chrono.length}건 전체 기록입니다. 프로젝트가 끝나서 회고 문서를 만들려고 합니다.

===== 회의 기록 =====
${meetingBlock}

===== 사람별로 맡았던 업무 =====
${peopleBlock}

작성 규칙:
- members에는 위 "사람별로 맡았던 업무"에 이름이 나온 사람만 넣으세요.
  ${names.length?`이번 프로젝트의 대상: ${names.join(', ')}`:'대상이 없으면 빈 배열로 두세요.'}
- 이름을 새로 만들지 마세요. "미지정"은 사람이 아니므로 넣지 마세요.
- role: 이 사람이 프로젝트에서 실제로 맡은 역할을 한 문장으로. 기록에 근거해서 쓰세요.
- contributions: 실제로 한 일을 3~6개. 회의 기록에 있는 구체적인 내용으로 쓰세요.
  "열심히 참여함" 같은 빈말 말고 무엇을 했는지 적으세요.
- learned: 그 일을 하면서 얻었을 경험·역량을 2~4개.
  기록에서 드러나는 것만 쓰고 확대해석하지 마세요.
  (예: 여러 부서와 일정을 조율한 기록이 있으면 "일정 조율" — 없는 성과를 지어내지 말 것)
- overview: 프로젝트가 어떻게 시작해서 어떻게 마무리됐는지 3~5문장.
- teamLearnings: 팀 전체가 배운 것 3~5개.
- keepNext: 다음 프로젝트에서 이어가면 좋을 것과 고치면 좋을 것 3~5개.
  회의에서 반복해 미뤄진 일이나 결정이 늦어진 지점이 있으면 짚어주세요.
- 자기소개서에 그대로 쓸 수 있을 만큼 구체적으로, 한국어로 쓰세요.`;

  const schema={
    type:'object',
    properties:{
      overview:{type:'string'},
      members:{
        type:'array',
        items:{
          type:'object',
          properties:{
            name:         {type:'string'},
            role:         {type:'string'},
            contributions:{type:'array', items:{type:'string'}},
            learned:      {type:'array', items:{type:'string'}},
          },
          required:['name','role','contributions','learned']
        }
      },
      teamLearnings:{type:'array', items:{type:'string'}},
      keepNext:     {type:'array', items:{type:'string'}}
    },
    required:['overview','members','teamLearnings','keepNext']
  };

  const parsed=await geminiRequest(prompt,schema,16384);

  /* 기록에 없는 사람을 지어내는 경우가 있어 실제 담당자 명단으로 한 번 거른다 */
  const allow=new Set(names);
  parsed.members=Array.isArray(parsed.members)
    ? parsed.members
        .filter(m=>m&&m.name&&(allow.size===0||allow.has(String(m.name).trim())))
        .map(m=>({
          name:String(m.name).trim(),
          role:m.role||'',
          contributions:Array.isArray(m.contributions)?m.contributions.filter(Boolean):[],
          learned:Array.isArray(m.learned)?m.learned.filter(Boolean):[]
        }))
    : [];
  parsed.teamLearnings=Array.isArray(parsed.teamLearnings)?parsed.teamLearnings.filter(Boolean):[];
  parsed.keepNext=Array.isArray(parsed.keepNext)?parsed.keepNext.filter(Boolean):[];
  return parsed;
}

/* ────────────────────────────────
   개인 경험 정리 — 한 사람만 깊게

   전체 회고(callProjectWrapup)가 팀 단위 요약이라면, 이건 한 사람이
   자기소개서·포트폴리오에 쓸 수 있을 만큼 자세히 파는 쪽이다.
   담당자가 팀 이름("홍보팀")인 경우도 있어 사람/팀을 가리지 않고 "담당 주체"로 다룬다.
   ──────────────────────────────── */

/**
 * @param {object} project 현재 프로젝트
 * @param {Array}  meets   회의 이력 (최신순)
 * @param {string} who     정리할 담당자 이름
 */
async function callMemberWrapup(project, meets, who){
  const chrono=[...meets].reverse();

  /* 이 사람이 맡은 업무를 회차별로 */
  const myTasks=[];
  chrono.forEach((m,i)=>{
    (m.items||[]).forEach(it=>{
      if(it.assignee===who)
        myTasks.push(`- [${i+1}차] ${it.task} (${ST.lbl[it.status||'todo']}${it.deadline?`, 마감 ${it.deadline}`:''})`);
    });
  });

  /* 이 사람 이름이 언급된 회의 내용 — 업무 목록만으로는 안 보이는 맥락이 여기 있다 */
  const mentions=[];
  chrono.forEach((m,i)=>{
    (m.topics||[]).forEach(t=>{
      (t.discussion||[]).forEach(d=>{
        if(d.includes(who)) mentions.push(`- [${i+1}차 · ${t.title}] ${d}`);
      });
    });
    (m.carriedOver||[]).forEach(c=>{
      if((c.task||'').includes(who)||(c.note||'').includes(who))
        mentions.push(`- [${i+1}차 · 이어진 업무] ${c.task}: ${c.note||''}`);
    });
  });

  /* 팀 전체 흐름 — 이 사람의 일이 어디에 놓였는지 알아야 역할을 제대로 쓴다 */
  const flow=chrono.map((m,i)=>
    `[${i+1}차${m.date?` · ${m.date.slice(0,10)}`:''}] ${m.summary||''}`).join('\n');

  const prompt=`"${project.name||'프로젝트'}"(${TRACK_LBL[project.track]||'팀 프로젝트'})에서
**${who}**가 한 일을 정리해 개인 경험 기록을 만들려고 합니다.

===== 프로젝트 전체 흐름 (회의 ${chrono.length}건) =====
${flow}

===== ${who}가 맡은 업무 =====
${myTasks.length?myTasks.join('\n'):'(배정된 업무 기록이 없습니다.)'}

===== 회의에서 ${who}가 언급된 대목 =====
${mentions.length?mentions.join('\n'):'(직접 언급된 대목이 없습니다.)'}

작성 규칙:
- 주인공은 ${who}입니다. 다른 사람이 한 일을 ${who}의 성과로 쓰지 마세요.
- **기록에 있는 것만 쓰세요.** 없는 성과·수치·직함을 지어내면 안 됩니다.
  근거가 부족하면 항목을 적게 쓰는 편이 낫습니다.
- role: ${who}가 이 프로젝트에서 맡은 역할을 한 문장으로.
- summary: 무엇을 맡아 어떻게 해냈는지 3~4문장. 자기소개서 도입부처럼 쓰세요.
- timeline: 회차별로 무엇을 했는지. when은 "1차 회의"처럼, what은 한 문장으로.
  업무가 있던 회차만 넣으세요.
- highlights: 대표 경험 2~3개를 상황·행동·결과로 나눠 쓰세요.
  situation은 그때 어떤 문제나 필요가 있었는지, action은 ${who}가 실제로 한 행동,
  result는 그래서 어떻게 됐는지. result가 기록에 없으면 "진행 중"처럼 사실대로 쓰세요.
- skills: 이 경험으로 보여줄 수 있는 역량 3~5개. 한 단어~짧은 구로.
- growth: 배운 점·성장한 부분 2~4개를 문장으로.
- selfIntro: 자기소개서에 그대로 붙여 쓸 수 있는 한 문단(4~6문장).
  과장 없이, 위 기록에 있는 사실만으로 쓰세요.
- 한국어로 쓰세요.`;

  const schema={
    type:'object',
    properties:{
      role:   {type:'string'},
      summary:{type:'string'},
      timeline:{
        type:'array',
        items:{ type:'object',
          properties:{ when:{type:'string'}, what:{type:'string'} },
          required:['when','what'] }
      },
      highlights:{
        type:'array',
        items:{ type:'object',
          properties:{
            title:    {type:'string'},
            situation:{type:'string'},
            action:   {type:'string'},
            result:   {type:'string'},
          },
          required:['title','situation','action','result'] }
      },
      skills:   {type:'array', items:{type:'string'}},
      growth:   {type:'array', items:{type:'string'}},
      selfIntro:{type:'string'}
    },
    required:['role','summary','timeline','highlights','skills','growth','selfIntro']
  };

  const parsed=await geminiRequest(prompt,schema,16384);
  const arr=v=>Array.isArray(v)?v.filter(Boolean):[];
  return {
    name:who,
    role:parsed.role||'',
    summary:parsed.summary||'',
    timeline:arr(parsed.timeline).filter(t=>t.when&&t.what),
    highlights:arr(parsed.highlights).filter(h=>h.title),
    skills:arr(parsed.skills),
    growth:arr(parsed.growth),
    selfIntro:parsed.selfIntro||'',
    createdAt:new Date().toISOString()
  };
}
