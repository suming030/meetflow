/* MeetFlow — 녹음 + 전사
   담당: ① 회의 입력·분석*/

/* ════════════════════════════════
   녹음 + 전사 (음성 입력)

   전사 경로가 둘이다.
   - Gemini 전사 (지금 기본): 오디오를 Gemini에 그대로 보낸다. 화자 구분이 추정이라 부정확하고,
     요청 크기 상한(약 20MB) 때문에 약 40분까지만 된다.
   - Cloud Speech-to-Text (화자 분리): 녹음을 Storage에 올리고 Cloud Function(functions/)이
     batchRecognize로 통째로 전사한다. Blaze 요금제가 필요해 결제 승인을 기다리는 중이다.
     승인 후 `firebase deploy --only functions,storage` 하고 STT_CLOUD_ENABLED를 true로 켠다.
     Cloud 전사가 실패하면 Gemini로 대신한다(파일이 작을 때만).

   전사는 오래 걸릴 수 있어서(1시간 회의 ≈ Gemini 약 4분, Cloud는 실측 전) 다른 화면으로
   가도 뒤에서 계속되고, 끝나면 알림을 띄운다.
════════════════════════════════ */
const AUDIO_BPS         = 48000;  /* 48kbps opus — 전사 정확도를 위해 여유 있게 */
const GEMINI_MAX_MB     = 15;     /* Gemini 요청 상한 약 20MB, base64 팽창을 감안한 값 */
const CLOUD_MAX_MB      = 500;    /* storage.rules의 업로드 상한과 같은 값 */
const STT_CLOUD_ENABLED = false;  /* 결제·배포 전까지 false — 켜면 Cloud Speech-to-Text로 전사 */

let mediaStream=null, recorder=null, recTick=null;
let recStartMs=0, recChunks=[], sttBusy=false;

function pickAudioMime(){
  if(!window.MediaRecorder) return '';
  return ['audio/webm;codecs=opus','audio/webm','audio/mp4'].find(m=>MediaRecorder.isTypeSupported(m))||'';
}
function extFromMime(m){ return (m||'').includes('mp4') ? 'm4a' : 'webm'; }

function toggleRecording(){ recorder ? stopRecording() : startRecording(); }

async function startRecording(){
  if(sttBusy){ toast('이전 녹음을 전사하는 중이에요. 잠시만요.','info'); return; }
  if(!navigator.mediaDevices||!window.MediaRecorder){
    toast('이 브라우저는 녹음을 지원하지 않아요. 음성 파일 업로드를 이용해주세요.','error'); return;
  }
  try{
    mediaStream=await navigator.mediaDevices.getUserMedia({audio:true});
  }catch(e){
    toast('마이크 권한이 필요해요. 브라우저 주소창의 권한 설정을 확인해주세요.','error'); return;
  }

  const mime=pickAudioMime();
  const opts={audioBitsPerSecond:AUDIO_BPS};
  if(mime) opts.mimeType=mime;
  try{ recorder=new MediaRecorder(mediaStream,opts); }
  catch(e){ recorder=new MediaRecorder(mediaStream); }

  recChunks=[];
  recorder.ondataavailable=e=>{ if(e.data&&e.data.size) recChunks.push(e.data); };
  recorder.onstop=()=>{
    const type=recorder&&recorder.mimeType||mime||'audio/webm';
    const blob=new Blob(recChunks,{type});
    recChunks=[];
    /* 녹음 길이는 이미 알고 있으니 진행 막대 예상 시간에 쓴다 */
    if(blob.size>2000) processAudio(blob, extFromMime(type), (Date.now()-recStartMs)/1000);
    else toast('녹음이 너무 짧아요.','error');
  };
  recorder.start(1000);            /* 1초마다 데이터를 흘려 메모리 급증을 막는다 */
  recStartMs=Date.now();
  recTick=setInterval(updateRecTimer,500);
  updateRecUI(true);
  setSttStatus('🎙️ 녹음 중이에요. 회의가 끝나면 중지를 눌러주세요.');
}

