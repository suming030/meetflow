/* MeetFlow — 마일스톤 화면 (온보딩 결과: 트랙별 마일스톤·아젠다)
   담당: ④ 마일스톤
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

/* ──── MVP 1차 공통 계획 렌더러 ──── */
function msPlanSnapshot(plan){ return plan&&((plan.current&&plan.current.snapshot)||(plan.baseline&&plan.baseline.snapshot)); }
function msTaskState(plan,task){ return (plan.current&&plan.current.taskState&&plan.current.taskState[task.id])||task.status||'todo'; }
function msDateDiff(value){
  if(!value) return null;
  const today=new Date(); today.setHours(0,0,0,0);
  const date=new Date(value+'T00:00:00');
  return Number.isNaN(date.getTime())?null:Math.ceil((date-today)/86400000);
}
function msDueHTML(value){
  const diff=msDateDiff(value);
  return diff===null?'<span class="dl-dday dd-ok">미정</span>':ddayHTML(diff);
}
function msCheckpointHTML(checkpoints){
  if(!Array.isArray(checkpoints)||!checkpoints.length) return '';
  return `<div style="margin-top:8px;padding:9px 10px;background:var(--bg);border-left:3px solid var(--teal);font-size:12px;"><div style="font-weight:700;color:var(--teal);margin-bottom:4px;">🔎 검증 Checkpoint</div>${checkpoints.map(c=>`<div style="margin-top:5px;"><b>${c.focus||c.title||'검증 기준'}</b>${Array.isArray(c.criteria)&&c.criteria.length?`<ul style="margin:3px 0 0;padding-left:17px;color:var(--muted);">${c.criteria.map(x=>`<li>${x}</li>`).join('')}</ul>`:''}</div>`).join('')}</div>`;
}
function msTaskRisk(task,status){
  const diff=msDateDiff(task.dueDate);
  if(status==='done') return '완료';
  if(diff!=null&&diff<0) return '지연';
  if(diff!=null&&diff<=3) return '마감 임박';
  if(!task.assignee) return '담당자 미정';
  return diff==null?'일정 미정':'정상';
}
function msFindMilestone(plan,milestoneId){
  const snap=msPlanSnapshot(plan);if(!snap)return null;
  if(plan.track==='club') for(const thread of snap.agendaThreads||[]){const milestone=(thread.milestones||[]).find(item=>item.id===milestoneId);if(milestone)return {milestone,thread,tasks:thread.tasks};}
  const milestone=(snap.milestones||[]).find(item=>item.id===milestoneId);return milestone?{milestone,thread:null,tasks:snap.tasks}:null;
}
function msRecommendationFallback(plan,milestone,thread){
  if(plan.track==='team') return ['유사 과제·사례 벤치마킹','교수자·사용자 요구사항 다시 확인','팀 내부 중간 피드백'];
  if(plan.track==='contest'){
    const type=msPlanSnapshot(plan).trackData&&msPlanSnapshot(plan).trackData.contestType;
    return {idea:['유사 수상작 차별점 비교','아이디어 실행 가능성 확인'],data_ai:['데이터 품질 확인','baseline 설정','평가 지표 사전 정의'],marketing:['경쟁사 사례 분석','타겟 페르소나 검증','기존 캠페인 벤치마킹'],startup_bm:['고객 문제 인터뷰','경쟁 대안 비교','수익구조 검증'],hackathon:['핵심 기능 범위 고정','데모 시나리오 테스트','백업 데모 준비'],design:['레퍼런스 보드 구성','사용자 피드백','제출 규격 사전 점검']}[type]||[];
  }
  return thread&&thread.agendaType==='outreach'?['섭외 대상 우선순위 정리','연락 메시지 초안 검토']:['유사 활동 사례 확인','담당자와 실행 범위 검토'];
}
function msRecommendations(plan,milestone,thread){const saved=Array.isArray(milestone.recommendations)?milestone.recommendations.filter(Boolean):[];return saved.length?saved:msRecommendationFallback(plan,milestone,thread);}
function msAddRecommendedTasks(milestoneId){
  const plan=currentProject&&currentProject.milestonePlan,found=msFindMilestone(plan,milestoneId);if(!plan||!found)return;
  const recommendations=msRecommendations(plan,found.milestone,found.thread),selected=[...document.querySelectorAll(`[data-ms-rec="${milestoneId}"]:checked`)].map(input=>recommendations[Number(input.value)]).filter(Boolean);if(!selected.length){toast('추가할 제안을 선택해주세요.','info');return;}
  selected.forEach(title=>{const task={id:typeof onboardPlanId==='function'?onboardPlanId('task'):`ms_task_${Date.now()}_${Math.random()}`,milestoneId,title,assignee:null,dueDate:found.milestone.dueDate||null,status:'todo',definitionOfDone:'선택한 추천 업무 완료',needsDecomposition:false};found.tasks.push(task);found.milestone.taskIds=found.milestone.taskIds||[];found.milestone.taskIds.push(task.id);});
  found.milestone.recommendations=msRecommendations(plan,found.milestone,found.thread).filter(title=>!selected.includes(title));plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();toast(`${selected.length}개 업무를 추가했어요.`,'success');
}
function msCycleTaskStatus(id){
  const plan=currentProject&&currentProject.milestonePlan, snap=msPlanSnapshot(plan); if(!plan||!snap) return;
  const tasks=[...(snap.tasks||[]),...(snap.agendaThreads||[]).flatMap(t=>t.tasks||[])];
  const task=tasks.find(t=>t.id===id); if(!task) return;
  const now=msTaskState(plan,task), next=ST.cycle[(ST.cycle.indexOf(now)+1)%ST.cycle.length];
  plan.current.taskState=plan.current.taskState||{}; plan.current.taskState[id]=next; plan.updatedAt=new Date().toISOString();
  msOpenMilestoneIds.add(task.milestoneId);persistCurrentProject({milestonePlan:plan}); renderMilestones();
}
function msThreadProgress(plan,thread){
  const tasks=Array.isArray(thread.tasks)?thread.tasks:[];
  const done=tasks.filter(task=>msTaskState(plan,task)==='done').length;
  return {done,total:tasks.length,rate:tasks.length?Math.round(done/tasks.length*100):0};
}
function msNormalizeDecisionStatus(status){ return ['undecided','decided','deferred'].includes(status)?status:'undecided'; }
function msDecisionStatus(plan,thread){
  const saved=plan&&plan.current&&plan.current.decisionState&&plan.current.decisionState[thread.id];
  return msNormalizeDecisionStatus(saved||thread.status);
}
function msSetDecisionStatus(threadId,nextStatus){
  const plan=currentProject&&currentProject.milestonePlan,snap=msPlanSnapshot(plan);
  if(!plan||!snap) return;
  const thread=(snap.agendaThreads||[]).find(item=>item.id===threadId);
  if(!thread||thread.mode!=='decision') return;
  const current=msDecisionStatus(plan,thread),next=msNormalizeDecisionStatus(nextStatus);
  const allowed={undecided:['decided','deferred'],deferred:['decided','undecided'],decided:['undecided']};
  if(!allowed[current].includes(next)) return;
  plan.current.decisionState=plan.current.decisionState||{};
  plan.current.decisionState[threadId]=next;
  plan.updatedAt=new Date().toISOString();
  persistCurrentProject({milestonePlan:plan}); renderMilestones();
}
function msAllMeetingItems(meetings){
  const list=Array.isArray(meetings)?meetings:[];
  return list.flatMap((meeting,index)=>(Array.isArray(meeting.items)?meeting.items:[])
    .filter(item=>meeting.id&&item&&item.id)
    .map(item=>({meeting,item,meetingNo:(list===history&&typeof meetingNo==='function'?meetingNo(meeting):list.length-index),key:`${meeting.id}|${item.id}`})));
}
function msLinkedItems(plan,taskId,meetings){
  const links=Array.isArray(plan&&plan.links)?plan.links:[];
  const all=msAllMeetingItems(meetings===undefined?history:meetings);
  return links.filter(link=>link.taskId===taskId).map(link=>{
    const found=all.find(entry=>entry.meeting.id===link.meetingId&&entry.item.id===link.itemId);
    return {...link,meeting:found&&found.meeting||null,item:found&&found.item||null,meetingNo:found&&found.meetingNo||null};
  });
}
function msLinkMeetingItem(taskId,meetingId,itemId,type='manual'){
  const plan=currentProject&&currentProject.milestonePlan,snap=msPlanSnapshot(plan);
  if(!plan||!snap||!taskId||!meetingId||!itemId) return;
  const tasks=[...(snap.tasks||[]),...(snap.agendaThreads||[]).flatMap(thread=>thread.tasks||[])];
  const exists=tasks.some(task=>task.id===taskId);
  const meeting=history.find(entry=>entry.id===meetingId);
  const item=meeting&&(meeting.items||[]).find(entry=>entry.id===itemId);
  if(!exists||!item) return;
  plan.links=Array.isArray(plan.links)?plan.links:[];
  if(!plan.links.some(link=>link.taskId===taskId&&link.meetingId===meetingId&&link.itemId===itemId)){
    plan.links.push({taskId,meetingId,itemId,type:type==='manual'?'manual':'suggested'});
    plan.updatedAt=new Date().toISOString();
    persistCurrentProject({milestonePlan:plan}); renderMilestones();
  }
}
function msUnlinkMeetingItem(taskId,meetingId,itemId){
  const plan=currentProject&&currentProject.milestonePlan;
  if(!plan||!Array.isArray(plan.links)) return;
  const next=plan.links.filter(link=>!(link.taskId===taskId&&link.meetingId===meetingId&&link.itemId===itemId));
  if(next.length===plan.links.length) return;
  plan.links=next;plan.updatedAt=new Date().toISOString();
  persistCurrentProject({milestonePlan:plan}); renderMilestones();
}
function msLinkSelected(taskId){
  const select=document.getElementById(`ms-link-${taskId}`),value=select&&select.value;
  if(!value) return;
  const [meetingId,itemId]=value.split('|');
  msLinkMeetingItem(taskId,meetingId,itemId,'manual');
}
function msTaskMeetingLinksHTML(plan,task){
  const linked=msLinkedItems(plan,task.id),linkedKeys=new Set(linked.map(link=>`${link.meetingId}|${link.itemId}`));
  const candidates=msAllMeetingItems(history).filter(entry=>!linkedKeys.has(entry.key));
  const linkedHTML=linked.length?`<div style="margin-top:6px;font-size:11px;color:var(--muted);">🔗 ${linked.map(link=>link.item?`${link.meetingNo}차 · ${link.item.task}<button class="btn-ghost" type="button" style="margin-left:4px;padding:2px 5px;font-size:10px;" onclick="msUnlinkMeetingItem('${task.id}','${link.meetingId}','${link.itemId}')">해제</button>`:'연결된 회의 업무를 찾을 수 없음').join('<br>')}</div>`:'';
  const picker=candidates.length?`<div style="display:flex;gap:5px;margin-top:6px;"><select id="ms-link-${task.id}" class="m-inp" style="margin:0;min-width:0;padding:4px 6px;font-size:11px;"><option value="">회의 업무 연결…</option>${candidates.map(entry=>`<option value="${entry.key}">${entry.meetingNo}차 · ${entry.item.task}</option>`).join('')}</select><button class="btn-ghost" type="button" style="padding:4px 7px;font-size:11px;" onclick="msLinkSelected('${task.id}')">연결</button></div>`:'';
  return linkedHTML+picker;
}
function msInspectTaskEntries(plan,snap){
  if(plan.track!=='club') return (snap.tasks||[]).map(task=>({task,thread:null}));
  return (snap.agendaThreads||[]).flatMap(thread=>thread.mode==='delivery'?(thread.tasks||[]).map(task=>({task,thread})):[]);
}
function msRiskRank(level){ return {normal:0,attention:1,risk:2,overdue:3}[level]||0; }
function msMaxRisk(...levels){ return levels.reduce((max,level)=>msRiskRank(level)>msRiskRank(max)?level:max,'normal'); }
function msBuildNextAgenda(inspection){
  const out=[],seen=new Set(),add=(key,level,text,meta={})=>{if(!seen.has(key)){seen.add(key);out.push({level,text,...meta});}};
  (inspection.risks||[]).forEach(risk=>{
    if(risk.level==='overdue'||risk.type==='gap'||risk.type==='unlinked-item'||risk.type==='carried-over'||risk.type==='milestone-deadline'||risk.type==='decision') add(`${risk.type}:${risk.id||risk.taskId||risk.threadId||risk.text}`,risk.level,risk.message,{type:risk.type,taskId:risk.taskId||null,threadId:risk.threadId||null});
  });
  return out;
}
function msBuildInspection(plan,meetingHistory){
  const snap=msPlanSnapshot(plan),meetings=Array.isArray(meetingHistory)?meetingHistory:[];
  const inspection={tasks:[],milestones:[],decisions:[],risks:[],newItems:[],gaps:[],nextAgenda:[]};
  if(!plan||!snap) return inspection;
  const allItems=msAllMeetingItems(meetings),links=Array.isArray(plan.links)?plan.links:[];
  const linkedItemKeys=new Set(links.map(link=>`${link.meetingId}|${link.itemId}`));
  const carriesByItem={};
  meetings.forEach((meeting,index)=>(Array.isArray(meeting.carriedOver)?meeting.carriedOver:[]).forEach(carry=>{
    if(!carry||!carry.id) return;
    (carriesByItem[carry.id]||(carriesByItem[carry.id]=[])).push({meetingId:meeting.id||null,meetingNo:meetings.length-index,resolved:carry.resolved===true,note:carry.note||'',newDeadline:carry.newDeadline||null});
  }));
  msInspectTaskEntries(plan,snap).forEach(({task,thread})=>{
    const status=msTaskState(plan,task),dueDiff=msDateDiff(task.dueDate),linked=msLinkedItems(plan,task.id,meetings);
    const carries=linked.flatMap(link=>link.item?(carriesByItem[link.item.id]||[]):[]);
    const unresolved=carries.filter(carry=>!carry.resolved);
    let level='normal';
    if(status!=='done'&&dueDiff!==null&&dueDiff<0) level='overdue';
    else if(status!=='done'&&dueDiff!==null&&dueDiff<=3) level='risk';
    else if(unresolved.length) level=unresolved.length>=2?'risk':'attention';
    const entry={taskId:task.id,title:task.title,threadId:thread&&thread.id||null,status,dueDate:task.dueDate||null,dueDiff,level,linkedItemCount:linked.length,carriedOver:unresolved,hasLinkedItem:linked.length>0};
    inspection.tasks.push(entry);
    if(level!=='normal') inspection.risks.push({level,type:level==='overdue'?'overdue-task':unresolved.length?'carried-over':'task-deadline',taskId:task.id,threadId:entry.threadId,message:level==='overdue'?`기한이 지난 업무: ${task.title}`:unresolved.length?`계속 이어지는 업무: ${task.title}`:`마감이 임박한 업무: ${task.title}`});
  });
  const milestoneGroups=plan.track==='club'
    ?(snap.agendaThreads||[]).filter(thread=>thread.mode==='delivery').flatMap(thread=>(thread.milestones||[]).map(milestone=>({milestone,thread})))
    :(snap.milestones||[]).map(milestone=>({milestone,thread:null}));
  milestoneGroups.forEach(({milestone,thread})=>{
    const tasks=(thread?thread.tasks:snap.tasks||[]).filter(task=>task.milestoneId===milestone.id),done=tasks.filter(task=>msTaskState(plan,task)==='done').length,dueDiff=msDateDiff(milestone.dueDate);
    let level='normal';
    if(tasks.length&&done<tasks.length&&dueDiff!==null&&dueDiff<0) level='overdue';
    else if(tasks.length&&done<tasks.length&&dueDiff!==null&&dueDiff<=3) level='risk';
    const entry={milestoneId:milestone.id,title:milestone.title,threadId:thread&&thread.id||null,dueDate:milestone.dueDate||null,dueDiff,totalTasks:tasks.length,doneTasks:done,rate:tasks.length?Math.round(done/tasks.length*100):0,level};
    inspection.milestones.push(entry);
    if(level!=='normal') inspection.risks.push({level,type:'milestone-deadline',id:milestone.id,threadId:entry.threadId,message:`${level==='overdue'?'기한이 지난':'마감이 임박한'} 마일스톤: ${milestone.title}`});
  });
  allItems.filter(entry=>!linkedItemKeys.has(entry.key)).forEach(entry=>{
    inspection.newItems.push({meetingId:entry.meeting.id,itemId:entry.item.id,meetingNo:entry.meetingNo,task:entry.item.task});
    inspection.risks.push({level:'attention',type:'unlinked-item',id:entry.key,message:`연결되지 않은 새 업무 후보: ${entry.item.task}`});
  });
  meetings.forEach((meeting,index)=>(Array.isArray(meeting.gaps)?meeting.gaps:[]).filter(Boolean).forEach(gap=>{
    const entry={meetingId:meeting.id||null,meetingNo:meetings.length-index,text:gap};inspection.gaps.push(entry);
    inspection.risks.push({level:'attention',type:'gap',id:`${entry.meetingId}|${gap}`,message:`확인 필요: ${gap}`});
  }));
  if(plan.track==='club') (snap.agendaThreads||[]).filter(thread=>thread.mode==='decision').forEach(thread=>{
    const status=msDecisionStatus(plan,thread),level=status==='decided'?'normal':'attention';
    inspection.decisions.push({threadId:thread.id,title:thread.title,status,level});
    if(level!=='normal') inspection.risks.push({level,type:'decision',threadId:thread.id,message:`의사결정 확인 필요: ${thread.title} (${status==='deferred'?'보류':'미결'})`});
  });
  inspection.nextAgenda=msBuildNextAgenda(inspection);
  return inspection;
}
function msInspectionHTML(inspection){
  if(!inspection.risks.length&&!inspection.nextAgenda.length) return '';
  const label={normal:'정상',attention:'확인',risk:'위험',overdue:'기한 초과'};
  return `<div class="panel" style="margin-top:16px;"><div class="panel-hd"><div class="panel-ttl">🔍 계획 점검</div></div>${inspection.risks.length?`<div style="font-size:12px;margin-bottom:12px;">${inspection.risks.map(risk=>`<div class="mini-task"><span class="bdg ${risk.level==='overdue'||risk.level==='risk'?'b-dl':'b-nodl'}">${label[risk.level]}</span><div class="mt-name">${risk.message}</div></div>`).join('')}</div>`:''}${inspection.nextAgenda.length?`<div class="m-lbl" style="margin-bottom:6px;">다음 회의 확인 안건</div><ol style="margin:0;padding-left:20px;font-size:13px;line-height:1.8;">${inspection.nextAgenda.map(item=>`<li>${item.text}</li>`).join('')}</ol>`:''}</div>`;
}
function msBuildReplanTriggers(inspection,plan,targetThreadId=null){
  const snap=msPlanSnapshot(plan),base=plan&&plan.baseline&&plan.baseline.snapshot,triggers=[];
  if(!plan||!snap||!base) return triggers;
  const add=(kind,strength,message)=>triggers.push({kind,strength,message,targetThreadId});
  if(targetThreadId){
    const target=(snap.agendaThreads||[]).find(thread=>thread.id===targetThreadId);
    if(!target||target.mode!=='delivery') return triggers;
  }else{
    const currentDeadline=snap.trackData&&snap.trackData.finalDeadline,baselineDeadline=base.trackData&&base.trackData.finalDeadline;
    if(currentDeadline!==baselineDeadline) add('deadline-changed','strong','최종 마감일이 변경되었습니다.');
    const currentDeliverables=(snap.deliverables||[]).map(item=>item.id).sort().join('|'),baselineDeliverables=(base.deliverables||[]).map(item=>item.id).sort().join('|');
    if(currentDeliverables!==baselineDeliverables) add('deliverable-changed','strong','필수 Deliverable 구성이 변경되었습니다.');
    const currentRequirements=JSON.stringify((snap.requirements||[]).map(item=>[item.title,item.acceptanceCriteria]).sort()),baselineRequirements=JSON.stringify((base.requirements||[]).map(item=>[item.title,item.acceptanceCriteria]).sort());
    if(currentRequirements!==baselineRequirements) add('requirement-changed','strong','핵심 Requirement가 변경되었습니다.');
  }
  const milestones=(inspection.milestones||[]).filter(item=>targetThreadId?item.threadId===targetThreadId:!item.threadId);
  if(milestones.some(item=>item.level==='overdue')) add('milestone-overdue','strong','핵심 마일스톤의 기한이 지났습니다.');
  const tasks=(inspection.tasks||[]).filter(item=>targetThreadId?item.threadId===targetThreadId:!item.threadId);
  if(tasks.some(item=>(item.carriedOver||[]).length>=2)) add('repeated-carried-over','conditional','같은 업무가 여러 회의에서 계속 이월되었습니다.');
  if(tasks.filter(item=>item.level==='overdue'||item.level==='risk').length>=2) add('multiple-delays','conditional','여러 핵심 업무가 동시에 지연되고 있습니다.');
  if(milestones.some(item=>item.dueDiff!==null&&item.dueDiff>=0&&item.dueDiff<=3&&item.rate<50)) add('low-progress-near-deadline','conditional','마감이 임박했지만 마일스톤 진행률이 낮습니다.');
  return triggers;
}
function msNeedsReplan(triggers){ return Array.isArray(triggers)&&triggers.length>0; }
function msReplanId(kind){
  if(typeof onboardPlanId==='function') return onboardPlanId(`replan-${kind}`);
  return `ms_replan_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}
function msReplanOutputTaskSchema(){ return {type:'object',properties:{id:{type:'string',nullable:true},title:{type:'string'},assignee:{type:'string',nullable:true},dueDate:{type:'string',nullable:true},definitionOfDone:{type:'string'},needsDecomposition:{type:'boolean'}},required:['id','title','definitionOfDone','needsDecomposition']}; }
function msReplanOutputMilestoneSchema(){ return {type:'object',properties:{id:{type:'string',nullable:true},title:{type:'string'},kind:{type:'string'},dueDate:{type:'string',nullable:true},checkpoints:{type:'array',items:{type:'object',properties:{title:{type:'string'},focus:{type:'string'},criteria:{type:'array',items:{type:'string'}}},required:['title','criteria']}},tasks:{type:'array',items:msReplanOutputTaskSchema()}},required:['id','title','tasks']}; }
function msReplanSchema(track){
  const milestone=msReplanOutputMilestoneSchema();
  const deliverable={type:'object',properties:{id:{type:'string',nullable:true},refKey:{type:'string'},title:{type:'string'},format:{type:'string'},dueDate:{type:'string',nullable:true},milestones:{type:'array',items:milestone}},required:['id','title','milestones']};
  const goal={type:'object',properties:{id:{type:'string',nullable:true},title:{type:'string'},deliverables:{type:'array',items:deliverable}},required:['id','title','deliverables']};
  const shared={summary:{type:'string'},reasons:{type:'array',items:{type:'string'}},mitigation:{type:'array',items:{type:'string'}}};
  if(track==='club') return {type:'object',properties:{...shared,proposedPlan:{type:'object',properties:{thread:{type:'object',properties:{id:{type:'string'},title:{type:'string'},agendaType:{type:'string'},targetDate:{type:'string',nullable:true},assignees:{type:'array',items:{type:'string'}},milestones:{type:'array',items:milestone}},required:['id','title','milestones']}},required:['thread']}},required:['summary','reasons','mitigation','proposedPlan']};
  return {type:'object',properties:{...shared,proposedPlan:{type:'object',properties:{goals:{type:'array',items:goal}},required:['goals']}},required:['summary','reasons','mitigation','proposedPlan']};
}
function msReplanScope(plan,inspection,targetThreadId){
  const snap=msPlanSnapshot(plan),tasks=msInspectTaskEntries(plan,snap)
    .filter(entry=>!targetThreadId||entry.thread&&entry.thread.id===targetThreadId)
    .map(entry=>({
      id:entry.task.id,title:entry.task.title,assignee:entry.task.assignee,dueDate:entry.task.dueDate,status:msTaskState(plan,entry.task),
      linkedItems:msLinkedItems(plan,entry.task.id).filter(link=>link.item).map(link=>({meetingNo:link.meetingNo,task:link.item.task,status:link.item.status||'todo'})),
      carriedOver:(inspection.tasks.find(item=>item.taskId===entry.task.id)||{}).carriedOver||[]
    }));
  const milestoneProgress=(inspection.milestones||[]).filter(item=>!targetThreadId||item.threadId===targetThreadId).map(item=>({id:item.milestoneId,title:item.title,rate:item.rate,dueDate:item.dueDate,level:item.level}));
  if(targetThreadId){
    const thread=(snap.agendaThreads||[]).find(item=>item.id===targetThreadId);
    return {thread:{id:thread.id,title:thread.title,agendaType:thread.agendaType,targetDate:thread.targetDate,assignees:thread.assignees,milestones:thread.milestones,tasks},milestoneProgress,tasks,gaps:(inspection.gaps||[]).slice(0,3)};
  }
  const inputs=currentProject&&currentProject.onboarding&&currentProject.onboarding.inputs||{};
  const limit=text=>typeof text==='string'?text.slice(0,4000):'';
  return {goals:(snap.goals||[]).map(goal=>({id:goal.id,title:goal.title,deliverables:(snap.deliverables||[]).filter(deliverable=>deliverable.goalId===goal.id).map(deliverable=>({id:deliverable.id,refKey:deliverable.refKey,title:deliverable.title,dueDate:deliverable.dueDate,milestones:(snap.milestones||[]).filter(milestone=>milestone.deliverableId===deliverable.id)}))})),milestoneProgress,tasks,criteria:{requirements:snap.requirements||[],rubrics:snap.rubrics||[],finalDeadline:snap.trackData&&snap.trackData.finalDeadline||null},contestReference:plan.track==='contest'?{guidelines:limit(inputs.guidelines),judgingCriteria:limit(inputs.rubric),contestType:snap.trackData&&snap.trackData.contestType||null,profile:snap.trackData&&snap.trackData.profile||null}:null,gaps:(inspection.gaps||[]).slice(0,3)};
}
function msReplanPrompt(plan,inspection,triggers,targetThreadId){
  const snap=msPlanSnapshot(plan),scope=msReplanScope(plan,inspection,targetThreadId),track=plan.track;
  const guard=track==='contest'?'실제 요강·최종 마감·심사기준이 contestType Profile보다 항상 우선입니다. Profile 때문에 필수 제출물이나 요강 요구를 바꾸지 마세요.':track==='team'?'Requirement, Rubric, 최종 Deadline은 기준선입니다. 지연만을 이유로 필수 Requirement나 제출물을 삭제하지 마세요.':'이 delivery Agenda Thread만 바꾸고 다른 Thread는 절대 포함하거나 변경하지 마세요.';
  return `당신은 프로젝트 재계획 초안만 만드는 AI입니다. 이 응답은 자동 반영되지 않고 사용자 승인 전 비교 화면에만 보입니다. ${guard}\n기존 항목을 유지하거나 날짜/제목을 바꿀 때는 반드시 제공된 id를 그대로 쓰고, 새 항목만 id:null로 두세요. 전체 회의 원문은 제공되지 않으며 아래 요약 밖의 사실을 만들지 마세요.\n\n재계획 Trigger:\n${triggers.map(trigger=>`- ${trigger.message}`).join('\n')}\n\n현재 범위 JSON:\n${JSON.stringify(scope)}\n\n응답에는 summary, reasons, mitigation, proposedPlan을 넣으세요. proposedPlan에는 유지 항목도 빠뜨리지 말고 포함하세요. 변경은 마일스톤/Task 수준에서 실행 가능해야 합니다.`;
}
function msClone(value){ return JSON.parse(JSON.stringify(value)); }
function msExistingOrNewId(rawId,allowed,used,kind){
  if(rawId&&allowed.has(rawId)&&!used.has(rawId)){used.add(rawId);return rawId;}
  let id=msReplanId(kind);while(used.has(id)) id=msReplanId(kind);used.add(id);return id;
}
function msNormalizeReplanTask(raw,milestoneId,oldTasks,used){
  const id=msExistingOrNewId(raw.id,oldTasks,used,'task'),old=oldTasks.get(id)||{};
  return {id,milestoneId,title:raw.title||old.title||'새 업무',assignee:raw.assignee||old.assignee||null,dueDate:raw.dueDate||null,status:old.status||'todo',definitionOfDone:raw.definitionOfDone||old.definitionOfDone||'',needsDecomposition:!!raw.needsDecomposition};
}
function msBuildProposedSnapshot(plan,proposed,targetThreadId){
  const current=msClone(msPlanSnapshot(plan)),oldTasks=new Map(msInspectTaskEntries(plan,current).map(entry=>[entry.task.id,entry.task]));
  if(targetThreadId){
    const index=(current.agendaThreads||[]).findIndex(thread=>thread.id===targetThreadId),oldThread=current.agendaThreads[index];
    if(index<0||!oldThread||oldThread.mode!=='delivery'||!proposed.thread) throw new Error('재계획할 Agenda Thread를 찾지 못했어요.');
    const raw=proposed.thread,usedMilestones=new Set(),usedTasks=new Set(),oldMilestones=new Set((oldThread.milestones||[]).map(item=>item.id));
    const thread={...oldThread,title:raw.title||oldThread.title,targetDate:raw.targetDate||null,assignees:Array.isArray(raw.assignees)?raw.assignees:oldThread.assignees,milestones:[],tasks:[]};
    (Array.isArray(raw.milestones)?raw.milestones:[]).forEach(item=>{
      const id=msExistingOrNewId(item.id,oldMilestones,usedMilestones,'milestone'),milestone={id,title:item.title||'새 마일스톤',kind:item.kind||'work',dueDate:item.dueDate||thread.targetDate||null,taskIds:[],checkpoints:Array.isArray(item.checkpoints)?item.checkpoints:[]};
      (Array.isArray(item.tasks)?item.tasks:[]).forEach(rawTask=>{const task=msNormalizeReplanTask(rawTask,id,oldTasks,usedTasks);milestone.taskIds.push(task.id);thread.tasks.push(task);});
      thread.milestones.push(milestone);
    });
    current.agendaThreads[index]=thread;return current;
  }
  const oldGoals=new Set((current.goals||[]).map(item=>item.id)),oldDeliverables=new Set((current.deliverables||[]).map(item=>item.id)),oldMilestones=new Set((current.milestones||[]).map(item=>item.id)),usedGoals=new Set(),usedDeliverables=new Set(),usedMilestones=new Set(),usedTasks=new Set();
  current.goals=[];current.deliverables=[];current.milestones=[];current.tasks=[];
  (Array.isArray(proposed.goals)?proposed.goals:[]).forEach(rawGoal=>{
    const goalId=msExistingOrNewId(rawGoal.id,oldGoals,usedGoals,'goal'),goal={id:goalId,title:rawGoal.title||'새 목표',deliverableIds:[]};current.goals.push(goal);
    (Array.isArray(rawGoal.deliverables)?rawGoal.deliverables:[]).forEach(rawDeliverable=>{
      const deliverableId=msExistingOrNewId(rawDeliverable.id,oldDeliverables,usedDeliverables,'deliverable'),oldDeliverable=(msPlanSnapshot(plan).deliverables||[]).find(item=>item.id===deliverableId)||{},deliverable={id:deliverableId,refKey:rawDeliverable.refKey||oldDeliverable.refKey||`replan-${deliverableId}`,goalId,title:rawDeliverable.title||oldDeliverable.title||'새 산출물',format:rawDeliverable.format||oldDeliverable.format||'',dueDate:rawDeliverable.dueDate||null,requirementIds:oldDeliverable.requirementIds||[],rubricIds:oldDeliverable.rubricIds||[],milestoneIds:[]};
      goal.deliverableIds.push(deliverableId);current.deliverables.push(deliverable);
      (Array.isArray(rawDeliverable.milestones)?rawDeliverable.milestones:[]).forEach(rawMilestone=>{
        const milestoneId=msExistingOrNewId(rawMilestone.id,oldMilestones,usedMilestones,'milestone'),milestone={id:milestoneId,deliverableId,title:rawMilestone.title||'새 마일스톤',kind:rawMilestone.kind||'work',dueDate:rawMilestone.dueDate||deliverable.dueDate||null,taskIds:[],checkpoints:Array.isArray(rawMilestone.checkpoints)?rawMilestone.checkpoints:[]};
        (Array.isArray(rawMilestone.tasks)?rawMilestone.tasks:[]).forEach(rawTask=>{const task=msNormalizeReplanTask(rawTask,milestoneId,oldTasks,usedTasks);milestone.taskIds.push(task.id);current.tasks.push(task);});
        deliverable.milestoneIds.push(milestoneId);current.milestones.push(milestone);
      });
    });
  });
  return current;
}
function msDiffRows(before,after,kind,targetThreadId){
  const source=targetThreadId?(snapshot=>{const thread=(snapshot.agendaThreads||[]).find(item=>item.id===targetThreadId);return kind==='milestone'?thread&&thread.milestones||[]:thread&&thread.tasks||[];}):(snapshot=>kind==='milestone'?snapshot.milestones||[]:snapshot.tasks||[]);
  const oldItems=source(before),newItems=source(after),oldById=new Map(oldItems.map(item=>[item.id,item])),newById=new Map(newItems.map(item=>[item.id,item])),rows=[];
  newItems.forEach(item=>{const old=oldById.get(item.id);if(!old)rows.push({type:'added',kind,id:item.id,after:item});else if(old.title!==item.title)rows.push({type:'title',kind,id:item.id,before:old,after:item});else if((old.dueDate||null)!==(item.dueDate||null))rows.push({type:'date',kind,id:item.id,before:old,after:item});else rows.push({type:'kept',kind,id:item.id,before:old,after:item});});
  oldItems.filter(item=>!newById.has(item.id)).forEach(item=>rows.push({type:'removed',kind,id:item.id,before:item}));return rows;
}
function msBuildPlanDiff(plan,proposedPlan,targetThreadId=null){ const before=msPlanSnapshot(plan);return {milestones:msDiffRows(before,proposedPlan,'milestone',targetThreadId),tasks:msDiffRows(before,proposedPlan,'task',targetThreadId)}; }
function msStorePendingReplan(plan,aiResult,triggers,targetThreadId=null){
  const proposedPlan=msBuildProposedSnapshot(plan,aiResult.proposedPlan||{},targetThreadId),reasons=[...triggers.map(trigger=>trigger.message),...(Array.isArray(aiResult.reasons)?aiResult.reasons:[])];
  plan.pendingReplan={createdAt:new Date().toISOString(),targetThreadId,reasons,summary:aiResult.summary||'',mitigation:Array.isArray(aiResult.mitigation)?aiResult.mitigation:[],proposedPlan,diff:msBuildPlanDiff(plan,proposedPlan,targetThreadId)};
  return plan.pendingReplan;
}
async function msCreateReplanDraft(targetThreadId=null,manual=false){
  const plan=currentProject&&currentProject.milestonePlan;if(!plan||plan.pendingReplan) return;
  const inspection=msBuildInspection(plan,history),triggers=msBuildReplanTriggers(inspection,plan,targetThreadId);
  if(manual) triggers.push({kind:'manual-request','strength':'strong',message:'사용자가 재계획을 직접 요청했습니다.',targetThreadId});
  if(!msNeedsReplan(triggers)){toast('현재는 재계획을 권장할 조건이 없어요.','info');return;}
  try{
    const result=await geminiRequest(msReplanPrompt(plan,inspection,triggers,targetThreadId),msReplanSchema(plan.track),8192);
    msStorePendingReplan(plan,result,triggers,targetThreadId);plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();
  }catch(error){toast(error.message||'재계획안 생성에 실패했어요.','error');}
}
function msApproveReplan(){
  const plan=currentProject&&currentProject.milestonePlan,pending=plan&&plan.pendingReplan;if(!plan||!pending) return;
  const snapshot=pending.proposedPlan,validTaskIds=new Set([...(snapshot.tasks||[]),...(snapshot.agendaThreads||[]).flatMap(thread=>thread.tasks||[])].map(task=>task.id));
  plan.current.snapshot=snapshot;plan.current.source='replan';plan.current.version=(plan.current.version||1)+1;plan.current.taskState=Object.fromEntries(Object.entries(plan.current.taskState||{}).filter(([id])=>validTaskIds.has(id)));plan.links=(Array.isArray(plan.links)?plan.links:[]).filter(link=>validTaskIds.has(link.taskId));plan.currentVersion=(plan.currentVersion||1)+1;
  plan.changeLog=Array.isArray(plan.changeLog)?plan.changeLog:[];plan.changeLog.push({version:plan.currentVersion,approvedAt:new Date().toISOString(),reasons:pending.reasons,summary:pending.summary});plan.pendingReplan=null;plan.updatedAt=new Date().toISOString();
  persistCurrentProject({milestonePlan:plan});renderMilestones();toast('재계획안을 현재 계획에 반영했어요.','success');
}
function msRejectReplan(){ const plan=currentProject&&currentProject.milestonePlan;if(!plan||!plan.pendingReplan) return;plan.pendingReplan=null;plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();toast('재계획안을 취소했어요.','info'); }
function msRenderReplanComparison(plan,targetThreadId=null){
  const pending=plan&&plan.pendingReplan;if(!pending||pending.targetThreadId!==targetThreadId) return '';
  const label={added:'추가',removed:'삭제',date:'날짜 변경',title:'제목 변경',kept:'유지'};
  const rows=[...(pending.diff.milestones||[]),...(pending.diff.tasks||[])].filter(row=>row.type!=='kept');
  return `<div class="panel" style="margin-top:16px;border:1px solid var(--pk);"><div class="panel-hd"><div class="panel-ttl">📝 재계획 초안 — 승인 전 비교</div></div><div style="font-size:13px;margin-bottom:8px;">${pending.summary||'변경 요약 없음'}</div>${pending.reasons.length?`<div style="font-size:12px;color:var(--muted);margin-bottom:10px;">${pending.reasons.map(reason=>`• ${reason}`).join('<br>')}</div>`:''}<div style="font-size:12px;">${rows.length?rows.map(row=>`<div class="mini-task"><span class="bdg b-nodl">${label[row.type]}</span><div class="mt-name">${row.kind==='milestone'?'마일스톤':'Task'} · ${row.before?row.before.title:'—'}${row.after?` → ${row.after.title}`:''}${row.type==='date'?` (${row.before.dueDate||'미정'} → ${row.after.dueDate||'미정'})`:''}</div></div>`).join(''):'변경 사항이 없습니다.'}</div><div style="display:flex;gap:8px;margin-top:12px;"><button class="btn-pk" type="button" onclick="msApproveReplan()">승인</button><button class="btn-ghost" type="button" onclick="msRejectReplan()">취소</button></div></div>`;
}
function msReplanControlsHTML(plan,inspection,targetThreadId=null){
  const pending=plan&&plan.pendingReplan;if(pending&&pending.targetThreadId===targetThreadId) return msRenderReplanComparison(plan,targetThreadId);
  if(pending) return '';
  const triggers=msBuildReplanTriggers(inspection,plan,targetThreadId),recommended=msNeedsReplan(triggers);
  return `<div style="margin-top:12px;padding:10px;background:var(--bg);font-size:12px;">${recommended?`<div style="margin-bottom:7px;color:var(--amber);font-weight:700;">⚠️ 재계획 권장 · ${triggers.map(trigger=>trigger.message).join(' ')}</div><button class="btn-pk" type="button" onclick="msCreateReplanDraft(${targetThreadId?`'${targetThreadId}'`:'null'})">재계획안 만들기</button>`:`<span style="color:var(--muted);">재계획 권장 조건은 없습니다.</span><button class="btn-ghost" type="button" style="margin-left:8px;" onclick="msCreateReplanDraft(${targetThreadId?`'${targetThreadId}'`:'null'},true)">직접 재계획 요청</button>`}</div>`;
}
function msValidationStatus(plan,kind,id){
  const value=plan&&plan.current&&plan.current.validationState&&plan.current.validationState[kind]&&plan.current.validationState[kind][id];
  return ['met','unmet','review'].includes(value)?value:'review';
}
function msSetValidationStatus(kind,id,status){
  if(!['requirements','rubrics'].includes(kind)||!['met','unmet','review'].includes(status)) return;
  const plan=currentProject&&currentProject.milestonePlan;if(!plan) return;
  plan.current.validationState=plan.current.validationState||{requirements:{},rubrics:{}};
  plan.current.validationState[kind]=plan.current.validationState[kind]||{};
  plan.current.validationState[kind][id]=status;plan.updatedAt=new Date().toISOString();
  persistCurrentProject({milestonePlan:plan});renderMilestones();
}
function msMilestoneValidation(plan,current,milestone){
  const active=(current.milestones||[]).find(item=>item.id===milestone.id);
  if(!active) return {complete:false,totalTasks:0,doneTasks:0,missing:true};
  const tasks=(current.tasks||[]).filter(task=>task.milestoneId===active.id),done=tasks.filter(task=>msTaskState(plan,task)==='done').length;
  return {complete:tasks.length>0&&done===tasks.length,totalTasks:tasks.length,doneTasks:done,missing:false};
}
function msBuildValidation(plan){
  const baseline=plan&&plan.baseline&&plan.baseline.snapshot,current=msPlanSnapshot(plan);
  const empty={requirements:[],rubrics:[],deliverables:[],checkpoints:[],incompleteTasks:[],ready:false,state:'not-ready',message:'계획 정보를 찾을 수 없어요.'};
  if(!plan||!baseline||!current) return empty;
  const validation={requirements:[],rubrics:[],deliverables:[],checkpoints:[],incompleteTasks:[],ready:false,state:'not-ready',message:''};
  const activeDeliverables=new Map((current.deliverables||[]).map(item=>[item.id,item]));
  (baseline.deliverables||[]).forEach(deliverable=>{
    const active=activeDeliverables.get(deliverable.id),milestones=(baseline.milestones||[]).filter(item=>item.deliverableId===deliverable.id),checks=milestones.map(milestone=>({milestone,...msMilestoneValidation(plan,current,milestone)}));
    const complete=!!active&&checks.length>0&&checks.every(check=>check.complete);
    validation.deliverables.push({deliverableId:deliverable.id,title:deliverable.title,format:deliverable.format||'',status:complete?'complete':'incomplete',milestones:checks});
    checks.forEach(check=>{const activeMilestone=(current.milestones||[]).find(item=>item.id===check.milestone.id);(activeMilestone?current.tasks||[]:[]).filter(task=>task.milestoneId===check.milestone.id&&msTaskState(plan,task)!=='done').forEach(task=>validation.incompleteTasks.push({taskId:task.id,title:task.title,deliverableId:deliverable.id,milestoneId:check.milestone.id}));
      (check.milestone.checkpoints||[]).forEach(checkpoint=>validation.checkpoints.push({milestoneId:check.milestone.id,deliverableId:deliverable.id,title:checkpoint.focus||checkpoint.title||'검증 기준',criteria:checkpoint.criteria||[],complete:check.complete}));
    });
  });
  (baseline.requirements||[]).forEach(requirement=>validation.requirements.push({requirementId:requirement.id,title:requirement.title,acceptanceCriteria:requirement.acceptanceCriteria||[],status:msValidationStatus(plan,'requirements',requirement.id),relatedDeliverableIds:requirement.relatedDeliverableIds||[]}));
  (baseline.rubrics||[]).forEach(rubric=>{
    const related=new Set(rubric.relatedDeliverableIds||[]),checkpoints=validation.checkpoints.filter(checkpoint=>related.has(checkpoint.deliverableId));
    validation.rubrics.push({rubricId:rubric.id,title:rubric.title,weight:rubric.weight||null,status:msValidationStatus(plan,'rubrics',rubric.id),checkpointsComplete:checkpoints.every(checkpoint=>checkpoint.complete),checkpointCount:checkpoints.length});
  });
  const hasIncomplete=validation.deliverables.some(item=>item.status==='incomplete')||validation.incompleteTasks.length>0||validation.checkpoints.some(item=>!item.complete);
  const hasUnmet=[...validation.requirements,...validation.rubrics].some(item=>item.status==='unmet');
  const hasReview=[...validation.requirements,...validation.rubrics].some(item=>item.status==='review');
  if(!hasIncomplete&&!hasUnmet&&!hasReview){validation.ready=true;validation.state='ready';validation.message='제출 또는 종료 준비가 완료되었습니다.';}
  else if(!hasIncomplete&&!hasUnmet&&hasReview){validation.state='review-needed';validation.message='자동 완료 조건은 충족했지만 최종 확인이 필요합니다.';}
  else validation.message='미완료 Deliverable, Task, Checkpoint 또는 미충족 기준이 남아 있습니다.';
  return validation;
}
function msBuildClubValidation(plan){
  const baseline=plan&&plan.baseline&&plan.baseline.snapshot,current=msPlanSnapshot(plan);
  if(!plan||!baseline||!current) return {threads:[]};
  const threads=(baseline.agendaThreads||[]).map(baseThread=>{
    const active=(current.agendaThreads||[]).find(thread=>thread.id===baseThread.id);
    if(baseThread.mode==='decision') return {threadId:baseThread.id,title:baseThread.title,mode:'decision',status:active?msDecisionStatus(plan,active):msNormalizeDecisionStatus(baseThread.status)};
    const milestones=(baseThread.milestones||[]).map(milestone=>({milestone,...msMilestoneValidation(plan,{milestones:active?active.milestones:[],tasks:active?active.tasks:[]},milestone)}));
    const completed=!!active&&milestones.length>0&&milestones.every(item=>item.complete);
    return {threadId:baseThread.id,title:baseThread.title,mode:'delivery',status:completed?'completed':'incomplete',milestones};
  });
  return {threads};
}
function msValidationButtons(kind,id,status){
  const labels={met:'충족',unmet:'미충족',review:'확인 필요'};
  return `<div style="display:flex;gap:5px;margin-top:6px;">${Object.keys(labels).map(next=>`<button class="btn-ghost" type="button" style="padding:3px 6px;font-size:10px;${status===next?'border-color:var(--pk);color:var(--pk);font-weight:700;':''}" onclick="msSetValidationStatus('${kind}','${id}','${next}')">${labels[next]}</button>`).join('')}</div>`;
}
function msValidationHTML(plan){
  if(plan.pendingReplan) return `<details class="panel" style="margin-top:16px;"><summary style="cursor:pointer;font-weight:700;">✅ 최종 검수 · 재계획 확인 필요</summary><p style="font-size:13px;color:var(--muted);margin:12px 0 0;">재계획 초안을 먼저 승인하거나 취소해주세요.</p></details>`;
  if(plan.track==='club'){
    const validation=msBuildClubValidation(plan),decisionLabels={undecided:'미결',decided:'결정됨',deferred:'보류'};
    return `<details class="panel" style="margin-top:16px;"><summary style="cursor:pointer;font-weight:700;">✅ Thread 종료 점검 · 펼쳐보기</summary><div style="margin-top:12px;">${validation.threads.map(thread=>thread.mode==='decision'?`<div class="mini-task"><div class="mt-name">${thread.title}<div style="font-size:12px;color:var(--muted);">의사결정형 · ${decisionLabels[thread.status]}</div></div></div>`:`<div class="mini-task"><div class="mt-name">${thread.title}<div style="font-size:12px;color:var(--muted);">${thread.status==='completed'?'모든 필수 Milestone/Task 완료':'미완료 Milestone 또는 Task 존재'}</div></div><span class="bdg ${thread.status==='completed'?'b-person':'b-nodl'}">${thread.status==='completed'?'종료 가능':'진행 중'}</span></div>`).join('')||'<div style="font-size:13px;color:var(--muted);">종료 점검할 Thread가 없어요.</div>'}</div></details>`;
  }
  const validation=msBuildValidation(plan),stateLabel={ready:'준비 완료', 'review-needed':'최종 확인 필요','not-ready':'준비 미완료'}[validation.state],deliverableRows=validation.deliverables.map(item=>`<div class="mini-task"><div class="mt-name">${item.title}${item.format?` · ${item.format}`:''}<div style="font-size:11px;color:var(--muted);">${item.milestones.map(milestone=>`${milestone.milestone.title} ${milestone.doneTasks}/${milestone.totalTasks}`).join(' · ')}</div></div><span class="bdg ${item.status==='complete'?'b-person':'b-nodl'}">${item.status==='complete'?'완료':'미완료'}</span></div>`).join('');
  const criteria=(title,kind,items)=>`<div class="panel" style="margin-top:12px;"><div class="panel-ttl">${title}</div>${items.map(item=>`<div class="mini-task"><div class="mt-name">${item.title}${item.weight?` (${item.weight}%)`:''}${item.acceptanceCriteria&&item.acceptanceCriteria.length?`<div style="font-size:11px;color:var(--muted);">${item.acceptanceCriteria.join(' · ')}</div>`:''}${kind==='rubrics'&&item.checkpointCount?`<div style="font-size:11px;color:${item.checkpointsComplete?'var(--muted)':'var(--amber)'};">Checkpoint ${item.checkpointsComplete?'완료':'미완료'}</div>`:''}${msValidationButtons(kind,item.requirementId||item.rubricId,item.status)}</div><span class="bdg ${item.status==='met'?'b-person':item.status==='unmet'?'b-dl':'b-nodl'}">${item.status==='met'?'충족':item.status==='unmet'?'미충족':'확인 필요'}</span></div>`).join('')||'<div style="font-size:13px;color:var(--muted);">기준이 없어요.</div>'}</div>`;
  const contestCheckpoint=plan.track==='contest'&&validation.checkpoints.length?`<div class="panel" style="margin-top:12px;"><div class="panel-ttl">🔎 Checkpoint</div>${validation.checkpoints.map(checkpoint=>`<div class="mini-task"><div class="mt-name">${checkpoint.title}<div style="font-size:11px;color:var(--muted);">${checkpoint.criteria.join(' · ')}</div></div><span class="bdg ${checkpoint.complete?'b-person':'b-nodl'}">${checkpoint.complete?'완료':'미완료'}</span></div>`).join('')}</div>`:'';
  return `<details class="panel" style="margin-top:16px;"><summary style="cursor:pointer;display:flex;justify-content:space-between;gap:10px;font-weight:700;"><span>✅ 최종 검수</span><span class="bdg ${validation.state==='ready'?'b-person':validation.state==='not-ready'?'b-dl':'b-nodl'}">${stateLabel}</span></summary><div style="margin-top:12px;font-size:13px;color:var(--muted);">${validation.message}</div><div class="m-lbl" style="margin:12px 0 6px;">${plan.track==='contest'?'제출요건 검수':'필수 Deliverable'}</div>${deliverableRows}${validation.incompleteTasks.length?`<div class="m-lbl" style="margin:12px 0 6px;">미완료 Task</div>${validation.incompleteTasks.map(task=>`<div class="mini-task"><div class="mt-name">${task.title}</div></div>`).join('')}`:''}${criteria('Requirement','requirements',validation.requirements)}${criteria(plan.track==='contest'?'심사기준 검수':'Rubric','rubrics',validation.rubrics)}${contestCheckpoint}</details>`;
}
let msOpenMilestoneIds=new Set(),msEditingTaskId=null,msEditingMilestoneId=null,msSelectedMilestoneId=null,msSelectedTaskId=null;
let msDraggedMilestoneId=null,msMilestoneDropTargetId=null,msMilestoneDropPosition='before',msDraggedTaskId=null,msTaskDropTargetId=null,msTaskDropPosition='before';
function msRememberMilestoneOpen(id,open){if(open)msOpenMilestoneIds.add(id);else msOpenMilestoneIds.delete(id);}
function msDots(){return '<i style="width:3px;height:3px;border-radius:50%;background:var(--muted);display:block;"></i>'.repeat(6);}
function msUpdateSelectionChrome(){
  document.querySelectorAll('[data-ms-live]').forEach(card=>{const selected=card.dataset.msLive===msSelectedMilestoneId,handle=card.querySelector('[data-ms-handle]');card.style.borderColor=selected?'var(--pk)':'transparent';if(handle)handle.style.opacity=selected?'1':'0';});
  document.querySelectorAll('[data-ms-task]').forEach(row=>{row.style.borderColor=row.dataset.msTask===msSelectedTaskId?'var(--pk)':'transparent';});
}
function msSelectMilestone(id){msSelectedMilestoneId=id;msSelectedTaskId=null;msUpdateSelectionChrome();}
function msSelectTask(id,milestoneId){msSelectedTaskId=id;msSelectedMilestoneId=milestoneId;msUpdateSelectionChrome();}
function msShowMilestoneHandle(id){const card=document.querySelector(`[data-ms-live="${id}"]`),handle=card&&card.querySelector('[data-ms-handle]');if(handle)handle.style.opacity='1';}
function msHideMilestoneHandle(id){if(id===msSelectedMilestoneId||id===msDraggedMilestoneId)return;const card=document.querySelector(`[data-ms-live="${id}"]`),handle=card&&card.querySelector('[data-ms-handle]');if(handle)handle.style.opacity='0';}
function msShowTaskHandle(id){const row=document.querySelector(`[data-ms-task="${id}"]`),handle=row&&row.querySelector('[data-ms-task-handle]');if(handle)handle.style.opacity='1';}
function msHideTaskHandle(id){if(id===msSelectedTaskId||id===msDraggedTaskId)return;const row=document.querySelector(`[data-ms-task="${id}"]`),handle=row&&row.querySelector('[data-ms-task-handle]');if(handle)handle.style.opacity='0';}
function msFindMilestoneList(plan,id){const snap=msPlanSnapshot(plan);if(!snap)return null;if(plan.track==='club')for(const thread of snap.agendaThreads||[]){const index=(thread.milestones||[]).findIndex(item=>item.id===id);if(index>=0)return {list:thread.milestones,index,thread};}const index=(snap.milestones||[]).findIndex(item=>item.id===id);return index>=0?{list:snap.milestones,index,thread:null}:null;}
function msClearMilestoneGaps(){document.querySelectorAll('[data-ms-live]').forEach(card=>{card.style.marginTop='2px';card.style.marginBottom='2px';});}
function msMilestoneDragStart(event,id){event.stopPropagation();msDraggedMilestoneId=id;msSelectMilestone(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}
function msMilestoneDragEnd(){msDraggedMilestoneId=null;msMilestoneDropTargetId=null;msMilestoneDropPosition='before';msClearMilestoneGaps();msUpdateSelectionChrome();}
function msMilestoneListDragOver(event){if(!msDraggedMilestoneId)return;event.preventDefault();event.dataTransfer.dropEffect='move';const cards=[...event.currentTarget.querySelectorAll(':scope > [data-ms-live]')].filter(card=>card.dataset.msLive!==msDraggedMilestoneId);if(!cards.length)return;let target=cards.find(card=>event.clientY<card.getBoundingClientRect().top+card.getBoundingClientRect().height/2),position='before';if(!target){target=cards[cards.length-1];position='after';}msClearMilestoneGaps();msMilestoneDropTargetId=target.dataset.msLive;msMilestoneDropPosition=position;target.style.marginTop=position==='before'?'22px':'2px';target.style.marginBottom=position==='after'?'22px':'2px';}
function msMilestoneListDrop(event){event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,sourceId=msDraggedMilestoneId||event.dataTransfer.getData('text/plain'),targetId=msMilestoneDropTargetId,position=msMilestoneDropPosition;msMilestoneDragEnd();if(!plan||!sourceId||!targetId||sourceId===targetId)return;const source=msFindMilestoneList(plan,sourceId),target=msFindMilestoneList(plan,targetId);if(!source||!target||source.list!==target.list)return;const[item]=source.list.splice(source.index,1),targetIndex=source.list.findIndex(entry=>entry.id===targetId);source.list.splice(targetIndex+(position==='after'?1:0),0,item);plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msClearTaskGaps(){document.querySelectorAll('[data-ms-task]').forEach(row=>{row.style.marginTop='1px';row.style.marginBottom='1px';row.style.borderColor=row.dataset.msTask===msSelectedTaskId?'var(--pk)':'transparent';});}
function msTaskDragStart(event,id,milestoneId){event.stopPropagation();msDraggedTaskId=id;msSelectTask(id,milestoneId);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}
function msTaskDragEnd(){msDraggedTaskId=null;msTaskDropTargetId=null;msTaskDropPosition='before';msClearTaskGaps();}
function msTaskListDragOver(event){if(!msDraggedTaskId)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';const rows=[...event.currentTarget.querySelectorAll(':scope > [data-ms-task]')].filter(row=>row.dataset.msTask!==msDraggedTaskId);if(!rows.length)return;let target=rows.find(row=>event.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2),position='before';if(!target){target=rows[rows.length-1];position='after';}msClearTaskGaps();msTaskDropTargetId=target.dataset.msTask;msTaskDropPosition=position;target.style.marginTop=position==='before'?'18px':'1px';target.style.marginBottom=position==='after'?'18px':'1px';}
function msTaskListDrop(event,milestoneId){event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,sourceId=msDraggedTaskId||event.dataTransfer.getData('text/plain'),targetId=msTaskDropTargetId,position=msTaskDropPosition;msTaskDragEnd();if(!plan||!sourceId||!targetId||sourceId===targetId)return;const source=msFindTask(plan,sourceId),target=msFindTask(plan,targetId);if(!source||!target||source.tasks!==target.tasks||source.task.milestoneId!==milestoneId||target.task.milestoneId!==milestoneId)return;const[item]=source.tasks.splice(source.index,1),targetIndex=source.tasks.findIndex(task=>task.id===targetId);source.tasks.splice(targetIndex+(position==='after'?1:0),0,item);msOpenMilestoneIds.add(milestoneId);plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msApplyAssigneePolicy(plan){
  if(!plan||plan.assigneePolicyVersion===1)return;
  const snap=msPlanSnapshot(plan),tasks=[...(snap&&snap.tasks||[]),...(snap&&snap.agendaThreads||[]).flatMap(thread=>thread.tasks||[])];
  tasks.forEach(task=>{if(task.assignee){task.assignee=null;task.assigneeSource='legacy-ai';}});plan.assigneePolicyVersion=1;
}
function msFindTask(plan,id){const snap=msPlanSnapshot(plan);if(!snap)return null;const groups=[snap.tasks||[],...(snap.agendaThreads||[]).map(thread=>thread.tasks||[])];for(const tasks of groups){const index=tasks.findIndex(task=>task.id===id);if(index>=0)return {tasks,index,task:tasks[index]};}return null;}
function msStartTaskEdit(id){const plan=currentProject&&currentProject.milestonePlan,found=msFindTask(plan,id);if(!found)return;msEditingTaskId=id;msOpenMilestoneIds.add(found.task.milestoneId);renderMilestones();}
function msSaveTaskEdit(id){const plan=currentProject&&currentProject.milestonePlan,found=msFindTask(plan,id);if(!plan||!found)return;const value=key=>(document.getElementById(`ms-task-${key}-${id}`)?.value||'').trim();const title=value('title');if(!title){toast('업무 이름을 입력해주세요.','error');return;}found.task.title=title;found.task.assignee=value('assignee')||null;found.task.assigneeSource=found.task.assignee?'user':null;found.task.dueDate=value('due')||null;plan.updatedAt=new Date().toISOString();msEditingTaskId=null;msOpenMilestoneIds.add(found.task.milestoneId);persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msDeleteTask(id){const plan=currentProject&&currentProject.milestonePlan,found=msFindTask(plan,id);if(!plan||!found||!confirm('이 세부 업무를 삭제할까요?'))return;const milestoneId=found.task.milestoneId,milestone=msFindMilestone(plan,milestoneId);found.tasks.splice(found.index,1);if(milestone)milestone.milestone.taskIds=(milestone.milestone.taskIds||[]).filter(taskId=>taskId!==id);if(plan.current&&plan.current.taskState)delete plan.current.taskState[id];plan.updatedAt=new Date().toISOString();msOpenMilestoneIds.add(milestoneId);persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msAddTask(milestoneId){const plan=currentProject&&currentProject.milestonePlan,found=msFindMilestone(plan,milestoneId);if(!plan||!found)return;const id=typeof onboardPlanId==='function'?onboardPlanId('task'):`ms_task_${Date.now()}`,task={id,milestoneId,title:'새 세부 업무',assignee:null,dueDate:null,status:'todo',definitionOfDone:'세부 업무 완료',needsDecomposition:false};found.tasks.push(task);found.milestone.taskIds=found.milestone.taskIds||[];found.milestone.taskIds.push(id);plan.updatedAt=new Date().toISOString();msEditingTaskId=id;msOpenMilestoneIds.add(milestoneId);persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msAddMilestone(threadId=null){const plan=currentProject&&currentProject.milestonePlan,snap=msPlanSnapshot(plan);if(!plan||!snap)return;const id=typeof onboardPlanId==='function'?onboardPlanId('milestone'):`ms_milestone_${Date.now()}`,milestone={id,title:'새 마일스톤',kind:'work',dueDate:null,taskIds:[],checkpoints:[],recommendations:[]};if(plan.track==='club'){const thread=(snap.agendaThreads||[]).find(item=>item.id===threadId&&item.mode==='delivery')||(snap.agendaThreads||[]).find(item=>item.mode==='delivery');if(!thread){toast('추가할 delivery Thread가 없어요.','info');return;}milestone.dueDate=thread.targetDate||null;thread.milestones=thread.milestones||[];thread.milestones.push(milestone);}else{const deliverable=(snap.deliverables||[])[0];if(!deliverable){toast('마일스톤을 연결할 제출물이 없어요.','info');return;}milestone.deliverableId=deliverable.id;snap.milestones=snap.milestones||[];snap.milestones.push(milestone);deliverable.milestoneIds=deliverable.milestoneIds||[];deliverable.milestoneIds.push(id);}msEditingMilestoneId=id;msSelectedMilestoneId=id;msOpenMilestoneIds.add(id);plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msStartMilestoneEdit(id){msEditingMilestoneId=id;msOpenMilestoneIds.add(id);renderMilestones();}
function msSaveMilestoneEdit(id){const plan=currentProject&&currentProject.milestonePlan,found=msFindMilestone(plan,id);if(!plan||!found)return;const title=(document.getElementById(`ms-milestone-title-${id}`)?.value||'').trim(),due=document.getElementById(`ms-milestone-due-${id}`)?.value||null;if(!title){toast('마일스톤 이름을 입력해주세요.','error');return;}found.milestone.title=title;found.milestone.dueDate=due;plan.updatedAt=new Date().toISOString();msEditingMilestoneId=null;msOpenMilestoneIds.add(id);persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msDeleteMilestone(id){const plan=currentProject&&currentProject.milestonePlan,snap=msPlanSnapshot(plan),found=msFindMilestone(plan,id);if(!plan||!snap||!found||!confirm('마일스톤과 안의 세부 업무를 삭제할까요?'))return;if(found.thread)found.thread.milestones=(found.thread.milestones||[]).filter(item=>item.id!==id);else snap.milestones=(snap.milestones||[]).filter(item=>item.id!==id);const removed=new Set(found.tasks.filter(task=>task.milestoneId===id).map(task=>task.id));if(found.thread)found.thread.tasks=(found.thread.tasks||[]).filter(task=>task.milestoneId!==id);else snap.tasks=(snap.tasks||[]).filter(task=>task.milestoneId!==id);if(plan.current&&plan.current.taskState)removed.forEach(taskId=>delete plan.current.taskState[taskId]);plan.updatedAt=new Date().toISOString();msOpenMilestoneIds.delete(id);persistCurrentProject({milestonePlan:plan});renderMilestones();}
function msTaskHTML(plan,task,index){
  const status=msTaskState(plan,task),risk=msTaskRisk(task,status),editing=msEditingTaskId===task.id;
  const warning=['지연','마감 임박'].includes(risk)?`<span class="bdg ${risk==='지연'?'b-dl':'b-nodl'}">${risk}</span>`:'';
  const shell=(body)=>`<div class="mini-task" data-ms-task="${task.id}" onclick="msSelectTask('${task.id}','${task.milestoneId}')" onmouseenter="msShowTaskHandle('${task.id}')" onmouseleave="msHideTaskHandle('${task.id}')" style="position:relative;align-items:flex-start;gap:9px;border:1px solid ${msSelectedTaskId===task.id?'var(--pk)':'transparent'};border-radius:6px;padding:7px 6px;margin:1px 0;transition:margin .14s,border-color .12s;"><button type="button" draggable="true" data-ms-task-handle ondragstart="msTaskDragStart(event,'${task.id}','${task.milestoneId}')" ondragend="msTaskDragEnd()" onclick="event.preventDefault();event.stopPropagation()" style="position:absolute;left:-25px;top:5px;width:22px;height:24px;padding:5px;border:0;border-radius:4px;background:transparent;opacity:${msSelectedTaskId===task.id?'1':'0'};cursor:grab;display:grid;grid-template-columns:repeat(2,3px);grid-template-rows:repeat(3,3px);gap:2px;align-content:center;justify-content:center;transition:opacity .1s;" title="끌어서 순서 변경">${msDots()}</button><span style="width:22px;height:22px;border-radius:50%;border:1px solid var(--bd-s);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${index+1}</span>${body}</div>`;
  if(editing)return shell(`<div style="flex:1;"><input class="m-inp" id="ms-task-title-${task.id}" value="${task.title}" placeholder="업무 이름" style="margin-bottom:6px;"><div style="display:flex;gap:6px;"><input class="m-inp" id="ms-task-assignee-${task.id}" value="${task.assignee||''}" placeholder="담당자 미정" style="margin:0;"><input class="m-inp" id="ms-task-due-${task.id}" type="date" value="${task.dueDate||''}" style="margin:0;"></div></div><button class="btn-pk" type="button" onclick="event.stopPropagation();msSaveTaskEdit('${task.id}')">저장</button><button class="btn-ghost" type="button" onclick="event.stopPropagation();msEditingTaskId=null;renderMilestones()">취소</button>`);
  return shell(`<button class="st-bdg ${ST.cls[status]}" style="border:0;cursor:pointer;" onclick="event.stopPropagation();msCycleTaskStatus('${task.id}')">${ST.ico[status]} ${ST.lbl[status]}</button><div style="flex:1;"><div class="mt-name">${task.title}</div><div style="font-size:12px;color:var(--muted);">${task.assignee?'👤 '+task.assignee:'👤 담당자 미정'}${task.dueDate?' · 📅 '+task.dueDate:''}</div></div>${warning}<button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="event.stopPropagation();msStartTaskEdit('${task.id}')">수정</button><button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="event.stopPropagation();msDeleteTask('${task.id}')">삭제</button>`);
}
function msMilestoneDetailsHTML(plan,milestone,tasks,inspection,thread=null,index=0){
  const done=tasks.filter(task=>msTaskState(plan,task)==='done').length,editing=msEditingMilestoneId===milestone.id,open=msOpenMilestoneIds.has(milestone.id)?' open':'';
  const settings=editing?`<div style="display:flex;gap:7px;align-items:center;margin-bottom:10px;"><input class="m-inp" id="ms-milestone-title-${milestone.id}" value="${milestone.title}" style="margin:0;flex:1;"><input class="m-inp" id="ms-milestone-due-${milestone.id}" type="date" value="${milestone.dueDate||''}" style="margin:0;width:160px;"><button class="btn-pk" type="button" onclick="msSaveMilestoneEdit('${milestone.id}')">저장</button><button class="btn-ghost" type="button" onclick="msEditingMilestoneId=null;renderMilestones()">취소</button></div>`:`<div style="display:flex;gap:6px;margin-bottom:10px;"><button class="btn-ghost" type="button" onclick="msStartMilestoneEdit('${milestone.id}')">마일스톤 수정</button><button class="btn-ghost" type="button" onclick="msDeleteMilestone('${milestone.id}')">삭제</button><button class="btn-ghost" type="button" onclick="msAddTask('${milestone.id}')">＋ 세부 업무 추가</button></div>`;
  return `<details data-ms-live="${milestone.id}"${open} ontoggle="msRememberMilestoneOpen('${milestone.id}',this.open)" onmouseenter="msShowMilestoneHandle('${milestone.id}')" onmouseleave="msHideMilestoneHandle('${milestone.id}')" style="position:relative;background:var(--surface);border:1px solid ${msSelectedMilestoneId===milestone.id?'var(--pk)':'transparent'};border-radius:7px;padding:9px 10px;margin:2px 0;box-shadow:none;transition:border-color .12s,margin .14s;"><button type="button" draggable="true" data-ms-handle onmousedown="msSelectMilestone('${milestone.id}')" ondragstart="msMilestoneDragStart(event,'${milestone.id}')" ondragend="msMilestoneDragEnd()" onclick="event.preventDefault();event.stopPropagation();msSelectMilestone('${milestone.id}')" style="position:absolute;left:-32px;top:8px;width:24px;height:26px;padding:5px;border:0;border-radius:5px;background:transparent;opacity:${msSelectedMilestoneId===milestone.id?'1':'0'};cursor:grab;display:grid;grid-template-columns:repeat(2,3px);grid-template-rows:repeat(3,3px);gap:2px;align-content:center;justify-content:center;transition:opacity .1s,background .1s;" title="끌어서 순서 변경">${msDots()}</button><summary onclick="msSelectMilestone('${milestone.id}')" style="display:flex;align-items:center;gap:9px;cursor:pointer;list-style:none;min-height:30px;"><span style="width:22px;color:var(--hint);font-size:11px;font-weight:700;">${String(index+1).padStart(2,'0')}</span><b style="flex:1;">${milestone.title}</b><span style="font-size:11px;color:var(--hint);">${done}/${tasks.length} 완료${milestone.dueDate?' · '+milestone.dueDate:''}</span></summary><div style="padding:10px 0 2px 30px;">${settings}<div data-ms-task-list="${milestone.id}" ondragover="msTaskListDragOver(event)" ondrop="msTaskListDrop(event,'${milestone.id}')">${tasks.length?tasks.map((task,taskIndex)=>msTaskHTML(plan,task,taskIndex)).join(''):'<div style="font-size:13px;color:var(--muted);padding:8px 0;">아직 세부 업무가 없어요.</div>'}</div><div style="margin-top:12px;border-top:1px solid var(--bd);padding-top:10px;"><div style="font-size:12px;font-weight:700;color:var(--muted);">변경 / 재계획</div>${msReplanControlsHTML(plan,inspection,thread&&thread.id||null)}${(plan.changeLog||[]).length?`<div style="font-size:12px;color:var(--muted);margin-top:8px;">계획 변경 ${(plan.changeLog||[]).length}회</div>`:''}</div></div></details>`;
}
function msProjectFinishHTML(){return `<div class="panel" style="margin-top:16px;display:flex;align-items:center;justify-content:space-between;gap:12px;"><div><div class="panel-ttl">프로젝트를 마무리할 때</div><div style="font-size:12px;color:var(--muted);">종료 후 회고·아카이브 단계로 이동합니다.</div></div><button class="btn-ghost" type="button" onclick="openWrapup()">프로젝트 종료</button></div>`;}
function msPlanHTML(plan,snap){
  const all=snap.tasks||[],done=all.filter(t=>msTaskState(plan,t)==='done').length,rate=all.length?Math.round(done/all.length*100):0;
  const inspection=msBuildInspection(plan,history);
  const milestones=(snap.milestones||[]).map((milestone,index)=>msMilestoneDetailsHTML(plan,milestone,(snap.tasks||[]).filter(task=>task.milestoneId===milestone.id),inspection,null,index)).join('');
  return `<div class="m-card" style="margin-bottom:16px;"><div class="m-lbl">전체 진행률</div><div class="m-val" style="color:var(--pk);">${rate}%</div><div class="prog-wrap"><div class="prog-fill" style="width:${rate}%"></div></div><div class="m-sub">${all.length?`완료 ${done} / 전체 ${all.length}`:'세부 업무를 추가해 시작하세요.'}</div></div><div class="panel" style="padding-left:46px;"><div class="panel-ttl">🧭 전체 마일스톤</div><div data-ms-list ondragover="msMilestoneListDragOver(event)" ondrop="msMilestoneListDrop(event)">${milestones||'<div style="font-size:13px;color:var(--muted);">마일스톤이 없어요.</div>'}</div><button class="btn-ghost" type="button" style="margin-top:8px;border-color:transparent;" onclick="msAddMilestone()">＋ 마일스톤 추가</button></div>`+agendaPanelHTML(snap)+msProjectFinishHTML();
}
const _renderMilestones=renderMilestones;
renderMilestones=function(){
  const plan=currentProject&&currentProject.milestonePlan,snap=msPlanSnapshot(plan);
  if(snap&&currentProject){ const wrap=document.getElementById('milestones-wrap');if(!wrap)return;msApplyAssigneePolicy(plan);if(plan.status==='draft'){wrap.innerHTML=`<div class="panel"><div class="empty"><div class="e-ico">✨</div><h3>추천 마일스톤을 확인해주세요</h3><p>AI가 큰 단계를 제안했어요. 이름·순서를 다듬고 시작할 수 있어요.</p><button class="btn-pk" type="button" style="margin-top:18px;" onclick="gp('onboard');setTimeout(renderOnboardResult,0)">추천 구조 확인하기</button></div></div>`;return;}wrap.innerHTML=currentProject.track==='club'?msClubPlanHTML(plan,snap):msPlanHTML(plan,snap);msUpdateSelectionChrome(); return; }
  _renderMilestones();
};
function msClubPlanHTML(plan,snap){
  const threads=Array.isArray(snap.agendaThreads)?snap.agendaThreads:[];
  const inspection=msBuildInspection(plan,history);
  return `<div class="panel"><div class="panel-ttl">🧵 Agenda Thread</div>${threads.map(th=>{
    if(th.mode==='decision'){
      const status=msDecisionStatus(plan,th),label={undecided:'미결',decided:'결정됨',deferred:'보류'}[status];
      const actions={undecided:[['decided','결정'],['deferred','보류']],deferred:[['decided','결정'],['undecided','미결로']],decided:[['undecided','미결로']]}[status];
      return `<div class="mini-task"><div class="mt-name">${th.title}<div style="font-size:12px;color:var(--muted);">운영/의사결정형 · ${label}</div><div style="display:flex;gap:6px;margin-top:7px;">${actions.map(([next,label])=>`<button class="btn-ghost" type="button" style="padding:4px 8px;font-size:11px;" onclick="msSetDecisionStatus('${th.id}','${next}')">${label}</button>`).join('')}</div></div></div>`;
    }
    const progress=msThreadProgress(plan,th);
    return `<div style="border-top:1px solid var(--bd);padding:12px 0 0 36px;margin-top:12px;"><div style="display:flex;justify-content:space-between;gap:10px;"><b>${th.title}</b><span style="font-size:12px;color:var(--muted);">${progress.total?`완료 ${progress.done}/${progress.total} · ${progress.rate}%`:'세부 업무 미정'}</span></div>${progress.total?`<div class="prog-wrap" style="margin:7px 0 10px;"><div class="prog-fill" style="width:${progress.rate}%"></div></div>`:''}<div data-ms-list ondragover="msMilestoneListDragOver(event)" ondrop="msMilestoneListDrop(event)">${(th.milestones||[]).map((m,index)=>msMilestoneDetailsHTML(plan,m,(th.tasks||[]).filter(t=>t.milestoneId===m.id),inspection,th,index)).join('')}</div><button class="btn-ghost" type="button" style="margin-top:8px;border-color:transparent;" onclick="msAddMilestone('${th.id}')">＋ 마일스톤 추가</button></div>`;
  }).join('')}</div>`+agendaPanelHTML(snap)+msProjectFinishHTML();
}
