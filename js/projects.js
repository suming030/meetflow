/* MeetFlow — 프로젝트 목록·생성·삭제·전환
   소유자: 공용 */

/* ──── 프로젝트 목록 (다중 프로젝트) ──── */
function loadProjects(){
  if(!currentUser) return [];
  const key='mf_projects_'+currentUser.uid;
  let list=JSON.parse(localStorage.getItem(key)||'null');
  if(!list){
    /* 이전 버전(단일 프로젝트) 데이터 마이그레이션 */
    const legacy=localStorage.getItem('mf_project_'+currentUser.uid);
    list=legacy?[JSON.parse(legacy)]:[];
    localStorage.setItem(key,JSON.stringify(list));
  }
  /* 온보딩 기능 이전 프로젝트는 온보딩 완료로 간주(재접속 시 막히지 않게) */
  list=list.map(p=>p.onboardStatus?p:{...p, onboardStatus:'done', onboarding:p.onboarding||null});
  return list;
}
function saveProjects(list){
  if(!currentUser) return;
  localStorage.setItem('mf_projects_'+currentUser.uid,JSON.stringify(list));
}
function persistCurrentProject(patch){
  if(!currentProject) return;
  const projects=loadProjects();
  const idx=projects.findIndex(p=>p.id===currentProject.id);
  if(idx<0) return;
  projects[idx]={...projects[idx], ...patch};
  saveProjects(projects);
  currentProject=projects[idx];
}
function switchProject(id,opts={}){
  const p=loadProjects().find(x=>x.id===id);
  if(!p) return;
  currentProject=p;
  localStorage.setItem('mf_active_project_'+currentUser.uid,id);
  loadProjectHistory();
  renderProjectBadge();
  renderProjectsGallery();
  renderAll();
  if(!opts.silent) toast(`"${p.name}"(으)로 전환했어요.`,'info');
  if(currentProject.onboardStatus==='pending') gp('onboard');
}
function openProject(id){
  switchProject(id,{silent:true});
  if(currentProject&&currentProject.id===id&&currentProject.onboardStatus!=='pending'){
    gp('dash');
  }
}
function renderProjectsGallery(){
  const el=document.getElementById('projects-gallery'); if(!el) return;
  const projects=loadProjects();
  const statusBdg={
    pending:'<span class="bdg b-nodl">⏳ 온보딩 필요</span>',
    skipped:'<span class="bdg b-dl">⏭️ 온보딩 건너뜀</span>',
    done:'<span class="bdg b-person" style="background:var(--teal-lt);color:var(--teal);">✅ 온보딩 완료</span>'
  };
  if(!projects.length){
    el.innerHTML=`
      <div class="panel">
        <div class="empty">
          <div class="e-ico">📁</div>
          <h3>아직 프로젝트가 없어요</h3>
          <p>새 프로젝트를 만들어서 회의 분석과 마일스톤 관리를 시작해보세요.</p>
          <button class="btn-pk" style="margin-top:18px;" onclick="gp('track')">✨ 새 프로젝트 만들기</button>
        </div>
      </div>`;
    return;
  }
  el.innerHTML=`
    <div class="feat-grid">
      ${projects.map(p=>`
        <div class="feat-card track-card" style="position:relative;" onclick="openProject('${p.id}')">
          <button class="ico-btn" style="position:absolute;top:14px;right:14px;" onclick="deleteProject('${p.id}',event)" title="프로젝트 삭제">🗑️</button>
          <div class="feat-ico" style="background:var(--pk-light);">${TRACK_ICON[p.track]||'📁'}</div>
          <h3>${p.name}</h3>
          <p>${TRACK_LBL[p.track]||''}</p>
          <div style="margin-top:10px;">${statusBdg[p.onboardStatus]||''}</div>
        </div>`).join('')}
      <div class="feat-card track-card" onclick="gp('track')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-style:dashed;">
        <div class="feat-ico" style="background:var(--pk-light);">➕</div>
        <h3>새 프로젝트</h3>
      </div>
    </div>`;
}
function deleteProject(id,evt){
  if(evt) evt.stopPropagation();
  const p=loadProjects().find(x=>x.id===id);
  if(!p) return;
  if(!confirm(`"${p.name}" 프로젝트를 삭제할까요?\n회의 이력과 온보딩 결과가 모두 삭제되고 되돌릴 수 없어요.`)) return;

  saveProjects(loadProjects().filter(x=>x.id!==id));
  localStorage.removeItem('mf_history_'+id);

  if(currentProject&&currentProject.id===id){
    currentProject=null;
    localStorage.removeItem('mf_active_project_'+currentUser.uid);
    history=[];
    renderProjectBadge();
  }
  renderProjectsGallery();
  toast(`"${p.name}" 프로젝트를 삭제했어요.`,'info');
}

/* ──── 트랙 선택·프로젝트 생성 (0단계) ──── */
function pickTrack(t){
  selectedTrack=t;
  document.querySelectorAll('.track-card').forEach(c=>c.classList.toggle('sel', c.dataset.track===t));
  const panel=document.getElementById('track-name-panel');
  panel.style.display='block';
  document.getElementById('track-name-inp').focus();
}
function createProject(){
  if(!currentUser){ toast('먼저 로그인해주세요.','error'); return; }
  if(!selectedTrack){ toast('프로젝트 유형을 선택해주세요.','error'); return; }
  const name=document.getElementById('track-name-inp').value.trim();
  if(!name){ toast('프로젝트 이름을 입력해주세요.','error'); return; }

  const newProject={
    id:'p_'+Date.now(),
    name, track:selectedTrack,
    ownerUid:currentUser.uid,
    createdAt:new Date().toISOString(),
    onboardStatus:'pending',
    onboarding:null
  };
  const projects=loadProjects();
  projects.unshift(newProject);
  saveProjects(projects);

  currentProject=newProject;
  localStorage.setItem('mf_active_project_'+currentUser.uid, newProject.id);
  loadProjectHistory();
  renderProjectBadge();
  renderProjectsGallery();
  toast(`"${name}" 프로젝트가 만들어졌어요! ${TRACK_LBL[selectedTrack]} 🎉`,'success');

  /* 트랙 선택 UI 초기화 (다음 프로젝트 생성 대비) */
  selectedTrack=null;
  document.querySelectorAll('.track-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('track-name-panel').style.display='none';
  document.getElementById('track-name-inp').value='';

  gp('onboard');
}
function loadProjectHistory(){
  history = currentProject ? JSON.parse(localStorage.getItem('mf_history_'+currentProject.id) || '[]') : [];
}