function stopRecording(){
  clearInterval(recTick);
  if(recorder&&recorder.state!=='inactive') recorder.stop();
  if(mediaStream) mediaStream.getTracks().forEach(t=>t.stop());
  recorder=null; mediaStream=null;
  updateRecUI(false);
}
function updateRecTimer(){
  const s=Math.floor((Date.now()-recStartMs)/1000);
  document.getElementById('rec-timer').textContent=
    String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');
}
function updateRecUI(on){
  document.getElementById('rec-btn').textContent = on?'⏹️ 녹음 중지':'🎙️ 녹음 시작';
  document.getElementById('rec-dot').className   = on?'rec-dot on':'rec-dot';
  document.getElementById('audio-up-btn').disabled = on;
  if(!on) document.getElementById('rec-timer').textContent='00:00';
}
function setSttStatus(msg){
  const el=document.getElementById('stt-status');
  if(el) el.textContent=msg||'';
}
function setSttBusy(on){
  sttBusy=on;
  const rb=document.getElementById('rec-btn'), ub=document.getElementById('audio-up-btn');
  if(rb) rb.disabled=on;
  if(ub) ub.disabled=on;
}

/* ── 오디오 한 개를 전사해서 입력창에 채운다 ── */
async function processAudio(blob, ext, durSec){
  const mb=blob.size/1024/1024;
  const maxMb=STT_CLOUD_ENABLED?CLOUD_MAX_MB:GEMINI_MAX_MB;
  if(mb>maxMb){
    setSttStatus('');
    toast(STT_CLOUD_ENABLED
      ? `녹음 파일이 너무 커요 (${mb.toFixed(0)}MB). ${CLOUD_MAX_MB}MB까지 올릴 수 있어요.`
      : `녹음이 너무 길어요 (${mb.toFixed(1)}MB). 지금은 약 40분까지 옮길 수 있어요. 나눠서 녹음하거나 텍스트로 붙여넣어 주세요.`,'error');
    return;
  }
  setSttBusy(true);
  window.addEventListener('beforeunload', warnSttLeave);
  /* 녹음 길이 — 내장 녹음은 넘겨받고, 파일은 메타데이터에서 읽고, 그것도 안 되면
     48kbps 기준으로 크기에서 어림한다 */
  const dur=durSec || await audioDurationSec(blob) || blob.size/6000;
  const speakers=selectedSpeakers();
  try{
    let text, note='';
    if(STT_CLOUD_ENABLED){
      try{
        text=await transcribeViaCloud(blob, ext, dur, speakers);
      }catch(e){
        console.error('[MeetFlow] Cloud 전사 실패 — Gemini로 대신', e);
        if(mb>GEMINI_MAX_MB) throw new Error('화자 구분 전사에 실패했고, 파일이 커서 대신 옮길 수도 없어요. 잠시 후 다시 시도해 주세요.');
        note=' (화자 구분 전사에 실패해 일반 전사로 대신했어요)';
        text=await withSttProgress(dur, estimateSttSec(dur), ()=>transcribeViaGemini(blob, speakers));
      }
    }else{
      text=await withSttProgress(dur, estimateSttSec(dur), ()=>transcribeViaGemini(blob, speakers));
    }
    appendTranscript(text);
    setSttStatus('✅ 전사가 끝났어요'+note+' — 아래 텍스트를 확인하고 수정하세요.');
    notifySttDone(true);
  }catch(e){
    console.error('[MeetFlow] 전사 실패', e);
    setSttStatus('');
    notifySttDone(false, e.message||String(e));
  }finally{
    setSttBusy(false);
    window.removeEventListener('beforeunload', warnSttLeave);
  }
}

/** 전사 중에 탭을 닫거나 새로고침하면 전사가 끊긴다 — 브라우저 확인 창을 띄운다 */
function warnSttLeave(e){ e.preventDefault(); e.returnValue=''; }

/** 참석자 수 선택값 (클로바노트처럼 알려주면 화자 구분이 정확해진다). 자동이면 null */
function selectedSpeakers(){
  const n=parseInt((document.getElementById('stt-speakers')||{}).value,10);
  return n>=2&&n<=10?n:null;
}

