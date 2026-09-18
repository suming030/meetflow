# MeetFlow 작업 규칙

여러 회의를 이어서 프로젝트 전체 흐름을 붙잡아주는 AI 서비스입니다.
대학생 팀(공모전·팀플·동아리)이 타겟입니다.

**5인 팀입니다 (2026-09-18~).** 파일 단위로 담당을 나눠 작업합니다.

**모든 파일에 주인이 있습니다.** 내 파일이 아니면 고치지 말고, 담당자에게 요청하세요.

| 담당 | 역할 | 담당 파일 |
| --- | --- | --- |
| 김세은 | 디자인 A — 브랜드/랜딩 | `css/base.css`, `css/landing.css`, `index.html` 랜딩 영역 |
| 송지은 | 디자인 B-1 — 대시보드 | `css/app.css`, `js/dashboard.js`, `js/timeline.js`, `index.html` 대시보드 영역 |
| 신지연 | 디자인 B-2 — 모달/온보딩 + 구글연동 | `js/google.js`, `js/wrapup.js`, `index.html` 온보딩·모달 영역 |
| 여수민 | 기능 C-1 — 온보딩 AI + 백엔드 | `js/onboarding.js`, `js/research.js`, `functions/`, `*.rules`, `firebase.json` |
| 하주향 | 기능 C-2 — 회의 흐름 AI | `js/meetings.js`, `js/gemini.js`, `js/stt.js` |

**공용 파일 — 고치기 전에 반드시 팀에 공유**

`js/state.js`, `js/utils.js`, `js/auth.js`, `js/router.js`, `js/projects.js`,
`js/main.js`, `README.md`, `CLAUDE.md`

**둘이 같이 만져야 하는 과제**는 미리 짝을 맞추세요. 화면과 프롬프트가 다른 파일에
있기 때문입니다.

- 공모전 6종 선택 — 신지연(화면) + 여수민(프롬프트). **저장하는 필드 이름을 먼저 합의**
- 경험 정리 양식 — 신지연(`wrapup.js` 화면) + 하주향(`gemini.js` 프롬프트)
- 화자 이름 수정 — 송지은(UI) + 하주향(전사·분석 연결)

**담당 표에 안 잡히는 공유 구간 셋** (충돌이 여기서 납니다):

- `index.html`은 한 파일을 셋이 나눠 씁니다(랜딩·대시보드·온보딩). 영역을 나눠도
  git 충돌이 나니 커밋을 작게 쪼개고 자주 당겨 받으세요.
- **`MF_MODELS`와 Gemini 호출구는 `index.html` 맨 아래**에 있습니다. AI 로직 담당이
  모델을 건드리려면 이 파일을 열어야 합니다.
- `js/google.js`는 `utils.js`의 `openCal`을 덮어쓰고, 대시보드 아젠다 패널에 버튼을
  주입합니다. 신지연·송지은 영역이 여기서 만납니다.

## ⚠️ 반드시 지킬 것

아래는 취향이 아니라 **코드가 실제로 그렇게 동작해서** 어기면 앱이 깨지는 것들입니다.

### 1. ES 모듈로 바꾸지 않는다

`js/*.js`는 전부 **일반 스크립트**입니다 (`type="module"` 아님).
`onclick="gp('upload')"` 형태의 인라인 핸들러가 63개 있습니다
(`index.html` 47개 + JS 템플릿 문자열 안 16개). 모듈로 바꾸면
전역 스코프가 사라져 **전부 깨집니다.**

"모던하게 모듈로 리팩터링할까요?" 같은 제안은 하지 마세요.

### 2. 스크립트 로드 순서가 의존성이다

`index.html` 하단의 `<script src>` 순서가 실행 순서입니다.
상태·유틸이 먼저, `js/main.js`(init 호출)가 마지막입니다.
새 js 파일을 만들면 **이 목록에 순서를 맞춰 추가**해야 합니다.

