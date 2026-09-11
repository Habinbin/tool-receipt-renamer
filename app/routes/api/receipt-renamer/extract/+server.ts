/*
	단독 배포 껍데기의 서버 라우트. 툴박스에 실릴 때는 이 파일이 존재하지 않고,
	툴박스가 자기 쪽에 같은 모양의 파일을 둔다 — 어느 쪽이든 하는 일은
	`handleExtract` 를 부르고 키를 넣어 주는 것뿐이다 (@standalone-tool-deployment #1).
*/
import { env } from '$env/dynamic/private';

import { handleExtract } from '$lib/server/handler';

import type { RequestHandler } from './$types';

export const POST: RequestHandler = ({ request }) =>
	handleExtract(request, {
		apiKey: env.GEMINI_API_KEY ?? '',
		model: env.GEMINI_MODEL || undefined
	});
