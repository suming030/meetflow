/**
 * MeetFlow — 회의 녹음 전사 (Google Cloud Speech-to-Text V2)
 *
 * 왜 백엔드가 필요한가:
 *  - STT V2는 서비스 계정 인증만 지원해서 브라우저에서 직접 호출할 수 없다.
 *  - 화자 분리는 요청 단위로 화자 번호를 매기므로, 회의를 조각내면 화자가 뒤섞인다.
 *    → 회의 전체를 한 번에 batchRecognize로 넘긴다 (60초 동기 제한을 우회).
 */
// firebase-functions/v2 루트를 가져오면 쓰지도 않는 provider(database 등)까지
// 로드되므로, https만 직접 import한다.
const { onCall, HttpsError } = require("firebase-functions/v2/https");
const speech = require("@google-cloud/speech");
const { initializeApp } = require("firebase-admin/app");
const { getStorage } = require("firebase-admin/storage");
const { extractTranscript } = require("./transcript");

initializeApp();

/** 이 프로젝트의 기본 Storage 버킷 — 다른 버킷의 파일은 받지 않는다 */
function defaultBucket() {
  try { return JSON.parse(process.env.FIREBASE_CONFIG || "{}").storageBucket || null; }
  catch (_) { return null; }
}

/** 한국어 화자 분리는 chirp_3 모델에서만 지원되며, 문서상 eu 로케이션에 있다.
 *  리전을 옮겨야 하면 이 값만 바꾸면 된다. */
const STT_LOCATION = "eu";
const LANGUAGE = "ko-KR";
const MODEL = "chirp_3";

/** 함수가 배포될 리전 (프론트의 getFunctions 리전과 반드시 일치해야 한다) */
const FN_REGION = "asia-northeast3";

let _client;
function sttClient() {
  if (!_client) {
    _client = new speech.v2.SpeechClient({
      apiEndpoint: `${STT_LOCATION}-speech.googleapis.com`,
    });
  }
  return _client;
}

exports.transcribeMeeting = onCall(
  { region: FN_REGION, timeoutSeconds: 3600, memory: "512MiB", maxInstances: 5 },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError("unauthenticated", "로그인이 필요해요.");
    }

    const gcsUri = request.data && request.data.gcsUri;
    const m = typeof gcsUri === "string" && gcsUri.match(/^gs:\/\/([^/]+)\/(.+)$/);
    if (!m) {
      throw new HttpsError("invalid-argument", "오디오 파일 경로(gcsUri)가 올바르지 않아요.");
    }
    const [, bucketName, objectPath] = m;
    // 남의 파일을 전사하거나 지우지 못하도록 — 이 프로젝트 버킷의 meetings/<내 uid>/ 아래만 받는다.
    // (전사가 끝나면 파일을 지우므로 예전의 includes() 검사보다 엄격하게 본다)
    const bucket = defaultBucket();
    if ((bucket && bucketName !== bucket) ||
        !objectPath.startsWith(`meetings/${request.auth.uid}/`) || objectPath.includes("..")) {
      throw new HttpsError("permission-denied", "본인이 업로드한 파일만 전사할 수 있어요.");
    }

    const projectId = process.env.GCLOUD_PROJECT;
    const recognizer = `projects/${projectId}/locations/${STT_LOCATION}/recognizers/_`;

    // 참석자 수를 알려주면(클로바노트처럼) 화자 수를 그 수로 고정해 더 정확히 나눈다.
    // 모르면 2~6명 사이에서 알아서 찾는다.
    const exact = Number(request.data.speakers);
    const known = Number.isInteger(exact) && exact >= 2 && exact <= 10;
    const minSpeakers = known ? exact : 2;
    const maxSpeakers = known ? exact : 6;

    try {
      const [operation] = await sttClient().batchRecognize({
        recognizer,
        config: {
          autoDecodingConfig: {},
          model: MODEL,
          languageCodes: [LANGUAGE],
          features: {
            enableAutomaticPunctuation: true,
            enableWordTimeOffsets: true,
            diarizationConfig: {
              minSpeakerCount: minSpeakers,
              maxSpeakerCount: maxSpeakers,
            },
          },
        },
        files: [{ uri: gcsUri }],
        recognitionOutputConfig: { inlineResponseConfig: {} },
      });

      const [response] = await operation.promise();
      const transcript = extractTranscript(response, (msg) => new HttpsError("internal", msg));

      if (!transcript) {
        throw new HttpsError("not-found", "음성에서 말소리를 찾지 못했어요.");
      }
      return { transcript };
    } catch (err) {
      if (err instanceof HttpsError) throw err;
      console.error("[MeetFlow] STT 오류", err);
      throw new HttpsError("internal", err.message || "전사 중 오류가 발생했어요.");
    } finally {
      // 회의 녹음은 전사가 끝나면(실패해도) 지운다 — "음성 파일은 저장하지 않는다"를 지키기 위해.
      // 다시 전사하려면 사용자가 다시 올린다. 삭제 실패는 전사 결과에 영향을 주지 않게 기록만 한다.
      try {
        await getStorage().bucket(bucketName).file(objectPath).delete({ ignoreNotFound: true });
      } catch (e) {
        console.error("[MeetFlow] 녹음 파일 삭제 실패", objectPath, e);
      }
    }
  }
);
