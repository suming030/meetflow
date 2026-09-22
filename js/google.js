/* MeetFlow — 구글 연동 (Calendar / Docs)
   담당: ⑤ 정리·내보내기

   Firebase 구글 로그인에 스코프를 추가하면 액세스 토큰을 받을 수 있고,
   그 토큰으로 브라우저에서 Google API를 직접 호출할 수 있다 (서버 불필요).
     provider.addScope('https://www.googleapis.com/auth/calendar.events');
     const token = GoogleAuthProvider.credentialFromResult(result).accessToken;
   주의: 액세스 토큰은 약 1시간 뒤 만료되고 자동 갱신되지 않는다.
        만료되면 재로그인을 유도해야 한다.

   구현 범위 (1차 과제)
   - Action Item 캘린더 등록: 기존엔 링크만 열어줬는데(utils.js의 openCal),
     여기서 openCal을 다시 선언해 실제 Calendar API 호출로 바꾼다.
     (이 파일이 index.html에서 utils.js보다 나중에 로드되므로 마지막 선언이 이긴다.)
   - 회의록 Google Docs 내보내기: 업로드 결과 패널(#result-wrap)에 버튼을
     JS로 동적 주입해서 넣는다. index.html은 건드리지 않는다.

   ⚠️ 이 파일은 내 담당(기능 D)만 수정한다. 다른 파일 로직은 여기서
      "덮어쓰기"로만 확장하고, index.html/dashboard.js/utils.js는 손대지 않는다. */

/* ════════════════════════════════════════
   1) 구글 액세스 토큰 관리
   ════════════════════════════════════════ */

/* Calendar 일정 등록 + Docs 문서 생성/편집에 필요한 최소 스코프 */
const GOOGLE_SCOPES = [
  'https://www.googleapis.com/auth/calendar.events',
  'https://www.googleapis.com/auth/documents',
];

const GOOGLE_TOKEN_KEY     = 'mf_google_access_token';
const GOOGLE_TOKEN_EXP_KEY = 'mf_google_access_token_exp';
/* 구글 액세스 토큰은 보통 1시간 뒤 만료된다고 안내돼 있어서, 안전하게 55분으로 캐시한다 */
const GOOGLE_TOKEN_TTL_MS = 55 * 60 * 1000;

/* index.html의 <script type="module">이 이미 같은 URL로 firebase-app/auth를
   로드해 두므로, 브라우저 모듈 캐시 덕분에 아래 동적 import는 네트워크 요청 없이
   바로 재사용된다. 클릭 시점에 지연 없이 쓰려고 스크립트 로드 시점에 미리 시작해둔다. */
const _mfFirebaseModules = Promise.all([
  import('https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js'),
  import('https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js'),
]);
/* 아직 아무 버튼도 안 눌렀는데 프리페치가 실패하면(네트워크 차단 등) 콘솔에 시끄러운
   "Uncaught (in promise)"가 뜨는 것만 막는다 — 실제 에러 처리는 getGoogleAccessToken에서 함 */
_mfFirebaseModules.catch(() => {});

function clearGoogleToken(){
  sessionStorage.removeItem(GOOGLE_TOKEN_KEY);
  sessionStorage.removeItem(GOOGLE_TOKEN_EXP_KEY);
}

/* 캐시된 토큰이 있으면 그대로, 없거나 만료됐으면 팝업으로 동의 받아 새로 발급.
   이미 로그인된 사용자면 reauthenticateWithPopup으로 "추가 동의"만 받는다
   (완전히 새로 로그인시키지 않음 — Firebase가 권장하는 증분 권한 부여 방식). */
