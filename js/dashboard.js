/* MeetFlow — 대시보드 렌더링 (개요/Action Items/담당자별/Task Flow/브리핑)
   담당: ③ 디자인 B (세부 디테일). 마일스톤 화면은 js/milestones.js(④)로 옮겼다. */

/* ──── 통계 ──── */
function calcStats(items){
  return {
    total:  items.length,
    persons:new Set(items.filter(i=>i.assignee&&i.assignee!=='미지정').map(i=>i.assignee)).size,
    dlCt:   items.filter(i=>i.deadline).length,
    done:   items.filter(i=>i.status==='done').length,
    rate:   items.length?Math.round(items.filter(i=>i.status==='done').length/items.length*100):0,
  };
}

/* ──── HTML 빌더들 ──── */
function metricsHTML(s,pfx){
  return `
    <div class="m-card"><div class="m-lbl">Action Items</div><div class="m-val" style="color:var(--pk)" id="mv-total-${pfx}">${s.total}</div><div class="m-sub">이번 회의 총 업무</div></div>
    <div class="m-card"><div class="m-lbl">담당자</div><div class="m-val" style="color:var(--teal)">${s.persons}명</div><div class="m-sub">업무 배정 인원</div></div>
    <div class="m-card"><div class="m-lbl">마감일 명시</div><div class="m-val" style="color:var(--amber)">${s.dlCt}개</div><div class="m-sub">기한이 있는 업무</div></div>
    <div class="m-card"><div class="m-lbl">완료율</div><div class="m-val" style="color:var(--violet)" id="mv-rate-${pfx}">${s.rate}%</div><div class="prog-wrap"><div class="prog-fill" id="pf-${pfx}" style="width:${s.rate}%"></div></div></div>`;
}

function renderWarn(items,bid,tid){
  const today=new Date(); today.setHours(0,0,0,0);
  const urg=items.filter(i=>{
    if(!i.deadline) return false;
    const diff=Math.ceil((new Date(i.deadline)-today)/86400000);
    return diff>=0&&diff<=3;
  });
  const b=document.getElementById(bid);
  if(!b) return;
  if(urg.length){
    b.style.display='flex';
    document.getElementById(tid).textContent=`⚠️ ${urg.length}개 업무의 마감이 3일 이내예요: ${urg.map(i=>i.task).join(' · ')}`;
  } else b.style.display='none';
}

function asSummaryHTML(items){
  const g=groupBy(items);
  return Object.entries(g).map(([name,tasks])=>`
    <div style="margin-bottom:14px;">
      <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
        <div class="av ${avCls(name)}" style="width:28px;height:28px;font-size:11px;">${name[0]}</div>
        <div style="font-size:13px;font-weight:700;">${name}</div>
        <div style="font-size:11px;color:var(--muted);">업무 ${tasks.length}개</div>
      </div>
      ${tasks.map(t=>`
        <div style="display:flex;align-items:center;gap:8px;padding:7px 0;border-bottom:1px solid var(--bd);flex-wrap:wrap;">
          <div style="flex:1;min-width:100px;font-size:12px;">${t.task}</div>
          ${t.deadline?`<span class="bdg b-dl" style="font-size:10px;flex-shrink:0;">📅 ${t.deadline}</span>`:''}
        </div>`).join('')}
    </div>`).join('');
}

function prioChartHTML(items){
  const h=items.filter(i=>i.priority==='high').length;
  const m=items.filter(i=>i.priority==='medium').length;
  const l=items.filter(i=>i.priority==='low').length;
  const total=items.length||1;
  return `
    <div style="display:flex;flex-direction:column;gap:12px;">
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
          <span style="color:var(--red);font-weight:700;">🔴 높음</span><span>${h}개</span>
        </div>
        <div class="prog-wrap" style="background:var(--red-lt);"><div style="height:100%;width:${h/total*100}%;background:var(--red);border-radius:99px;transition:width .8s;"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
          <span style="color:var(--amber);font-weight:700;">🟡 보통</span><span>${m}개</span>
        </div>
        <div class="prog-wrap" style="background:var(--amber-lt);"><div style="height:100%;width:${m/total*100}%;background:var(--amber);border-radius:99px;transition:width .8s;"></div></div>
      </div>
      <div>
        <div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px;">
          <span style="color:var(--green);font-weight:700;">🟢 낮음</span><span>${l}개</span>
        </div>
        <div class="prog-wrap" style="background:var(--green-lt);"><div style="height:100%;width:${l/total*100}%;background:var(--green);border-radius:99px;transition:width .8s;"></div></div>
      </div>
    </div>`;
}

