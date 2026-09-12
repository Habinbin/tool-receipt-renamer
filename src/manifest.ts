import ReceiptTextIcon from '@lucide/svelte/icons/receipt-text';

/**
 * 런처와 헤더에 쓰이는 메타데이터.
 *
 * 제목·설명은 호스트가 헤더를 그릴 때도 여기서 가져간다 — 두 번 적지 않는다.
 * 타입을 공유 패키지에서 가져오지 않는다: 이 툴은 자립해야 하고,
 * 호스트가 자기 `ToolManifest` 로 구조적으로 검사한다.
 */
export const manifest = {
	id: 'receipt-renamer',
	title: '영수증 리네이머',
	description:
		'영수증·전표·승차권을 뭉텅이로 넣으면 읽어서 규칙대로 이름을 붙여 ZIP으로 내보냅니다. 상황별 규칙을 저장해 두고 갈아 끼웁니다.',
	category: '영수증 도구',
	icon: ReceiptTextIcon,
	/** 'embed' — 툴박스 안 라우트로 렌더한다. @standalone-tool-deployment */
	surface: 'embed' as const,
	/**
	 * 이 툴이 요구하는 서버 엔드포인트. 껍데기가 `src/routes/api/receipt-renamer/extract/`
	 * 에 얇게 재수출하고 `GEMINI_API_KEY` 를 주입한다.
	 * 서버가 필요한 이유는 오직 키를 숨기는 것이다 (@client-first-processing).
	 */
	serverRoutes: ['extract']
};
