/**
 * 껍데기가 라우트에 얇게 재수출하는 핸들러.
 *
 * 껍데기 쪽 파일은 이것을 부르고 `env` 만 넣어 준다 — 툴은 `process.env` 도
 * `$env/*` 도 읽지 않는다 (@tool-package-contract #2).
 *
 *   // src/routes/api/receipt-renamer/extract/+server.ts
 *   import { env } from '$env/dynamic/private';
 *   import { handleExtract } from '$tools/receipt-renamer/server';
 *   export const POST = ({ request }) => handleExtract(request, { apiKey: env.GEMINI_API_KEY });
 */

import { ExtractError, extractReceipt, isRetryable, type ExtractEnv } from './extract';

/** 서버가 받아 줄 이미지의 상한. 브라우저가 1024px JPEG 로 줄여 보내므로 넉넉하다. */
const MAX_BASE64_LENGTH = 8 * 1024 * 1024;

function fail(message: string, status: number): Response {
	return Response.json({ error: message, status, retryable: isRetryable(status) }, { status });
}

export async function handleExtract(request: Request, env: ExtractEnv): Promise<Response> {
	let body: { data?: unknown; mimeType?: unknown; hint?: unknown };
	try {
		body = (await request.json()) as typeof body;
	} catch {
		return fail('요청을 읽지 못했습니다.', 400);
	}

	if (typeof body.data !== 'string' || body.data.length === 0) {
		return fail('이미지가 없습니다.', 400);
	}
	if (body.data.length > MAX_BASE64_LENGTH) {
		// 여기 걸리면 브라우저의 축소가 동작하지 않은 것이다 — 원본이 올라왔다는 뜻.
		return fail('이미지가 너무 큽니다. 브라우저에서 축소되지 않았습니다.', 413);
	}

	try {
		const { info, usage } = await extractReceipt(
			{
				data: body.data,
				mimeType: typeof body.mimeType === 'string' ? body.mimeType : 'image/jpeg',
				hint: typeof body.hint === 'string' ? body.hint : undefined
			},
			env
		);
		return Response.json({ info, usage });
	} catch (error) {
		if (error instanceof ExtractError) return fail(error.message, error.status);
		return fail(error instanceof Error ? error.message : '알 수 없는 오류', 500);
	}
}