async function getGoogleAccessToken(){
  const cached = sessionStorage.getItem(GOOGLE_TOKEN_KEY);
  const exp = Number(sessionStorage.getItem(GOOGLE_TOKEN_EXP_KEY) || 0);
  if(cached && Date.now() < exp) return cached;

  const [{ getApp }, { getAuth, GoogleAuthProvider, signInWithPopup, reauthenticateWithPopup }] =
    await _mfFirebaseModules;

  const auth = getAuth(getApp());
  const provider = new GoogleAuthProvider();
  GOOGLE_SCOPES.forEach(scope => provider.addScope(scope));
  /* 캘린더/문서 권한에 실제로 동의했는지 매번 확인 */
  provider.setCustomParameters({ prompt: 'consent' });

  let result;
  try{
    result = auth.currentUser
      ? await reauthenticateWithPopup(auth.currentUser, provider)
      : await signInWithPopup(auth, provider);
  }catch(e){
    if(e && e.code === 'auth/popup-closed-by-user'){
      throw new Error('권한 동의 창이 닫혔어요. 다시 시도해주세요.');
    }
    throw new Error('구글 인증에 실패했어요: ' + (e && e.message ? e.message : e));
  }

  const credential = GoogleAuthProvider.credentialFromResult(result);
  const token = credential && credential.accessToken;
  if(!token) throw new Error('구글 액세스 토큰을 받지 못했어요. 캘린더/문서 권한 동의가 필요해요.');

  sessionStorage.setItem(GOOGLE_TOKEN_KEY, token);
  sessionStorage.setItem(GOOGLE_TOKEN_EXP_KEY, String(Date.now() + GOOGLE_TOKEN_TTL_MS));
  return token;
}

/* Calendar/Docs 공통 REST 호출 헬퍼. 401(토큰 만료)이면 캐시를 지우고 한 번만
   재발급 받아 재시도한다. */
