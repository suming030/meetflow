/* MeetFlow — 회의 분석 (2단계) — 회의 누적·이어붙이기가 여기로 들어온다
   담당: ① 회의 입력·분석*/

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
    const saved=await saveHistory(result,text);
    const no=saved?meetingNo(saved):null;
    toast((no?`${no}차 회의로 저장했어요 · `:'')+(applied
      ? `Action Item ${result.items.length}개, 지난 회의 업무 ${applied}건 반영 🎉`
      : `Action Item ${result.items.length}개 추출 🎉`),'success');
    /* 저장됐으면 분석 페이지를 비우고 방금 회의 화면으로 넘어간다 — 다음 회의를 바로 받을 수 있게.
       저장에 실패했으면 결과까지 사라지면 안 되니 이 화면에 그대로 둔다. */
    if(saved&&saved.id){ resetUploadPage(); openMeeting(saved.id); }
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

/* ════════════════════════════════
   담당자·마감일 직접 수정

   AI 배정은 틀릴 수 있고("화자2"만 들린 경우 등), 회의 뒤에 담당자가 바뀌기도 한다.
   그래서 업무 카드의 담당자·마감일 배지를 그 자리에서 고칠 수 있게 한다.
   저장 방식은 상태 변경(persistItemStatus)과 같다 — history를 고치고 회의 문서를 갱신.
════════════════════════════════ */

/** itemId로 그 업무가 속한 회의와 업무 객체를 찾는다. */
function findItemById(itemId){
  const meeting=history.find(m=>(m.items||[]).some(it=>it.id===itemId));
  if(!meeting) return null;
  return {meeting, item:meeting.items.find(it=>it.id===itemId)};
}

/** 업무의 담당자/마감일을 history와 Firestore 양쪽에 반영한다. */
function persistItemField(itemId, patch){
  const found=findItemById(itemId);
  if(!found){ renderAll(); return; }
  const {meeting,item}=found;

  let changed=false;
  Object.keys(patch).forEach(k=>{ if(item[k]!==patch[k]){ item[k]=patch[k]; changed=true; } });

  /* 같은 업무가 개요·Action Items·담당자별·타임라인에 동시에 그려져 있어서
     한 군데만 고치면 나머지가 어긋난다. 편집이 끝나면 항상 전체를 다시 그린다. */
  renderAll();
  if(!changed) return;

  /* 아직 저장 전인 회의는 저장될 때 함께 기록되므로 여기서는 건너뛴다 */
  if(!meeting.id || !currentProject) return;
  window.mfDb.updateMeeting(currentProject.id, meeting.id, {items:meeting.items})
    .catch(e=>{
      console.error('[MeetFlow] 업무 수정 저장 실패', e);
      toast('수정한 내용을 저장하지 못했어요.','error');
    });
}

/** 이미 쓰인 담당자 이름을 자동완성으로 제안한다 — 같은 사람을 다르게 적는 걸 줄인다.
    이름에 따옴표가 섞여도 안전하도록 innerHTML 대신 DOM으로 만든다. */
function ensureAssigneeList(){
  let dl=document.getElementById('ac-assignees');
  if(!dl){ dl=document.createElement('datalist'); dl.id='ac-assignees'; document.body.appendChild(dl); }
  const names=[...new Set(history.flatMap(m=>(m.items||[]).map(i=>i.assignee)))]
    .filter(n=>n&&n!=='미지정');
  dl.innerHTML='';
  names.forEach(n=>{ const o=document.createElement('option'); o.value=n; dl.appendChild(o); });
  return dl;
}

/** 배지를 그 자리에서 입력창으로 바꾼다. Enter·포커스 아웃이면 저장, Esc면 취소.
    cssExtra로 배지용(작은 알약)과 업무 제목용(넓은 칸) 모양을 구분한다. */
function openInlineEdit(span, type, value, placeholder, onSave, cssExtra){
  if(span.dataset.editing==='1') return;
  span.dataset.editing='1';

  const inp=document.createElement('input');
  inp.type=type;
  inp.value=value||'';
  if(placeholder) inp.placeholder=placeholder;
  inp.style.cssText='font-family:inherit;border:1.5px solid var(--pk);outline:none;'+
                    'background:#fff;color:var(--text);'+
                    (cssExtra || 'font-size:11px;padding:3px 8px;border-radius:20px;'+
                                 (type==='date'?'width:132px;':'width:96px;'));
  if(type==='text'&&!cssExtra){ ensureAssigneeList(); inp.setAttribute('list','ac-assignees'); }

  span.replaceWith(inp);
  inp.focus();
  if(type==='text') inp.select();

  let done=false;
  const finish=save=>{
    if(done) return;            /* Enter로 저장하면 blur가 또 불려서 두 번 실행된다 */
    done=true;
    if(save) onSave(inp.value); else renderAll();
  };
  inp.onkeydown=e=>{
    if(e.key==='Enter'){ e.preventDefault(); finish(true); }
    else if(e.key==='Escape'){ e.preventDefault(); finish(false); }
  };
  inp.onblur=()=>finish(true);
}