/** 전사가 끝났을 때 — 분석 화면에 있으면 토스트, 다른 화면에 가 있으면 돌아갈 버튼이 있는 알림 */
function notifySttDone(ok, errMsg){
  const onUpload=document.getElementById('page-upload')?.classList.contains('active');
  if(onUpload){
    if(ok) toast('전사가 완료됐어요! 🎉','success');
    else   toast('전사에 실패했어요: '+errMsg,'error');
    return;
  }
  document.getElementById('stt-done-notice')?.remove();
  const el=document.createElement('div');
  el.id='stt-done-notice';
  el.setAttribute('role','status');
  el.style.cssText='position:fixed;right:24px;bottom:24px;z-index:1100;display:flex;align-items:center;gap:12px;'+
    'padding:14px 16px;background:var(--surface);border:1px solid var(--bd-s);border-radius:var(--r-md);'+
    'box-shadow:var(--shadow-pk);font-size:var(--fs-base);max-width:380px;';
  el.innerHTML=`
    <span style="font-size:22px;">${ok?'✅':'⚠️'}</span>
    <span style="flex:1;line-height:1.5;">${ok?'회의 녹음 전사가 끝났어요.':'회의 녹음 전사에 실패했어요.'}</span>
    <button class="btn-pk btn-pk-sm" id="stt-done-go">${ok?'분석하러 가기':'확인하기'}</button>
    <button class="ico-btn" id="stt-done-x" title="닫기" style="font-size:16px;">✕</button>`;
  document.body.appendChild(el);
  el.querySelector('#stt-done-go').onclick=()=>{ el.remove(); gp('upload'); if(!ok) toast('전사에 실패했어요: '+errMsg,'error'); };
  el.querySelector('#stt-done-x').onclick=()=>el.remove();
}

/* ── 전사 진행 막대 ──
   Gemini 전사는 끝날 때 결과를 한 번에 줘서 진짜 진행률을 알 수 없다. 그래서 녹음 길이로
   예상 시간을 잡고 막대를 채운다. 실측(2026-09-21, gemini-3.6-flash): 15초 녹음 ≈ 19초,
   20분 녹음 ≈ 85~95초 → 예상 = 15초 + 녹음 1분당 4초.
   예상 시간 동안 90%까지 차고, 넘기면 98%까지만 천천히 다가가다가 끝나면 100%. */
function estimateSttSec(durSec){ return Math.round(15 + (durSec/60)*4); }
function fmtMinSec(sec){
  const s=Math.max(0,Math.round(sec));
  return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');
}
/* Cloud Speech-to-Text 예상 시간 — 아직 실측 전이다. 공식 문서의 일반 수치("평균적으로 녹음 길이의
   절반")로 잡았다. 결제 승인 후 실제 녹음으로 재서 고칠 것. */
function estimateCloudSttSec(durSec){ return Math.round(20 + durSec*0.5); }

/** 작업(job)이 끝날 때까지 진행 막대를 움직인다 */
async function withSttProgress(durSec, estSec, job, label){
  const stop=startSttProgress(durSec, estSec, label);
  try{ const r=await job(); stop(true); return r; }
  catch(e){ stop(false); throw e; }
}

/** 막대를 움직이기 시작하고, 멈추는 함수를 돌려준다 — stop(true)면 100%로 채우고 사라진다 */
function startSttProgress(durSec, estSec, label){
  const wrap=document.getElementById('stt-prog'), fill=document.getElementById('stt-prog-fill');
  const est=estSec||estimateSttSec(durSec||0), t0=Date.now();
  const what=label||'음성을 텍스트로 옮기는 중이에요';
  if(wrap) wrap.hidden=false;
  if(fill) fill.style.width='0%';
  const tick=()=>{
    const e=(Date.now()-t0)/1000;
    const p=e<est ? 90*e/est : 90+8*(1-Math.exp(-(e-est)/est));
    if(fill) fill.style.width=p.toFixed(1)+'%';
    setSttStatus(e<est
      ? `🗣️ ${what} · ${fmtMinSec(e)} / 약 ${fmtMinSec(est)} — 다른 화면으로 가도 계속 진행돼요`
      : `🗣️ 예상보다 오래 걸리고 있어요 · ${fmtMinSec(e)} — AI 서버가 붐빌 수 있어요. 조금만 더 기다려 주세요.`);
  };
  tick();
  const timer=setInterval(tick,500);
  return ok=>{
    clearInterval(timer);
    if(fill) fill.style.width=ok?'100%':'0%';
    setTimeout(()=>{ if(wrap) wrap.hidden=true; if(fill) fill.style.width='0%'; }, ok?900:0);
  };
}
/** 오디오 파일 길이(초). 못 읽으면 null — MediaRecorder가 만든 webm은 길이가 비어 있기도 하다 */
function audioDurationSec(blob){
  return new Promise(resolve=>{
    const url=URL.createObjectURL(blob), a=new Audio();
    let settled=false;
    const done=v=>{ if(settled) return; settled=true; URL.revokeObjectURL(url); resolve(v); };
    a.preload='metadata';
    a.onloadedmetadata=()=>done(isFinite(a.duration)&&a.duration>0?a.duration:null);
    a.onerror=()=>done(null);
    setTimeout(()=>done(null),3000);
    a.src=url;
  });
}

