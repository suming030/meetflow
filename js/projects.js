/* MeetFlow — 프로젝트 목록·생성·삭제·전환
   소유자: 공용

   저장소는 Firestore다. 다만 화면 렌더 코드가 loadProjects()를 동기로 부르므로,
   Firestore에서 읽어온 결과를 projectsCache에 담아두고 동기 함수는 캐시만 읽는다.
   쓰기는 캐시를 먼저 갱신해 화면이 즉시 반응하게 하고, 서버 반영은 뒤에서 처리한다. */

/* ──── 프로젝트 목록 (Firestore + 메모리 캐시) ──── */
function loadProjects(){
  return currentUser ? projectsCache : [];
}

/** Firestore에서 내 프로젝트를 다시 읽어 캐시를 채운다. 로그인 직후 한 번 호출된다. */
async function syncProjects(){
  if(!currentUser || typeof window.mfDb!=='object'){ projectsCache=[]; return; }
  try{
    const list = await window.mfDb.listProjects(currentUser.uid);
    /* 온보딩 기능 이전 프로젝트는 온보딩 완료로 간주(재접속 시 막히지 않게) */
    projectsCache = list.map(p=>p.onboardStatus?p:{...p, onboardStatus:'done', onboarding:p.onboarding||null});
    await migrateLocalProjects();
  }catch(e){
    console.error('[MeetFlow] 프로젝트를 불러오지 못했어요', e);
    toast('프로젝트를 불러오지 못했어요. 새로고침해 주세요.','error');
    projectsCache = [];
  }
}

/** 예전 버전에서 localStorage에 저장해 둔 프로젝트를 한 번만 Firestore로 올린다. */
async function migrateLocalProjects(){
  const key='mf_projects_'+currentUser.uid;
  const raw=localStorage.getItem(key);
  if(!raw) return;
  let local=[];
  try{ local=JSON.parse(raw)||[]; }catch(e){ localStorage.removeItem(key); return; }

  const existing=new Set(projectsCache.map(p=>p.id));
  const toUpload=local.filter(p=>p && p.id && !existing.has(p.id));
  for(const p of toUpload){
    const proj={...p, ownerUid:p.ownerUid||currentUser.uid,
                memberUids:[currentUser.uid],
                onboardStatus:p.onboardStatus||'done', onboarding:p.onboarding||null};
    await window.mfDb.saveProject(proj);
    projectsCache.push(proj);
    /* 회의 이력도 함께 옮긴다 */
    const hraw=localStorage.getItem('mf_history_'+p.id);
    if(hraw){
      try{
        for(const m of (JSON.parse(hraw)||[]).slice().reverse()){
          await window.mfDb.addMeeting(p.id, m);
        }
      }catch(e){ console.warn('[MeetFlow] 회의 이력 이전 실패', p.id, e); }
      localStorage.removeItem('mf_history_'+p.id);
    }
  }
  localStorage.removeItem(key);
  if(toUpload.length){
    toast(`이전에 저장된 프로젝트 ${toUpload.length}개를 계정으로 옮겼어요.`,'success');
  }
}

