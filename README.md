# MeetFlow

> 여러 회의를 하나로 이어서 프로젝트 전체의 흐름을 계속 붙잡아주는 AI

공모전·팀플·동아리를 운영하는 대학생 팀을 위한 서비스입니다.
기존 AI 회의록은 회의 한 건을 잘 남기는 데서 멈추지만, MeetFlow는 **회의가 쌓일수록 프로젝트 흐름이 더 선명해지는 것**을 목표로 합니다.

---

## 파일 구조와 담당자

4명이 동시에 작업할 수 있도록 파일을 나눠 놨습니다. **자기 파일만 수정하는 것이 원칙**입니다.

### 디자인 A — 브랜드 / 바깥 화면

| 파일 | 내용 |
|---|---|
| `css/base.css` | 색 토큰, 타이포, 버튼·뱃지·카드 등 공용 컴포넌트, 내비게이션 |
| `css/landing.css` | 랜딩 페이지 (히어로 / 기능 카드 / 연동 배지 / CTA) |
| `index.html` 랜딩 영역 | 랜딩 마크업 |

`base.css`는 앱 전체의 기준이 되는 공용 파일입니다. **다른 담당자가 직접 고치지 않고 A에게 요청**하세요. 이 규칙 하나로 디자인 톤이 갈라지는 걸 막습니다.

**A 우선순위** ① 디자인 시스템 정립(색·타이포·간격 규격화) ② 랜딩 히어로의 가짜 미리보기 교체 ③ 공유용 OG 이미지
— 반응형은 하지 않습니다.

### 디자인 B — 제품 / 안쪽 화면

| 파일 | 내용 |
|---|---|
| `css/app.css` | 회의 분석·대시보드·온보딩·모달·토스트 |
| `js/dashboard.js` | 대시보드 렌더링 (화면 구조가 여기 JS 안에 있음) |
| `index.html` 대시보드 영역 | 대시보드 마크업 |

### 기능 C — Core (회의 흐름)

| 파일 | 내용 |
|---|---|
| `js/meetings.js` | 회의 분석 + 이력 저장(`saveHistory`). **지난 회의 미완료 → 이번 회의 반영**이 여기 들어갑니다 |
| `js/gemini.js` | Gemini 공통 호출·JSON 파싱 |
| `js/stt.js` | 녹음 + 전사 (Gemini) |
| `js/onboarding.js` | 1단계 트랙별 온보딩 |

제품의 차별점 그 자체이므로 가장 비중이 큰 파트입니다.

### 기능 D — 구글 연동

| 파일 | 내용 |
|---|---|
| `js/google.js` | Google Calendar 일정 등록, 회의록 Google Docs 내보내기 |

**서버 없이 브라우저에서 구현할 수 있습니다.** Firebase 구글 로그인에 스코프를 추가하면 액세스 토큰을 받을 수 있고, 그 토큰으로 Google API를 직접 호출하면 됩니다.

```js
provider.addScope('https://www.googleapis.com/auth/calendar.events');
const token = GoogleAuthProvider.credentialFromResult(result).accessToken;
```

⚠️ 액세스 토큰은 약 1시간 뒤 만료되고 자동 갱신되지 않습니다. 만료 시 재로그인을 유도해야 합니다.

### 공용 (건드릴 땐 팀에 공유)

`js/state.js` 전역 상태 · `js/utils.js` 토스트/유틸 · `js/auth.js` 로그인 · `js/router.js` 페이지 전환 · `js/projects.js` 프로젝트 CRUD · `js/main.js` 시작점

---

## 협업 규칙

1. **자기 파일만 수정**합니다. 남의 파일을 고쳐야 하면 먼저 말하세요.
2. `index.html`과 공용 JS는 **짧게 작업하고 바로 머지**합니다.
3. 브랜치는 `design/responsive`, `feat/calendar` 형태로 파고 **main에 직접 푸시하지 않습니다.**
4. 하루 한 번은 `git pull origin main` — 오래 묵힐수록 충돌이 커집니다.
5. `js/dashboard.js`처럼 디자인과 기능이 겹치는 파일은 **디자인 담당은 클래스명·스타일만, 구조 변경은 기능 담당과 상의**합니다.

⚠️ `js/`의 스크립트는 **일반 스크립트**입니다 (`type="module"` 아님). 마크업에 `onclick="gp('upload')"` 같은 인라인 핸들러가 50개 넘게 있어서 전역 스코프가 유지돼야 합니다. **모듈로 바꾸면 전부 깨집니다.**
`index.html`의 스크립트 로드 **순서도 중요**합니다 — 상태·유틸이 먼저, `main.js`가 마지막입니다.

---

## 실행 방법

```bash
python -m http.server 8000
```

http://localhost:8000 으로 접속합니다. `localhost`는 Firebase 기본 승인 도메인이라 구글 로그인이 바로 됩니다.

`file://`로 직접 열면 로그인이 동작하지 않습니다.

---

## 현재 진행 상황

**구현 완료**
- 구글 로그인, 다중 프로젝트 생성·전환·삭제
- 트랙별(팀프로젝트/공모전/동아리) AI 온보딩 → 마일스톤·역할·배점·1차 아젠다 생성
- 회의 텍스트 분석 → 담당자·업무·마감일 추출
- 녹음 / 음성 파일 → Gemini 전사 (짧은 회의 1~2분 기준, 화자 구분은 없음)
- 대시보드 6개 탭, 해시 라우팅(브라우저 뒤로가기)

**미구현** — 랜딩에 "준비 중" 배지로 표시돼 있습니다
- 회의를 이어서 관리 (지난 회의 미완료 반영) ← **최우선**
- 관련 자료 자동 추천 (Grounding with Google Search)
- 프로젝트 종료 후 경험 정리

**Firestore 규칙 배포** (팀 공유가 안 되면 이것부터)

```bash
firebase login
firebase deploy --only firestore:rules
```

데이터 구조는 `projects/{id}` + `projects/{id}/meetings/{id}` 하위 컬렉션이고,
`memberUids` 배열로 접근을 제어합니다. 팀원은 6자리 **초대 코드**로 참여합니다
(`invites/{code}` 컬렉션이 공개 인덱스 역할).

**아직 안 된 설정**
- App Check 적용 해제 또는 정식 설정 (안 하면 AI 호출이 401로 막힘)
- 배포 도메인 `suming030.github.io`를 Firebase 승인된 도메인에 추가

**쓰지 않는 코드**
`functions/`, `storage.rules`는 Cloud Speech-to-Text(화자 분리)용으로 만들었으나
**현재 사용하지 않습니다.** 화자 분리는 서비스 계정 인증이 필요해 브라우저에서 직접
호출할 수 없고 Cloud Function + Blaze 요금제가 있어야 하는데, 녹음이 1~2분 수준이라
Gemini 전사만 쓰기로 했습니다. Blaze 결제도 필요 없습니다.

**알려진 한계**
- **데스크톱 전용입니다.** 모바일·반응형은 하지 않기로 했습니다. 미디어쿼리가 없고
  일부 레이아웃이 고정폭인 것은 의도된 상태이니 그대로 두세요.
- 데이터가 `localStorage`에만 저장돼 기기 간 공유가 안 됩니다