function acHTML(item,idx,pfx){
  /* 같은 업무가 여러 화면(개요·Action Items·브리핑)에 그려지므로 DOM id는 화면별로 구분하고,
     저장할 때 어느 업무인지 찾기 위해 item.id를 따로 실어 보낸다. */
  const pid=pfx+'-'+idx, st=item.status||'todo';
  const iid=item.id||'';
  const prio=item.priority||'medium';
  const calBtn=item.deadline
    ?`<button class="ico-btn" title="캘린더에 추가" onclick="openCal('${esc(item.task)}','${item.deadline}','${esc(item.assignee||'')}')">📅</button>`:'';
  /* 여러 회의의 업무가 섞이는 화면(개요·Action Items·브리핑·마일스톤)에서는 몇 차 회의에서
     나온 업무인지 붙인다. 회의 하나만 보는 화면(분석 결과·타임라인·N차 회의)에선 뻔해서 뺀다. */
  const single=pfx==='up'||pfx==='md'||/^tl\d/.test(pfx);
  const from=single?null:((iid&&findItemById(iid))||{}).meeting;
  const roundNo=from?meetingNo(from):null;
  const roundBdg=roundNo
    ?`<span class="bdg b-round"${from.id?` title="${roundNo}차 회의 보기" onclick="openMeeting('${from.id}')"`:''}>🕒 ${roundNo}차 회의</span>`:'';
  return `
    <div class="ac" id="ac-${pid}">
      <div class="prio-bar prio-${prio[0]}"></div>
      <div class="ac-chk${st==='done'?' ck':''}" id="ck-${pid}" onclick="toggleCk('${pid}','${iid}')">${st==='done'?'✓':''}</div>
      <div class="ac-body">
        <div class="ac-task${st==='done'?' done':''}${iid?' ac-ed-task':''}" id="t-${pid}"${iid?` title="클릭해서 업무 내용 수정" onclick="editItemTask(event,'${iid}')"`:''}>${item.task}</div>
        <div class="ac-meta">
          ${roundBdg}
          ${/* 담당자·마감일은 배지를 눌러 그 자리에서 고친다(js/meetings.js).
                AI가 잘못 배정하거나 미지정으로 남긴 걸 사람이 채울 수 있어야 해서,
                비어 있을 때도 배지를 감추지 않고 "지정" 자리표시자로 띄운다.
                id가 없는 업무(저장 전)는 찾을 수 없으므로 편집을 걸지 않는다. */''}
          ${iid?`
            ${item.assignee&&item.assignee!=='미지정'
              ?`<span class="bdg b-person ac-ed" title="클릭해서 담당자 변경" onclick="editItemAssignee(event,'${iid}')">👤 ${item.assignee}</span>`
              :`<span class="bdg b-nodl ac-ed" title="클릭해서 담당자 지정" onclick="editItemAssignee(event,'${iid}')">👤 담당자 지정</span>`}
            ${item.deadline
              ?`<span class="bdg b-dl ac-ed" title="클릭해서 마감일 변경" onclick="editItemDeadline(event,'${iid}')">📅 ${item.deadline}</span>`
              :`<span class="bdg b-nodl ac-ed" title="클릭해서 마감일 지정" onclick="editItemDeadline(event,'${iid}')">📅 마감일 지정</span>`}`
          :`
            ${item.assignee&&item.assignee!=='미지정'?`<span class="bdg b-person">👤 ${item.assignee}</span>`:''}
            ${item.deadline?`<span class="bdg b-dl">📅 ${item.deadline}</span>`:`<span class="bdg b-nodl">마감일 미정</span>`}`}
          <span class="st-bdg ${ST.cls[st]}" id="st-${pid}" data-st="${st}" onclick="cycleSt('${pid}','${iid}')">${ST.ico[st]} ${ST.lbl[st]}</span>
        </div>
      </div>
      <div class="ac-right">${calBtn}</div>
    </div>`;
}

/* ──── 체크·상태 ────
   상태는 회의 문서 안의 items 배열에 들어 있다. 화면만 바꾸면 새로고침할 때
   전부 '미시작'으로 돌아가므로, 바뀔 때마다 해당 회의 문서를 갱신한다. */