/** 캐시를 즉시 갱신하고 서버에는 뒤이어 반영한다. */
function persistCurrentProject(patch){
  if(!currentProject) return;
  const idx=projectsCache.findIndex(p=>p.id===currentProject.id);
  const updated={...(idx>=0?projectsCache[idx]:currentProject), ...patch};
  if(idx>=0) projectsCache[idx]=updated;
  currentProject=updated;
  window.mfDb.saveProject(updated).catch(e=>{
    console.error('[MeetFlow] 저장 실패', e);
    toast('변경 사항을 저장하지 못했어요.','error');
  });
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
          <p>새 프로젝트를 만들거나, 팀원에게 받은 초대 코드로 참여해보세요.</p>
          <div style="display:flex;gap:8px;justify-content:center;margin-top:18px;">
            <button class="btn-pk" onclick="gp('track')">✨ 새 프로젝트 만들기</button>
            <button class="btn-out" onclick="promptJoinProject()">🔑 초대 코드로 참여</button>
          </div>
        </div>
      </div>`;
    return;
  }
  el.innerHTML=`
    <div class="feat-grid">
      ${projects.map(p=>`
        <div class="feat-card track-card" style="position:relative;" onclick="openProject('${p.id}')">
          ${p.ownerUid===currentUser.uid
            ? `<button class="ico-btn" style="position:absolute;top:14px;right:14px;" onclick="deleteProject('${p.id}',event)" title="프로젝트 삭제">🗑️</button>`
            : ''}
          <div class="feat-ico" style="background:var(--pk-light);">${TRACK_ICON[p.track]||'📁'}</div>
          <h3>${p.name}</h3>
          <p>${TRACK_LBL[p.track]||''}${(p.memberUids&&p.memberUids.length>1)?` · 팀원 ${p.memberUids.length}명`:''}</p>
          <div style="margin-top:10px;">${statusBdg[p.onboardStatus]||''}</div>
        </div>`).join('')}
      <div class="feat-card track-card" onclick="gp('track')" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-style:dashed;">
        <div class="feat-ico" style="background:var(--pk-light);">➕</div>
        <h3>새 프로젝트</h3>
      </div>
      <div class="feat-card track-card" onclick="promptJoinProject()" style="display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;border-style:dashed;">
        <div class="feat-ico" style="background:var(--pk-light);">🔑</div>
        <h3>초대 코드로 참여</h3>
      </div>
    </div>`;
}
async function deleteProject(id,evt){
  if(evt) evt.stopPropagation();
  const p=loadProjects().find(x=>x.id===id);
  if(!p) return;
  if(p.ownerUid!==currentUser.uid){ toast('프로젝트를 만든 사람만 삭제할 수 있어요.','error'); return; }
  if(!confirm(`"${p.name}" 프로젝트를 삭제할까요?\n회의 이력과 온보딩 결과가 모두 삭제되고 되돌릴 수 없어요.`)) return;

  projectsCache=projectsCache.filter(x=>x.id!==id);
  if(currentProject&&currentProject.id===id){
    currentProject=null;
    localStorage.removeItem('mf_active_project_'+currentUser.uid);
    history=[];
    renderProjectBadge();
  }
  renderProjectsGallery();
  try{
    await window.mfDb.deleteProject(id);
    if(p.inviteCode) await window.mfDb.deleteInvite?.(p.inviteCode);
    toast(`"${p.name}" 프로젝트를 삭제했어요.`,'info');
  }catch(e){
    console.error('[MeetFlow] 삭제 실패', e);
    toast('삭제하지 못했어요. 새로고침 후 다시 시도해주세요.','error');
  }
}

/* ──── 초대 코드로 팀원 참여 ──── */
function makeInviteCode(){
  const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* 헷갈리는 O0I1 제외 */
  return Array.from({length:6},()=>chars[Math.floor(Math.random()*chars.length)]).join('');
}
async function promptJoinProject(){
  if(!currentUser){ openLogin(); return; }
  const code=(prompt('팀원에게 받은 초대 코드를 입력하세요 (6자리)')||'').trim().toUpperCase();
  if(!code) return;
  try{
    const info=await window.mfDb.lookupInvite(code);
    if(!info){ toast('그런 초대 코드가 없어요. 다시 확인해주세요.','error'); return; }
    if(projectsCache.some(p=>p.id===info.projectId)){ toast('이미 참여 중인 프로젝트예요.','info'); return; }
    await window.mfDb.joinProject(info.projectId, currentUser.uid);
    await syncProjects();
    renderProjectsGallery();
    const joined=projectsCache.find(p=>p.id===info.projectId);
    toast(joined?`"${joined.name}"에 참여했어요! 🎉`:'프로젝트에 참여했어요!','success');
  }catch(e){
    console.error('[MeetFlow] 참여 실패', e);
    toast('참여하지 못했어요: '+e.message,'error');
  }
}
function showInviteCode(){
  if(!currentProject) return;
  if(!currentProject.inviteCode){ toast('초대 코드가 아직 없어요.','error'); return; }
  prompt('팀원에게 이 코드를 알려주세요', currentProject.inviteCode);
}

/* ──── 트랙 선택·프로젝트 생성 (0단계) ──── */
function pickTrack(t){
  selectedTrack=t;
  document.querySelectorAll('.track-card').forEach(c=>c.classList.toggle('sel', c.dataset.track===t));
  const panel=document.getElementById('track-name-panel');
  panel.style.display='block';
  document.getElementById('track-name-inp').focus();
}
async function createProject(){
  if(!currentUser){ toast('먼저 로그인해주세요.','error'); return; }
  if(!selectedTrack){ toast('프로젝트 유형을 선택해주세요.','error'); return; }
  const name=document.getElementById('track-name-inp').value.trim();
  if(!name){ toast('프로젝트 이름을 입력해주세요.','error'); return; }

  const inviteCode=makeInviteCode();
  const newProject={
    id:'p_'+Date.now(),
    name, track:selectedTrack,
    ownerUid:currentUser.uid,
    memberUids:[currentUser.uid],
    inviteCode,
    createdAt:new Date().toISOString(),
    onboardStatus:'pending',
    onboarding:null
  };

  projectsCache.unshift(newProject);
  currentProject=newProject;
  localStorage.setItem('mf_active_project_'+currentUser.uid, newProject.id);
  history=[];
  renderProjectBadge();
  renderProjectsGallery();

  /* 트랙 선택 UI 초기화 (다음 프로젝트 생성 대비) */
  selectedTrack=null;
  document.querySelectorAll('.track-card').forEach(c=>c.classList.remove('sel'));
  document.getElementById('track-name-panel').style.display='none';
  document.getElementById('track-name-inp').value='';

  gp('onboard');

  try{
    await window.mfDb.saveProject(newProject);
    await window.mfDb.createInvite(inviteCode, newProject.id, currentUser.uid);
    toast(`"${name}" 프로젝트가 만들어졌어요! 초대 코드: ${inviteCode} 🎉`,'success');
  }catch(e){
    console.error('[MeetFlow] 프로젝트 생성 실패', e);
    toast('프로젝트를 저장하지 못했어요: '+e.message,'error');
  }
}

/** 현재 프로젝트의 회의 이력을 Firestore에서 읽어 history에 채운다. */
async function loadProjectHistory(){
  /* 읽어오는 동안 이전 프로젝트의 회의가 남아 보이지 않도록 먼저 비운다 */
  history=[];
  if(!currentProject) return;
  const projectId=currentProject.id;
  try{
    const list=await window.mfDb.listMeetings(projectId);
    /* 늦게 도착한 응답이 그 사이 바뀐 프로젝트를 덮어쓰지 않도록 확인 */
    if(currentProject && currentProject.id===projectId){
      history=list;
      renderAll();
    }
  }catch(e){
    console.error('[MeetFlow] 회의 이력을 불러오지 못했어요', e);
    history=[];
  }
}
