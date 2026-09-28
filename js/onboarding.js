/* MeetFlow — 1단계 트랙별 온보딩 (문서 입력 → 마일스톤 생성)
   담당: ④ 마일스톤 (화면 모양은 ③ 디자인과 협의)*/

/* ──── 1단계: 트랙별 온보딩 ──── */
function skipOnboarding(){
  if(!currentProject) return;
  persistCurrentProject({onboardStatus:'skipped'});
  renderMilestones();
  toast('나중에 온보딩할 수 있어요. 대시보드 🧭 마일스톤 탭에서 다시 시작하세요.','info');
  gp('upload');
}
function renderOnboardPage(){
  if(!currentProject) return;
  const t=currentProject.track;
  document.getElementById('ob-title').textContent=`🚀 온보딩 — ${TRACK_LBL[t]}`;
  document.getElementById('ob-sub').textContent='아는 만큼만 입력해도 괜찮아요. 채워진 정보만으로 AI가 마일스톤을 설계해 드려요.';
  renderTrackSwitcher();
  ['team','contest','club'].forEach(k=>{ document.getElementById('ob-fields-'+k).style.display=(k===t)?'block':'none'; });
  document.getElementById('ob-fields-'+t).innerHTML=onboardFieldsHTML(t);
  const saved=currentProject.onboarding&&currentProject.onboarding.track===t?currentProject.onboarding.inputs:null;
  if(saved) onboardRestoreInputs(t,saved);
  document.getElementById('ob-actions').style.display='block';
  document.getElementById('ob-err').style.display='none';
  document.getElementById('ob-proc').classList.remove('show');
  document.getElementById('ob-result').classList.remove('show');
  document.getElementById('ob-result').innerHTML='';
  if(currentProject.milestonePlan&&currentProject.milestonePlan.status==='draft'){
    document.getElementById('ob-actions').style.display='none';
    renderOnboardResult();
  }
}
function onboardSetValue(id,value){const el=document.getElementById(id);if(el)el.value=value||'';}
function onboardRestoreInputs(t,inputs){
  if(t==='team'){
    onboardSetValue('team-name',inputs.name);onboardSetValue('team-brief-ta',inputs.requirements);onboardSetValue('team-deliverables-ta',inputs.deliverables);onboardSetValue('team-deadline',inputs.finalDeadline);onboardSetValue('team-mid-deadline',inputs.midDeadline);onboardSetValue('team-rubric-ta',inputs.rubric);onboardSetValue('team-members-ta',inputs.members);
    ['team-brief','team-deliverables','team-rubric','team-members'].forEach(updateDocCC);return;
  }
  if(t==='contest'){
    onboardSetValue('contest-name',inputs.name);onboardSetValue('contest-guidelines-ta',inputs.guidelines);onboardSetValue('contest-deliverables-ta',inputs.deliverables);onboardSetValue('contest-deadline',inputs.finalDeadline);onboardSetValue('contest-rubric-ta',inputs.rubric);onboardSetValue('contest-type',inputs.contestType);onboardSetValue('contest-members-ta',inputs.members);
    ['contest-guidelines','contest-deliverables','contest-rubric','contest-members'].forEach(updateDocCC);return;
  }
  const box=document.getElementById('club-thread-list'),threads=Array.isArray(inputs.threads)?inputs.threads:[];if(!box||!threads.length)return;
  box.innerHTML=threads.map((_,index)=>onboardClubThreadHTML(index)).join('');
  [...box.querySelectorAll('[data-thread]')].forEach((el,index)=>{const thread=threads[index]||{};el.querySelector('[data-f="title"]').value=thread.title||'';el.querySelector('[data-f="description"]').value=thread.description||'';el.querySelector('[data-f="agendaType"]').value=thread.agendaType||'new_event';el.querySelector('[data-f="targetDate"]').value=thread.targetDate||'';el.querySelector('[data-f="assignees"]').value=(thread.assignees||[]).join(', ');});
}
function renderTrackSwitcher(){
  const el=document.getElementById('ob-track-switch'); if(!el||!currentProject) return;
  el.innerHTML=['team','contest','club'].map(t=>{
    const on=currentProject.track===t;
    return `<button class="samp-btn" type="button" ${on?'style="background:var(--pk);color:#fff;border-color:var(--pk);"':''} onclick="changeProjectTrack('${t}')">${TRACK_LBL[t]}</button>`;
  }).join('');
}
function changeProjectTrack(t){
  if(!currentProject||currentProject.track===t) return;
  if(currentProject.onboarding&&!confirm('유형을 바꾸면 기존 온보딩 결과가 삭제돼요. 계속할까요?')) return;
  persistCurrentProject({track:t, onboarding:null, milestonePlan:null, onboardStatus:'pending'});
  renderProjectBadge();
  renderProjectsGallery();
  renderAll();
  renderOnboardPage();
  toast(`${TRACK_LBL[t]}(으)로 변경했어요.`,'success');
}