function toggleCk(pid,iid){
  const ck=document.getElementById('ck-'+pid), t=document.getElementById('t-'+pid);
  const done=ck.classList.toggle('ck');
  ck.textContent=done?'✓':''; t.classList.toggle('done',done);
  setSt(pid, done?'done':'todo', iid);
}
function cycleSt(pid,iid){
  const el=document.getElementById('st-'+pid), cur=el.dataset.st||'todo';
  setSt(pid, ST.cycle[(ST.cycle.indexOf(cur)+1)%3], iid);
}
function setSt(pid,st,iid){
  const el=document.getElementById('st-'+pid);
  if(el){
    el.dataset.st=st; el.className=`st-bdg ${ST.cls[st]}`; el.textContent=`${ST.ico[st]} ${ST.lbl[st]}`;
  }
  if(iid) persistItemStatus(iid, st);
}

/** 업무 상태를 history와 Firestore 양쪽에 반영한다. */
function persistItemStatus(itemId, st){
  const meeting=history.find(m=>(m.items||[]).some(it=>it.id===itemId));
  if(!meeting){ return; }
  const item=meeting.items.find(it=>it.id===itemId);
  if(!item || item.status===st) return;
  item.status=st;

  /* 같은 업무가 다른 화면에도 그려져 있으면 함께 갱신 */
  document.querySelectorAll(`[onclick*="'${itemId}'"]`).forEach(el=>{
    if(el.classList.contains('st-bdg')){
      el.dataset.st=st; el.className=`st-bdg ${ST.cls[st]}`; el.textContent=`${ST.ico[st]} ${ST.lbl[st]}`;
    }
  });

  /* 아직 저장 전인 회의는 저장될 때 함께 기록되므로 여기서는 건너뛴다 */
  if(!meeting.id || !currentProject) return;
  window.mfDb.updateMeeting(currentProject.id, meeting.id, {items:meeting.items})
    .catch(e=>{
      console.error('[MeetFlow] 상태 저장 실패', e);
      toast('상태를 저장하지 못했어요.','error');
    });
}

/* 사이드바 업무·브리핑 그룹 접기/펼치기 */
const SB_GROUP_OF={members:'work',taskflow:'work',timeline:'meet',briefing:'meet',meeting:'meet'};
function toggleSbGroup(key){
  const sub=document.getElementById('sb-sub-'+key), chev=document.getElementById('sb-chev-'+key);
  if(!sub) return;
  const open=sub.classList.toggle('open');
  if(chev) chev.textContent=open?'▾':'▸';
}
function openSbGroup(key){
  const sub=document.getElementById('sb-sub-'+key);
  if(sub && !sub.classList.contains('open')) toggleSbGroup(key);
}
/* sdt()는 js/router.js(공용) 소유라 그 파일은 건드리지 않고, 여기서 감싸서
   하위 탭이 활성화될 때(사이드바 클릭이든 URL 직접 진입·뒤로가기든) 소속 그룹을 자동으로 편다. */
const _sdt=sdt;
sdt=function(id,opts){
  _sdt(id,opts);
  document.querySelectorAll('.sb-parent').forEach(p=>p.classList.remove('sb-parent-on'));
  const key=SB_GROUP_OF[id];
  if(!key) return;
  openSbGroup(key);
  const parent=document.getElementById('sb-sub-'+key).closest('.sb-group').querySelector('.sb-parent');
  if(parent) parent.classList.add('sb-parent-on');
};

/* 상단 nav의 프로젝트 배지("캡스톤" 등) — 클릭하면 최근 회의 미리보기 +
   새 회의 분석·전체 타임라인 진입 버튼을 보여준다. */
function toggleProjectMenu(){
  const menu=document.getElementById('nav-project-menu');
  if(!menu) return;
  if(menu.classList.contains('show')){ menu.classList.remove('show'); return; }
  renderProjectMenu();
  menu.classList.add('show');
}
function closeProjectMenu(){
  document.getElementById('nav-project-menu')?.classList.remove('show');
}
function renderProjectMenu(){
  const menu=document.getElementById('nav-project-menu');
  if(!menu) return;
  const total=history.length;
  const recent=history.slice(0,3);
  menu.innerHTML=`
    <div class="npm-title">최근 회의</div>
    ${recent.length?recent.map((m,i)=>`
      <div class="npm-meeting">
        <span class="npm-no">${total-i}차 회의</span>
        <span class="npm-date">${(m.date||'').slice(0,10)}</span>
      </div>`).join(''):`<div class="npm-empty">아직 분석된 회의가 없어요.</div>`}
    <div class="npm-actions">
      <div class="npm-btn npm-btn-primary" onclick="closeProjectMenu();gp('upload');">✨ 새 회의 분석하기</div>
      <div class="npm-btn npm-btn-ghost" onclick="closeProjectMenu();gp('dash',{tab:'timeline'});">🕒 전체 타임라인 보기 →</div>
    </div>`;
}
document.addEventListener('click', e=>{
  const wrap=document.getElementById('nav-project-wrap');
  if(wrap && !wrap.contains(e.target)) closeProjectMenu();
});

