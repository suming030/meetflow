/* MeetFlow — 마일스톤 화면 (온보딩 결과: 트랙별 마일스톤·아젠다)
   담당: ④ 마일스톤 + 정리 양식
   원래 js/dashboard.js 안에 있었는데, 마일스톤 담당이 대시보드 파일을 건드리지 않도록
   따로 떼어냈다. renderAll()(dashboard.js)과 onboarding.js가 renderMilestones()를 부른다. */

/* 마일스톤 (1단계 온보딩 결과) */
function renderMilestones(){
  const wrap=document.getElementById('milestones-wrap');
  if(!wrap||!currentProject) return;
  if(currentProject.onboardStatus!=='done'||!currentProject.onboarding){
    wrap.innerHTML=`
      <div class="panel">
        <div class="empty">
          <div class="e-ico">🧭</div>
          <h3>아직 온보딩을 완료하지 않았어요</h3>
          <p>AI가 마일스톤과 다음 회의 아젠다를 준비하려면 온보딩을 먼저 진행해주세요.</p>
          <button class="btn-pk" style="margin-top:18px;" onclick="gp('onboard')">✨ 온보딩 시작하기</button>
        </div>
      </div>`;
    return;
  }
  wrap.innerHTML=milestonesHTML(currentProject);
}
function milestonesHTML(project){
  const t=project.track, r=project.onboarding.result;
  return t==='club' ? milestonesClubHTML(r) : milestonesLinearHTML(t,r);
}
function agendaPanelHTML(r){
  const agenda=r.firstMeetingAgenda||[];
  if(!agenda.length) return '';
  return `
    <div class="panel">
      <div class="panel-hd">
        <div class="panel-ttl">📋 1차 회의 아젠다</div>
        <button class="btn-ghost" onclick="openMeetScheduler()">🗓️ 이 회의 일정 잡기</button>
      </div>
      <ol style="padding-left:20px;font-size:13px;line-height:2;color:var(--text);">
        ${agenda.map(a=>`<li>${a}</li>`).join('')}
      </ol>
    </div>`;
}
function milestonesLinearHTML(t,r){
  const today=new Date(); today.setHours(0,0,0,0);
  const ms=(r.milestones||[])
    .map(m=>({...m,_diff:m.dueDate?Math.ceil((new Date(m.dueDate)-today)/86400000):null}))
    .sort((a,b)=>{ if(a._diff==null) return 1; if(b._diff==null) return -1; return a._diff-b._diff; });

  const msHTML=ms.length?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">🧭 마일스톤</div></div>
      <div class="dl-grid">
        ${ms.map(m=>`
          <div class="dl-card">
            ${m._diff!=null?ddayHTML(m._diff):'<span class="dl-dday dd-ok">미정</span>'}
            <div class="dl-task">${m.title}</div>
            <div class="dl-who">${m.deliverable||m.rubricCategory||''}</div>
          </div>`).join('')}
      </div>
    </div>`:'';

  const rubricHTML=(r.rubric&&r.rubric.length)?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">📊 평가 배점</div></div>
      ${r.rubric.map(it=>`
        <div style="margin-bottom:12px;">
          <div style="display:flex;justify-content:space-between;font-size:13px;margin-bottom:5px;">
            <span style="font-weight:600;">${it.category}</span><span>${it.weight}%</span>
          </div>
          <div class="prog-wrap"><div class="prog-fill" style="width:${it.weight}%"></div></div>
        </div>`).join('')}
    </div>`:'';

  let sideHTML='';
  if(t==='team'&&r.roles&&r.roles.length){
    sideHTML=`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">👥 역할 분배</div></div>
      ${r.roles.map(role=>`
        <div class="mini-task">
          <div class="av ${avCls(role.assignee||role.role)}" style="width:28px;height:28px;font-size:11px;">${(role.assignee||role.role||'?')[0]}</div>
          <div class="mt-name">${role.role}${role.assignee?` — ${role.assignee}`:''}</div>
        </div>`).join('')}
    </div>`;
  } else if(t==='contest'&&r.checklist&&r.checklist.length){
    const items=r.checklist.map(c=>({task:c.item,assignee:null,deadline:null,status:c.met?'done':'todo',priority:'medium'}));
    sideHTML=`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">✅ 심사기준 충족 체크리스트</div></div>
      <div class="ac-grid">${items.map((it,i)=>acHTML(it,i,'ms-check')).join('')}</div>
    </div>`;
  }

  const insightsHTML=(t==='contest'&&r.insights&&r.insights.length)?`
    <div class="ai-rec">
      <div class="ai-rec-hd">
        <div class="ai-rec-ico">💡</div>
        <div><div class="ai-rec-title">수상작 인사이트</div><div class="ai-rec-sub">이전 수상작 분석 기반</div></div>
      </div>
      ${r.insights.map(i=>`<div class="rec-item"><span class="rec-ico">✨</span><div class="rec-body"><div class="rec-desc">${i}</div></div></div>`).join('')}
    </div>`:'';

  return msHTML+`<div class="g2">${rubricHTML}${sideHTML}</div>`+insightsHTML+agendaPanelHTML(r);
}
function milestonesClubHTML(r){
  const rm=r.recurringMeeting||{};
  const wdNames=['일','월','화','수','목','금','토'];
  const wd=wdNames[rm.dayOfWeek??2];
  let nextHTML='';
  if(rm.startDate){
    const start=new Date(rm.startDate);
    const today=new Date(); today.setHours(0,0,0,0);
    const dow=Number(rm.dayOfWeek);
    let next=new Date(Math.max(start.getTime(),today.getTime()));
    while(next.getDay()!==dow) next.setDate(next.getDate()+1);
    const diff=Math.ceil((next-today)/86400000);
    const weeksCount=rm.weeksCount||15;
    const weekNo=Math.min(weeksCount, Math.max(1, Math.floor((next-start)/(7*86400000))+1));
    nextHTML=`
      <div class="sum-banner">
        <div class="sum-ico">🗓️</div>
        <div>
          <div class="sum-lbl">다음 정기모임</div>
          <div class="sum-txt">매주 ${wd}요일 · ${next.toISOString().split('T')[0]} (${diff===0?'오늘':diff+'일 후'}) — ${weekNo}/${weeksCount}회차</div>
        </div>
      </div>
      <div class="m-card" style="margin-bottom:16px;">
        <div class="m-lbl">이번 학기 진행률</div>
        <div class="m-val" style="color:var(--pk);">${weekNo}/${weeksCount}주</div>
        <div class="prog-wrap"><div class="prog-fill" style="width:${Math.min(100,weekNo/weeksCount*100)}%"></div></div>
      </div>`;
  }

  const evs=(r.eventMilestones||[]).map(e=>({title:e.title,date:e.prepStartDate||e.eventDate,note:e.notes}));
  const goals=(r.goalMilestones||[]).map(g=>({title:g.title,date:g.targetDate,note:g.notes}));
  const today=new Date(); today.setHours(0,0,0,0);
  const all=[...evs,...goals]
    .map(x=>({...x,_diff:x.date?Math.ceil((new Date(x.date)-today)/86400000):null}))
    .sort((a,b)=>{ if(a._diff==null) return 1; if(b._diff==null) return -1; return a._diff-b._diff; });

  const evHTML=all.length?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">🎪 행사·목표 마일스톤</div></div>
      <div class="dl-grid">
        ${all.map(x=>`
          <div class="dl-card">
            ${x._diff!=null?ddayHTML(x._diff):'<span class="dl-dday dd-ok">미정</span>'}
            <div class="dl-task">${x.title}</div>
            <div class="dl-who">${x.note||''}</div>
          </div>`).join('')}
      </div>
    </div>`:'';

  const budget=r.budgetChecklist||[];
  const budgetHTML=budget.length?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">💰 예산 체크리스트</div></div>
      ${budget.map(b=>`
        <div class="mini-task">
          <div class="mt-name">${b.item}</div>
          <span class="bdg b-dl">${b.estimatedCost?b.estimatedCost+'원':'미정'}</span>
        </div>`).join('')}
    </div>`:'';

  return nextHTML+evHTML+budgetHTML+agendaPanelHTML(r);
}