/** 담당자 배지 클릭 — 비어 있으면 새로 채우고, 있으면 고친다. */
function editItemAssignee(ev, itemId){
  ev.stopPropagation();
  const found=findItemById(itemId);
  if(!found) return;
  const cur=(found.item.assignee&&found.item.assignee!=='미지정')?found.item.assignee:'';
  openInlineEdit(ev.currentTarget,'text',cur,'담당자 이름',v=>{
    /* 비우면 다시 미지정으로 — 코드 전반이 '미지정'을 담당자 없음으로 취급한다 */
    persistItemField(itemId,{assignee:v.trim()||'미지정'});
  });
}

/** 마감일 배지 클릭 — 날짜 선택기로 고친다. 비우면 '마감일 미정'으로 돌아간다. */
function editItemDeadline(ev, itemId){
  ev.stopPropagation();
  const found=findItemById(itemId);
  if(!found) return;
  openInlineEdit(ev.currentTarget,'date',found.item.deadline||'','',v=>{
    persistItemField(itemId,{deadline:v||null});
  });
}

/** 업무 제목 클릭 — AI가 25자로 줄이면서 뜻이 달라지는 경우가 있어 직접 고칠 수 있게 한다.
    제목 없는 업무는 목록에서 빈 줄로만 보이므로, 비우면 저장하지 않고 원래대로 되돌린다. */
function editItemTask(ev, itemId){
  ev.stopPropagation();
  const found=findItemById(itemId);
  if(!found) return;
  const before=found.item.task;
  openInlineEdit(ev.currentTarget,'text',before,'업무 내용',v=>{
    persistItemField(itemId,{task:v.trim()||before});
  },'font-size:13.5px;font-weight:500;padding:5px 10px;border-radius:8px;width:100%;');
}

/* ──── 업로드 결과 렌더링 ──── */
function renderUpResult(result){
  const items=result.items;
  lastResult=result;                                  /* 자료 찾기(js/research.js)가 참고한다 */
  document.getElementById('up-research').innerHTML=''; /* 지난 회의의 검색 결과를 남기지 않는다 */
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
  if(!currentProject){ toast('프로젝트를 먼저 선택해주세요.','error'); return null; }
  /* 업무마다 고유 ID를 붙인다. 체크 상태를 저장할 때 어느 업무인지 찾는 열쇠가 된다. */
  const stamp=Date.now();
  const meeting={
    text:text.slice(0,40)+(text.length>40?'…':''),
    summary:result.summary,
    items:(result.items||[]).map((it,i)=>({...it, id:'i'+stamp+'_'+i})),
    /* 회의 타임라인에서 "몇 차 회의에서 무엇이 이어졌는지"를 되짚으려면
       분석 당시의 판단을 회의 문서에 함께 남겨야 한다. */
    carriedOver:result.carriedOver||[],
    gaps:result.gaps||[],
    /* 안건별 논의 내용 — 회의 타임라인의 회의록 본문이 된다.
       이 필드가 없는 과거 회의는 회의록에서 요약+업무 표로 자동 폴백한다. */
    topics:result.topics||[],
    date:new Date().toISOString(),
    createdBy:currentUser?currentUser.uid:null,
    createdByName:currentUser?(currentUser.displayName||currentUser.email||''):''
  };
  const projectId=currentProject.id;
  history.unshift(meeting);   /* 화면에 즉시 반영 */
  renderAll();
  try{
    meeting.id=await window.mfDb.addMeeting(projectId, meeting);
    return meeting;
  }catch(e){
    console.error('[MeetFlow] 회의 저장 실패', e);
    history=history.filter(m=>m!==meeting);   /* 저장 실패한 건 되돌린다 */
    renderAll();
    toast('회의를 저장하지 못했어요: '+e.message,'error');
    return null;
  }
}

/** 분석 페이지를 처음 상태로 — 다음 회의를 받을 준비 */
function resetUploadPage(){
  document.getElementById('meeting-input').value='';
  updateCC();
  document.getElementById('result-wrap').classList.remove('show');
  document.getElementById('up-empty').style.display='block';
  document.getElementById('up-research').innerHTML='';
  if(typeof setSttStatus==='function') setSttStatus('');
}