function docFieldHTML(id,label,placeholder,opts={}){
  const withPdf=opts.withPdf!==false;
  const rows=opts.rows||6;
  return `
    <div class="up-panel">
      <div class="up-panel-ttl">${label} <span style="color:var(--hint);font-weight:500;">${opts.optional?'(선택)':'(권장)'}</span></div>
      <textarea id="${id}-ta" class="textarea" rows="${rows}" placeholder="${placeholder}" oninput="updateDocCC('${id}')"></textarea>
      <div class="input-row">
        <span class="char-ct" id="${id}-ct">0자</span>
        ${withPdf?`
        <div class="sample-row">
          <button class="samp-btn" type="button" onclick="triggerPdfUpload('${id}')">📎 PDF 업로드</button>
          <input type="file" id="${id}-file" accept="application/pdf" style="display:none" onchange="handlePdfUpload(event,'${id}')">
          <span class="char-ct" id="${id}-fname"></span>
        </div>`:''}
      </div>
    </div>`;
}
function clubCadenceHTML(){
  const today=new Date().toISOString().split('T')[0];
  return `
    <div class="up-panel">
      <div class="up-panel-ttl">🗓️ 정기모임 주기 <span style="color:var(--hint);font-weight:500;">(권장)</span></div>
      <div class="g2" style="margin-bottom:0;">
        <div>
          <div class="m-lbl">요일</div>
          <select id="club-weekday" class="m-inp" style="margin-bottom:0;">
            <option value="1">매주 월요일</option>
            <option value="2" selected>매주 화요일</option>
            <option value="3">매주 수요일</option>
            <option value="4">매주 목요일</option>
            <option value="5">매주 금요일</option>
            <option value="6">매주 토요일</option>
            <option value="0">매주 일요일</option>
          </select>
        </div>
        <div>
          <div class="m-lbl">시작일</div>
          <input type="date" id="club-start" class="m-inp" style="margin-bottom:0;" value="${today}">
        </div>
      </div>
      <div style="margin-top:14px;max-width:200px;">
        <div class="m-lbl">학기 주차 수</div>
        <input type="number" id="club-weeks" class="m-inp" style="margin-bottom:0;" value="15" min="1" max="30">
      </div>
    </div>`;
}
/* 이전 저장 결과를 읽을 때의 참고용 UI 규격. 새 온보딩은 아래 MVP 1차 함수를 사용한다. */
function legacyOnboardFieldsHTML(t){
  if(t==='team') return [
    docFieldHTML('team-syllabus','📘 강의계획서','주차별 진도, 발표일, 제출 마감일이 담긴 강의계획서 내용을 붙여넣으세요.'),
    docFieldHTML('team-brief','📋 과제 안내문','과제 요구사항, 제출 형식, 평가 배점표가 있다면 함께 붙여넣으세요.'),
    docFieldHTML('team-members','👥 팀원 정보','예) 팀원 4명 — 홍길동(기획), 김영희(디자인), 이철수(개발), 박민준(발표)',{optional:true,withPdf:false,rows:3}),
  ].join('');
  if(t==='contest') return [
    docFieldHTML('contest-guidelines','📢 모집요강','자격요건, 제출서류, 마감일, 제출형식이 담긴 모집요강을 붙여넣으세요.'),
    docFieldHTML('contest-rubric','📊 심사기준','배점표(예: 창의성 30%, 실현가능성 30%, 발표력 20%, 완성도 20%)를 붙여넣으세요.'),
    docFieldHTML('contest-pastwinners','🏅 이전 수상작','참고할 이전 수상작 내용이 있다면 붙여넣으세요.',{optional:true}),
  ].join('');
  if(t==='club') return [
    docFieldHTML('club-history','📚 작년 기수 활동내역','작년에 진행한 행사/활동 목록을 붙여넣으세요. (MT, 정기공연, 전시회 등)'),
    docFieldHTML('club-goals','🎯 이번 학기 목표','이번 학기에 새로 계획하는 목표가 있다면 적어주세요.',{optional:true,withPdf:false,rows:3}),
    clubCadenceHTML(),
    docFieldHTML('club-budget','💰 예산 정보','항목별 예산이 있다면 적어주세요.',{optional:true,withPdf:false,rows:3}),
  ].join('');
  return '';
}
function updateDocCC(id){
  const ta=document.getElementById(id+'-ta'), ct=document.getElementById(id+'-ct');
  if(ta&&ct) ct.textContent=ta.value.length+'자';
}
function triggerPdfUpload(id){ document.getElementById(id+'-file').click(); }
async function handlePdfUpload(evt,id){
  const file=evt.target.files[0]; if(!file) return;
  const fname=document.getElementById(id+'-fname');
  fname.textContent='📄 추출 중...';
  try{
    const {text,pages}=await extractPdfText(file);
    document.getElementById(id+'-ta').value=text;
    updateDocCC(id);
    fname.textContent=`✅ ${pages}페이지 추출됨 (${file.name})`;
    toast('PDF 텍스트를 추출했어요!','success');
  }catch(e){
    fname.textContent='⚠️ 추출 실패';
    toast(e.message||'PDF 추출에 실패했어요. 직접 붙여넣어주세요.','error');
  }finally{
    evt.target.value='';
  }
}
async function extractPdfText(file){
  if(file.type!=='application/pdf'&&!/\.pdf$/i.test(file.name)){
    throw new Error('PDF 파일만 업로드할 수 있어요.');
  }
  const buf=await file.arrayBuffer();
  let pdf;
  try{ pdf=await pdfjsLib.getDocument({data:buf}).promise; }
  catch(e){ throw new Error('손상되었거나 지원되지 않는 PDF 파일이에요.'); }
  let text='';
  for(let p=1;p<=pdf.numPages;p++){
    const page=await pdf.getPage(p);
    const content=await page.getTextContent();
    text += content.items.map(it=>it.str).join(' ') + '\n\n';
  }
  text=text.trim();
  if(!text) throw new Error('PDF에서 텍스트를 찾을 수 없어요. (스캔 이미지 PDF는 지원되지 않아요)');
  return {text, pages:pdf.numPages};
}

function legacyCollectOnboardInputs(t){
  const val=id=>{ const el=document.getElementById(id); return el?el.value.trim():''; };
  if(t==='team') return { syllabus:val('team-syllabus-ta'), brief:val('team-brief-ta'), members:val('team-members-ta') };
  if(t==='contest') return { guidelines:val('contest-guidelines-ta'), rubric:val('contest-rubric-ta'), pastWinners:val('contest-pastwinners-ta') };
  if(t==='club') return {
    history:val('club-history-ta'), goals:val('club-goals-ta'),
    weekday:document.getElementById('club-weekday').value,
    startDate:document.getElementById('club-start').value,
    weeks:document.getElementById('club-weeks').value,
    budget:val('club-budget-ta')
  };
  return {};
}
/* 개별 항목은 모두 선택 사항 — 분석할 내용이 하나도 없을 때만 막는다 */
function legacyOnboardMissingField(t,inp){
  const texts = t==='club'
    ? [inp.history, inp.goals, inp.budget]
    : Object.values(inp);
  if(texts.every(v=>!v||!String(v).trim())){
    return '최소 한 가지 정보는 입력해주세요. 아직 자료가 없다면 "나중에 하기"를 눌러도 돼요.';
  }
  return null;
}
function showOnboardErr(msg){ document.getElementById('ob-err').style.display='flex'; document.getElementById('ob-err-msg').textContent=msg; }

async function runOnboarding(){
  if(!currentProject) return;
  const t=currentProject.track;
  const inputs=collectOnboardInputs(t);
  const missing=onboardMissingField(t,inputs);
  if(missing){ toast(missing,'error'); return; }

  document.getElementById('ob-actions').style.display='none';
  document.getElementById('ob-err').style.display='none';
  document.getElementById('ob-proc').classList.add('show');

  try{
    const result=await callGeminiOnboard(t,inputs);
    const milestonePlan=onboardMakePlan(t,inputs,result);
    persistCurrentProject({onboardStatus:'review', onboarding:{track:t, inputs, result, completedAt:new Date().toISOString()}, milestonePlan});
    /* 탭 전환(sdt)은 클래스만 바꾸고 다시 그리지 않는다. 여기서 마일스톤을 새로 그려두지 않으면
       대시보드로 갔을 때 "아직 온보딩을 완료하지 않았어요" 화면이 그대로 남는다.
       (skipOnboarding()은 원래부터 renderMilestones()를 부르고 있었다) */
    renderOnboardResult();
    toast('AI가 큰 마일스톤 흐름을 제안했어요. 확인해주세요.','success');
  }catch(e){
    showOnboardErr(e.message);
    document.getElementById('ob-actions').style.display='block';
  }finally{
    document.getElementById('ob-proc').classList.remove('show');
  }
}
function renderOnboardResult(){
  const el=document.getElementById('ob-result');
  el.classList.add('show');
  el.innerHTML=onboardMilestoneReviewHTML();
  onboardUpdateMilestoneChrome();
}

