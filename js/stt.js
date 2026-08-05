/* MeetFlow — 녹음 + 전사
   소유자: 기능 C */

/* ════════════════════════════════
   녹음 + STT (2단계 — 음성 입력)

   녹음한 오디오를 Gemini에 그대로 보내 텍스트로 옮긴다.

   Cloud Speech-to-Text(화자 분리)를 쓰지 않는 이유:
   화자 분리는 서비스 계정 인증이 필요해 브라우저에서 직접 호출할 수 없고,
   Cloud Function + Blaze 요금제가 있어야 한다. 녹음이 1~2분 수준이라
   그만한 비용을 들일 이유가 없어 Gemini 전사만 쓰기로 했다.
   (백엔드 코드는 functions/ 에 남아 있으나 현재 사용하지 않는다)
════════════════════════════════ */
const AUDIO_BPS     = 48000;  /* 48kbps opus — 전사 정확도를 위해 여유 있게 */
const GEMINI_MAX_MB = 15;     /* Gemini 요청 상한 약 20MB, base64 팽창을 감안한 값 */

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

/* ── 오디오 한 개를 전사해서 입력창에 채운다 ──
   Gemini에 오디오를 그대로 보내 전사한다. Cloud Speech-to-Text(화자 분리)는
   Blaze 요금제와 백엔드가 필요한데, 녹음이 1~2분 수준이라 쓰지 않기로 했다.
   대신 요청 크기 상한(약 20MB, base64 팽창 포함)에 걸리지 않게 길이를 제한한다. */
async function processAudio(blob, ext){
  const mb=blob.size/1024/1024;
  if(mb>GEMINI_MAX_MB){
    setSttStatus('');
    toast(`녹음이 너무 길어요 (${mb.toFixed(1)}MB). 회의를 나눠서 녹음해 주세요.`,'error');
    return;
  }
  setSttBusy(true);
  setSttStatus('🗣️ 음성을 텍스트로 옮기는 중이에요...');
  try{
    const text=await transcribeViaGemini(blob);
    appendTranscript(text);
    setSttStatus('✅ 전사가 끝났어요 — 아래 텍스트를 확인하고 수정하세요.');
    toast('전사가 완료됐어요! 🎉','success');
  }catch(e){
    console.error('[MeetFlow] 전사 실패', e);
    setSttStatus('');
    toast('전사에 실패했어요: '+(e.message||e),'error');
  }finally{
    setSttBusy(false);
  }
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
