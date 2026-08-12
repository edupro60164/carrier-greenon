// 파일을 직접 열었을 때 사용하는 안전한 미설정 상태입니다.
// Node 서버로 실행하면 이 경로는 환경변수로 생성한 공개 설정 응답으로 교체됩니다.
window.GREENON_PUBLIC_CONFIG = Object.freeze({
  configured: false,
});