function onboardDraftMilestones(plan){
  const snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!snap) return [];
  if(plan.track==='club') return (snap.agendaThreads||[]).filter(thread=>thread.mode==='delivery').flatMap(thread=>(thread.milestones||[]).map(milestone=>({milestone,thread})));
  return (snap.milestones||[]).map(milestone=>({milestone,thread:null}));
}
function onboardDraftTasks(plan,milestone,thread){
  const snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!snap)return [];
  const tasks=thread?(thread.tasks||[]):(snap.tasks||[]);
  return tasks.filter(task=>task.milestoneId===milestone.id);
}
function onboardMilestoneReviewHTML(){
  const plan=currentProject&&currentProject.milestonePlan,rows=onboardDraftMilestones(plan);
  return `<div class="sum-banner"><div class="sum-ico">✨</div><div><div class="sum-lbl">AI가 마일스톤 흐름을 제안했어요</div><div class="sum-txt">큰 단계를 먼저 확인하고, 필요하면 펼쳐서 세부 업무를 확인하세요. 마우스를 올리면 왼쪽에 이동 핸들이 나타나요.</div></div></div>
    <div class="panel" style="margin-top:14px;padding-left:46px;" data-ob-list ondragover="onboardListDragOver(event)" ondrop="onboardListDrop(event)"><div class="panel-ttl">추천 마일스톤</div>${rows.map(({milestone,thread},index)=>{const tasks=onboardDraftTasks(plan,milestone,thread);return `<details style="position:relative;background:var(--surface);border:1px solid transparent;border-radius:7px;padding:9px 10px;margin:2px 0;box-shadow:none;transition:border-color .12s,margin .14s;" data-ob-ms="${milestone.id}" onmouseenter="onboardShowMilestoneHandle('${milestone.id}')" onmouseleave="onboardHideMilestoneHandle('${milestone.id}')"><button type="button" draggable="true" data-ob-handle onmousedown="onboardDragSelect('${milestone.id}')" ondragstart="onboardDragStart(event,'${milestone.id}')" ondragend="onboardDragEnd()" onclick="event.preventDefault();event.stopPropagation();onboardSelectMilestone('${milestone.id}')" onmouseenter="this.style.background='var(--pk-light)'" onmouseleave="this.style.background='transparent'" style="position:absolute;left:-32px;top:8px;width:24px;height:26px;padding:5px;border:0;border-radius:5px;background:transparent;opacity:0;cursor:grab;display:grid;grid-template-columns:repeat(2,3px);grid-template-rows:repeat(3,3px);gap:2px;align-content:center;justify-content:center;transition:opacity .1s,background .1s;" title="끌어서 순서 변경" aria-label="${milestone.title} 이동">${'<i style="width:3px;height:3px;border-radius:50%;background:var(--muted);display:block;"></i>'.repeat(6)}</button><summary onclick="onboardSelectMilestone('${milestone.id}')" style="display:flex;align-items:center;gap:9px;cursor:pointer;list-style:none;min-height:30px;"><span style="width:22px;color:var(--hint);font-size:11px;font-weight:700;">${String(index+1).padStart(2,'0')}</span><span class="mt-name" data-ob-title style="flex:1;font-weight:600;">${thread?`<span style="font-size:11px;color:var(--muted);">${thread.title}</span><br>`:''}${milestone.title}</span><span style="font-size:11px;color:var(--hint);">업무 ${tasks.length}</span><button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="onboardStartEdit(event,'${milestone.id}')">수정</button><button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="event.preventDefault();event.stopPropagation();onboardDeleteMilestone('${milestone.id}')">삭제</button></summary><div style="padding:10px 0 2px 30px;" data-ob-task-list="${milestone.id}" ondragover="onboardTaskListDragOver(event,'${milestone.id}')" ondrop="onboardTaskListDrop(event,'${milestone.id}')">${tasks.map((task,taskIndex)=>`<div class="mini-task" data-ob-task="${task.id}" onmouseenter="onboardShowTaskHandle('${task.id}')" onmouseleave="onboardHideTaskHandle('${task.id}')" style="position:relative;gap:10px;border:1px solid transparent;border-radius:6px;padding:7px 6px;margin:1px 0;transition:margin .14s,border-color .12s;"><button type="button" draggable="true" data-ob-task-handle ondragstart="onboardTaskDragStart(event,'${task.id}','${milestone.id}')" ondragend="onboardTaskDragEnd()" onclick="event.preventDefault();event.stopPropagation()" style="position:absolute;left:-25px;top:5px;width:22px;height:24px;padding:5px;border:0;border-radius:4px;background:transparent;opacity:0;cursor:grab;display:grid;grid-template-columns:repeat(2,3px);grid-template-rows:repeat(3,3px);gap:2px;align-content:center;justify-content:center;transition:opacity .1s;" title="끌어서 순서 변경" aria-label="${task.title} 이동">${'<i style="width:3px;height:3px;border-radius:50%;background:var(--muted);display:block;"></i>'.repeat(6)}</button><span style="width:22px;height:22px;border-radius:50%;border:1px solid var(--bd-s);color:var(--muted);display:inline-flex;align-items:center;justify-content:center;font-size:10px;font-weight:700;flex-shrink:0;">${taskIndex+1}</span><span class="mt-name" data-ob-task-title style="flex:1;">${task.title}</span><button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="onboardStartTaskEdit(event,'${task.id}')">수정</button><button class="btn-ghost" type="button" style="padding:4px 7px;border-color:transparent;" onclick="onboardDeleteTask(event,'${task.id}')">삭제</button></div>`).join('')||'<div style="font-size:12px;color:var(--muted);">세부 업무가 아직 없어요.</div>'}<button class="btn-ghost" type="button" style="margin-top:7px;border-color:transparent;" onclick="onboardAddTask(event,'${milestone.id}')">＋ 세부 업무 추가</button></div></details>`;}).join('')||'<div style="font-size:13px;color:var(--muted);">아직 제안된 delivery 마일스톤이 없어요.</div>'}<button class="btn-ghost" type="button" style="margin-top:10px;" onclick="onboardAddMilestone()">＋ 단계 추가</button></div>
    <div style="display:flex;gap:8px;margin-top:14px;"><button class="btn-pk" type="button" onclick="onboardApproveMilestones()">이 흐름으로 시작</button><button class="btn-ghost" type="button" onclick="runOnboarding()">AI 다시 추천</button></div>`;
}
function onboardFindDraftMilestone(plan,id){
  const snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!snap) return null;
  if(plan.track==='club') for(const thread of snap.agendaThreads||[]){const index=(thread.milestones||[]).findIndex(item=>item.id===id);if(index>=0)return {list:thread.milestones,index,thread};}
  const index=(snap.milestones||[]).findIndex(item=>item.id===id);return index>=0?{list:snap.milestones,index,thread:null}:null;
}
function onboardSaveDraft(plan,openMilestoneId){plan.updatedAt=new Date().toISOString();persistCurrentProject({milestonePlan:plan});renderOnboardResult();if(openMilestoneId){const card=document.querySelector(`[data-ob-ms="${openMilestoneId}"]`);if(card)card.open=true;}}
function onboardStartEdit(event,id){
  if(event){event.preventDefault();event.stopPropagation();}
  const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftMilestone(plan,id),card=document.querySelector(`[data-ob-ms="${id}"]`),host=card&&card.querySelector('[data-ob-title]');if(!found||!host)return;
  const input=document.createElement('input');input.className='m-inp';input.style.margin='0';input.value=found.list[found.index].title;
  const save=document.createElement('button');save.className='btn-pk';save.type='button';save.textContent='저장';save.style.padding='6px 10px';save.onclick=e=>{e.preventDefault();e.stopPropagation();onboardCommitEdit(id,input.value);};
  const cancel=document.createElement('button');cancel.className='btn-ghost';cancel.type='button';cancel.textContent='취소';cancel.style.padding='6px 10px';cancel.onclick=e=>{e.preventDefault();e.stopPropagation();renderOnboardResult();};
  host.replaceChildren(input,save,cancel);host.style.display='flex';host.style.gap='6px';input.focus();input.select();
  input.onkeydown=e=>{if(e.key==='Enter')save.click();if(e.key==='Escape')cancel.click();};
}
function onboardCommitEdit(id,title){const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftMilestone(plan,id),next=(title||'').trim();if(!found||!next)return;found.list[found.index].title=next;onboardSaveDraft(plan);}
function onboardFindDraftTask(plan,id){
  const snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!snap)return null;
  const groups=[{tasks:snap.tasks||[]}].concat((snap.agendaThreads||[]).map(thread=>({tasks:thread.tasks||[],thread})));
  for(const group of groups){const index=group.tasks.findIndex(task=>task.id===id);if(index>=0)return {tasks:group.tasks,index,task:group.tasks[index],thread:group.thread||null};}
  return null;
}
function onboardStartTaskEdit(event,id){
  event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftTask(plan,id),row=document.querySelector(`[data-ob-task="${id}"]`),host=row&&row.querySelector('[data-ob-task-title]');if(!found||!host)return;
  const input=document.createElement('input');input.className='m-inp';input.style.margin='0';input.value=found.task.title;
  const save=document.createElement('button');save.className='btn-pk';save.type='button';save.textContent='저장';save.style.padding='6px 10px';save.onclick=e=>{e.preventDefault();e.stopPropagation();onboardCommitTaskEdit(id,input.value);};
  const cancel=document.createElement('button');cancel.className='btn-ghost';cancel.type='button';cancel.textContent='취소';cancel.style.padding='6px 10px';cancel.onclick=e=>{e.preventDefault();e.stopPropagation();onboardSaveDraft(plan,found.task.milestoneId);};
  host.replaceChildren(input,save,cancel);host.style.display='flex';host.style.gap='6px';input.focus();input.select();input.onkeydown=e=>{if(e.key==='Enter')save.click();if(e.key==='Escape')cancel.click();};
}
function onboardCommitTaskEdit(id,title){const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftTask(plan,id),next=(title||'').trim();if(!found||!next)return;found.task.title=next;onboardSaveDraft(plan,found.task.milestoneId);}
function onboardDeleteTask(event,id){event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftTask(plan,id);if(!found||!confirm('이 세부 업무를 삭제할까요?'))return;const milestone=onboardFindDraftMilestone(plan,found.task.milestoneId);found.tasks.splice(found.index,1);if(milestone)milestone.list[milestone.index].taskIds=(milestone.list[milestone.index].taskIds||[]).filter(taskId=>taskId!==id);onboardSaveDraft(plan,found.task.milestoneId);}
function onboardAddTask(event,milestoneId){
  event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftMilestone(plan,milestoneId),snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!found||!snap)return;
  const tasks=found.thread?(found.thread.tasks||(found.thread.tasks=[])):(snap.tasks||(snap.tasks=[])),task={id:onboardPlanId('task'),milestoneId,title:'새 세부 업무',assignee:null,dueDate:found.list[found.index].dueDate||null,status:'todo',definitionOfDone:'세부 업무 완료',needsDecomposition:false};tasks.push(task);found.list[found.index].taskIds=found.list[found.index].taskIds||[];found.list[found.index].taskIds.push(task.id);onboardSaveDraft(plan,milestoneId);setTimeout(()=>onboardStartTaskEdit({preventDefault(){},stopPropagation(){}},task.id),0);
}
function onboardDeleteMilestone(id){const plan=currentProject&&currentProject.milestonePlan,found=onboardFindDraftMilestone(plan,id);if(!found||!confirm('이 단계를 삭제할까요?'))return;found.list.splice(found.index,1);onboardSaveDraft(plan);}
let onboardDraggedMilestoneId=null,onboardSelectedMilestoneId=null,onboardDropTargetId=null,onboardDropPosition='before';
function onboardUpdateMilestoneChrome(){document.querySelectorAll('[data-ob-ms]').forEach(card=>{const selected=card.dataset.obMs===onboardSelectedMilestoneId,handle=card.querySelector('[data-ob-handle]');card.style.borderColor=selected?'var(--pk)':'transparent';card.style.borderWidth='1px';if(handle)handle.style.opacity=selected?'1':'0';});}
function onboardSelectMilestone(id){onboardSelectedMilestoneId=id;onboardUpdateMilestoneChrome();}
function onboardShowMilestoneHandle(id){const card=document.querySelector(`[data-ob-ms="${id}"]`),handle=card&&card.querySelector('[data-ob-handle]');if(handle)handle.style.opacity='1';}
function onboardHideMilestoneHandle(id){if(id===onboardSelectedMilestoneId||id===onboardDraggedMilestoneId)return;const card=document.querySelector(`[data-ob-ms="${id}"]`),handle=card&&card.querySelector('[data-ob-handle]');if(handle)handle.style.opacity='0';}
function onboardDragSelect(id){onboardSelectedMilestoneId=id;onboardUpdateMilestoneChrome();}
function onboardDragStart(event,id){onboardDraggedMilestoneId=id;onboardDragSelect(id);event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}
function onboardClearDropGaps(){document.querySelectorAll('[data-ob-ms]').forEach(card=>{card.style.marginTop='2px';card.style.marginBottom='2px';delete card.dataset.dropPosition;});}
function onboardDragEnd(){onboardDraggedMilestoneId=null;onboardDropTargetId=null;onboardDropPosition='before';onboardClearDropGaps();onboardUpdateMilestoneChrome();}
function onboardListDragOver(event){
  if(!onboardDraggedMilestoneId)return;event.preventDefault();event.dataTransfer.dropEffect='move';const cards=[...event.currentTarget.querySelectorAll('[data-ob-ms]')].filter(card=>card.dataset.obMs!==onboardDraggedMilestoneId);if(!cards.length)return;
  let target=cards.find(card=>event.clientY<card.getBoundingClientRect().top+card.getBoundingClientRect().height/2),position='before';if(!target){target=cards[cards.length-1];position='after';}
  onboardClearDropGaps();onboardDropTargetId=target.dataset.obMs;onboardDropPosition=position;target.style.marginTop=position==='before'?'22px':'2px';target.style.marginBottom=position==='after'?'22px':'2px';
}
function onboardListDrop(event){
  event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,sourceId=onboardDraggedMilestoneId||event.dataTransfer.getData('text/plain'),targetId=onboardDropTargetId,position=onboardDropPosition;onboardDragEnd();if(!plan||!sourceId||!targetId||sourceId===targetId)return;
  const source=onboardFindDraftMilestone(plan,sourceId),target=onboardFindDraftMilestone(plan,targetId);if(!source||!target||source.list!==target.list)return;
  const [item]=source.list.splice(source.index,1),targetIndex=source.list.findIndex(entry=>entry.id===targetId);source.list.splice(targetIndex+(position==='after'?1:0),0,item);onboardSaveDraft(plan);
}
let onboardDraggedTaskId=null,onboardTaskDropTargetId=null,onboardTaskDropPosition='before';
function onboardShowTaskHandle(id){const row=document.querySelector(`[data-ob-task="${id}"]`),handle=row&&row.querySelector('[data-ob-task-handle]');if(handle)handle.style.opacity='1';}
function onboardHideTaskHandle(id){if(id===onboardDraggedTaskId)return;const row=document.querySelector(`[data-ob-task="${id}"]`),handle=row&&row.querySelector('[data-ob-task-handle]');if(handle)handle.style.opacity='0';}
function onboardTaskDragStart(event,id,milestoneId){event.stopPropagation();onboardDraggedTaskId=id;onboardSelectedMilestoneId=milestoneId;onboardUpdateMilestoneChrome();const row=document.querySelector(`[data-ob-task="${id}"]`);if(row)row.style.borderColor='var(--pk)';event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain',id);}
function onboardClearTaskDropGaps(){document.querySelectorAll('[data-ob-task]').forEach(row=>{row.style.marginTop='1px';row.style.marginBottom='1px';row.style.borderColor=row.dataset.obTask===onboardDraggedTaskId?'var(--pk)':'transparent';});}
function onboardTaskDragEnd(){onboardDraggedTaskId=null;onboardTaskDropTargetId=null;onboardTaskDropPosition='before';onboardClearTaskDropGaps();}
function onboardTaskListDragOver(event,milestoneId){
  if(!onboardDraggedTaskId)return;event.preventDefault();event.stopPropagation();event.dataTransfer.dropEffect='move';const rows=[...event.currentTarget.querySelectorAll('[data-ob-task]')].filter(row=>row.dataset.obTask!==onboardDraggedTaskId);if(!rows.length)return;
  let target=rows.find(row=>event.clientY<row.getBoundingClientRect().top+row.getBoundingClientRect().height/2),position='before';if(!target){target=rows[rows.length-1];position='after';}
  onboardClearTaskDropGaps();onboardTaskDropTargetId=target.dataset.obTask;onboardTaskDropPosition=position;target.style.marginTop=position==='before'?'18px':'1px';target.style.marginBottom=position==='after'?'18px':'1px';
}
function onboardTaskListDrop(event,milestoneId){
  event.preventDefault();event.stopPropagation();const plan=currentProject&&currentProject.milestonePlan,sourceId=onboardDraggedTaskId||event.dataTransfer.getData('text/plain'),targetId=onboardTaskDropTargetId,position=onboardTaskDropPosition;onboardTaskDragEnd();if(!plan||!sourceId||!targetId||sourceId===targetId)return;
  const source=onboardFindDraftTask(plan,sourceId),target=onboardFindDraftTask(plan,targetId);if(!source||!target||source.tasks!==target.tasks||source.task.milestoneId!==milestoneId||target.task.milestoneId!==milestoneId)return;
  const [item]=source.tasks.splice(source.index,1),targetIndex=source.tasks.findIndex(task=>task.id===targetId);source.tasks.splice(targetIndex+(position==='after'?1:0),0,item);onboardSaveDraft(plan,milestoneId);
}
function onboardAddMilestone(){
  const plan=currentProject&&currentProject.milestonePlan,snap=plan&&plan.baseline&&plan.baseline.snapshot;if(!snap)return;
  const milestone={id:onboardPlanId('milestone'),title:'새 마일스톤',kind:'work',dueDate:null,taskIds:[],checkpoints:[],recommendations:[]};
  if(plan.track==='club'){
    const deliveries=(snap.agendaThreads||[]).filter(thread=>thread.mode==='delivery');if(!deliveries.length){toast('delivery Thread가 있어야 단계를 추가할 수 있어요.','info');return;}
    const chosen=deliveries[0];chosen.milestones.push(milestone);
  }else{
    const deliverable=(snap.deliverables||[])[0];if(!deliverable)return;milestone.deliverableId=deliverable.id;snap.milestones.push(milestone);deliverable.milestoneIds=deliverable.milestoneIds||[];deliverable.milestoneIds.push(milestone.id);
  }
  onboardSaveDraft(plan);setTimeout(()=>onboardStartEdit(null,milestone.id),0);
}
function onboardApproveMilestones(){
  const plan=currentProject&&currentProject.milestonePlan;if(!plan||!onboardDraftMilestones(plan).length){toast('최소 한 개의 delivery 마일스톤이 필요해요.','error');return;}
  const now=new Date().toISOString();plan.status='active';plan.baseline.approvedAt=now;plan.current.source='baseline';plan.updatedAt=now;persistCurrentProject({onboardStatus:'done',milestonePlan:plan});renderMilestones();toast('마일스톤 흐름을 확정했어요.','success');gp('dash',{tab:'milestones'});
}

/* ──── 온보딩 전용 Gemini 프롬프트/스키마 ──── */
async function callGeminiOnboard(track,inputs){
  const today=new Date().toISOString().split('T')[0];
  return await geminiRequest(onboardPrompt(track,onboardCompactInputs(track,inputs),today), onboardSchema(track), 4096);
}
function onboardCompactText(value,limit){const text=String(value||'').replace(/\s+/g,' ').trim();if(text.length<=limit)return text;const half=Math.floor(limit/2);return text.slice(0,half)+' … '+text.slice(-half);}
function onboardCompactInputs(track,inputs){
  if(track==='team')return {...inputs,requirements:onboardCompactText(inputs.requirements,3500),deliverables:onboardCompactText(inputs.deliverables,1800),rubric:onboardCompactText(inputs.rubric,1200),members:onboardCompactText(inputs.members,500)};
  if(track==='contest')return {...inputs,guidelines:onboardCompactText(inputs.guidelines,3500),deliverables:onboardCompactText(inputs.deliverables,1800),rubric:onboardCompactText(inputs.rubric,1600),members:onboardCompactText(inputs.members,500)};
  return {...inputs,threads:(inputs.threads||[]).map(thread=>({...thread,description:onboardCompactText(thread.description,1200)}))};
}
function legacyOnboardPrompt(t,inputs,today){
  if(t==='team') return `당신은 팀 프로젝트 온보딩을 돕는 AI입니다. 아래 문서를 분석해서 마일스톤·역할·배점·1차 회의 아젠다를 JSON으로 설계하세요.

[강의계획서]
"""
${inputs.syllabus||'(제공되지 않음)'}
"""

[과제 안내문]
"""
${inputs.brief||'(제공되지 않음)'}
"""

[팀원 정보 (선택)]
"""
${inputs.members||'(제공되지 않음)'}
"""

규칙:
- 오늘 날짜는 ${today}입니다. 상대적 날짜 표현은 이 날짜 기준으로 YYYY-MM-DD로 변환하세요.
- "(제공되지 않음)"인 항목은 없는 것으로 보고, 주어진 정보만으로 최대한 유용한 결과를 만드세요. 근거가 없는 날짜는 지어내지 말고 null로 두세요.
- 강의계획서에 명시된 중간발표일·최종제출일 등 고정 날짜는 milestones에 그대로 반영하고 임의로 추정하지 마세요. 날짜를 알 수 없으면 dueDate는 null.
- 과제 안내문에서 요구되는 산출물(보고서·PPT·시연영상 등)을 deliverable에 구체적으로 적으세요.
- 평가 배점표가 있으면 rubric을 채우고, 각 마일스톤이 해당하는 배점 항목을 rubricCategory로 태깅하세요. 배점표가 없으면 rubric은 빈 배열로 두세요.
- 산출물 종류로부터 필요한 역할(아이디어/자료조사, PPT 제작, 기술 공부, 개발, 발표 등)을 roles에 나열하세요.
- 팀원 정보가 있으면 인원 수만큼 역할을 배분해 assignee를 채우고, 없으면 assignee는 null로 두세요.
- firstMeetingAgenda는 5개 이내로, 첫 팀 회의에서 다룰 안건을 bullet 형태 문장으로 작성하세요.`;

  if(t==='contest') return `당신은 공모전 참가 온보딩을 돕는 AI입니다. 아래 문서를 분석해서 역산 일정·심사기준 배점·체크리스트·인사이트·1차 회의 아젠다를 JSON으로 설계하세요.

[모집요강]
"""
${inputs.guidelines||'(제공되지 않음)'}
"""

[심사기준]
"""
${inputs.rubric||'(제공되지 않음)'}
"""

[이전 수상작 (선택)]
"""
${inputs.pastWinners||'(제공되지 않음)'}
"""

규칙:
- 오늘 날짜는 ${today}입니다.
- "(제공되지 않음)"인 항목은 없는 것으로 보고, 주어진 정보만으로 최대한 유용한 결과를 만드세요. 근거가 없는 날짜는 지어내지 말고 null로 두세요.
- 모집요강에서 제출 마감일을 찾아, 그 날짜로부터 역산해서 마일스톤을 설계하세요. (예: 마감 60일 전 아이디어 확정, 45일 전 프로토타입, 20일 전 발표자료, 7일 전 리허설 — 프로젝트 성격에 맞게 조정)
- 각 마일스톤의 dueDate는 실제 YYYY-MM-DD로 계산해서 채우세요. 마감일을 찾을 수 없으면 dueDate는 null.
- 심사기준의 배점 항목들을 rubric에 채우세요.
- 이전 수상작 정보가 제공됐다면, 수상작들이 공통적으로 강조한 지점을 insights에 2~4개 문장으로 작성하세요. 정보가 없으면 빈 배열로 두세요.
- 심사기준 각 항목에 대해 "현재 이 프로젝트가 이 항목을 충족하는지" 체크리스트를 만드세요. 아직 알 수 없으면 met은 false, notes에 "확인 필요"라고 적으세요.
- firstMeetingAgenda는 5개 이내 bullet.`;

  if(t==='club') return `당신은 동아리 활동 온보딩을 돕는 AI입니다. 아래 정보를 분석해서 행사 마일스톤·목표 마일스톤·예산 체크리스트·1차 회의 아젠다를 JSON으로 설계하세요.

[작년 기수 활동내역]
"""
${inputs.history||'(제공되지 않음)'}
"""

[이번 학기 목표 (선택)]
"""
${inputs.goals||'(제공되지 않음)'}
"""

[예산 정보 (선택)]
"""
${inputs.budget||'(제공되지 않음)'}
"""

정기모임: 매주 요일코드 ${inputs.weekday}(0=일,1=월,2=화,3=수,4=목,5=금,6=토), 시작일 ${inputs.startDate}, 총 ${inputs.weeks}주

규칙:
- 오늘 날짜는 ${today}입니다.
- "(제공되지 않음)"인 항목은 없는 것으로 보고, 주어진 정보만으로 최대한 유용한 결과를 만드세요. 근거가 없는 날짜는 지어내지 말고 null로 두세요.
- recurringMeeting에는 위에 주어진 정기모임 정보를 그대로 반영하세요 (dayOfWeek, weeksCount는 숫자로).
- 작년 기수 활동내역에서 반복되는 행사(MT, 정기공연, 전시회 등)를 찾아, 올해도 비슷한 시기에 있을 것으로 가정하고 eventMilestones에 준비 시작일(prepStartDate)과 행사 예상일(eventDate)을 추정해 넣으세요. 정확한 날짜를 모르면 notes에 "작년 대비 예상 시기"라고 설명하고 날짜는 null로 두세요.
- 이번 학기 목표가 있으면 각각을 goalMilestones에 별도 항목으로 추가하세요.
- 예산 정보가 있으면 항목별로 budgetChecklist를 채우세요. 없으면 빈 배열.
- firstMeetingAgenda는 5개 이내 bullet.`;

  return '';
}
function legacyOnboardSchema(t){
  if(t==='team') return {
    type:'object',
    properties:{
      milestones:{type:'array',items:{type:'object',properties:{
        title:{type:'string'}, dueDate:{type:'string',nullable:true},
        deliverable:{type:'string'}, rubricCategory:{type:'string',nullable:true}
      },required:['title','deliverable']}},
      roles:{type:'array',items:{type:'object',properties:{
        role:{type:'string'}, assignee:{type:'string',nullable:true}, tasks:{type:'array',items:{type:'string'}}
      },required:['role','tasks']}},
      rubric:{type:'array',items:{type:'object',properties:{
        category:{type:'string'}, weight:{type:'number'}
      },required:['category','weight']}},
      firstMeetingAgenda:{type:'array',items:{type:'string'}}
    },
    required:['milestones','roles','rubric','firstMeetingAgenda']
  };
  if(t==='contest') return {
    type:'object',
    properties:{
      milestones:{type:'array',items:{type:'object',properties:{
        title:{type:'string'}, dueDate:{type:'string',nullable:true}, deliverable:{type:'string'}
      },required:['title','deliverable']}},
      rubric:{type:'array',items:{type:'object',properties:{
        category:{type:'string'}, weight:{type:'number'}
      },required:['category','weight']}},
      insights:{type:'array',items:{type:'string'}},
      checklist:{type:'array',items:{type:'object',properties:{
        item:{type:'string'}, met:{type:'boolean'}, notes:{type:'string'}
      },required:['item','met']}},
      firstMeetingAgenda:{type:'array',items:{type:'string'}}
    },
    required:['milestones','rubric','checklist','firstMeetingAgenda']
  };
  if(t==='club') return {
    type:'object',
    properties:{
      recurringMeeting:{type:'object',properties:{
        dayOfWeek:{type:'number'}, startDate:{type:'string',nullable:true}, weeksCount:{type:'number'}, notes:{type:'string'}
      },required:['dayOfWeek','weeksCount']},
      eventMilestones:{type:'array',items:{type:'object',properties:{
        title:{type:'string'}, prepStartDate:{type:'string',nullable:true}, eventDate:{type:'string',nullable:true}, notes:{type:'string'}
      },required:['title','notes']}},
      goalMilestones:{type:'array',items:{type:'object',properties:{
        title:{type:'string'}, targetDate:{type:'string',nullable:true}, notes:{type:'string'}
      },required:['title']}},
      budgetChecklist:{type:'array',items:{type:'object',properties:{
        item:{type:'string'}, estimatedCost:{type:'number',nullable:true}, notes:{type:'string'}
      },required:['item']}},
      firstMeetingAgenda:{type:'array',items:{type:'string'}}
    },
    required:['recurringMeeting','eventMilestones','goalMilestones','budgetChecklist','firstMeetingAgenda']
  };
  return {type:'object',properties:{}};
}
function onboardPlanId(kind){
  if(typeof crypto!=='undefined'&&typeof crypto.randomUUID==='function') return `mp_${kind}_${crypto.randomUUID()}`;
  return `mp_${kind}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,10)}`;
}
function onboardNormalizeDecisionStatus(status){ return ['undecided','decided','deferred'].includes(status)?status:'undecided'; }
function onboardMakePlan(track,inputs,result){
  const now=new Date().toISOString();
  const uid=kind=>onboardPlanId(kind);
  const s={requirements:[],rubrics:[],goals:[],deliverables:[],milestones:[],tasks:[],agendaThreads:[],firstMeetingAgenda:Array.isArray(result.firstMeetingAgenda)?result.firstMeetingAgenda:[],trackData:{}};
  const task=(x,mid)=>({id:uid('task'),milestoneId:mid,title:x.title,assignee:null,dueDate:x.dueDate||null,status:'todo',definitionOfDone:x.definitionOfDone||'',needsDecomposition:!!x.needsDecomposition});
  if(track==='club'){
    (Array.isArray(result.agendaThreads)?result.agendaThreads:[]).forEach(x=>{
      const isDecision=x.mode==='decision';
      const th={id:uid('thread'),title:x.title,agendaType:x.agendaType,mode:isDecision?'decision':'delivery',targetDate:x.targetDate||null,assignees:Array.isArray(x.assignees)?x.assignees:[],status:isDecision?onboardNormalizeDecisionStatus(x.status):(x.status||'active'),decision:isDecision?{result:null,deferredReason:null}:null,milestones:[],tasks:[]};
      if(th.mode==='delivery') (Array.isArray(x.milestones)?x.milestones:[]).forEach(m=>{
        const mid=uid('milestone'),mo={id:mid,title:m.title,kind:m.kind||'work',dueDate:m.dueDate||th.targetDate||null,taskIds:[],checkpoints:Array.isArray(m.checkpoints)?m.checkpoints:[],recommendations:Array.isArray(m.recommendations)?m.recommendations:[]};
        (Array.isArray(m.tasks)?m.tasks:[]).forEach(a=>{const z=task(a,mid);mo.taskIds.push(z.id);th.tasks.push(z);});
        th.milestones.push(mo);
      });
      s.agendaThreads.push(th);
    });
  }else{
    const didByKey={}, didsByLegacyTitle={};
    (Array.isArray(result.goals)?result.goals:[]).forEach((g,i)=>{
      const gid=uid('goal'),goal={id:gid,title:g.title,deliverableIds:[]};
      s.goals.push(goal);
      (Array.isArray(g.deliverables)?g.deliverables:[]).forEach((d,j)=>{
        const did=uid('deliverable'),baseKey=String(d.refKey||`g${i + 1}-d${j + 1}`);
        let refKey=baseKey, suffix=2;
        while(didByKey[refKey]) refKey=`${baseKey}-${suffix++}`;
        const del={id:did,refKey,goalId:gid,title:d.title,format:d.format||'',dueDate:d.dueDate||inputs.finalDeadline||null,requirementIds:[],rubricIds:[],milestoneIds:[]};
        didByKey[refKey]=did;
        (didsByLegacyTitle[d.title]||(didsByLegacyTitle[d.title]=[])).push(did);
        goal.deliverableIds.push(did);s.deliverables.push(del);
        (Array.isArray(d.milestones)?d.milestones:[]).forEach(m=>{
          const mid=uid('milestone'),mo={id:mid,deliverableId:did,title:m.title,kind:m.kind||'work',dueDate:m.dueDate||del.dueDate||null,taskIds:[],checkpoints:Array.isArray(m.checkpoints)?m.checkpoints:[],recommendations:Array.isArray(m.recommendations)?m.recommendations:[]};
          (Array.isArray(m.tasks)?m.tasks:[]).forEach(a=>{const z=task(a,mid);mo.taskIds.push(z.id);s.tasks.push(z);});
          del.milestoneIds.push(mid);s.milestones.push(mo);
        });
      });
    });
    const linkedIds=entry=>{
      const keys=Array.isArray(entry.relatedDeliverableKeys)?entry.relatedDeliverableKeys:[];
      if(keys.length) return keys.map(key=>didByKey[key]).filter(Boolean);
      return (Array.isArray(entry.relatedDeliverables)?entry.relatedDeliverables:[]).map(title=>{
        const matches=didsByLegacyTitle[title]||[];
        return matches.length===1?matches[0]:null;
      }).filter(Boolean);
    };
    (Array.isArray(result.requirements)?result.requirements:[]).forEach(r=>{
      const relatedDeliverableIds=linkedIds(r),item={id:uid('requirement'),title:r.title,acceptanceCriteria:Array.isArray(r.acceptanceCriteria)?r.acceptanceCriteria:[],relatedDeliverableIds};
      s.requirements.push(item);relatedDeliverableIds.forEach(did=>{const del=s.deliverables.find(d=>d.id===did);if(del)del.requirementIds.push(item.id);});
    });
    (Array.isArray(result.rubric)?result.rubric:[]).forEach(r=>{
      const relatedDeliverableIds=linkedIds(r),item={id:uid('rubric'),title:r.category,weight:r.weight||null,relatedDeliverableIds};
      s.rubrics.push(item);relatedDeliverableIds.forEach(did=>{const del=s.deliverables.find(d=>d.id===did);if(del)del.rubricIds.push(item.id);});
    });
    s.trackData=track==='contest'?{name:inputs.name||null,finalDeadline:inputs.finalDeadline||null,contestType:inputs.contestType,profile:result.profile||{emphasis:onboardBuildProfile(inputs.contestType)}}:{name:inputs.name||null,finalDeadline:inputs.finalDeadline||null,midDeadline:inputs.midDeadline||null};
  }
  return {schemaVersion:1,assigneePolicyVersion:1,track,status:'draft',createdAt:now,updatedAt:now,currentVersion:1,baseline:{version:1,approvedAt:null,snapshot:s},current:{version:1,source:'baseline',snapshot:null,taskState:{},decisionState:{},validationState:{requirements:{},rubrics:{}}},links:[],pendingReplan:null,changeLog:[]};
}

/* ──── MVP 1차 입력·생성 구조 (아래 선언이 구형 온보딩 함수를 대체한다) ──── */
function onboardDateInput(id,label){ return `<div class="up-panel"><div class="up-panel-ttl">${label}</div><input class="m-inp" type="date" id="${id}" style="max-width:240px;margin-bottom:0;"></div>`; }
function onboardClubThreadHTML(i){ return `<div class="up-panel" data-thread="${i}" style="margin-bottom:10px;"><div style="display:flex;justify-content:space-between;gap:10px;"><div class="up-panel-ttl">Agenda Thread ${i+1}</div><button class="btn-ghost" type="button" onclick="onboardRemoveClubThread(${i})">삭제</button></div><input class="m-inp" data-f="title" placeholder="안건명" style="margin-bottom:8px;"><textarea class="textarea" data-f="description" rows="2" placeholder="안건 설명"></textarea><div class="g2"><select class="m-inp" data-f="agendaType"><option value="new_event">신규 기획 행사형</option><option value="recurring_event">반복 행사형</option><option value="content">콘텐츠 제작형</option><option value="outreach">섭외/매칭형</option><option value="operations_decision">운영/의사결정형</option></select><input class="m-inp" data-f="targetDate" type="date" placeholder="목표 날짜"></div><input class="m-inp" data-f="assignees" placeholder="담당자 (쉼표로 구분)" style="margin-bottom:0;"></div>`; }
function onboardAddClubThread(){ const box=document.getElementById('club-thread-list'); if(box) box.insertAdjacentHTML('beforeend',onboardClubThreadHTML(box.children.length)); }
function onboardRemoveClubThread(i){ const el=document.querySelector(`#club-thread-list [data-thread="${i}"]`); if(el) el.remove(); document.querySelectorAll('#club-thread-list [data-thread]').forEach((x,n)=>{x.dataset.thread=n;x.querySelector('.up-panel-ttl').textContent=`Agenda Thread ${n+1}`;}); }
function onboardFieldsHTML(t){
  if(t==='team') return [
    `<div class="up-panel"><div class="up-panel-ttl">📚 과제 정보</div><input id="team-name" class="m-inp" placeholder="과제명" style="margin-bottom:0;"></div>`,
    docFieldHTML('team-brief','📋 과제 요구사항 / 설명','필수 요구사항, 제약, 제출 조건을 붙여넣으세요.'),
    docFieldHTML('team-deliverables','📦 제출물','예) 보고서 PDF, 발표 PPT, 시연 영상',{withPdf:false,rows:3}),
    onboardDateInput('team-deadline','📅 최종 마감일'), onboardDateInput('team-mid-deadline','🗓️ 중간 마감일 (선택)'),
    docFieldHTML('team-rubric','📊 Rubric / 평가기준','배점표와 평가 항목',{optional:true}), docFieldHTML('team-members','👥 팀원','예) 지은(기획), 수민(개발)',{optional:true,withPdf:false,rows:3})].join('');
  if(t==='contest') return [
    `<div class="up-panel"><div class="up-panel-ttl">🏆 공모전 정보</div><input id="contest-name" class="m-inp" placeholder="공모전명"><select id="contest-type" class="m-inp" style="margin-bottom:0;"><option value="idea">아이디어/기획</option><option value="data_ai">데이터분석/AI</option><option value="marketing">마케팅/콘텐츠</option><option value="startup_bm">창업/BM</option><option value="hackathon">개발/해커톤</option><option value="design">디자인</option></select></div>`,
    docFieldHTML('contest-guidelines','📢 공모전 요강','자격요건, 제출 규격, 마감일, 제출 절차'),docFieldHTML('contest-deliverables','📦 제출물','예) 기획서 PDF, 발표 영상, 프로토타입',{withPdf:false,rows:3}),onboardDateInput('contest-deadline','📅 최종 마감일'),docFieldHTML('contest-rubric','📊 심사기준','배점표와 평가 항목'),docFieldHTML('contest-members','👥 팀원','예) 지은(기획), 수민(개발)',{optional:true,withPdf:false,rows:3})].join('');
  return `<div class="up-panel"><div class="up-panel-ttl">🧵 Agenda Thread</div><p style="font-size:12px;color:var(--muted);">동아리 전체가 아니라, 병렬 안건을 각각 관리합니다.</p><div id="club-thread-list">${onboardClubThreadHTML(0)}</div><button class="btn-ghost" type="button" style="margin-top:10px;" onclick="onboardAddClubThread()">＋ 안건 추가</button></div>`;
}
function collectOnboardInputs(t){
  const v=id=>(document.getElementById(id)?.value||'').trim();
  if(t==='team') return {name:v('team-name'),requirements:v('team-brief-ta'),deliverables:v('team-deliverables-ta'),finalDeadline:v('team-deadline'),midDeadline:v('team-mid-deadline'),rubric:v('team-rubric-ta'),members:v('team-members-ta')};
  if(t==='contest') return {name:v('contest-name'),guidelines:v('contest-guidelines-ta'),deliverables:v('contest-deliverables-ta'),finalDeadline:v('contest-deadline'),rubric:v('contest-rubric-ta'),contestType:v('contest-type')||'idea',members:v('contest-members-ta')};
  return {threads:[...document.querySelectorAll('#club-thread-list [data-thread]')].map(el=>({title:el.querySelector('[data-f="title"]').value.trim(),description:el.querySelector('[data-f="description"]').value.trim(),agendaType:el.querySelector('[data-f="agendaType"]').value,targetDate:el.querySelector('[data-f="targetDate"]').value,assignees:el.querySelector('[data-f="assignees"]').value.split(',').map(x=>x.trim()).filter(Boolean)})).filter(x=>x.title)};
}
function onboardMissingField(t,input){ if(t==='club') return input.threads.length?'': '최소 한 개의 Agenda Thread를 입력해주세요.'; return (t==='team'?input.requirements||input.deliverables:input.guidelines||input.deliverables)?null:'최소 한 가지 핵심 정보를 입력해주세요.'; }
function onboardBuildProfile(type){ return {idea:['문제 정의','차별성','공모전 의도 부합','논리 검증','실행 가능성'],data_ai:['데이터 품질','방법론 선정 근거','재현성','기술 검증','결과 해석'],marketing:['타깃','채널','핵심 메시지','실행안','성과 지표'],startup_bm:['문제/고객 검증','가치제안','경쟁 분석','수익구조','시장 검증','Q&A 준비'],hackathon:['구현 범위','MVP','핵심 기능','테스트','데모','데모 백업'],design:['요구사항 해석','Concept','Draft/Feedback','Refinement','제출 규격','최종 완성도']}[type]||[]; }
function onboardPrompt(t,i,today){
  const rules=`오늘은 ${today}입니다. 입력에 없는 필수 요구사항을 만들지 마세요. 단 하나의 추천 구조로 프로젝트 전체에 핵심 마일스톤을 3~5개만 만드세요. 각 milestone 안에는 실제로 실행할 세부 Task를 2~5개 넣으세요. Task는 담당자가 완료 여부를 판단할 수 있는 크기와 표현으로 만들고, 첫 회의 전에는 담당자를 임의 배정하지 말고 모든 task.assignee를 null로 두세요. 별도의 방법론 추천 단계는 만들지 마세요. milestone.recommendations는 빈 배열로 두세요. 기본 계층 Goal → Deliverable → Milestone → Task는 내부 데이터로 유지하고 Requirement와 Rubric은 관련 Deliverable/Milestone의 검수 기준으로 두세요. 각 Deliverable에 고유한 refKey를 부여하고 relatedDeliverableKeys에는 그 refKey만 넣으세요. 마감일/목표일은 실제 입력을 우선하세요.`;
  if(t==='team') return `대학 팀플 초기 계획을 JSON으로 만드세요. 과제명:${i.name}\nRequirement:${i.requirements}\n제출물:${i.deliverables}\n최종 마감:${i.finalDeadline||'없음'}\n중간 마감:${i.midDeadline||'없음'}\nRubric:${i.rubric||'없음'}\n팀원:${i.members||'없음'}\n${rules}`;
  if(t==='contest') return `공모전 초기 계획을 JSON으로 만드세요. 공모전명:${i.name}\n요강:${i.guidelines}\n제출물:${i.deliverables}\n최종 마감:${i.finalDeadline||'없음'}\n심사기준:${i.rubric}\n팀원:${i.members||'없음'}\n유형:${i.contestType}, 강조 Profile:${onboardBuildProfile(i.contestType).join(', ')}\n${rules}\nProfile은 고정 템플릿이 아니며, 실제 요강과 심사기준이 항상 우선입니다. 필요한 milestone에 checkpoint(완료 지점이 아닌 검증 기준)를 넣으세요.`;
  return `동아리 Agenda Thread 초기 계획을 JSON으로 만드세요. 입력:${JSON.stringify(i.threads)}\n${rules}\nnew_event, recurring_event, content, outreach는 mode:'delivery'와 각 Thread 내부 milestones/tasks를 만드세요. operations_decision은 mode:'decision', status:undecided/decided/deferred만 두고 milestones/tasks를 만들지 마세요.`;
}
function onboardTaskSchema(){return {type:'object',properties:{title:{type:'string'},assignee:{type:'string',nullable:true},dueDate:{type:'string',nullable:true},definitionOfDone:{type:'string'},needsDecomposition:{type:'boolean'}},required:['title','definitionOfDone','needsDecomposition']};}
function onboardMilestoneSchema(){return {type:'object',properties:{title:{type:'string'},kind:{type:'string'},dueDate:{type:'string',nullable:true},checkpoints:{type:'array',items:{type:'object',properties:{title:{type:'string'},focus:{type:'string'},criteria:{type:'array',items:{type:'string'}}},required:['title','criteria']}},recommendations:{type:'array',items:{type:'string'}},tasks:{type:'array',items:onboardTaskSchema()}},required:['title','recommendations','tasks']};}
function onboardSchema(t){
  if(t==='club') return {type:'object',properties:{agendaThreads:{type:'array',items:{type:'object',properties:{title:{type:'string'},agendaType:{type:'string'},mode:{type:'string'},targetDate:{type:'string',nullable:true},assignees:{type:'array',items:{type:'string'}},status:{type:'string'},milestones:{type:'array',items:onboardMilestoneSchema()}},required:['title','agendaType','mode','status','milestones']}},firstMeetingAgenda:{type:'array',items:{type:'string'}}},required:['agendaThreads','firstMeetingAgenda']};
  const criterionSchema={type:'object',properties:{title:{type:'string'},acceptanceCriteria:{type:'array',items:{type:'string'}},relatedDeliverableKeys:{type:'array',items:{type:'string'}}},required:['title','acceptanceCriteria','relatedDeliverableKeys']};
  const rubricSchema={type:'object',properties:{category:{type:'string'},weight:{type:'number',nullable:true},relatedDeliverableKeys:{type:'array',items:{type:'string'}}},required:['category','relatedDeliverableKeys']};
  const deliverableSchema={type:'object',properties:{refKey:{type:'string'},title:{type:'string'},format:{type:'string'},dueDate:{type:'string',nullable:true},milestones:{type:'array',items:onboardMilestoneSchema()}},required:['refKey','title','milestones']};
  return {type:'object',properties:{requirements:{type:'array',items:criterionSchema},rubric:{type:'array',items:rubricSchema},goals:{type:'array',items:{type:'object',properties:{title:{type:'string'},deliverables:{type:'array',items:deliverableSchema}},required:['title','deliverables']}},profile:{type:'object',properties:{emphasis:{type:'array',items:{type:'string'}}}},firstMeetingAgenda:{type:'array',items:{type:'string'}}},required:['requirements','rubric','goals','firstMeetingAgenda']};
}
