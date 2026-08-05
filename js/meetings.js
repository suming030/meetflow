/* MeetFlow — 회의 분석 (2단계) — 회의 누적·이어붙이기가 여기로 들어온다
   소유자: 기능 C */

function updateCC(){
  document.getElementById('char-ct').textContent = document.getElementById('meeting-input').value.length+'자';
}
function loadSample(n){
  document.getElementById('meeting-input').value=SAMPLES[n]; updateCC();
  toast('샘플 텍스트가 입력됐어요!','success');
}
function handleDrop(e){
  e.preventDefault();
  document.getElementById('drop-area').classList.remove('dragover');
  const text=[...e.dataTransfer.items]
    .filter(i=>i.kind==='string')
    .map(i=>{ let t=''; i.getAsString(s=>t=s); return t; }).join('');
  if(text){ document.getElementById('meeting-input').value=text; updateCC(); toast('텍스트가 붙여넣어졌어요!','success'); }
}

/* ──── AI 분석 ──── */
async function analyze(){
  const text=document.getElementById('meeting-input').value.trim();
  if(!text){toast('회의 내용을 입력해주세요.','error');return;}

  setLoading(true); hideErr();
  document.getElementById('result-wrap').classList.remove('show');
  document.getElementById('up-empty').style.display='none';
  document.getElementById('ai-proc').classList.add('show');

  /* 단계 애니메이션 */
  const steps=['ai-s1','ai-s2','ai-s3'];
  steps.forEach(s=>{ document.getElementById(s).className='ai-step'; });
  let si=0;
  const stInt=setInterval(()=>{
    if(si>0) document.getElementById(steps[si-1]).className='ai-step done';
    if(si<steps.length){ document.getElementById(steps[si]).className='ai-step active'; si++; }
    else clearInterval(stInt);
  },600);

  try{
    const pending=collectPendingItems();
    const result=await callGemini(text, pending);
    clearInterval(stInt);
    steps.forEach(s=>{ document.getElementById(s).className='ai-step done'; });
    const applied=await applyCarriedOver(result.carriedOver);
    renderUpResult(result);
    await saveHistory(result,text);
    toast(applied
      ? `Action Item ${result.items.length}개 추출, 지난 회의 업무 ${applied}건 반영! 🎉`
      : `${result.items.length}개 Action Item 추출 완료! 🎉`,'success');
  }catch(e){
    clearInterval(stInt);
    showErr(e.message);
    document.getElementById('up-empty').style.display='block';
  }finally{
    setLoading(false);
    setTimeout(()=>document.getElementById('ai-proc').classList.remove('show'),400);
  }
}

/* ──── 회의 이어붙이기 ────
   이 서비스의 차별점. 회의를 각각 분석하는 데서 그치지 않고, 이전 회의에서
   끝나지 않은 업무를 AI에게 함께 넘겨 이번 회의에서 해결됐는지까지 판단시킨다. */

/** 이전 회의들에서 아직 끝나지 않은 업무를 모은다. */
function collectPendingItems(){
  const out=[];
  for(const m of history){
    for(const it of (m.items||[])){
      if(it.status==='done') continue;
      out.push({
        id:it.id, task:it.task, assignee:it.assignee,
        deadline:it.deadline, status:it.status||'todo',
        meetingDate:(m.date||'').slice(0,10)
      });
    }
  }
  /* 프롬프트가 지나치게 길어지지 않도록 최근 것 위주로 자른다 */
  return out.slice(0,40);
}

/** AI가 "해결됐다"고 판단한 업무를 완료 처리하고, 새 마감일이 있으면 반영한다. */
async function applyCarriedOver(carried){
  if(!Array.isArray(carried)||!carried.length) return 0;
  const touched=new Map();   /* meetingId → items */
  let count=0;

  for(const c of carried){
    const meeting=history.find(m=>(m.items||[]).some(it=>it.id===c.id));
    if(!meeting) continue;                       /* AI가 없는 id를 지어낸 경우 무시 */
    const item=meeting.items.find(it=>it.id===c.id);
    if(!item) continue;

    let changed=false;
    if(c.resolved && item.status!=='done'){ item.status='done'; changed=true; }
    if(c.newDeadline && c.newDeadline!==item.deadline){ item.deadline=c.newDeadline; changed=true; }
    if(c.note){ item.carryNote=c.note; changed=true; }

    if(changed){ count++; if(meeting.id) touched.set(meeting.id, meeting.items); }
  }

  if(currentProject){
    await Promise.all([...touched].map(([mid,items])=>
      window.mfDb.updateMeeting(currentProject.id, mid, {items})
        .catch(e=>console.error('[MeetFlow] 이어받은 업무 저장 실패', mid, e))
    ));
  }
  if(count) renderAll();
  return count;
}