function renderAll(){
  renderOverview();
  renderAllActions();
  renderMembers();
  /* 회의 타임라인은 js/timeline.js에 있다 (담당: 디자인 B).
     아직 안 만들어졌을 수 있으므로 있을 때만 부른다. */
  if(typeof renderTimeline==='function') renderTimeline();
  /* N차 회의 화면·사이드바 회의 목록. 타임라인 뒤에 그려야 한다 —
     renderTimeline()이 TL_MEETINGS를 비우는데, N차 회의 화면도 거기에 'md'를 넣어 쓴다. */
  renderMeetingDetail();
  renderSbMeetings();
  renderMilestones();
  renderTaskFlow();
  renderBriefing();
}

/* 대시보드 개요 */
function renderOverview(){
  if(!history.length){
    document.getElementById('ov-empty').style.display='block';
    document.getElementById('ov-content').style.display='none';
    document.getElementById('sb-cnt-total').style.display='none';
    return;
  }
  document.getElementById('ov-empty').style.display='none';
  document.getElementById('ov-content').style.display='block';
  const all=history.flatMap(e=>e.items);
  const stats=calcStats(all);
  document.getElementById('sb-cnt-total').style.display='';
  document.getElementById('sb-cnt-total').textContent=all.filter(i=>i.status!=='done').length;  /* 개요 메뉴 옆 — 남은 업무 수 */
  document.getElementById('ov-metrics').innerHTML=metricsHTML(stats,'ov');
  renderWarn(all,'ov-warn','ov-warn-txt');
  /* 개요는 "지금" 중심 — 회의가 쌓여도 복잡해지지 않게, 누적 기록은
     사이드바 회의 목록과 Action Items 탭에 맡기고 여기엔 남은 일만 둔다. */
  document.getElementById('ov-latest').innerHTML=latestMeetingHTML();
  const byDeadline=(a,b)=>{ if(!a.deadline) return 1; if(!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); };
  const pending=all.filter(i=>i.status!=='done').sort(byDeadline);
  document.getElementById('ov-ac-grid').innerHTML=pending.length
    ?pending.slice(0,6).map((it,i)=>acHTML(it,i,'ov')).join('')
    :`<div style="font-size:13px;color:var(--muted);padding:12px 0;">남은 업무가 없어요 🎉</div>`;
  document.getElementById('ov-as-summary').innerHTML=ovMembersHTML(all);
}

/** 개요 맨 위 — 가장 최근 회의 한 건 */
function latestMeetingHTML(){
  const m=history[0];
  if(!m) return '';
  const carried=m.carriedOver||[], gaps=m.gaps||[];
  const resolved=carried.filter(c=>c.resolved).length;
  return `
    <div class="panel">
      <div class="panel-hd">
        <div class="panel-ttl">🕒 최근 회의 · ${history.length}차 <span class="ov-latest-date">${(m.date||'').slice(0,10)}</span></div>
        ${m.id?`<span class="panel-lnk" onclick="openMeeting('${m.id}')">자세히 보기 →</span>`:''}
      </div>
      ${m.summary?`<div class="ov-latest-sum">${esc2(m.summary)}</div>`:''}
      <div class="ov-latest-stats">
        <span>🆕 새 업무 ${(m.items||[]).length}개</span>
        ${carried.length?`<span>🔗 지난 업무 ${carried.length}건 중 ${resolved}건 마무리</span>`:''}
        ${gaps.length?`<span>🔍 놓친 부분 ${gaps.length}개</span>`:''}
      </div>
    </div>`;
}

/** 개요의 담당자 현황 — 사람당 한 줄. 업무 목록은 담당자별 탭에서 본다. */
function ovMembersHTML(items){
  return Object.entries(groupBy(items)).map(([name,tasks])=>{
    const done=tasks.filter(t=>t.status==='done').length;
    return {name, left:tasks.length-done, rate:Math.round(done/tasks.length*100)};
  }).sort((a,b)=>b.left-a.left).map(r=>`
    <div class="ov-mem">
      <div class="av ${avCls(r.name)}" style="width:26px;height:26px;font-size:11px;">${r.name[0]}</div>
      <div class="ov-mem-name">${r.name}</div>
      <div class="prog-wrap ov-mem-bar"><div class="prog-fill" style="width:${r.rate}%"></div></div>
      <div class="ov-mem-left">${r.left?`남은 ${r.left}개`:'완료 ✓'}</div>
    </div>`).join('');
}

