# MeetFlow 화자 분리 전사 (Cloud Speech-to-Text V2)

회의 녹음을 화자별로 구분해 전사하는 Cloud Function입니다.

## 왜 백엔드가 필요한가

- **STT V2는 API 키를 지원하지 않는다.** 서비스 계정(ADC) 인증만 가능해서 브라우저에서 직접 못 부른다.
- **화자 분리는 요청 단위로 화자 번호를 매긴다.** 회의를 조각내 보내면 조각마다 "화자1"이 다른 사람이 되므로,
  회의 전체를 한 번에 넘겨야 한다. 그러면 동기 요청의 60초 제한을 넘으므로 `batchRecognize`(비동기) +
  Cloud Storage 경로를 써야 한다.

## 처리 흐름

```
브라우저: 녹음(통짜 webm) → Firebase Storage (meetings/<uid>/<ts>.webm)
    ↓  gs:// URI
Cloud Function transcribeMeeting: batchRecognize(chirp_3, diarization) → 완료 대기
    ↓  "화자1: ... / 화자2: ..." 텍스트
브라우저: 입력창에 채움 → 기존 Gemini 분석(담당자·업무·마감일)
```

## 설정값

| 항목 | 값 | 위치 |
|---|---|---|
| STT 로케이션 | `eu` | `index.js`의 `STT_LOCATION` |
| 모델 | `chirp_3` | `index.js`의 `MODEL` |
| 언어 | `ko-KR` | `index.js`의 `LANGUAGE` |
| 함수 리전 | `asia-northeast3` | `index.js`의 `FN_REGION` |

> 한국어 화자 분리는 `chirp_3` 모델에서만 지원되며, 문서 기준 `eu` 로케이션에 있습니다.
> 리전을 바꾸면 **`index.html`의 `getFunctions(app, "asia-northeast3")`도 같이 바꿔야** 합니다.

## 배포 전 준비 (콘솔에서 직접)

1. **Firebase Blaze(종량제) 요금제로 업그레이드** — Cloud Functions와 STT 모두 필요
2. **Cloud Storage 사용 설정** — Firebase 콘솔 → 빌드 → Storage → 시작하기
3. **Speech-to-Text API 사용 설정** — https://console.cloud.google.com/apis/library/speech.googleapis.com

## 배포

```bash
firebase login
firebase deploy --only functions,storage
```

## 테스트

전사 파싱 로직은 배포 없이 단독 실행됩니다.

```bash
cd functions
node transcript.test.js
```
