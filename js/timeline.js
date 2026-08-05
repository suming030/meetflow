/* MeetFlow — 회의 타임라인
   소유자: 디자인 B

   ────────────────────────────────────────────────────────────
   이 파일은 비어 있습니다. 여기에 작업하세요.

   왜 새 파일인가:
     4명이 동시에 작업하기 때문에, 이미 있는 파일을 고치면 머지할 때 충돌이 납니다.
     새 파일에만 쓰면 충돌이 나지 않습니다.
     index.html에는 이미 연결해 두었으니 그 파일은 건드리지 마세요.

   만들 것:
     1차 → 2차 → 3차 회의가 세로로 이어지는 화면.
     이 서비스의 차별점("회의가 쌓일수록 프로젝트가 선명해진다")을
     사용자 눈에 보이게 하는 가장 중요한 화면입니다.

   쓸 수 있는 데이터 — 전역 변수 history (최신 회의가 [0]):
     [
       {
         id,                  회의 문서 ID
         date,                "2026-08-05T12:00:00.000Z"
         summary,             AI가 쓴 2~3문장 요약
         items: [             그 회의에서 새로 정해진 업무
           { id, task, assignee, deadline, status, priority, carryNote }
         ],
         carriedOver: [       지난 회의에서 이어진 업무에 대한 AI 판단
           { id, task, resolved, note, newDeadline }
         ],
         gaps: [ "예산 논의가 빠졌어요" ],   AI가 짚은 놓친 부분
         createdByName        분석을 돌린 사람 이름
       }
     ]

   상태값: status 는 'todo' | 'doing' | 'done'
           전역 상수 ST 에 라벨·색·아이콘이 정의돼 있습니다 (js/state.js).

   참고할 만한 기존 코드:
     js/dashboard.js 의 renderBriefing() — 패널과 D-day 카드를 그리는 방식
     js/meetings.js 의 carryOverHTML()   — 이어받은 업무를 보여주는 방식

   화면에 그리는 곳:
     index.html 의 <div class="tab" id="tab-timeline"> 안
     사이드바 메뉴도 이미 추가돼 있습니다 (🕒 회의 타임라인)
   ──────────────────────────────────────────────────────────── */

/** 회의 타임라인을 그린다. renderAll()에서 자동으로 호출됩니다. */
function renderTimeline(){
  const wrap = document.getElementById('timeline-wrap');
  if(!wrap) return;

  if(!history.length){
    wrap.innerHTML = `
      <div class="panel">
        <div class="empty">
          <div class="e-ico">🕒</div>
          <h3>아직 분석된 회의가 없어요</h3>
          <p>회의를 분석하면 여기에 순서대로 쌓입니다.</p>
        </div>
      </div>`;
    return;
  }

  /* TODO: 여기에 타임라인을 그리세요. */
  wrap.innerHTML = `<div class="panel">회의 ${history.length}건</div>`;
}