/* 전체 Action Items — 회의가 쌓일수록 계속 늘어나므로 상태별로 나누고
   완료는 접어서, 지금 봐야 할 업무(진행중·미시작)가 먼저 눈에 들어오게 한다. */
function renderAllActions(){
  const wrap=document.getElementById('all-ac-wrap');
  if(!history.length){ wrap.innerHTML=`<div class="panel"><div class="empty"><div class="e-ico">📋</div><h3>아직 분석된 회의가 없어요</h3></div></div>`; return; }
  const all=history.flatMap(e=>e.items);
  const byDeadline=(a,b)=>{ if(!a.deadline) return 1; if(!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); };
  const doing=all.filter(i=>i.status==='doing').sort(byDeadline);
  const todo=all.filter(i=>(i.status||'todo')==='todo').sort(byDeadline);
  const done=all.filter(i=>i.status==='done').sort(byDeadline);

  const section=(label,items,pfx,first)=>items.length?`
    <div class="m-lbl" style="margin:${first?'0':'18px'} 0 10px;">${label} ${items.length}개</div>
    <div class="ac-grid">${items.map((it,i)=>acHTML(it,i,'all-'+pfx)).join('')}</div>`:'';

  const pending=doing.length||todo.length;

  wrap.innerHTML=`
    <div class="panel">
      ${pending?`
        ${section('🔄 진행중',doing,'doing',true)}
        ${section('⬜ 미시작',todo,'todo',!doing.length)}
      `:`
        <div style="text-align:center;padding:20px 0 4px;">
          <div style="font-size:40px;margin-bottom:12px;">🎉</div>
          <div style="font-size:16px;font-weight:700;margin-bottom:6px;">진행중·미시작 업무가 없어요!</div>
          <div style="font-size:13px;color:var(--muted);">다음 회의를 분석해보세요.</div>
        </div>`}
      ${done.length?`
        <div class="tl-toggle-chip" style="margin-top:${pending?'18px':'20px'};" onclick="toggleAllDone()">✅ 완료 ${done.length}개 <span class="tl-chev" id="all-done-chev">▸</span></div>
        <div id="all-done-wrap" style="display:none;margin-top:10px;">
          <div class="ac-grid">${done.map((it,i)=>acHTML(it,i,'all-done')).join('')}</div>
        </div>`:''}
    </div>`;
}
/** 전체 Action Items의 완료 목록을 접었다 펼친다. */
function toggleAllDone(){
  const box=document.getElementById('all-done-wrap'), chev=document.getElementById('all-done-chev');
  if(!box) return;
  const show=box.style.display==='none';
  box.style.display=show?'block':'none';
  if(chev) chev.textContent=show?'▾':'▸';
}

/* 담당자별 — 카드는 기본 접힌 요약만 보여주고, 누르면 업무 리스트를 펼친다.
   회의가 쌓일수록 업무가 계속 늘어나므로 펼친 상태로 다 쏟아내면 스크롤만 길어진다. */
