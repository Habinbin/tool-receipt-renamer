/*
	페이지 자체는 정적이다 — 규칙은 localStorage, 축소·ZIP 은 브라우저에서 끝난다.
	서버가 사는 곳은 `/api/receipt-renamer/extract` 하나뿐이고, 그건 별도 라우트라
	이 설정에 걸리지 않는다.
*/
export const prerender = true;
