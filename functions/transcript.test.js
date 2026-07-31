/** transcript.js 단위 테스트 — `node transcript.test.js` 로 실행 */
const assert = require("assert");
const { wordsToDialogue, extractTranscript } = require("./transcript");

const err = (m) => new Error(m);
let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log("  ok -", name);
}

test("화자가 바뀌는 지점에서 줄을 나눈다", () => {
  const words = [
    { word: "안녕하세요", speakerLabel: "1" },
    { word: "회의", speakerLabel: "1" },
    { word: "시작할게요", speakerLabel: "1" },
    { word: "네", speakerLabel: "2" },
    { word: "좋습니다", speakerLabel: "2" },
    { word: "그럼", speakerLabel: "1" },
  ];
  assert.strictEqual(
    wordsToDialogue(words),
    "화자1: 안녕하세요 회의 시작할게요\n화자2: 네 좋습니다\n화자1: 그럼"
  );
});

test("speakerTag(구버전 필드)도 인식한다", () => {
  const words = [
    { word: "가", speakerTag: 1 },
    { word: "나", speakerTag: 2 },
  ];
  assert.strictEqual(wordsToDialogue(words), "화자1: 가\n화자2: 나");
});

test("화자 번호가 숫자/문자로 섞여도 같은 화자로 본다", () => {
  const words = [
    { word: "가", speakerLabel: "1" },
    { word: "나", speakerTag: 1 },
  ];
  assert.strictEqual(wordsToDialogue(words), "화자1: 가 나");
});

test("응답에서 화자 분리된 대화를 뽑는다", () => {
  const response = {
    results: {
      "gs://b/a.webm": {
        transcript: {
          results: [
            {
              alternatives: [
                {
                  transcript: "안녕하세요 네",
                  words: [
                    { word: "안녕하세요", speakerLabel: "1" },
                    { word: "네", speakerLabel: "2" },
                  ],
                },
              ],
            },
          ],
        },
      },
    },
  };
  assert.strictEqual(extractTranscript(response, err), "화자1: 안녕하세요\n화자2: 네");
});

test("화자 정보가 없으면 평문 전사로 떨어진다", () => {
  const response = {
    results: {
      f: {
        transcript: {
          results: [
            { alternatives: [{ transcript: "첫 문장." }] },
            { alternatives: [{ transcript: "둘째 문장." }] },
          ],
        },
      },
    },
  };
  assert.strictEqual(extractTranscript(response, err), "첫 문장. 둘째 문장.");
});

test("파일 단위 오류는 예외로 올린다", () => {
  const response = { results: { f: { error: { message: "BAD_AUDIO" } } } };
  assert.throws(() => extractTranscript(response, err), /BAD_AUDIO/);
});

test("빈 응답은 빈 문자열", () => {
  assert.strictEqual(extractTranscript({}, err), "");
  assert.strictEqual(extractTranscript({ results: {} }, err), "");
});

console.log(`\n${passed}개 테스트 통과`);