function renderMembers(){
  const wrap=document.getElementById('members-wrap');
  if(!history.length){ wrap.innerHTML=`<div class="panel"><div class="empty"><div class="e-ico">👥</div><h3>아직 분석된 회의가 없어요</h3></div></div>`; return; }
  const all=history.flatMap(e=>e.items);
  const g=groupBy(all);
  const today=new Date(); today.setHours(0,0,0,0);
  const byDeadline=(a,b)=>{ if(!a.deadline) return 1; if(!b.deadline) return -1; return new Date(a.deadline)-new Date(b.deadline); };
  /* 내 카드를 맨 위로, 나머지는 배정된 업무가 많은 순으로 */
  const myName=(currentUser&&currentUser.displayName||'').trim();
  const entries=Object.entries(g).sort((a,b)=>{
    const aMe=myName&&a[0]===myName, bMe=myName&&b[0]===myName;
    if(aMe!==bMe) return aMe?-1:1;
    return b[1].length-a[1].length;
  });
  const row=t=>{
    const diff=t.deadline?Math.ceil((new Date(t.deadline)-today)/86400000):null;
    const urgent=diff!==null&&diff<=3;
    const from=t.id&&findItemById(t.id), rn=from?meetingNo(from.meeting):null;
    return `
      <div class="mini-task">
        ${rn?`<span class="mt-round" title="${rn}차 회의에서 나온 업무">${rn}차</span>`:''}
        <div class="mt-name">${t.task}</div>
        ${t.deadline?`<span class="mt-dl${urgent?' urg':''}">${urgent?'⚠️ ':'📅 '}${t.deadline}</span>`:''}
        <span class="st-bdg ${ST.cls[t.status||'todo']}" style="font-size:10px;">${ST.ico[t.status||'todo']} ${ST.lbl[t.status||'todo']}</span>
      </div>`;
  };

  wrap.innerHTML=entries.map(([name,tasks],mi)=>{
    const doing=tasks.filter(t=>t.status==='doing').sort(byDeadline);
    const todo=tasks.filter(t=>(t.status||'todo')==='todo').sort(byDeadline);
    const done=tasks.filter(t=>t.status==='done').sort(byDeadline);
    const rate=tasks.length?Math.round(done.length/tasks.length*100):0;
    return `
    <div class="as-group">
      <div class="as-hd" onclick="toggleMemberCard(${mi})">
        <div class="av ${avCls(name)}">${name[0]}</div>
        <div style="flex:1;min-width:0;">
          <div class="as-name">${name}</div>
          <div class="as-ct">진행중 ${doing.length} · 미시작 ${todo.length} · 완료 ${done.length}</div>
        </div>
        <div style="width:80px;flex-shrink:0;">
          <div class="prog-wrap"><div class="prog-fill" style="width:${rate}%"></div></div>
          <div style="font-size:11px;color:var(--muted);text-align:right;margin-top:3px;">${rate}%</div>
        </div>
        <span class="tl-chev" id="as-chev-${mi}">▸</span>
      </div>
      <div class="as-body" id="as-body-${mi}" style="display:none;">
        ${doing.map(row).join('')}
        ${todo.map(row).join('')}
        ${done.length?`
          <div class="tl-toggle-chip" style="margin-top:6px;" onclick="event.stopPropagation();toggleMemberDone(${mi})">✅ 완료 ${done.length}개 <span class="tl-chev" id="as-done-chev-${mi}">▸</span></div>
          <div id="as-done-${mi}" style="display:none;margin-top:8px;">${done.map(row).join('')}</div>`:''}
      </div>
    </div>`;
  }).join('');
}

/** 담당자 카드를 접었다 펼친다. */
function toggleMemberCard(i){
  const body=document.getElementById('as-body-'+i), chev=document.getElementById('as-chev-'+i);
  if(!body) return;
  const show=body.style.display==='none';
  body.style.display=show?'block':'none';
  if(chev) chev.textContent=show?'▾':'▸';
}
/** 완료된 업무 목록을 접었다 펼친다. */
function toggleMemberDone(i){
  const box=document.getElementById('as-done-'+i), chev=document.getElementById('as-done-chev-'+i);
  if(!box) return;
  const show=box.style.display==='none';
  box.style.display=show?'block':'none';
  if(chev) chev.textContent=show?'▾':'▸';
}

