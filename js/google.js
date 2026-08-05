/* MeetFlow — 구글 연동 (Calendar / Docs)
   소유자: 기능 D

   Firebase 구글 로그인에 스코프를 추가하면 액세스 토큰을 받을 수 있고,
   그 토큰으로 브라우저에서 Google API를 직접 호출할 수 있다 (서버 불필요).
     provider.addScope('https://www.googleapis.com/auth/calendar.events');
     const token = GoogleAuthProvider.credentialFromResult(result).accessToken;
   주의: 액세스 토큰은 약 1시간 뒤 만료되고 자동 갱신되지 않는다.
        만료되면 재로그인을 유도해야 한다. */
