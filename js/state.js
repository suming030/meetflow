/* MeetFlow — 전역 상태와 상수
   소유자: 공용 — 바꾸기 전 팀에 공유 */

/* ──── 전역 상태 ──── */
let history = [];              /* 현재 프로젝트의 회의 이력 (Firestore에서 읽어온 캐시) */
let projectsCache = [];        /* 내 프로젝트 목록 캐시 — loadProjects()가 이걸 읽는다 */
let routeReady = false;
let currentUser    = null;
let currentProject = null;
let selectedTrack   = null;
let lastResult     = null;     /* 가장 최근 분석 결과 — 자료 찾기(js/research.js)가 참고한다 */
let currentMeetingId = null;   /* 대시보드 "N차 회의" 화면이 보여주는 회의 (js/timeline.js) */

const TRACK_LBL  = {team:'🧑‍🤝‍🧑 팀 프로젝트', contest:'🏆 공모전', club:'🎨 동아리'};
const TRACK_ICON = {team:'🧑‍🤝‍🧑', contest:'🏆', club:'🎨'};

const ST = {
  cycle: ['todo','doing','done'],
  lbl:   {todo:'미시작', doing:'진행중', done:'완료'},
  cls:   {todo:'s-todo', doing:'s-doing', done:'s-done'},
  ico:   {todo:'⬜', doing:'🔄', done:'✅'},
};

/* 아바타 색상 매핑 */
const _avMap = {};
let _avIdx = 0;
function avCls(name){ if(!_avMap[name]) _avMap[name]='av'+(_avIdx++%5); return _avMap[name]; }

/* 샘플 텍스트 */
const SAMPLES = {
1:`오늘 기획팀 주간 회의 내용입니다.

홍길동 팀장님이 2분기 마케팅 기획서를 7월 5일까지 작성하기로 하셨습니다.
김영희님은 경쟁사 분석 리포트를 7월 3일까지 공유해 주시기로 했습니다.
이철수님이 SNS 콘텐츠 캘린더를 이번 달 말까지 완성하기로 했습니다.
박민준님은 다음 주 월요일까지 광고 예산안을 제출해야 합니다.
홍길동 팀장님은 추가로 팀 OKR 점검 자료도 7월 10일까지 정리해 주시기로 했습니다.`,
2:`개발팀 스프린트 회고 및 계획 미팅입니다.

백엔드 API 개발은 이준호님이 담당하며 7월 10일까지 완료 예정입니다.
프론트엔드 UI 컴포넌트 개발은 최지수님이 7월 8일까지 진행합니다.
QA 테스트 계획서는 강태양님이 7월 6일까지 작성해 공유해 주세요.
배포 파이프라인 구성은 이준호님이 7월 12일까지 완성합니다.
최지수님은 성능 최적화 작업도 7월 15일까지 완료 예정입니다.`,
3:`디자인팀 리뷰 미팅 결과입니다.

UI 시안 수정은 정하은님이 7월 4일까지 마무리합니다.
사용성 테스트 결과 분석은 윤서준님이 담당하며 7월 7일까지 보고서를 작성합니다.
디자인 시스템 업데이트는 정하은님과 윤서준님이 함께 7월 15일까지 진행합니다.
정하은님은 아이콘 에셋도 7월 5일까지 정리해서 공유해 주시기로 했습니다.`,
};
