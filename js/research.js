/* MeetFlow — 추가 분석 자료 찾기 (Google 검색 그라운딩)
   담당: ⑤ 구글 연동 + 내 공간

   회의 분석이 끝나면 "그래서 뭘 더 알아봐야 하지?"가 남는다. 회의에서 나온 안건과
   AI가 짚은 빈틈을 검색어로 바꿔 실제 웹 자료를 찾아온다.

   두 군데에서 부른다:
   - 회의 분석 결과 아래 (#up-research) — 방금 분석한 회의
   - 회의 타임라인의 각 회의 카드 (#tl-research-tlN) — 지난 회의도 따로 찾을 수 있게

   왜 회의 분석과 따로 호출하는가:
   그라운딩을 구조화 JSON(responseSchema)과 함께 쓰면 출처(groundingChunks)가
   비어서 돌아오는 문제가 보고돼 있다. 그래서 분석은 JSON으로, 자료 찾기는
   그라운딩으로 분리한다.

   표시 의무:
   Google 정책상 그라운딩 응답을 쓰면 검색 제안(searchEntryPoint)과 출처를
   화면에 보여줘야 한다. renderResearch()가 둘 다 그린다. */

const researchBusy = new Set();   /* 동시에 여러 카드에서 눌러도 각각 따로 관리한다 */
const RESEARCH_CACHE = {};        /* 회의별 결과 — 타임라인이 다시 그려져도 살아남게 */

/** 회의를 캐시에서 찾을 열쇠. 저장 전 회의는 id가 없어 날짜로 대신한다. */
function researchKeyOf(m){ return (m && (m.id || m.date)) || ''; }

/** 이미 찾아둔 자료 — 메모리 캐시가 없으면 회의에 저장해둔 것을 쓴다. */
function cachedResearch(m){
  if(!m) return null;
  const key = researchKeyOf(m);
  return (key && RESEARCH_CACHE[key]) || m.research || null;
}

/** 찾은 자료를 회의 문서에 붙여 저장한다.
   AI 호출 한 번이 무료 한도를 꽤 먹는데 지금까지는 메모리에만 있어서
   새로고침하면 사라졌다. 저장해두면 다시 찾을 필요가 없다. */
async function saveResearch(meeting, res){
  if(!meeting || !meeting.id || !currentProject) return;
  meeting.research = res;
  try{
    await window.mfDb.updateMeeting(currentProject.id, meeting.id, { research: res });
  }catch(e){
    /* 저장 실패해도 화면에는 이미 결과가 떠 있다 — 새로고침하면 사라질 뿐이다 */
    console.error('[MeetFlow] 찾은 자료 저장 실패', e);
    toast('자료는 찾았지만 저장하지 못했어요. 새로고침하면 사라져요.','error');
  }
}