같은 이름의 전역 변수를 두 파일에서 `let`/`const`로 선언하면
**SyntaxError로 앱 전체가 죽습니다.** 새 전역이 필요하면 `js/state.js`에 넣으세요.
같은 이름의 함수를 두 파일에 두면 나중에 로드된 쪽이 조용히 이깁니다.

### 3. 모바일·반응형은 하지 않는다

**데스크톱 전용**입니다. 미디어쿼리가 없고 일부 레이아웃이 고정폭인 것은
의도된 상태이니 그대로 두세요. 반응형 작업을 먼저 제안하지 마세요.

(`design/responsive` 브랜치에 반응형 작업이 남아 있지만 의도적으로 머지하지 않았습니다.
오래된 main에서 갈라져 나와 이미 삭제된 클래스를 건드립니다.)

### 4. `css/base.css`는 앱 전체의 기준이다

색·타이포·간격·반경 토큰이 여기 있습니다. 개별 화면을 손볼 때는 값을 새로 쓰지 말고
이미 정의된 변수(`--pk`, `--muted`, `--bd`, `--fs-md`, `--sp-4`, `--r-md` 등)를 쓰세요.

## 실행 방법

```bash
python -m http.server 8000
```
→ http://localhost:8000

`index.html`을 더블클릭해 `file://`로 열면 **구글 로그인이 동작하지 않습니다.**
반드시 로컬 서버로 띄우세요. `localhost`는 Firebase 승인 도메인이라 로그인이 됩니다.

> 코드를 고쳤는데 화면이 그대로면 브라우저 캐시입니다. `Ctrl+Shift+R`로 강력 새로고침하세요.
> 파이썬 기본 서버는 캐시 헤더를 보내지 않아 js 파일이 자주 캐시됩니다.
> (실제로 이것 때문에 수정이 반영 안 된 걸 모르고 검증한 적이 있습니다.)

## 구조

- 빌드 도구 없음. HTML + CSS + 바닐라 JS
- `index.html` 마크업 / `css/` 3개 / `js/` 기능별 분리
- Firebase: Auth(구글 로그인), Firestore(데이터), AI Logic(Gemini)
- 데이터: `projects/{id}` + `projects/{id}/meetings/{id}` 하위 컬렉션,
  `memberUids` 배열로 접근 제어, 6자리 초대 코드로 팀원 참여
- Gemini 호출구는 `index.html` 맨 아래 `<script type="module">`에서 노출합니다.
  API 키는 코드에 없습니다.
  - `window.mfGenerateJSON` — 구조화 JSON (회의 분석)
  - `window.mfTranscribeAudio` — 음성 전사
  - `window.mfGroundedSearch` — Google 검색 그라운딩 (추가 자료 찾기)

  셋 다 `mfCallWithFallback`을 거칩니다. 모델 이름은 `MF_MODELS` 한 곳에만 있고,
  429/404가 나면 아래 후보로 내려갑니다. **모델 이름을 개별 함수에 하드코딩하지 마세요.**

## 회의 분석 데이터 모양

회의 문서 하나가 담는 것 (`js/gemini.js`의 스키마 = `js/meetings.js`가 저장하는 모양):

- `summary` — 2~3문장 요약
- `topics` — **안건별 논의 내용**(회의록 본문). `[{title, discussion[]}]`
- `items` — 이번 회의에서 새로 생긴 업무. `id`는 저장 시 부여
- `carriedOver` — 지난 회의 미완료 업무에 대한 판단
- `gaps` — AI가 짚은 놓친 부분

`topics`가 없는 과거 회의가 있습니다. 회의록 화면은 그때 안내 문구로 폴백하니
마이그레이션은 필요 없습니다.

## git 규칙

**`main`에 직접 push하지 않습니다.** 브랜치를 파고 PR로 합칩니다.

```bash
git checkout main
git pull                                # 항상 최신에서 시작
git checkout -b feat/세은-base-tokens    # feat/<이름>-<작업>
# ... 작업 ...
git commit -m "design: base.css 토큰 정비"
git push -u origin feat/세은-base-tokens
```