/* Task Flow */
function renderTaskFlow(){
  const wrap=document.getElementById('tf-wrap');
  if(!history.length){ wrap.innerHTML=`<div class="panel"><div class="empty"><div class="e-ico">🔗</div><h3>아직 분석된 회의가 없어요</h3></div></div>`; return; }
  const all=history.flatMap(e=>e.items);
  const today=new Date(); today.setHours(0,0,0,0);

  const stages=[
    {key:'이번 주 (7일 이내)', cls:'fc-week', items:[]},
    {key:'2주 내',            cls:'fc-2w',   items:[]},
    {key:'1개월 내',          cls:'fc-mon',  items:[]},
    {key:'장기',              cls:'fc-later',items:[]},
    {key:'마감 미정',         cls:'fc-none', items:[]},
  ];
  all.forEach(item=>{
    if(!item.deadline){ stages[4].items.push(item); return; }
    const diff=Math.ceil((new Date(item.deadline)-today)/86400000);
    if(diff<0||diff<=7) stages[0].items.push(item);
    else if(diff<=14) stages[1].items.push(item);
    else if(diff<=30) stages[2].items.push(item);
    else stages[3].items.push(item);
  });

  const active=stages.filter(s=>s.items.length);

  const nodesHTML=active.map(s=>`
    <div class="flow-col">
      <div class="flow-col-hd ${s.cls}">
        <span>${s.key}</span>
        <span class="col-cnt">${s.items.length}</span>
      </div>
      ${s.items.map(item=>{
        const today2=new Date(); today2.setHours(0,0,0,0);
        const diff=item.deadline?Math.ceil((new Date(item.deadline)-today2)/86400000):null;
        const nc=item.status==='done'?'fn-done':diff!==null&&diff<=3?'fn-warn':item.status==='doing'?'fn-active':'';
        return `<div class="flow-node ${nc}">
          <div class="fn-name">${item.task}</div>
          <div class="fn-meta">
            ${item.assignee&&item.assignee!=='미지정'?`<div class="fn-av ${avCls(item.assignee)}">${item.assignee[0]}</div>`:''}
            <span class="fn-dl">${item.deadline||'미정'}</span>
            <span class="fn-st ${item.status||'todo'}">${ST.lbl[item.status||'todo']}</span>
          </div>
        </div>`;
      }).join('')}
    </div>`).join('');

  /* 진행률 요약 */
  const doneAll=all.filter(i=>i.status==='done').length;
  const rate=all.length?Math.round(doneAll/all.length*100):0;

  wrap.innerHTML=`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">🔗 마감일 기준 업무 흐름</div></div>
      <div class="flow-board"><div class="flow-cols">${nodesHTML}</div></div>
    </div>
    <div class="g2">
      <div class="panel">
        <div class="panel-hd"><div class="panel-ttl">📊 전체 진행률</div></div>
        <div style="display:flex;align-items:center;gap:20px;">
          <div style="text-align:center;">
            <div style="font-size:40px;font-weight:800;color:var(--pk);">${rate}%</div>
            <div style="font-size:12px;color:var(--muted);">완료율</div>
          </div>
          <div style="flex:1;">
            <div class="prog-wrap" style="height:10px;margin-bottom:10px;"><div class="prog-fill" style="width:${rate}%"></div></div>
            <div style="display:flex;justify-content:space-between;font-size:12px;color:var(--muted);">
              <span>✅ 완료 ${doneAll}개</span><span>전체 ${all.length}개</span>
            </div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-hd"><div class="panel-ttl">📌 범례</div></div>
        <div style="display:flex;flex-direction:column;gap:10px;font-size:13px;">
          <span style="display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;border-radius:4px;background:var(--teal-lt);border:1.5px solid var(--teal);flex-shrink:0;"></span>완료된 업무</span>
          <span style="display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;border-radius:4px;background:var(--pk-light);border:1.5px solid var(--pk);flex-shrink:0;"></span>진행 중</span>
          <span style="display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;border-radius:4px;background:var(--amber-lt);border:1.5px solid #EF9F27;flex-shrink:0;"></span>마감 임박 (3일 이내)</span>
          <span style="display:flex;align-items:center;gap:8px;"><span style="width:14px;height:14px;border-radius:4px;background:var(--surface);border:1.5px solid var(--bd-s);flex-shrink:0;"></span>미시작</span>
        </div>
      </div>
    </div>`;
}

