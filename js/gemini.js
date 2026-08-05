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

async function callGemini(text){
  const today=new Date().toISOString().split('T')[0];
  const prompt=`다음 회의 텍스트를 분석하여 아래 JSON 스키마에 맞게 응답하세요.

회의 텍스트:
"""
${text}
"""

규칙:
- status는 항상 "todo"로 고정
- 상대적 날짜(이번 주, 다음 주, 이번 달 말 등)는 오늘(${today}) 기준으로 YYYY-MM-DD로 변환
- 한 사람이 여러 업무를 맡으면 각각 별도 항목으로 분리
- 마감일이 명확히 언급되지 않으면 deadline은 null
- task는 25자 이내로 간결하게
- summary는 2~3문장의 완성된 문장으로 작성`;

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
      }
    },
    required:['summary','items']
  };

  const parsed=await geminiRequest(prompt,schema,4096);
  if(!Array.isArray(parsed.items)) throw new Error('AI 응답 형식이 올바르지 않아요.');

  /* deadline이 빈 문자열이면 null로 정규화 */
  parsed.items=parsed.items.map(it=>({
    ...it,
    deadline: it.deadline&&it.deadline.trim()!==''?it.deadline:null,
    status:   'todo',
  }));

  return parsed;
}