/** 텍스트를 HTML에 넣기 전에 이스케이프한다(utils.js의 esc는 URL 인코딩이라 용도가 다르다). */
function esc2(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** 회의 내용을 검색 질의로 바꾸기 좋게 정리한다. 너무 길면 모델이 초점을 잃어서 잘라 쓴다. */
function researchContextFrom(result){
  const topics = (result.topics||[]).map(t=>`- ${t.title}: ${(t.discussion||[]).slice(0,3).join(' / ')}`);
  const gaps   = (result.gaps||[]).map(g=>`- ${g}`);
  const tasks  = (result.items||[]).slice(0,8).map(i=>`- ${i.task}`);
  return [
    result.summary ? `[회의 요약]\n${result.summary}` : '',
    topics.length  ? `[안건]\n${topics.join('\n')}` : '',
    tasks.length   ? `[이번에 정해진 업무]\n${tasks.join('\n')}` : '',
    gaps.length    ? `[아직 결정 못 한 것]\n${gaps.join('\n')}` : ''
  ].filter(Boolean).join('\n\n').slice(0, 4000);
}

function researchPrompt(meeting){
  return `아래는 한 대학생 팀 프로젝트의 회의 분석 결과입니다.
이 팀이 다음 회의 전에 알아두면 좋을 **실제 웹 자료**를 검색해서 정리해주세요.

${researchContextFrom(meeting)}

정리 규칙:
- 아직 결정 못 한 것을 푸는 데 실제로 도움이 되는 자료를 우선 찾으세요.
- 3~5개 주제로 나누고, 각 주제마다 무엇을 찾았는지 2~4문장으로 설명하세요.
- 검색으로 확인한 사실만 쓰세요. 찾지 못했으면 "관련 자료를 찾지 못했다"고 적으세요.
- 일반론("잘 협업하세요") 말고 이 회의 내용에 붙는 구체적인 정보를 쓰세요.
- 마크다운 제목(#)은 쓰지 말고, 주제 이름은 줄 맨 앞에 "■ "를 붙여 적으세요.
- 한국어로 답하세요.`;
}

/* ──── 실행 ──── */

/** 회의 하나에 대해 그라운딩 검색을 돌려 targetId 영역에 결과를 그린다. */
async function runResearchFor(meeting, targetId){
  const wrap = document.getElementById(targetId);
  if(!wrap) return;
  if(!meeting){ toast('먼저 회의를 분석해주세요.','error'); return; }
  if(researchBusy.has(targetId)) return;
  if(typeof window.mfGroundedSearch!=='function'){ toast('AI 모듈을 불러오는 중이에요.','error'); return; }

  researchBusy.add(targetId);
  wrap.innerHTML = `
    <div class="panel">
      <div class="research-loading">
        <div class="research-spin"></div>
        <div>
          <div class="research-load-ttl">웹에서 자료를 찾는 중이에요…</div>
          <div class="research-load-sub">회의에서 나온 안건과 미결정 사항을 검색하고 있어요.</div>
        </div>
      </div>
    </div>`;

  try{
    const res = await window.mfGroundedSearch(researchPrompt(meeting));
    const key = researchKeyOf(meeting);
    if(key) RESEARCH_CACHE[key] = res;
    renderResearch(res, targetId, meeting);
    await saveResearch(meeting, res);
  }catch(e){
    console.error('[MeetFlow] 자료 찾기 실패', e);
    const info=aiErrorInfo(e);
    wrap.innerHTML = `
      <div class="panel">
        <div class="empty">
          <div class="e-ico">${info.wait?'⏳':'🔍'}</div>
          <h3>${esc2(info.title)}</h3>
          <p>${esc2(info.desc)}</p>
          ${info.retry?`<button class="btn-out" onclick="retryResearch('${esc2(targetId)}')">다시 시도</button>`:''}
          ${aiErrorDetailHtml(info)}
        </div>
      </div>`;
  }finally{
    researchBusy.delete(targetId);
  }
}

/* 어느 영역이 어느 회의를 보고 있는지 — 다시 시도 버튼이 참고한다 */
const RESEARCH_TARGETS = {};

/** 회의 분석 결과 아래 버튼 */
function runMeetingResearch(){
  RESEARCH_TARGETS['up-research'] = lastResult;
  return runResearchFor(lastResult, 'up-research');
}

/** 타임라인 카드의 버튼 — 그 카드의 회의로 찾는다 */
function runTimelineResearch(pfx){
  const entry = TL_MEETINGS[pfx];
  if(!entry) return;
  const targetId = 'tl-research-'+pfx;
  RESEARCH_TARGETS[targetId] = entry.meeting;
  return runResearchFor(entry.meeting, targetId);
}

function retryResearch(targetId){
  return runResearchFor(RESEARCH_TARGETS[targetId], targetId);
}

/* ──── 렌더 ──── */

/** 그라운딩 결과를 그린다. 출처와 검색 제안 표시는 Google 정책상 필수다. */
function renderResearch(res, targetId, meeting){
  const wrap = document.getElementById(targetId);
  if(!wrap) return;
  const body = (res.text||'').trim();

  if(!body){
    wrap.innerHTML = `
      <div class="panel"><div class="empty">
        <div class="e-ico">🔍</div><h3>찾은 자료가 없어요</h3>
        <p>회의 내용이 짧으면 검색할 거리가 부족할 수 있어요.</p>
      </div></div>`;
    return;
  }

  /* "■ 주제"로 시작하는 줄은 소제목으로, 나머지는 문단으로 그린다. */
  const paras = body.split('\n').map(l=>l.trim()).filter(Boolean).map(line=>
    line.startsWith('■')
      ? `<div class="research-h">${esc2(line.replace(/^■\s*/,''))}</div>`
      : `<p class="research-p">${esc2(line)}</p>`
  ).join('');

  const sources = res.chunks && res.chunks.length ? `
    <div class="research-src">
      <div class="research-src-ttl">출처</div>
      <ol class="research-src-list">
        ${res.chunks.map(c=>`
          <li><a href="${esc2(c.uri)}" target="_blank" rel="noopener noreferrer">${esc2(c.title)}</a></li>
        `).join('')}
      </ol>
    </div>` : '';

  /* searchEntryPoint는 Google이 내려주는 완성된 HTML/CSS라 그대로 넣어야 한다. */
  const suggestions = res.searchEntryPoint
    ? `<div class="research-sugg">${res.searchEntryPoint}</div>` : '';

  wrap.innerHTML = `
    <div class="panel">
      <div class="panel-hd">
        <div class="panel-ttl">🔍 추가 분석 자료</div>
        <span class="panel-lnk" onclick="retryResearch('${esc2(targetId)}')">다시 찾기 ↻</span>
      </div>
      <div class="research-body">${paras}</div>
      ${sources}
      ${suggestions}
      <div class="research-note">Google 검색으로 찾은 결과예요. 중요한 내용은 출처에서 직접 확인하세요.</div>
    </div>`;
}

/** 타임라인 회의 카드에 붙일 "자료 찾기" 버튼 + 결과 자리.
    타임라인은 renderAll()마다 새로 그려지므로, 이미 찾아둔 결과는 되살린다.
    새로고침한 뒤에도 회의에 저장해둔 자료가 있으면 AI 호출 없이 그대로 뜬다. */
function researchBlockHTML(meeting, pfx){
  const targetId = 'tl-research-'+pfx;
  const cached = cachedResearch(meeting);

  /* 캐시가 있으면 다음 프레임에 다시 그려 넣는다(지금은 아직 DOM에 없다) */
  if(cached){
    RESEARCH_TARGETS[targetId] = meeting;
    setTimeout(()=>renderResearch(cached, targetId, meeting), 0);
  }

  return `
    <div class="tl-research-cta">
      <button class="btn-out btn-sm-research" onclick="runTimelineResearch('${pfx}')">
        🔍 이 회의로 추가 자료 찾기
      </button>
      <span class="tl-research-hint">회의에서 못 정한 것들을 웹에서 찾아봐요</span>
    </div>
    <div id="${targetId}"></div>`;
}