PR을 올리면 **다른 한 명이 보고 머지**합니다.

- 커밋은 목적 단위로 쪼개고, 메시지는
  `feat:`/`fix:`/`design:`/`docs:`/`refactor:`/`chore:` 접두사를 씁니다.
- **PR은 작게, 자주.** 브랜치를 오래 묵힐수록 충돌이 커집니다.
- 작업이 하루를 넘기면 중간에 `main`을 당겨 받으세요
  (`git checkout main && git pull && git checkout - && git merge main`).

### 충돌이 나는 자리 셋

`index.html`을 셋이 나눠 쓰지만, **서로 다른 줄만 건드리면 git이 알아서 합칩니다.**
진짜 조심할 곳은 여기입니다.

1. **`index.html` 맨 아래 `<script src>` 목록** — 새 js 파일을 추가하면 여기를
   건드립니다. 파일 추가는 팀에 먼저 공유하세요.
2. **`js/state.js`** — 같은 이름의 전역을 두 사람이 선언하면 충돌 이전에
   **SyntaxError로 앱 전체가 죽습니다.** 전역 추가는 반드시 공유 후.
3. **`index.html`의 `MF_MODELS`·Gemini 호출구** — AI 로직 담당 둘이 같이 봅니다.

### 개발용 Firebase 데이터

**다섯 명이 같은 Firestore를 봅니다.** 각자 `localhost`로 띄워도 데이터는 하나예요.
개발하면서 만든 테스트 회의가 서로 섞이고, 한 명이 지우면 같이 사라집니다.

- 개발용으로 **각자 자기 테스트 프로젝트를 하나씩** 만들어 쓰세요.
- **발표·데모용 프로젝트는 따로 두고 아무도 건드리지 않습니다.**

## 알아둘 상태

- AI 호출이 `401 App Check token is invalid`로 막힐 수 있습니다.
  콘솔 설정 문제이니 코드를 고치려 하지 마세요.
- **Gemini 호출은 무료(Spark) 한도 안에서 씁니다.**
  최신 Gemini 모델은 무료 티어에 없을 때가 있어 계속 429가 납니다. 그래서
  `MF_MODELS`에 후보를 위→아래(성능 좋음→무료 한도 넉넉함) 순으로 두고 폴백합니다.
  새 모델이 나오면 목록 맨 위에 추가만 하면 되고, 무료 티어에 없으면 알아서 건너뜁니다.
- **Google 검색 그라운딩은 구조화 JSON 출력과 함께 쓰지 않습니다.** 같이 쓰면
  출처 정보(`groundingChunks`)가 비어서 돌아오는 문제가 보고돼 있습니다.
  회의 분석(JSON)과 자료 찾기(그라운딩)는 **반드시 별도 호출**로 유지하세요.
  또 그라운딩 응답은 Google 정책상 **검색 제안과 출처를 화면에 표시해야 합니다.**
- **STT를 Cloud Speech-to-Text로 전환 중입니다 (2026-09-18~).** 화자 분리를 쓰려면
  서비스 계정 인증이 필요해 Cloud Function이 있어야 하고, 그래서 **Blaze 요금제로
  전환합니다.** `functions/`(chirp_3 화자 분리)와 `storage.rules`는 이때 쓰려고
  만들어둔 것이며 배포만 남았습니다.
  - 전환 전까지는 Gemini 전사가 그대로 쓰입니다(화자 구분 없음, 48kbps·15MB·약 43분).
  - **회의를 조각내 전사하지 마세요.** 화자 번호가 요청 단위로 매겨져서 나눠 보내면
    화자가 뒤섞입니다. 회의 전체를 한 번에 `batchRecognize`로 넘깁니다.
  - `chirp_3`는 `eu` 로케이션을 씁니다. 오디오가 EU로 전송된다는 뜻이라,
    개인정보 안내에 반영이 필요합니다.
- 랜딩의 "준비 중" 배지가 붙은 기능은 아직 구현되지 않았습니다.
