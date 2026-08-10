/* MeetFlow — 추가 분석 자료 찾기 (Google 검색 그라운딩)

   회의 분석이 끝나면 "그래서 뭘 더 알아봐야 하지?"가 남는다. 회의에서 나온 안건과
   AI가 짚은 빈틈을 검색어로 바꿔 실제 웹 자료를 찾아온다.

   왜 회의 분석과 따로 호출하는가:
   그라운딩을 구조화 JSON(responseSchema)과 함께 쓰면 출처(groundingChunks)가
   비어서 돌아오는 문제가 보고돼 있다. 그래서 분석은 JSON으로, 자료 찾기는
   그라운딩으로 분리한다.

   표시 의무:
   Google 정책상 그라운딩 응답을 쓰면 검색 제안(searchEntryPoint)과 출처를
   화면에 보여줘야 한다. renderResearch()가 둘 다 그린다. */

let researchBusy = false;

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

/** "추가 분석 자료 찾기" 버튼 — 그라운딩 검색을 돌려 결과를 아래에 붙인다. */
async function runMeetingResearch(){
  if(researchBusy) return;
  if(!lastResult){ toast('먼저 회의를 분석해주세요.','error'); return; }
  if(typeof window.mfGroundedSearch!=='function'){ toast('AI 모듈을 불러오는 중이에요.','error'); return; }

  researchBusy = true;
  const wrap = document.getElementById('up-research');
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
  wrap.scrollIntoView({behavior:'smooth', block:'nearest'});

  const prompt = `아래는 한 대학생 팀 프로젝트의 회의 분석 결과입니다.
이 팀이 다음 회의 전에 알아두면 좋을 **실제 웹 자료**를 검색해서 정리해주세요.

${researchContextFrom(lastResult)}

정리 규칙:
- 아직 결정 못 한 것을 푸는 데 실제로 도움이 되는 자료를 우선 찾으세요.
- 3~5개 주제로 나누고, 각 주제마다 무엇을 찾았는지 2~4문장으로 설명하세요.
- 검색으로 확인한 사실만 쓰세요. 찾지 못했으면 "관련 자료를 찾지 못했다"고 적으세요.
- 일반론("잘 협업하세요") 말고 이 회의 내용에 붙는 구체적인 정보를 쓰세요.
- 마크다운 제목(#)은 쓰지 말고, 주제 이름은 줄 맨 앞에 "■ "를 붙여 적으세요.
- 한국어로 답하세요.`;

  try{
    const res = await window.mfGroundedSearch(prompt);
    renderResearch(res);
  }catch(e){
    console.error('[MeetFlow] 자료 찾기 실패', e);
    wrap.innerHTML = `
      <div class="panel">
        <div class="empty">
          <div class="e-ico">🔍</div>
          <h3>자료를 찾지 못했어요</h3>
          <p>${(e && e.message) ? esc2(e.message) : '알 수 없는 오류예요.'}</p>
          <button class="btn-out" onclick="runMeetingResearch()">다시 시도</button>
        </div>
      </div>`;
  }finally{
    researchBusy = false;
  }
}

/** 텍스트를 HTML에 넣기 전에 이스케이프한다(utils.js의 esc는 URL 인코딩이라 용도가 다르다). */
function esc2(s){
  return String(s==null?'':s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/** 그라운딩 결과를 그린다. 출처와 검색 제안 표시는 Google 정책상 필수다. */
function renderResearch(res){
  const wrap = document.getElementById('up-research');
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

  const sources = res.chunks.length ? `
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
        <span class="panel-lnk" onclick="runMeetingResearch()">다시 찾기 ↻</span>
      </div>
      <div class="research-body">${paras}</div>
      ${sources}
      ${suggestions}
      <div class="research-note">Google 검색으로 찾은 결과예요. 중요한 내용은 출처에서 직접 확인하세요.</div>
    </div>`;
}