async function googleApiRequest(url, options = {}, _retry = true){
  const token = await getGoogleAccessToken();
  const res = await fetch(url, {
    ...options,
    headers: {
      'Authorization': 'Bearer ' + token,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  if(res.status === 401 && _retry){
    clearGoogleToken();
    return googleApiRequest(url, options, false);
  }
  if(!res.ok){
    let msg = `요청이 실패했어요 (${res.status})`;
    try{
      const body = await res.json();
      if(body && body.error && body.error.message) msg = body.error.message;
    }catch(_){ /* 응답이 JSON이 아니면 기본 메시지 사용 */ }
    throw new Error(msg);
  }
  return res.status === 204 ? null : res.json();
}

/* ════════════════════════════════════════
   2) Google Calendar — Action Item 실제 등록
   ════════════════════════════════════════
   utils.js의 openCal은 링크만 열어주는 버전이었다. 이 파일이 나중에 로드되므로
   같은 이름으로 다시 선언해 실제 등록 동작으로 덮어쓴다(모달 UI는 그대로 재사용). */
function openCal(te, dl, ae){
  const task = decodeURIComponent(te), assignee = decodeURIComponent(ae);

  const nameEl = document.getElementById('cal-task-name');
  if(nameEl) nameEl.textContent = (assignee ? assignee + ' – ' : '') + task;

  const linkEl = document.getElementById('cal-google');
  if(linkEl){
    linkEl.removeAttribute('href');
    linkEl.removeAttribute('target');
    linkEl.style.cursor = 'pointer';
    linkEl.innerHTML = '<span style="font-size:20px;">📅</span> Google 캘린더에 등록';
    linkEl.onclick = (e) => { e.preventDefault(); registerCalendarEvent(task, dl, assignee, linkEl); };
  }

  const overlay = document.getElementById('cal-overlay');
  if(overlay) overlay.classList.add('show');
}

async function registerCalendarEvent(task, deadline, assignee, linkEl){
  if(!currentUser){
    toast('먼저 구글 로그인을 해주세요.', 'error');
    closeCal(); openLogin();
    return;
  }

  const original = linkEl.innerHTML;
  linkEl.innerHTML = '<span style="font-size:20px;">⏳</span> 등록 중...';
  linkEl.style.pointerEvents = 'none';

  try{
    const event = buildCalendarEvent(task, deadline, assignee);
    const data = await googleApiRequest(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events',
      { method: 'POST', body: JSON.stringify(event) }
    );
    toast('📅 Google 캘린더에 일정이 등록됐어요!', 'success');
    closeCal();
    if(data && data.htmlLink) window.open(data.htmlLink, '_blank');
  }catch(e){
    console.error('[MeetFlow][google.js] 캘린더 등록 실패:', e);
    toast('캘린더 등록 실패: ' + e.message, 'error');
  }finally{
    linkEl.innerHTML = original;
    linkEl.style.pointerEvents = '';
  }
}

function buildCalendarEvent(task, deadline, assignee){
  const summary = (assignee ? assignee + ' – ' : '') + task;
  const description = [
    task,
    assignee ? `담당자: ${assignee}` : null,
    'MeetFlow에서 자동 등록된 일정입니다.',
  ].filter(Boolean).join('\n');

  if(deadline){
    /* 마감일 당일 오전 9시~10시 일정으로 등록 (KST 고정) */
    return {
      summary, description,
      start: { dateTime: `${deadline}T09:00:00+09:00` },
      end:   { dateTime: `${deadline}T10:00:00+09:00` },
    };
  }
  /* calBtn은 item.deadline이 있을 때만 노출되므로 실제로는 거의 안 타지만,
     방어적으로 내일 종일 일정으로 대체 */
  const d = new Date(); d.setDate(d.getDate() + 1);
  const ds = d.toISOString().slice(0, 10);
  return { summary, description, start: { date: ds }, end: { date: ds } };
}

/* ════════════════════════════════════════
   3) Google Docs — 회의록 내보내기
   ════════════════════════════════════════
   index.html을 건드리지 않고, 분석 결과 패널(#result-wrap)의 패널 헤더에
   버튼을 동적으로 주입한다. */
const PRIO_KR = { high: '높음', medium: '보통', low: '낮음' };

function injectExportButton(){
  if(document.getElementById('mf-export-docs-btn')) return; /* 중복 주입 방지 */
  const panelHd = document.querySelector('#result-wrap .panel-hd');
  if(!panelHd) return;

  const btn = document.createElement('button');
  btn.id = 'mf-export-docs-btn';
  btn.className = 'btn-ghost btn-pk-sm';
  btn.textContent = '📄 회의록 Docs로 내보내기';
  btn.onclick = exportMeetingToDocs;

  const dashBtn = panelHd.querySelector('button');
  if(dashBtn && dashBtn.parentNode === panelHd){
    /* panel-hd가 justify-content:space-between이라 버튼 두 개를 한 그룹으로 묶는다 */
    const group = document.createElement('div');
    group.style.display = 'flex';
    group.style.gap = '8px';
    group.style.alignItems = 'center';
    panelHd.insertBefore(group, dashBtn);
    group.appendChild(btn);
    group.appendChild(dashBtn);
  } else {
    panelHd.appendChild(btn);
  }
}

async function exportMeetingToDocs(target){
  if(!currentUser){ toast('먼저 구글 로그인을 해주세요.', 'error'); openLogin(); return; }

  /* meetings.js의 analyze()는 renderUpResult 직후 saveHistory를 호출해서
     history[0]에 방금 화면에 표시된 분석 결과를 넣어둔다 */
  /* 사이드바에서는 내보낼 회의를 넘겨준다. 분석 결과 패널의 버튼은 onclick 이벤트가
     첫 인자로 들어오므로, 회의 모양(items 배열)일 때만 그 회의를 쓴다. */
  const meeting = (target && Array.isArray(target.items))
    ? target
    : ((typeof history !== 'undefined') ? history[0] : null);
  if(!meeting){
    toast('내보낼 회의 분석 결과가 없어요. 먼저 회의를 분석해주세요.', 'error');
    return;
  }

  const btn = document.getElementById('mf-export-docs-btn');
  const original = btn ? btn.textContent : null;
  if(btn){ btn.disabled = true; btn.textContent = '⏳ 내보내는 중...'; }

  try{
    const no = meetingNo(meeting);
    const title = `MeetFlow ${no ? no + '차 ' : ''}회의록 – ${formatDateKR(meeting.date)}`;
    const doc = await googleApiRequest('https://docs.googleapis.com/v1/documents', {
      method: 'POST', body: JSON.stringify({ title }),
    });
    const documentId = doc.documentId;

    const requests = buildDocsRequests(meeting);
    await googleApiRequest(`https://docs.googleapis.com/v1/documents/${documentId}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests }),
    });

    toast('📄 회의록이 Google Docs로 내보내졌어요!', 'success');
    window.open(`https://docs.google.com/document/d/${documentId}/edit`, '_blank');
  }catch(e){
    console.error('[MeetFlow][google.js] Docs 내보내기 실패:', e);
    toast('회의록 내보내기 실패: ' + e.message, 'error');
  }finally{
    if(btn){ btn.disabled = false; btn.textContent = original; }
  }
}

/** 사이드바 "Docs로 회의록 내보내기" — N차 회의 화면을 보고 있으면 그 회의, 아니면 최근 회의 */
function exportFromSidebar(){
  const m = (currentTab === 'meeting' && typeof currentMeeting === 'function') ? currentMeeting() : history[0];
  return exportMeetingToDocs(m);
}

function formatDateKR(iso){
  try{ return new Date(iso).toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }); }
  catch(_){ return iso || ''; }
}

/* summary·안건별 논의·업무·이어진 업무·놓친 부분을 하나의 텍스트로 합치고,
   제목/소제목엔 헤딩 스타일, 목록엔 글머리 기호를 적용하는 Docs batchUpdate 요청을 만든다.
   js/timeline.js의 minutesDocHTML(회의록 보기 모달)과 같은 내용을 담아서,
   Docs로 내보냈을 때 앱 안에서 보는 것보다 내용이 빈약해지지 않게 한다. */
/* AI가 쓴 문장을 개조식(-임/-함/-됨/-음)으로 최대한 다듬는다.
   완벽한 한국어 문법 처리기는 아니고, 흔한 문장 종결형만 규칙 기반으로 바꾼다 —
   맞지 않는 드문 종결형은 그대로 둔다. */
function toGaejoshik(text){
  if(!text) return text;
  const s = text.trim().replace(/[.!]+$/, '');
  const rules = [
    [/했습니다$|했어요$|했다$/, '함'],
    [/하겠습니다$|하겠어요$|하겠다$/, '할 예정'],
    [/한다$|합니다$|해요$|하다$/, '함'],
    [/됐습니다$|됐어요$|됐다$|되었다$/, '됨'],
    [/된다$|됩니다$|돼요$/, '됨'],
    [/있습니다$|있어요$|있다$/, '있음'],
    [/없습니다$|없어요$|없다$/, '없음'],
    [/입니다$|이에요$|예요$|이다$/, '임'],
    [/다$/, '음'],
  ];
  for(const [re, rep] of rules){ if(re.test(s)) return s.replace(re, rep); }
  return s;
}

function buildDocsRequests(meeting){
  const items    = meeting.items || [];
  const topics   = meeting.topics || [];
  const carried  = meeting.carriedOver || [];
  const gaps     = meeting.gaps || [];
  const done     = carried.filter(c => c.resolved);
  const still    = carried.filter(c => !c.resolved);

  const lines = [];
  /* style: HEADING_1/2 또는 null(본문). bullet: 글머리 기호, bold: 굵게.
     HEADING_3는 쓰지 않는다 — Docs 개요(목차)에 안건마다 다 잡혀서 항목이 너무 많아지므로,
     소제목은 굵게만 표시해 개요에는 큰 섹션(HEADING_2) 5개만 남긴다. */
  const add = (text, style, bullet, bold) => lines.push({ text, style: style || null, bullet: !!bullet, bold: !!bold });

  const projectName = (currentProject && currentProject.name) || '프로젝트';
  const no = meetingNo(meeting);
  add(no ? `${projectName} ${no}차 회의록` : `${projectName} 회의록`, 'HEADING_1');
  add(`회의일: ${formatDateKR(meeting.date)}`, null);
  add('', null);

  add('핵심 안건 요약', 'HEADING_2');
  add(meeting.summary ? toGaejoshik(meeting.summary) : '(요약 없음)', null);
  add('', null);

  /* 안건별 논의 내용 — 요약만으로는 안 보이는 회의 본문 */
  add('안건별 논의 내용', 'HEADING_2');
  if(topics.length){
    topics.forEach((t, i) => {
      add(`${i + 1}. ${t.title}`, null, false, true);
      const discussion = t.discussion || [];
      if(discussion.length) discussion.forEach(d => add(toGaejoshik(d), null, true));
      else add('(기록된 논의 내용 없음)', null);
    });
  } else {
    add('안건별 논의 내용이 저장되기 전에 분석된 회의임', null);
  }
  add('', null);

  add(`새로 생긴 업무 (${items.length}개)`, 'HEADING_2');
  if(items.length){
    items.forEach(it => {
      const parts = [];
      if(it.assignee && it.assignee !== '미지정') parts.push(`[${it.assignee}]`);
      parts.push(it.task || '');
      if(it.deadline) parts.push(`(마감 ${it.deadline})`);
      if(it.priority) parts.push(`· 우선순위 ${PRIO_KR[it.priority] || it.priority}`);
      add(parts.join(' '), null, true);
    });
  } else {
    add('(추출된 Action Item 없음)', null);
  }

  /* 지난 회의에서 이어진 업무 — 마무리된 것과 아직 진행 중인 것을 나눠 보여준다 */
  if(carried.length){
    add('', null);
    add('진행중인 업무', 'HEADING_2');
    if(done.length){
      add('이번 회의에서 마무리됨', null, false, true);
      done.forEach(c => add(c.task + (c.note ? ` — ${toGaejoshik(c.note)}` : ''), null, true));
    }
    if(still.length){
      add('아직 진행 중', null, false, true);
      still.forEach(c => add(
        c.task + (c.note ? ` — ${toGaejoshik(c.note)}` : '') + (c.newDeadline ? ` (새 마감일 ${c.newDeadline})` : ''),
        null, true));
    }
  }

  /* AI가 짚은 놓친 부분 */
  if(gaps.length){
    add('', null);
    add('AI가 짚은 놓친 부분', 'HEADING_2');
    gaps.forEach(g => add(toGaejoshik(g), null, true));
  }

  /* 각 줄의 문서 내 시작/끝 인덱스를 누적 계산하면서 한 번에 삽입할 문자열을 만든다.
     Docs 문서 본문은 index 1부터 시작한다. */
  let cursor = 1, fullText = '';
  const ranges = lines.map(l => {
    const start = cursor;
    const seg = l.text + '\n';
    cursor += seg.length;
    fullText += seg;
    return { start, end: start + l.text.length, style: l.style, bullet: l.bullet, bold: l.bold };
  });

  const requests = [{ insertText: { location: { index: 1 }, text: fullText } }];

  ranges.forEach(r => {
    if(r.style){
      requests.push({
        updateParagraphStyle: {
          range: { startIndex: r.start, endIndex: r.end },
          paragraphStyle: { namedStyleType: r.style },
          fields: 'namedStyleType',
        },
      });
    }
    if(r.bold && r.end > r.start){
      requests.push({
        updateTextStyle: {
          range: { startIndex: r.start, endIndex: r.end },
          textStyle: { bold: true },
          fields: 'bold',
        },
      });
    }
  });

  /* 글머리 기호는 연속된 구간별로 한 번씩만 요청한다(안건마다·업무 목록마다 따로 끊기도록) */
  let runStart = -1;
  for(let i = 0; i <= ranges.length; i++){
    const bulleted = i < ranges.length && ranges[i].bullet;
    if(bulleted && runStart === -1) runStart = i;
    if(!bulleted && runStart !== -1){
      requests.push({
        createParagraphBullets: {
          range: { startIndex: ranges[runStart].start, endIndex: ranges[i - 1].end },
          bulletPreset: 'BULLET_DISC_CIRCLE_SQUARE',
        },
      });
      runStart = -1;
    }
  }

  return requests;
}

/* ════════════════════════════════════════
   4) 다음 회의 일정 잡기 — Calendar + Google Meet 링크
   ════════════════════════════════════════
   Google Meet REST API는 전사·녹화 조회가 Workspace 유료 플랜 전용이라
   무료 계정으로는 쓸 수 없다. 대신 Calendar API의 conferenceData로
   Meet 링크가 딸린 일정을 만드는 건 개인 계정에서도 된다.
   이미 받아둔 calendar.events 스코프로 되므로 추가 동의도 필요 없다.

   주의: conferenceDataVersion=1을 붙이지 않으면 conferenceData가 조용히 무시된다. */

/** 온보딩이 만들어둔 1차 회의 아젠다 (없으면 빈 배열) */
function meetAgenda(){
  const r = currentProject && currentProject.onboarding && currentProject.onboarding.result;
  return (r && r.firstMeetingAgenda) || [];
}

/* toISOString()은 UTC로 바꿔버려서 한국 시간 기준 날짜가 하루 밀릴 수 있다 */
function toLocalISODate(d){
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** 기본 날짜 — 동아리는 다음 정기모임 요일로, 그 외엔 내일로 채워둔다 */
function defaultMeetingDate(){
  const d = new Date();
  d.setDate(d.getDate() + 1);

  const r = currentProject && currentProject.onboarding && currentProject.onboarding.result;
  const dow = r && r.recurringMeeting ? Number(r.recurringMeeting.dayOfWeek) : NaN;
  if(currentProject && currentProject.track === 'club' && Number.isInteger(dow)){
    while(d.getDay() !== dow) d.setDate(d.getDate() + 1);
  }
  return toLocalISODate(d);
}

/** 일정 모달을 만든다(최초 1회). index.html은 건드리지 않고 JS로 붙인다. */
function ensureMeetOverlay(){
  let el = document.getElementById('meet-overlay');
  if(el) return el;
  el = document.createElement('div');
  el.id = 'meet-overlay';
  el.className = 'overlay';
  el.onclick = e => { if(e.target.id === 'meet-overlay') closeMeetScheduler(); };
  el.innerHTML = `<div class="cal-box" id="meet-box"></div>`;
  document.body.appendChild(el);
  return el;
}
function closeMeetScheduler(){
  const el = document.getElementById('meet-overlay');
  if(el) el.classList.remove('show');
}
document.addEventListener('keydown', e => { if(e.key === 'Escape') closeMeetScheduler(); });

/** 입력 화면 — 대시보드 마일스톤 탭의 아젠다 패널에서 연다. */
function openMeetScheduler(){
  if(!currentUser){ toast('먼저 구글 로그인을 해주세요.', 'error'); openLogin(); return; }
  if(!currentProject){ toast('프로젝트를 먼저 선택해주세요.', 'error'); return; }

  const el = ensureMeetOverlay();
  const agenda = meetAgenda();
  const round = (typeof history !== 'undefined' ? history.length : 0) + 1;

  document.getElementById('meet-box').innerHTML = `
    <div class="m-ttl">🗓️ 다음 회의 일정 잡기</div>
    <p class="meet-sub">구글 캘린더에 일정을 만들고 <b>Google Meet 링크</b>를 같이 발급해요.</p>

    <div class="m-lbl">회의 제목</div>
    <input type="text" id="meet-title" class="m-inp meet-inp"
           value="${esc2((currentProject.name || '프로젝트') + ' ' + round + '차 회의')}">

    <div class="meet-row">
      <div>
        <div class="m-lbl">날짜</div>
        <input type="date" id="meet-date" class="m-inp meet-inp" value="${defaultMeetingDate()}">
      </div>
      <div>
        <div class="m-lbl">시작</div>
        <input type="time" id="meet-time" class="m-inp meet-inp" value="19:00">
      </div>
      <div>
        <div class="m-lbl">길이</div>
        <select id="meet-dur" class="m-inp meet-inp">
          <option value="30">30분</option>
          <option value="60" selected>1시간</option>
          <option value="90">1시간 30분</option>
          <option value="120">2시간</option>
        </select>
      </div>
    </div>

    <div class="m-lbl">팀원 이메일 <span class="meet-opt">비워두면 나만 등록돼요</span></div>
    <input type="text" id="meet-guests" class="m-inp meet-inp"
           placeholder="쉼표로 구분 — hong@gmail.com, kim@gmail.com">

    ${agenda.length ? `
      <div class="meet-agenda">
        <div class="meet-agenda-hd">📋 온보딩 아젠다 ${agenda.length}개를 일정 설명에 넣어드려요</div>
        <ul>${agenda.map(a => `<li>${esc2(a)}</li>`).join('')}</ul>
      </div>` : ''}

    <button class="btn-pk" style="width:100%;" onclick="createMeetEvent()">
      📅 일정 만들고 Meet 링크 받기
    </button>
    <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="closeMeetScheduler()">닫기</button>`;

  el.classList.add('show');
}

/** 쉼표·공백으로 나눈 뒤 형식이 아닌 건 걸러내 사용자에게 알려준다 */
function parseGuestEmails(raw){
  const ok = [], bad = [];
  (raw || '').split(/[,\s]+/).map(s => s.trim()).filter(Boolean)
    .forEach(p => (/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(p) ? ok : bad).push(p));
  return { ok, bad };
}

async function createMeetEvent(){
  const title  = (document.getElementById('meet-title').value || '').trim();
  const date   = document.getElementById('meet-date').value;
  const time   = document.getElementById('meet-time').value;
  const durMin = Number(document.getElementById('meet-dur').value) || 60;
  const guests = parseGuestEmails(document.getElementById('meet-guests').value);

  if(!title){ toast('회의 제목을 입력해주세요.', 'error'); return; }
  if(!date || !time){ toast('날짜와 시작 시간을 골라주세요.', 'error'); return; }
  if(guests.bad.length){
    toast('이메일 형식이 아니에요: ' + guests.bad.join(', '), 'error');
    return;
  }

  document.getElementById('meet-box').innerHTML = `
    <div style="text-align:center;padding:40px 0;">
      <div class="research-spin" style="margin:0 auto 18px;"></div>
      <div style="font-size:14px;font-weight:700;">일정을 만들고 있어요…</div>
      <div style="font-size:12.5px;color:var(--muted);margin-top:6px;">
        Meet 링크가 발급될 때까지 잠깐 기다려요.
      </div>
    </div>`;

  try{
    /* 참석자가 있을 때만 초대 메일이 나가게 한다 */
    const created = await googleApiRequest(
      'https://www.googleapis.com/calendar/v3/calendars/primary/events'
        + '?conferenceDataVersion=1&sendUpdates=' + (guests.ok.length ? 'all' : 'none'),
      { method: 'POST', body: JSON.stringify(buildMeetEvent(title, date, time, durMin, guests.ok)) }
    );
    renderMeetResult(await waitForMeetLink(created), guests.ok.length);
  }catch(e){
    console.error('[MeetFlow][google.js] 회의 일정 생성 실패:', e);
    document.getElementById('meet-box').innerHTML = `
      <div class="m-ttl">일정을 만들지 못했어요</div>
      <p class="meet-sub">${esc2(e.message || String(e))}</p>
      <button class="btn-pk" style="width:100%;" onclick="openMeetScheduler()">다시 시도</button>
      <button class="btn-ghost" style="width:100%;margin-top:8px;" onclick="closeMeetScheduler()">닫기</button>`;
  }
}

function buildMeetEvent(title, date, time, durMin, guests){
  /* 입력값은 한국 시간이다. 오프셋을 명시해야 브라우저 시간대에 끌려가지 않는다. */
  const start = new Date(`${date}T${time}:00+09:00`);
  const end   = new Date(start.getTime() + durMin * 60000);

  const agenda = meetAgenda();
  const description = [
    ...(agenda.length ? ['📋 아젠다', ...agenda.map((a, i) => `${i + 1}. ${a}`), ''] : []),
    'MeetFlow에서 만든 회의 일정이에요.',
  ].join('\n');

  return {
    summary: title,
    description,
    start: { dateTime: start.toISOString(), timeZone: 'Asia/Seoul' },
    end:   { dateTime: end.toISOString(),   timeZone: 'Asia/Seoul' },
    attendees: guests.map(email => ({ email })),
    conferenceData: {
      createRequest: {
        /* 같은 requestId로 다시 부르면 같은 회의가 재사용되므로 매번 새로 만든다 */
        requestId: 'mf-' + Date.now() + '-' + Math.random().toString(36).slice(2, 8),
        conferenceSolutionKey: { type: 'hangoutsMeet' },
      },
    },
  };
}

function meetLinkOf(ev){
  const eps = (ev && ev.conferenceData && ev.conferenceData.entryPoints) || [];
  const video = eps.find(p => p.entryPointType === 'video');
  return (video && video.uri) || (ev && ev.hangoutLink) || null;
}

/** Meet 링크 발급은 비동기라 응답이 pending으로 올 수 있다. 붙을 때까지 몇 번 다시 읽는다. */
async function waitForMeetLink(ev, tries = 4){
  if(meetLinkOf(ev) || tries <= 0) return ev;
  await new Promise(r => setTimeout(r, 900));
  const fresh = await googleApiRequest(
    'https://www.googleapis.com/calendar/v3/calendars/primary/events/'
      + encodeURIComponent(ev.id) + '?conferenceDataVersion=1'
  );
  return waitForMeetLink(fresh, tries - 1);
}

function meetWhenLabel(ev){
  const s = ev.start && (ev.start.dateTime || ev.start.date);
  if(!s) return '';
  try{
    return new Date(s).toLocaleString('ko-KR',
      { month:'long', day:'numeric', weekday:'short', hour:'2-digit', minute:'2-digit' });
  }catch(_){ return s; }
}

function renderMeetResult(ev, guestCount){
  const link = meetLinkOf(ev);

  document.getElementById('meet-box').innerHTML = `
    <div style="text-align:center;">
      <div style="font-size:40px;margin-bottom:10px;">🗓️</div>
      <div class="m-ttl" style="margin-bottom:6px;">일정을 만들었어요</div>
      <p class="meet-sub">
        ${esc2(ev.summary || '')}<br>${esc2(meetWhenLabel(ev))}
        ${guestCount ? `<br>팀원 ${guestCount}명에게 초대를 보냈어요` : ''}
      </p>
    </div>

    ${link ? `
      <div class="m-lbl">Google Meet 링크</div>
      <div class="meet-link">${esc2(link)}</div>
      <textarea id="meet-link-src" style="position:absolute;left:-9999px;">${esc2(link)}</textarea>
      <button class="btn-ghost" style="width:100%;margin-bottom:8px;"
              onclick="copyText(this,'meet-link-src')">📋 링크 복사하기</button>`
    : `
      <div class="wrap-warn" style="margin-bottom:12px;">
        일정은 만들어졌는데 Meet 링크 발급이 아직 끝나지 않았어요.
        잠시 뒤 구글 캘린더에서 확인해주세요.
      </div>`}

    ${ev.htmlLink ? `
      <a class="cal-link" href="${esc2(ev.htmlLink)}" target="_blank" rel="noopener">
        <span style="font-size:20px;">📅</span> 구글 캘린더에서 열기
      </a>` : ''}
    <button class="btn-ghost" style="width:100%;margin-top:6px;" onclick="closeMeetScheduler()">닫기</button>`;
}

/* ════════════════════════════════════════
   5) 초기화
   ════════════════════════════════════════
   이 스크립트는 index.html에서 #result-wrap 마크업보다 뒤에 로드되므로
   바로 호출해도 되지만, 혹시 모를 순서 변경에 대비해 DOMContentLoaded에도
   한 번 더 걸어둔다(injectExportButton은 중복 실행에 안전하다). */
injectExportButton();
document.addEventListener('DOMContentLoaded', injectExportButton);
