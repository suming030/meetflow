/* MeetFlow — 녹음 + 화자 분리 전사
   소유자: 기능 C */

/* ════════════════════════════════
   녹음 + STT (2단계 — 음성 입력)

   화자 분리(diarization)는 요청 단위로 화자 번호를 매기므로, 회의를 조각내
   보내면 조각마다 "화자1"이 다른 사람이 된다. 그래서 회의 전체를 하나의
   파일로 녹음해 Cloud Storage에 올리고, Cloud Function이 STT V2의
   batchRecognize(chirp_3)로 한 번에 전사한다.

   Cloud STT를 쓸 수 없을 때(함수 미배포 등)는 Gemini 전사로 대체한다.
   단 Gemini는 요청 20MB 제한이 있어 짧은 녹음에만 가능하다.
════════════════════════════════ */
const AUDIO_BPS       = 48000;  /* 48kbps opus — 전사 정확도를 위해 여유 있게 */
const GEMINI_MAX_MB   = 15;     /* Gemini 대체 경로의 파일 상한 (base64 팽창 감안) */
const STORAGE_MAX_MB  = 500;    /* storage.rules와 맞춘 값 */

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
    if(blob.size>2000) processAudio(blob, extFromMime(type));
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
async function processAudio(blob, ext){
  const mb=blob.size/1024/1024;
  if(mb>STORAGE_MAX_MB){
    setSttStatus('');
    toast(`녹음 파일이 너무 커요 (${mb.toFixed(0)}MB).`,'error');
    return;
  }
  setSttBusy(true);
  try{
    const text=await transcribeViaCloud(blob, ext);
    appendTranscript(text);
    setSttStatus('✅ 화자 분리 전사가 끝났어요 — 아래 텍스트를 확인하고 수정하세요.');
    toast('전사가 완료됐어요! 🎉','success');
  }catch(e){
    console.error('[MeetFlow] Cloud STT 실패', e);
    /* Cloud STT를 못 쓰면 Gemini로라도 텍스트는 뽑아준다 (화자 구분 없음) */
    if(mb<=GEMINI_MAX_MB){
      try{
        setSttStatus('⚠️ 화자 분리 전사를 못 써서 기본 전사로 대체하는 중...');
        const text=await transcribeViaGemini(blob);
        appendTranscript(text);
        setSttStatus('✅ 전사 완료 (화자 구분 없음) — 아래 텍스트를 확인하세요.');
        toast('화자 분리는 못 했지만 전사는 됐어요.','warn');
        return;
      }catch(e2){
        console.error('[MeetFlow] Gemini 전사도 실패', e2);
        e=e2;
      }
    }
    setSttStatus('');
    toast('전사에 실패했어요: '+(e.message||e),'error');
  }finally{
    setSttBusy(false);
  }
}

async function transcribeViaCloud(blob, ext){
  if(typeof window.mfUploadAudio!=='function'||typeof window.mfTranscribeCloud!=='function'){
    throw new Error('업로드 모듈을 불러오는 중이에요.');
  }
  setSttStatus('☁️ 녹음 파일을 올리는 중... 0%');
  const gcsUri=await window.mfUploadAudio(blob, ext, p=>{
    setSttStatus(`☁️ 녹음 파일을 올리는 중... ${Math.round(p*100)}%`);
  });
  setSttStatus('🗣️ 화자를 구분해 전사하는 중이에요. 회의 길이에 따라 몇 분 걸려요...');
  return await window.mfTranscribeCloud(gcsUri);
}

async function transcribeViaGemini(blob){
  if(typeof window.mfTranscribeAudio!=='function') throw new Error('AI 모듈을 불러오는 중이에요.');
  const b64=await blobToBase64(blob);
  return await window.mfTranscribeAudio(b64, blob.type||'audio/webm');
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
