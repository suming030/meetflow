/**
 * batchRecognize 응답 → 사람이 읽는 전사문 변환.
 * index.js에서 분리해 둔 이유: Firebase는 index.js의 모든 export를 함수로 배포하려 하므로
 * 헬퍼를 그쪽에 노출할 수 없고, 이 파일은 배포와 무관하게 단독 테스트가 가능하다.
 */

/** 단어 배열을 화자가 바뀌는 지점에서 끊어 "화자1: ..." 형태로 합친다. */
function wordsToDialogue(words) {
  const lines = [];
  let speaker = null;
  let buf = [];

  const flush = () => {
    if (buf.length) {
      const text = buf.join(" ").replace(/\s+/g, " ").trim();
      if (text) lines.push(`화자${speaker ?? "?"}: ${text}`);
      buf = [];
    }
  };

  for (const w of words) {
    const s = w.speakerLabel || w.speakerTag || "?";
    if (String(s) !== String(speaker)) {
      flush();
      speaker = s;
    }
    buf.push(w.word || "");
  }
  flush();
  return lines.join("\n");
}

/**
 * batchRecognize 응답에서 전사문을 뽑는다. 화자 정보가 있으면 대화체로 만든다.
 * @param {object} response BatchRecognizeResponse
 * @param {(msg:string)=>Error} makeError 파일 단위 오류를 감쌀 에러 생성기
 */
function extractTranscript(response, makeError) {
  const fileResults = Object.values((response && response.results) || {});
  const chunks = [];

  for (const fr of fileResults) {
    if (fr && fr.error && fr.error.message) {
      throw makeError(`전사 실패: ${fr.error.message}`);
    }
    const inner = (fr && fr.transcript && fr.transcript.results) || [];
    const words = [];
    const plain = [];

    for (const r of inner) {
      const alt = r && r.alternatives && r.alternatives[0];
      if (!alt) continue;
      if (alt.words && alt.words.length) words.push(...alt.words);
      if (alt.transcript) plain.push(alt.transcript.trim());
    }

    const hasSpeakers = words.some((w) => w.speakerLabel || w.speakerTag);
    chunks.push(hasSpeakers ? wordsToDialogue(words) : plain.join(" "));
  }

  return chunks.filter(Boolean).join("\n\n").trim();
}

module.exports = { wordsToDialogue, extractTranscript };
