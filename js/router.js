/* MeetFlow — 페이지·탭 전환 (해시 라우팅)
   소유자: 공용 */

/* ──── 페이지·탭 전환 (해시 라우팅 — 브라우저 뒤로가기 지원) ──── */
const AUTH_PAGES=['upload','dash','projects','onboard','track'];
let currentTab='overview';

function gp(id,opts){
  opts=opts||{};
  if(AUTH_PAGES.includes(id)&&!currentUser){
    if(opts.fromPop){ gp('landing',{fromPop:true}); return; }
    openLogin(); return;
  }
  if(id==='upload'||id==='dash'){
    if(!currentProject){ id='track'; }
    else if(currentProject.onboardStatus==='pending'){ id='onboard'; }
  }
  if(id==='onboard'&&!currentProject){ id='track'; }
  if(!document.getElementById('page-'+id)) id='landing';

  document.querySelectorAll('.page').forEach(p=>p.classList.remove('active'));
  document.getElementById('page-'+id).classList.add('active');
  window.scrollTo(0,0);
  if(id==='onboard') renderOnboardPage();
  if(id==='projects') renderProjectsGallery();
  if(id==='dash') sdt(opts.tab||currentTab,{silent:true});

  syncRoute(id==='dash'?('dash/'+currentTab):id, opts.fromPop);
}
/* 주의: 이 스크립트의 전역 `history`(회의 이력 배열)가 window.history를 가리므로 반드시 window 경유 */
function syncRoute(route,replace){
  const url='#'+route;
  if(location.hash===url) return;
  if(replace) window.history.replaceState({route},'',url);
  else        window.history.pushState({route},'',url);
}
function applyHash(){
  const raw=(location.hash||'').replace(/^#/,'');
  if(!raw){ gp('landing',{fromPop:true}); return; }
  const [page,tab]=raw.split('/');
  gp(page,{fromPop:true,tab});
}
window.addEventListener('popstate',applyHash);

function sdt(id,opts){
  opts=opts||{};
  if(!document.getElementById('tab-'+id)) id='overview';
  document.querySelectorAll('#page-dash .tab').forEach(t=>t.classList.remove('active'));
  document.querySelectorAll('.sb-item[id^="sb-"]').forEach(s=>s.classList.remove('on'));
  document.getElementById('tab-'+id).classList.add('active');
  const sb=document.getElementById('sb-'+id); if(sb) sb.classList.add('on');
  currentTab=id;
  if(!opts.silent) syncRoute('dash/'+id,false);
}