async function transcribeViaGemini(blob, speakers){
  if(typeof window.mfTranscribeAudio!=='function') throw new Error('AI 모듈을 불러오는 중이에요.');
  const b64=await blobToBase64(blob);
  return await window.mfTranscribeAudio(b64, blob.type||'audio/webm', {speakers});
}

/** Cloud Speech-to-Text — 올리기(실제 진행률) → 함수 호출(예상 시간 막대) */
async function transcribeViaCloud(blob, ext, durSec, speakers){
  if(typeof window.mfUploadAudio!=='function'||typeof window.mfTranscribeCloud!=='function'){
    throw new Error('Firebase 모듈을 불러오는 중이에요.');
  }
  const wrap=document.getElementById('stt-prog'), fill=document.getElementById('stt-prog-fill');
  if(wrap) wrap.hidden=false;
  const gcsUri=await window.mfUploadAudio(blob, ext, p=>{
    if(fill) fill.style.width=(p*100).toFixed(0)+'%';
    setSttStatus(`⬆️ 녹음을 올리는 중이에요 · ${Math.round(p*100)}%`);
  });
  if(fill) fill.style.width='0%';
  return await withSttProgress(durSec, estimateCloudSttSec(durSec),
    ()=>window.mfTranscribeCloud(gcsUri, {speakers}), '말한 사람을 나눠가며 옮기는 중이에요');
}

function blobToBase64(blob){
  return new Promise((resolve,reject)=>{
    const r=new FileReader();
    r.onerror=()=>reject(new Error('오디오를 읽지 못했어요.'));
    r.onloadend=()=>resolve(String(r.result).split(',')[1]);
    r.readAsDataURL(blob);
  });
}
function appendTranscript(text){
  if(!text||!text.trim()) throw new Error('음성에서 말소리를 찾지 못했어요.');
  const ta=document.getElementById('meeting-input');
  const prev=ta.value.trim();
  ta.value=(prev?prev+'\n\n':'')+text.trim();
  updateCC();
  transcriptMeta={fromAudio:true, named:!!(transcriptMeta&&transcriptMeta.named)};
  renderSpeakerMapper();
}

/* ════════════════════════════════
   화자 → 이름 연결
   전사본의 "화자1:" 같은 라벨을 실제 이름으로 바꾼다. 사람이 확인한 이름이면 분석이
   "제가 할게요" 같은 말을 한 사람을 담당자로 연결할 수 있다(js/gemini.js의 지시문).
   STT(화자 분리)가 들어오면 라벨이 정확해져서 이 연결이 더 쓸모 있어진다.
════════════════════════════════ */
const SPEAKER_LINE = /^(화자\s*(\d+))\s*:\s*(.*)$/gm;

/** 입력창에서 화자 라벨을 찾아 {label, no, sample(첫 발화)} 목록으로 — 처음 나온 순서대로 */
function findSpeakers(text){
  const seen=new Map();
  for(const m of (text||'').matchAll(SPEAKER_LINE)){
    if(!seen.has(m[2])) seen.set(m[2], {label:'화자'+m[2], no:m[2], sample:m[3].trim()});
  }
  return [...seen.values()];
}

