/* MeetFlow — Gemini 공통 호출·JSON 파싱
   소유자: 기능 C */

/* AI 호출 실패를 화면에 보여줄 안내로 바꾼다. 원인마다 사용자가 할 일이 달라서
   (기다리기 / 콘솔 설정 고치기 / 그냥 재시도) 구분해준다. */
function aiErrorInfo(e){
  const msg=(e&&e.message)||String(e||'');
  if(/quota|RESOURCE_EXHAUSTED|429/i.test(msg)) return {
    title:'AI 사용량 한도를 넘었어요',
    desc:'Gemini 무료 할당량을 다 썼어요. 분당 한도면 1분 뒤 다시 되고, ' +
         '하루 한도면 태평양 시간 자정(한국 시간 오후 4~5시)에 초기화돼요. ' +
         'Firebase 콘솔에서 요금제를 올리면 한도가 늘어납니다.',
    retry:true, wait:true
  };
  if(/App Check/i.test(msg)) return {
    title:'App Check에 막혔어요',
    desc:'Firebase 콘솔의 App Check 설정 문제예요. 코드를 고쳐도 해결되지 않아요.',
    retry:false
  };
  if(/permission|PERMISSION_DENIED|403/i.test(msg)) return {
    title:'AI 서비스 권한 오류예요',
    desc:'Firebase AI Logic 설정을 확인해주세요.',
    retry:false
  };
  if(/network|fetch|Failed to fetch/i.test(msg)) return {
    title:'네트워크에 연결하지 못했어요',
    desc:'인터넷 연결을 확인하고 다시 시도해주세요.',
    retry:true
  };
  return { title:'AI 호출에 실패했어요', desc:msg||'알 수 없는 오류예요.', retry:true };
}

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

  /* 음성 전사본은 구어체에 (불분명) 구간이 섞여 있는데, topics의 분량 기준과 만나면
     AI가 근거 없는 내용으로 빈칸을 메우기 쉽다. 전사본으로 보일 때만 제동 규칙을 붙인다.
     (mfTranscribeAudio가 화자1/화자2·(불분명) 표기를 쓰므로 그걸로 판별한다) */
  const looksTranscribed = /화자\s*\d|\(불분명\)/.test(text);
  const transcriptBlock = looksTranscribed ? `

이 회의 텍스트는 음성 녹음을 자동 전사한 것입니다. 아래를 반드시 지키세요:
- (불분명)이 섞인 구간은 추측해서 채우지 마세요. 무슨 말인지 확실하지 않으면 그 항목을 아예 빼세요.
- "화자1", "화자2" 같은 라벨은 자동 추정이라 자주 틀립니다. 이 라벨을 담당자로 쓰지 마세요.
- 담당자는 대화 안에서 실제 이름이 불린 경우에만 지정하고, 확실하지 않으면 assignee를 "미지정"으로 두세요.
- 전사본에는 소제목이 없으니 화제가 바뀌는 지점을 직접 찾아 안건을 나누세요.
- topics의 "안건당 3~12개" 분량 기준은 **근거가 분명한 내용이 실제로 그만큼 있을 때만** 적용됩니다.
  들린 내용이 적으면 적은 대로 두세요. 분량을 맞추려고 지어내는 것이 가장 나쁩니다.
- 구어체 군더더기(음..., 그러니까, 아 네네)는 빼고 내용만 문장으로 정리하세요.` : '';

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
- 회의 내용에 근거한 것만, 최대 3개. 없으면 빈 배열.

topics 작성 규칙 (회의록 본문에 해당하는, 가장 중요한 부분):
- summary가 2~3문장 요약이라면, topics는 **이 회의에 참석하지 않은 사람이 읽어도
  회의 전체를 이해할 수 있는 상세 기록**입니다. 요약이 아니라 기록입니다.
- 회의에서 다뤄진 안건(주제)별로 나눠서 정리하세요.
- 각 안건마다 discussion 배열에 논의된 내용과 결정 사항을 항목별 문장으로 적으세요.

분량과 깊이:
- **짧게 줄이는 것이 가장 나쁩니다.** 회의 텍스트에 있는 내용은 최대한 살려 적으세요.
- 안건 하나당 discussion을 최소 3개, 논의가 길었던 안건은 6~12개까지 적으세요.
- 결정된 결과만 쓰지 말고 **왜 그렇게 정했는지(배경·근거)**, 검토된 다른 방안,
  나온 우려나 반대 의견, 보류된 쟁점까지 각각 항목으로 적으세요.
- 한 항목에 여러 내용을 몰아넣지 말고 내용이 다르면 항목을 나누세요.
- 문장을 압축하지 말고 완결된 문장으로 쓰세요. 개조식 단어 나열은 피하세요.

정확성:
- 언급된 담당자·날짜·장소·금액·수량·조건은 문장 안에 그대로 살리세요.
  (예: "혜강관 209호 예약하기 (지은)", "상품은 스타벅스 5000원 상품권 6개 증정")
- 명단·타임테이블·후보안처럼 나열된 것은 항목을 빠뜨리지 말고 모두 적으세요.
  개수가 많아도 생략하거나 "등"으로 뭉뚱그리지 마세요.
- 안건 제목은 회의에서 실제로 쓰인 표현을 우선 사용하세요.
- 안건 순서는 회의에서 다뤄진 순서를 따르세요.
- 논의만 하고 결론이 안 난 안건도 넣으세요. "결론은 다음 회의로 미룸"처럼 상태를 적으면 됩니다.
- 회의 텍스트에 없는 내용은 절대 지어내지 마세요. 분량을 채우려고 추측을 덧붙이지 마세요.
  회의 내용이 짧으면 그만큼만 적으면 됩니다.${transcriptBlock}`;

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
      gaps:{type:'array', items:{type:'string'}},
      /* 안건별 논의 내용 — 회의록 본문. summary(2~3문장)와 달리 상세 기록이다. */
      topics:{
        type:'array',
        items:{
          type:'object',
          properties:{
            title:     {type:'string'},
            discussion:{type:'array', items:{type:'string'}},
          },
          required:['title','discussion']
        }
      }
    },
    required:['summary','items','topics']
  };

  /* topics가 회의록 본문이라 출력이 길어진다. 8192로는 긴 회의에서 잘린다.
     안건별 상세 기록까지 담으려면 여유가 더 필요해 24576으로 둔다. */
  const parsed=await geminiRequest(prompt,schema,24576);
  if(!Array.isArray(parsed.items)) throw new Error('AI 응답 형식이 올바르지 않아요.');

  /* deadline이 빈 문자열이면 null로 정규화 */
  parsed.items=parsed.items.map(it=>({
    ...it,
    deadline: it.deadline&&it.deadline.trim()!==''?it.deadline:null,
    status:   'todo',
  }));
  parsed.carriedOver=Array.isArray(parsed.carriedOver)?parsed.carriedOver:[];
  parsed.gaps=Array.isArray(parsed.gaps)?parsed.gaps:[];
  /* 제목 없는 안건과 빈 논의 문장은 회의록에서 빈 줄로만 보이므로 여기서 걸러낸다. */
  parsed.topics=Array.isArray(parsed.topics)
    ? parsed.topics
        .filter(t=>t&&typeof t.title==='string'&&t.title.trim()!=='')
        .map(t=>({
          title:t.title.trim(),
          discussion:Array.isArray(t.discussion)?t.discussion.filter(d=>d&&d.trim()!==''):[]
        }))
    : [];

  return parsed;
}
