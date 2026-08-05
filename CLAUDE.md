# MeetFlow 작업 규칙

여러 회의를 이어서 프로젝트 전체 흐름을 붙잡아주는 AI 서비스입니다.
대학생 팀(공모전·팀플·동아리)이 타겟이고, 4명이 파일을 나눠 동시에 작업합니다.

## ⚠️ 반드시 지킬 것

### 1. 담당 파일만 수정한다

4명이 같은 저장소에서 동시에 작업합니다. **담당이 아닌 파일은 열어보되 고치지 마세요.**

| 담당 | 파일 |
|---|---|
| 디자인 A | `css/base.css`, `css/landing.css`, `index.html`의 랜딩 영역 |
| 디자인 B | `css/app.css`, `js/dashboard.js`, `index.html`의 대시보드 영역 |
| 기능 C | `js/meetings.js`, `js/gemini.js`, `js/stt.js`, `js/onboarding.js`, `js/projects.js` |
| 기능 D | `js/google.js` |
| 공용 | `js/state.js`, `js/utils.js`, `js/auth.js`, `js/router.js`, `js/main.js`, `index.html` |

공용 파일을 고쳐야 하면 **먼저 팀에 알리고, 짧게 작업한 뒤 바로 머지**하세요.

`css/base.css`는 앱 전체의 색·타이포·간격 기준입니다. 디자인 A만 수정하고,
다른 사람은 이미 정의된 CSS 변수(`--pk`, `--muted`, `--bd` 등)를 사용하세요.

### 2. ES 모듈로 바꾸지 않는다

`js/*.js`는 전부 **일반 스크립트**입니다 (`type="module"` 아님).
`onclick="gp('upload')"` 형태의 인라인 핸들러가 63개 있습니다
(`index.html` 47개 + JS 템플릿 문자열 안 16개). 모듈로 바꾸면
전역 스코프가 사라져 **전부 깨집니다.**

"모던하게 모듈로 리팩터링할까요?" 같은 제안은 하지 마세요.

### 3. 스크립트 로드 순서가 의존성이다

`index.html` 하단의 `<script src>` 순서가 실행 순서입니다.
상태·유틸이 먼저, `js/main.js`(init 호출)가 마지막입니다.
새 js 파일을 만들면 **이 목록에 순서를 맞춰 추가**해야 합니다.

같은 이름의 전역 변수를 두 파일에서 `let`/`const`로 선언하면
**SyntaxError로 앱 전체가 죽습니다.** 새 전역이 필요하면 `js/state.js`에 넣으세요.
같은 이름의 함수를 두 파일에 두면 나중에 로드된 쪽이 조용히 이깁니다.

### 4. 모바일·반응형은 하지 않는다

**데스크톱 전용**입니다. 미디어쿼리가 없고 일부 레이아웃이 고정폭인 것은
의도된 상태이니 그대로 두세요. 반응형 작업을 먼저 제안하지 마세요.

## 실행 방법

```bash
python -m http.server 8000
```
→ http://localhost:8000

`index.html`을 더블클릭해 `file://`로 열면 **구글 로그인이 동작하지 않습니다.**
반드시 로컬 서버로 띄우세요. `localhost`는 Firebase 승인 도메인이라 로그인이 됩니다.

> 코드를 고쳤는데 화면이 그대로면 브라우저 캐시입니다. `Ctrl+Shift+R`로 강력 새로고침하세요.
> 파이썬 기본 서버는 캐시 헤더를 보내지 않아 js 파일이 자주 캐시됩니다.

## 구조

- 빌드 도구 없음. HTML + CSS + 바닐라 JS
- `index.html` 마크업 / `css/` 3개 / `js/` 기능별 분리
- Firebase: Auth(구글 로그인), Firestore(데이터), AI Logic(Gemini)
- 데이터: `projects/{id}` + `projects/{id}/meetings/{id}` 하위 컬렉션,
  `memberUids` 배열로 접근 제어, 6자리 초대 코드로 팀원 참여
- Gemini는 `window.mfGenerateJSON`(구조화 JSON), `window.mfTranscribeAudio`(음성 전사)로 호출.
  `index.html` 맨 아래 `<script type="module">`에서 노출합니다. API 키는 코드에 없습니다.

## git 규칙

```bash
git checkout main
git pull origin main
git checkout -b feature/기능명
```

작업 후 Commit → Push → Pull Request. **main에 직접 push 금지.**

## 알아둘 상태

- AI 호출이 `401 App Check token is invalid`로 막힐 수 있습니다. 콘솔 설정 문제이니
  코드를 고치려 하지 말고 팀에 알리세요.
- `functions/`, `storage.rules`는 Cloud Speech-to-Text용으로 만들었으나 **현재 사용하지 않습니다.**
  전사는 Gemini로만 합니다(짧은 회의 1~2분 기준, 화자 구분 없음).
- 랜딩의 "준비 중" 배지가 붙은 기능은 아직 구현되지 않았습니다.