/** 이름 후보 — 이 프로젝트의 지난 회의에서 업무를 맡았던 사람들 */
function knownPeople(){
  const names=(typeof history!=='undefined'?history:[]).flatMap(m=>(m.items||[]).map(i=>i.assignee));
  return [...new Set(names)].filter(n=>n&&n!=='미지정');
}

/** 전사가 끝나면 "말한 사람을 알려주세요" 칸을 띄운다. 라벨이 없으면 숨긴다. */
function renderSpeakerMapper(){
  const text=document.getElementById('meeting-input').value;
  const speakers=findSpeakers(text);
  let box=document.getElementById('spk-map');
  if(!speakers.length){ if(box) box.remove(); return; }
  if(!box){
    box=document.createElement('div');
    box.id='spk-map';
    box.style.cssText='margin-top:var(--sp-4);padding:var(--sp-4);background:var(--pk-bg);border:1px solid var(--bd-s);border-radius:var(--r-md);';
    const anchor=document.getElementById('stt-prog')||document.getElementById('stt-status');
    anchor.insertAdjacentElement('afterend', box);
  }
  const people=knownPeople();
  box.innerHTML=`
    <div style="font-weight:var(--fw-bold);font-size:var(--fs-md);margin-bottom:4px;">🗣️ 말한 사람을 알려주세요</div>
    <div style="font-size:var(--fs-sm);color:var(--muted);margin-bottom:var(--sp-3);line-height:1.6;">
      이름을 넣으면 "제가 할게요"라고 말한 사람을 그 업무의 담당자로 연결해요. 모르면 비워두세요.
    </div>
    <datalist id="spk-people">${people.map(p=>`<option value="${esc2(p)}">`).join('')}</datalist>
    ${speakers.map(s=>`
      <div style="display:flex;align-items:center;gap:var(--sp-3);margin-bottom:var(--sp-2);">
        <span style="width:48px;flex-shrink:0;font-weight:var(--fw-bold);font-size:var(--fs-base);">${esc2(s.label)}</span>
        <input class="spk-name" data-no="${esc2(s.no)}" list="spk-people" maxlength="20" placeholder="이름"
          style="width:110px;flex-shrink:0;padding:6px 10px;border:1.5px solid var(--bd-s);border-radius:var(--r-sm);font-family:inherit;font-size:var(--fs-base);background:var(--surface);color:var(--text);">
        <span style="flex:1;min-width:0;font-size:var(--fs-sm);color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;"
          title="${esc2(s.sample)}">"${esc2(s.sample.slice(0,60))}"</span>
      </div>`).join('')}
    <div style="display:flex;gap:var(--sp-2);margin-top:var(--sp-3);">
      <button class="btn-pk btn-pk-sm" onclick="applySpeakerNames()">이름 바꾸기</button>
      <button class="btn-ghost" onclick="document.getElementById('spk-map').remove()">나중에</button>
    </div>`;
}

/** 입력한 이름으로 "화자N:"을 바꾼다. 줄 맨 앞의 라벨만 바꾸고, 화자1과 화자10은 헷갈리지 않는다. */
function applySpeakerNames(){
  const ta=document.getElementById('meeting-input');
  let text=ta.value, count=0;
  document.querySelectorAll('#spk-map .spk-name').forEach(inp=>{
    const name=inp.value.replace(/[:\n\r]/g,'').trim().slice(0,20);
    if(!name) return;
    const re=new RegExp('^화자\\s*'+inp.dataset.no+'\\s*:','gm');
    text=text.replace(re, ()=>{ count++; return name+':'; });
  });
  if(!count){ toast('바꿀 이름을 하나 이상 넣어주세요.','error'); return; }
  ta.value=text;
  updateCC();
  transcriptMeta={fromAudio:true, named:true};
  document.getElementById('spk-map')?.remove();
  toast('이름을 바꿨어요 — 분석할 때 말한 사람을 담당자로 연결해요.','success');
}

/* ── 음성 파일 업로드 ── */
function triggerAudioUpload(){ document.getElementById('audio-file').click(); }
function handleAudioUpload(evt){
  const file=evt.target.files[0];
  evt.target.value='';
  if(!file) return;
  const ext=(file.name.split('.').pop()||'webm').toLowerCase();
  processAudio(file, ext);
}
