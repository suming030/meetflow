# 제안: 회의록에 "안건별 논의 내용" 추가

**대상 파일**: `js/gemini.js`, `js/meetings.js` (기능 C 담당)
**제안자**: 디자인 B (하주향)
**배경**: 회의 타임라인에 "회의록 보기"를 만들었는데, 지금 있는 데이터(`summary`, `items`, `carriedOver`, `gaps`)만으로는
결국 업무 목록을 표로 재포맷한 것뿐이라 실제 "회의 내용"이 없다는 피드백을 받음. 첨부받은 실제 회의록(WAI 소학회
샘플)처럼 안건별로 무슨 얘기가 오갔는지가 회의록의 핵심이어야 함.

## 지금 상태

`js/gemini.js`의 `callGemini()` 스키마는 아래만 추출함:

- `summary` — 2~3문장 요약
- `items` — 새로 정해진 업무
- `carriedOver` — 지난 업무 판단
- `gaps` — 놓친 부분

**안건별 논의 내용, 결정 사항 같은 "회의 내용" 자체는 어디에도 없음.**

## 제안: `topics` 필드 추가

### 1. 스키마 (`js/gemini.js` — `callGemini()` 안 `schema`)

```js
topics:{
  type:'array',
  items:{
    type:'object',
    properties:{
      title:     {type:'string'},               // 안건 제목 (예: "취준토크쇼")
      discussion:{type:'array', items:{type:'string'}}, // 논의 내용·결정사항 (항목별)
    },
    required:['title','discussion']
  }
}
```

### 2. 프롬프트 규칙 (같은 함수 안 `prompt` 문자열에 추가)

```
topics 작성 규칙:
- 회의에서 다뤄진 안건(주제)별로 나눠서 정리하세요.
- 각 안건마다 discussion 배열에 논의된 내용·결정사항을 항목별 문장으로 적으세요.
  담당자나 날짜가 언급됐다면 문장 안에 포함하세요.
- 안건 제목은 회의에서 실제로 쓰인 표현을 우선 사용하세요.
- 안건 순서는 회의에서 다뤄진 순서를 따르세요.
- 논의는 있었지만 결정된 게 없어도 괜찮습니다. discussion에 "논의만 하고 결론은 못 냄" 같은
  문장을 넣어도 됩니다.
```

### 3. 반환값 정규화 (`callGemini()` 끝부분, `parsed.gaps=...` 근처)

```js
parsed.topics = Array.isArray(parsed.topics) ? parsed.topics : [];
```

### 4. 저장 (`js/meetings.js` — `saveHistory()`의 `meeting` 객체)

```js
const meeting = {
  ...
  topics: result.topics || [],
  ...
};
```

## 이후 제가 할 일 (`js/timeline.js`, 손 안 대셔도 됨)

`topics`가 있는 회의는 회의록 모달에서 요약 대신(또는 요약과 함께) 안건별 섹션을
제목 + 논의 내용 불릿으로 보여주도록 바꿀게요. `topics`가 없는 과거 회의는 지금처럼
요약 + 업무 표로 자동 폴백하면 되니 마이그레이션은 필요 없어요.

## 일부러 제안에서 뺀 것

- **참석자 명단 / 장소 / 회의 시간**: 회의 텍스트에 안 나오는 경우가 많아서, AI가 그대로 지어낼
  위험이 있어요. 필요하면 업로드 화면에서 사용자가 직접 입력하는 필드를 추가하는 쪽이 안전할 것
  같아 이번 제안에는 넣지 않았어요.
