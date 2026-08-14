/* MeetFlow — 1단계 트랙별 온보딩 (문서 입력 → 마일스톤 생성)
   소유자: 기능 C / 화면은 디자인 B */

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
  document.getElementById('ob-actions').style.display='block';
  document.getElementById('ob-err').style.display='none';
  document.getElementById('ob-proc').classList.remove('show');
  document.getElementById('ob-result').classList.remove('show');
  document.getElementById('ob-result').innerHTML='';
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
  persistCurrentProject({track:t, onboarding:null, onboardStatus:'pending'});
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
function onboardFieldsHTML(t){
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

function collectOnboardInputs(t){
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
function onboardMissingField(t,inp){
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
    if(t==='club'){
      result.recurringMeeting={
        dayOfWeek:Number(inputs.weekday),
        startDate:inputs.startDate,
        weeksCount:Number(inputs.weeks)||15,
        notes:(result.recurringMeeting&&result.recurringMeeting.notes)||''
      };
    }
    persistCurrentProject({onboardStatus:'done', onboarding:{track:t, inputs, result, completedAt:new Date().toISOString()}});
    /* 탭 전환(sdt)은 클래스만 바꾸고 다시 그리지 않는다. 여기서 마일스톤을 새로 그려두지 않으면
       대시보드로 갔을 때 "아직 온보딩을 완료하지 않았어요" 화면이 그대로 남는다.
       (skipOnboarding()은 원래부터 renderMilestones()를 부르고 있었다) */
    renderMilestones();
    renderOnboardResult();
    toast('온보딩이 완료됐어요! 🎉','success');
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
  el.innerHTML=`
    <div class="sum-banner">
      <div class="sum-ico">🎉</div>
      <div>
        <div class="sum-lbl">온보딩 완료</div>
        <div class="sum-txt">AI가 마일스톤과 다음 회의 아젠다를 준비했어요. 대시보드의 🧭 마일스톤 탭에서 확인하세요.</div>
      </div>
    </div>
    <button class="btn-pk" onclick="gp('dash',{tab:'milestones'})">대시보드에서 확인하기 →</button>`;
}

/* ──── 온보딩 전용 Gemini 프롬프트/스키마 ──── */
async function callGeminiOnboard(track,inputs){
  const today=new Date().toISOString().split('T')[0];
  return await geminiRequest(onboardPrompt(track,inputs,today), onboardSchema(track), 8192);
}
function onboardPrompt(t,inputs,today){
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
function onboardSchema(t){
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