/* 브리핑 */
function renderBriefing(){
  const wrap=document.getElementById('brief-wrap');
  if(!history.length){ wrap.innerHTML=`<div class="panel"><div class="empty"><div class="e-ico">📋</div><h3>아직 분석된 회의가 없어요</h3></div></div>`; return; }

  const all=history.flatMap(e=>e.items);
  const today=new Date(); today.setHours(0,0,0,0);
  const stats=calcStats(all);
  const lastSum=history[0]?.summary||'';

  /* D-day 계산 */
  const upcoming=all
    .filter(i=>i.deadline&&i.status!=='done')
    .map(i=>({...i, diff:Math.ceil((new Date(i.deadline)-today)/86400000)}))
    .filter(i=>i.diff>=-1)
    .sort((a,b)=>a.diff-b.diff)
    .slice(0,9);

  const incomplete=all.filter(i=>i.status!=='done');
  const urgCt=upcoming.filter(i=>i.diff<=3).length;

  wrap.innerHTML=`
    ${lastSum?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">💡 최근 회의 요약</div></div>
      <div style="font-size:14px;line-height:1.85;color:var(--text);background:var(--pk-bg);padding:14px 16px;border-radius:10px;">${lastSum}</div>
    </div>`:''}

    <div class="g2">
      <div class="panel">
        <div class="panel-hd"><div class="panel-ttl">📊 전체 현황</div></div>
        <div style="display:flex;gap:16px;align-items:center;margin-bottom:14px;">
          <div style="text-align:center;min-width:80px;">
            <div style="font-size:36px;font-weight:800;color:var(--pk);">${stats.rate}%</div>
            <div style="font-size:12px;color:var(--muted);">전체 완료율</div>
          </div>
          <div style="flex:1;">
            <div class="prog-wrap" style="height:10px;margin-bottom:8px;"><div class="prog-fill" style="width:${stats.rate}%"></div></div>
            <div style="font-size:12px;color:var(--muted);">완료 ${stats.done}개 / 전체 ${stats.total}개</div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
          <div style="background:var(--pk-bg);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:var(--pk);">${incomplete.length}</div>
            <div style="font-size:11px;color:var(--muted);">미완료</div>
          </div>
          <div style="background:var(--amber-lt);border-radius:10px;padding:12px;text-align:center;">
            <div style="font-size:20px;font-weight:800;color:var(--amber);">${urgCt}</div>
            <div style="font-size:11px;color:var(--muted);">마감 임박</div>
          </div>
        </div>
      </div>
      <div class="panel">
        <div class="panel-hd"><div class="panel-ttl">👥 담당자별 완료율</div></div>
        ${Object.entries(groupBy(all)).map(([name,tasks])=>{
          const rate2=tasks.length?Math.round(tasks.filter(t=>t.status==='done').length/tasks.length*100):0;
          return `<div style="margin-bottom:12px;">
            <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;">
              <div style="display:flex;align-items:center;gap:6px;">
                <div class="av ${avCls(name)}" style="width:22px;height:22px;font-size:10px;">${name[0]}</div>
                <span style="font-size:13px;font-weight:600;">${name}</span>
              </div>
              <span style="font-size:12px;color:var(--muted);font-weight:600;">${rate2}%</span>
            </div>
            <div class="prog-wrap"><div class="prog-fill" style="width:${rate2}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    ${upcoming.length?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">📅 마감 일정</div></div>
      <div class="dl-grid">
        ${upcoming.map(item=>`
          <div class="dl-card">
            ${ddayHTML(item.diff)}
            <div class="dl-task">${item.task}</div>
            <div class="dl-who">👤 ${item.assignee||'미지정'}</div>
          </div>`).join('')}
      </div>
    </div>`:''}

    ${incomplete.length?`
    <div class="panel">
      <div class="panel-hd">
        <div class="panel-ttl">⚠️ 미완료 업무 (${incomplete.length}개)</div>
        <span class="panel-lnk" onclick="sdt('members')">전체 보기 →</span>
      </div>
      <div class="ac-grid">${incomplete.slice(0,6).map((it,i)=>acHTML(it,i,'brief')).join('')}</div>
      ${incomplete.length>6?`<div style="text-align:center;margin-top:12px;font-size:13px;color:var(--muted);">+ ${incomplete.length-6}개 더 · <span style="color:var(--pk);cursor:pointer;font-weight:600;" onclick="sdt('members')">전체 보기</span></div>`:''}
    </div>`:`
    <div class="panel" style="text-align:center;padding:32px;">
      <div style="font-size:40px;margin-bottom:12px;">🎉</div>
      <div style="font-size:16px;font-weight:700;margin-bottom:6px;">모든 업무 완료!</div>
      <div style="font-size:13px;color:var(--muted);">다음 회의를 분석해보세요.</div>
    </div>`}

    <div class="ai-rec">
      <div class="ai-rec-hd">
        <div class="ai-rec-ico">✨</div>
        <div>
          <div class="ai-rec-title">AI 권고 사항</div>
          <div class="ai-rec-sub">Gemini AI 분석 기반 권고</div>
        </div>
      </div>
      <div class="rec-item">
        <span class="rec-ico">${urgCt>0?'🚨':'✅'}</span>
        <div class="rec-body">
          <div class="rec-ttl">${urgCt>0?`마감 임박 업무 ${urgCt}개 확인 필요`:'마감 임박 업무 없음'}</div>
          <div class="rec-desc">${urgCt>0?`3일 이내 마감되는 업무가 ${urgCt}개 있어요. 담당자에게 진행 상황을 확인해보세요.`:'현재 3일 이내 마감 업무가 없어요. 일정이 잘 관리되고 있어요!'}</div>
        </div>
      </div>
      <div class="rec-item">
        <span class="rec-ico">📈</span>
        <div class="rec-body">
          <div class="rec-ttl">완료율 ${stats.rate}% — ${stats.rate>=70?'양호':'개선 필요'}</div>
          <div class="rec-desc">${stats.rate>=70?'팀 업무 진행률이 양호해요. 현재 페이스를 유지하세요.':'전체 완료율이 낮아요. 미완료 업무의 원인을 파악하고 우선순위를 재조정해보세요.'}</div>
        </div>
      </div>
      <div class="rec-item">
        <span class="rec-ico">👥</span>
        <div class="rec-body">
          <div class="rec-ttl">다음 회의 체크포인트</div>
          <div class="rec-desc">${incomplete.length?`미완료 업무 ${incomplete.length}개의 진행 상황을 다음 회의에서 리뷰하세요. 특히 마감이 가까운 업무를 먼저 확인하세요.`:'모든 업무가 완료됐어요. 다음 스프린트 계획을 세워보세요.'}</div>
        </div>
      </div>
    </div>`;
}
