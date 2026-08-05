/* MeetFlow — Gemini 공통 호출·JSON 파싱
   소유자: 기능 C */

/* ──── Gemini 공통 호출/파싱 ──── */
async function geminiRequest(prompt,schema,maxTokens=4096){
  /* Firebase AI Logic 경유 — 사용자가 Gemini API 키를 입력할 필요 없음 */
  if(typeof window.mfGenerateJSON!=='function'){
    throw new Error('AI 모듈을 불러오는 중이에요. 잠시 후 다시 시도해주세요.');
  }
  let raw;
  try{
    raw=await window.mfGenerateJSON(prompt,schema,maxTokens);
  }catch(e){
    console.error('[MeetFlow] Firebase AI Logic 오류:', e);
    const msg=e?.message||'';
    if(/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) throw new Error('AI 사용량 한도를 초과했어요. 잠시 후 다시 시도해주세요.');
    if(/permission|PERMISSION_DENIED|403/i.test(msg)) throw new Error('AI 서비스 권한 오류예요. Firebase AI Logic 설정을 확인해주세요.');
    throw new Error('AI 호출에 실패했어요: '+msg);
  }
  console.log('[MeetFlow] Gemini 원본 응답:', raw);
  return parseGeminiJson(raw);
}
function parseGeminiJson(raw){
  /* 마크다운 코드블록 제거 후 첫 번째 JSON 객체 추출 */
  const stripped=raw.replace(/```json\s*/gi,'').replace(/```\s*/g,'').trim();
  const jsonMatch=stripped.match(/\{[\s\S]*\}/);
  const jsonStr=jsonMatch?jsonMatch[0]:stripped;
  try{
    return JSON.parse(jsonStr);
  }catch(e){
    console.error('[MeetFlow] JSON 파싱 실패. 원본:', raw, '/ 정제 후:', jsonStr);
    throw new Error('AI 응답 파싱 실패. 다시 시도해주세요.');
  }
}

/**
 * 회의 텍스트를 분석한다.
 * 이 서비스의 차별점은 회의를 "이어붙이는" 것이므로, 이전 회의에서 끝나지 않은
 * 업무를 함께 넘겨 AI가 이번 회의에서 해결됐는지까지 판단하게 한다.
 * @param {string} text     이번 회의 텍스트
 * @param {Array}  pending  이전 회의의 미완료 업무 [{id,task,assignee,deadline,status,meetingDate}]
 */
async function callGemini(text, pending=[]){
  const today=new Date().toISOString().split('T')[0];

  const pendingBlock = pending.length
    ? `\n지난 회의에서 아직 끝나지 않은 업무 (이번 회의에서 다뤄졌는지 판단해야 함):
"""
${pending.map(p=>`- [${p.id}] ${p.task} (담당: ${p.assignee||'미지정'}, 마감: ${p.deadline||'미정'}, 상태: ${ST.lbl[p.status]||p.status}, ${p.meetingDate} 회의)`).join('\n')}
"""\n`
    : '\n(이번이 첫 회의라 이어받을 업무가 없습니다.)\n';

  const prompt=`다음은 한 프로젝트의 회의 기록입니다. 아래 JSON 스키마에 맞게 응답하세요.

이번 회의 텍스트:
"""
${text}
"""
${pendingBlock}
규칙:
- items에는 **이번 회의에서 새로 정해진 업무만** 넣으세요. 위에 이미 있는 업무는 넣지 마세요.
- status는 항상 "todo"로 고정
- 상대적 날짜(이번 주, 다음 주, 이번 달 말 등)는 오늘(${today}) 기준으로 YYYY-MM-DD로 변환
- 한 사람이 여러 업무를 맡으면 각각 별도 항목으로 분리
- 마감일이 명확히 언급되지 않으면 deadline은 null
- task는 25자 이내로 간결하게
- summary는 2~3문장의 완성된 문장으로 작성

carriedOver 작성 규칙 (지난 회의 미완료 업무에 대한 판단):
- 위에 나열된 업무 각각에 대해, 이번 회의 내용에 근거해 판단한 것만 넣으세요.
  회의에서 전혀 언급되지 않은 업무는 넣지 마세요.
- id는 위 대괄호 안의 값을 그대로 쓰세요.
- resolved: 이번 회의에서 완료됐다고 확인되면 true, 아직 진행 중이거나 미뤄졌으면 false
- note: 근거를 회의 내용에서 인용해 한 문장으로. 미뤄졌다면 그 이유를 쓰세요.
- newDeadline: 마감일이 새로 정해졌으면 YYYY-MM-DD, 아니면 null

gaps 작성 규칙:
- 이번 회의에서 논의가 빠졌거나 결정이 미뤄진 부분, 팀이 놓치고 있는 것을 짚어주세요.
- 회의 내용에 근거한 것만, 최대 3개. 없으면 빈 배열.`;

  const schema={
    type:'object',
    properties:{
      summary:{type:'string'},
      items:{
        type:'array',
        items:{
          type:'object',
          properties:{
            assignee:{type:'string'},
            task:    {type:'string'},
            deadline:{type:'string', nullable:true},
            status:  {type:'string'},
            priority:{type:'string'},
          },
          required:['assignee','task','status','priority']
        }
      },
      carriedOver:{
        type:'array',
        items:{
          type:'object',
          properties:{
            id:         {type:'string'},
            task:       {type:'string'},
            resolved:   {type:'boolean'},
            note:       {type:'string'},
            newDeadline:{type:'string', nullable:true},
          },
          required:['id','task','resolved','note']
        }
      },
      gaps:{type:'array', items:{type:'string'}}
    },
    required:['summary','items']
  };

  const parsed=await geminiRequest(prompt,schema,8192);
  if(!Array.isArray(parsed.items)) throw new Error('AI 응답 형식이 올바르지 않아요.');

  /* deadline이 빈 문자열이면 null로 정규화 */
  parsed.items=parsed.items.map(it=>({
    ...it,
    deadline: it.deadline&&it.deadline.trim()!==''?it.deadline:null,
    status:   'todo',
  }));
  parsed.carriedOver=Array.isArray(parsed.carriedOver)?parsed.carriedOver:[];
  parsed.gaps=Array.isArray(parsed.gaps)?parsed.gaps:[];

  return parsed;
}
