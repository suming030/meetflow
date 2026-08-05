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
    const result=await callGemini(text);
    clearInterval(stInt);
    steps.forEach(s=>{ document.getElementById(s).className='ai-step done'; });
    renderUpResult(result);
    saveHistory(result,text);
    toast(`${result.items.length}개 Action Item 추출 완료! 🎉`,'success');
  }catch(e){
    clearInterval(stInt);
    showErr(e.message);
    document.getElementById('up-empty').style.display='block';
  }finally{
    setLoading(false);
    setTimeout(()=>document.getElementById('ai-proc').classList.remove('show'),400);
  }
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
}

/* ──── 이력 저장 ────
   회의는 프로젝트 하위 컬렉션에 쌓인다. "회의가 쌓일수록 선명해진다"가 이 제품의
   핵심이므로 개수 제한을 두지 않는다. */
async function saveHistory(result,text){
  if(!currentProject){ toast('프로젝트를 먼저 선택해주세요.','error'); return; }
  const meeting={
    text:text.slice(0,40)+(text.length>40?'…':''),
    summary:result.summary,
    items:result.items,
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