/* ──── 업로드 결과 렌더링 ──── */
function renderUpResult(result){
  const items=result.items;
  document.getElementById('result-wrap').classList.add('show');
  document.getElementById('up-empty').style.display='none';

  document.getElementById('sum-txt').textContent=result.summary;

  const stats=calcStats(items);
  document.getElementById('up-metrics').innerHTML=metricsHTML(stats,'up');
  renderWarn(items,'up-warn','up-warn-txt');
  document.getElementById('up-ac-grid').innerHTML=items.map((it,i)=>acHTML(it,i,'up')).join('');
  document.getElementById('up-as-summary').innerHTML=asSummaryHTML(items);
  document.getElementById('up-prio-chart').innerHTML=prioChartHTML(items);
  document.getElementById('up-carry').innerHTML=carryOverHTML(result);
}

/** 지난 회의에서 이어받은 업무와 AI가 짚은 빈틈을 보여준다. */
function carryOverHTML(result){
  const carried=result.carriedOver||[], gaps=result.gaps||[];
  if(!carried.length && !gaps.length) return '';

  const done=carried.filter(c=>c.resolved), still=carried.filter(c=>!c.resolved);
  const row=(c,ico)=>`
    <div class="rec-item">
      <span class="rec-ico">${ico}</span>
      <div class="rec-body">
        <div class="rec-ttl">${c.task}</div>
        <div class="rec-desc">${c.note||''}${c.newDeadline?` · 새 마감일 ${c.newDeadline}`:''}</div>
      </div>
    </div>`;

  return `
    ${carried.length?`
    <div class="panel">
      <div class="panel-hd"><div class="panel-ttl">🔗 지난 회의에서 이어진 일</div></div>
      ${done.length?`<div class="m-lbl" style="margin-bottom:4px;">이번 회의에서 마무리됨 ${done.length}건</div>
        ${done.map(c=>row(c,'✅')).join('')}`:''}
      ${still.length?`<div class="m-lbl" style="margin:14px 0 4px;">아직 진행 중 ${still.length}건</div>
        ${still.map(c=>row(c,'⏳')).join('')}`:''}
    </div>`:''}
    ${gaps.length?`
    <div class="ai-rec">
      <div class="ai-rec-hd">
        <div class="ai-rec-ico">🔍</div>
        <div><div class="ai-rec-title">놓치고 있는 부분</div>
             <div class="ai-rec-sub">이번 회의 내용을 기준으로 AI가 짚은 것</div></div>
      </div>
      ${gaps.map(g=>`<div class="rec-item"><span class="rec-ico">•</span><div class="rec-body"><div class="rec-desc">${g}</div></div></div>`).join('')}
    </div>`:''}`;
}

/* ──── 이력 저장 ────
   회의는 프로젝트 하위 컬렉션에 쌓인다. "회의가 쌓일수록 선명해진다"가 이 제품의
   핵심이므로 개수 제한을 두지 않는다. */
async function saveHistory(result,text){
  if(!currentProject){ toast('프로젝트를 먼저 선택해주세요.','error'); return; }
  /* 업무마다 고유 ID를 붙인다. 체크 상태를 저장할 때 어느 업무인지 찾는 열쇠가 된다. */
  const stamp=Date.now();
  const meeting={
    text:text.slice(0,40)+(text.length>40?'…':''),
    summary:result.summary,
    items:(result.items||[]).map((it,i)=>({...it, id:'i'+stamp+'_'+i})),
    date:new Date().toISOString(),
    createdBy:currentUser?currentUser.uid:null,
    createdByName:currentUser?(currentUser.displayName||currentUser.email||''):''
  };
  const projectId=currentProject.id;
  history.unshift(meeting);   /* 화면에 즉시 반영 */
  renderAll();
  try{
    meeting.id=await window.mfDb.addMeeting(projectId, meeting);
  }catch(e){
    console.error('[MeetFlow] 회의 저장 실패', e);
    history=history.filter(m=>m!==meeting);   /* 저장 실패한 건 되돌린다 */
    renderAll();
    toast('회의를 저장하지 못했어요: '+e.message,'error');
  }
}
