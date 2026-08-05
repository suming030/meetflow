/* MeetFlow — 로그인·로그아웃, 로그인 모달, 상단 CTA
   소유자: 공용 */

/* ──── 인증 (Firebase Auth) ──── */
function handleAuthChange(user){
  currentUser = user;
  if(user){
    const projects = loadProjects();
    const activeId = localStorage.getItem('mf_active_project_'+user.uid);
    currentProject = projects.find(p=>p.id===activeId) || projects[0] || null;
  } else {
    currentProject = null;
  }
  loadProjectHistory();
  renderAuthArea();
  renderProjectBadge();
  renderProjectsGallery();
  renderAll();
  /* 로그인 상태가 확정된 뒤에 URL(해시)이 가리키는 화면을 복원 */
  if(!routeReady){ routeReady=true; applyHash(); }
}

function renderAuthArea(){
  const el=document.getElementById('auth-area'); if(!el) return;
  if(currentUser){
    el.innerHTML=`
      <div class="user-chip" onclick="signOutUser()" title="로그아웃">
        ${currentUser.photoURL?`<img src="${currentUser.photoURL}" class="user-avatar" referrerpolicy="no-referrer">`:`<div class="user-avatar" style="display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:800;color:#fff;background:linear-gradient(135deg,var(--pk),var(--pk-dark));">${(currentUser.displayName||currentUser.email||'?')[0]}</div>`}
        <span class="user-name">${currentUser.displayName||currentUser.email}</span>
      </div>`;
  } else {
    el.innerHTML='';
  }
  renderCta();
}
/* nav의 프로젝트 버튼은 로그인했을 때만 노출한다 (로그아웃 시 nav 우측은 비움) */
function renderCta(){
  const navBtn=document.getElementById('nav-cta');
  if(navBtn) navBtn.style.display = currentUser?'':'none';
}
/* 로그인 전이면 로그인부터, 로그인 후면 프로젝트 목록으로 */
function navCta(){
  if(currentUser) gp('projects');
  else openLogin();
}
/* 히어로 CTA — 로그인 전이면 로그인 모달부터, 로그인 후면 회의 분석으로 */
function heroCta(){
  if(currentUser) gp('upload');
  else openLogin();
}
function openLogin(){ document.getElementById('login-overlay').classList.add('show'); }
function closeLogin(){ document.getElementById('login-overlay').classList.remove('show'); }
document.addEventListener('keydown',e=>{ if(e.key==='Escape') closeLogin(); });
function loginFromModal(){
  closeLogin();
  signInGoogle('upload');
}
function renderProjectBadge(){
  const el=document.getElementById('nav-project'); if(!el) return;
  if(currentProject){ el.style.display='inline-flex'; el.textContent='📁 '+currentProject.name; }
  else el.style.display='none';
}
async function signInGoogle(after){
  try{
    await window.mfSignIn();
    toast('로그인 됐어요! 🎉','success');
    /* 로그인 직후에는 랜딩에 머무르지 않고 눌렀던 버튼이 향하던 화면으로 넘어간다.
       (새로고침으로 복원되는 경우는 applyHash가 처리하므로 여기서만 이동) */
    gp(after||'projects');
  }
  catch(e){ toast('로그인에 실패했어요: '+e.message,'error'); }
}
async function signOutUser(){
  await window.mfSignOut();
  toast('로그아웃 됐어요.','info');
  gp('landing');
}
