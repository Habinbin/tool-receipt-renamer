/**
 * 영수증 이미지 한 장에서 필드를 읽어 낸다.
 *
 * 이 툴에서 서버가 필요한 유일한 이유는 **API 키**다 (@client-first-processing).
 * 그래서 이 모듈은 딱 그 일만 한다 — 축소와 PDF 래스터는 브라우저(`../prepare`)가
 * 이미 끝내 놓고, 여기로는 작은 JPEG 한 장이 온다.
 *
 * `env` 는 주입받는다. `process.env` 나 `$env/*` 를 읽지 않는다 (@tool-package-contract #2).
 */

import { normalizeReceiptInfo } from '../receipt';
import type { ReceiptInfo } from '../types';

const ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * 기본 모델. 실패하면 `FALLBACK_MODEL` 로 한 번 더 시도한다.
 *
 * 주력이 lite 인 이유는 **무료 티어의 일일 한도**다. 실측(2026-09-11):
 *
 *   gemini-3.6-flash   GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20/일
 *   gemini-3.1-flash-lite  훨씬 큼 (골든셋을 하루에 여러 번 돌려도 안 걸림)
 *
 * 하루 20건이면 영수증 한 묶음에 한도가 끝난다. 그래서 큰 모델은 lite 가
 * 실패했을 때만 쓰는 예비로 돌렸다. 정확도에서 손해도 없었다 — 아래 참조.
 */
export const DEFAULT_MODEL = 'gemini-3.1-flash-lite';
export const FALLBACK_MODEL = 'gemini-3.6-flash';

/**
 * 생각의 깊이. 실측으로 `generationConfig.thinkingConfig.thinkingLevel` 이 맞는 경로다.
 *
 * 2.5 세대의 `thinkingBudget` 은 3.x 에서 **400 을 돌려준다.** 옮겨 쓰지 말 것.
 */
export type ThinkingLevel = 'minimal' | 'low' | 'medium' | 'high';

/**
 * 골든셋 8장 실측 (gemini-3.1-flash-lite, `pnpm bench`):
 *
 *   minimal   8/8 정확 · 생각토큰 0    · 평균 7.8초
 *   low       7/8 정확 · 생각토큰 818  · 평균 8.7초
 *
 * 영수증 필드 읽기는 추론이 아니라 판독이라, 생각을 더 시킨다고 나아지지 않았다.
 * 표본이 8장이니 큰 차이로 읽지는 말 것 — 다만 minimal 이 더 나쁘지 않다는 건
 * 분명하고, 더 싸고 빠르다.
 */
export const DEFAULT_THINKING_LEVEL: ThinkingLevel = 'minimal';

/** 한 장을 기다려 줄 시간. 넘으면 408 로 바꿔 재시도 대상으로 만든다. */
export const DEFAULT_TIMEOUT_MS = 60_000;

export interface ExtractEnv {
	/** Google AI Studio 키. 호스트가 자기 시크릿 저장소에서 꺼내 넣어 준다. */
	apiKey: string;
	model?: string;
	fallbackModel?: string;
	thinkingLevel?: ThinkingLevel;
	timeoutMs?: number;
}

export interface ExtractInput {
	/** base64 로 인코딩된 이미지 바이트. 접두사(`data:`) 없이 순수 base64. */
	data: string;
	mimeType: string;
	/** 규칙이 얹는 문맥 한 줄. 없으면 생략된다. */
	hint?: string;
}

const PROMPT = `이 문서는 영수증, 카드 매출전표, 인보이스, 계산서, 승차권, 결제 증빙 중 하나다.
파일명 변경에 사용할 필드를 추출하라.

규칙:
- date 는 실제 거래·이용 날짜다. 카드 유효기간, 출력일, 영수증 일련번호 안의 숫자를 날짜로 쓰지 않는다.
  영수증 번호가 "20260630-01-0032" 처럼 날짜처럼 생겨도, 승인일시가 따로 있으면 승인일시를 쓴다.
- 숙박 문서는 체크인 또는 실제 이용 시작일을 쓴다.
- amount 는 최종 결제 총액만 정수로 쓴다. 소계, 공급가액, 부가세 단독, 단가, 포인트는 쓰지 않는다.
  금액이 적혀 있지 않은 문서(승차권, 검표 확인증 등)는 amount 를 null 로 둔다. 0 으로 쓰지 않는다.
- currency 는 ISO 4217 코드다. 원화는 KRW.
- merchantName 은 돈을 쓴 곳의 이름이다. 카드사나 결제 앱 이름이 아니라 가맹점명을 쓴다.
- documentType 은 "영수증", "매출전표", "인보이스", "세금계산서", "승차권", "견적서", "확인증" 등 실제 문서 종류다.
- expenseCategory 는 "식비", "숙박", "교통", "물품", "서비스", "기타" 중 가장 가까운 값이다.
- paymentMethod 는 "카드", "현금", "계좌이체" 중 하나이며, 문서에 결제수단이 없으면 빈 문자열로 둔다.
- invoiceNumber 는 승인번호를 우선하고, 없으면 영수증·티켓 번호 중 가장 대표적인 식별자를 쓴다.
- confidence 는 0에서 1 사이다. 확신이 낮거나 필드를 못 찾으면 warnings 에 짧은 한국어 경고를 넣는다.`;

/**
 * 응답 모양을 API 수준에서 강제한다.
 *
 * 스키마를 주면 모델이 코드펜스를 두르지 않으므로, 응답을 손으로 벗겨 내는 코드가
 * 통째로 필요 없어진다. 필드 누락도 `required` 가 막는다.
 */
const RESPONSE_SCHEMA = {
	type: 'OBJECT',
	properties: {
		date: { type: 'STRING', description: 'YYYY-MM-DD. 못 찾으면 빈 문자열' },
		documentType: { type: 'STRING' },
		merchantName: { type: 'STRING' },
		amount: { type: 'INTEGER', nullable: true, description: '금액이 없는 문서는 null' },
		currency: { type: 'STRING' },
		expenseCategory: { type: 'STRING' },
		paymentMethod: { type: 'STRING' },
		invoiceNumber: { type: 'STRING' },
		confidence: { type: 'NUMBER' },
		warnings: { type: 'ARRAY', items: { type: 'STRING' } }
	},
	required: [
		'date',
		'documentType',
		'merchantName',
		'amount',
		'currency',
		'expenseCategory',
		'paymentMethod',
		'invoiceNumber',
		'confidence',
		'warnings'
	],
	propertyOrdering: [
		'date',
		'documentType',
		'merchantName',
		'amount',
		'currency',
		'expenseCategory',
		'paymentMethod',
		'invoiceNumber',
		'confidence',
		'warnings'
	]
} as const;

/** 한 번의 호출에서 실제로 쓴 토큰. 벤치와 화면의 사용량 표시에 쓴다. */
export interface ExtractUsage {
	model: string;
	promptTokens: number;
	thoughtsTokens: number;
	outputTokens: number;
}

export interface ExtractResult {
	info: ReceiptInfo;
	usage: ExtractUsage;
}

interface GeminiResponse {
	candidates?: { content?: { parts?: { text?: string }[] } }[];
	usageMetadata?: {
		promptTokenCount?: number;
		thoughtsTokenCount?: number;
		candidatesTokenCount?: number;
	};
	error?: { message?: string };
}

/** 재시도해도 소용없는 실패인지. 키가 틀렸는데 폴백 모델로 다시 부를 이유는 없다. */
function isFatal(status: number): boolean {
	return status === 400 || status === 401 || status === 403;
}

/** 레이트 리밋·일시적 서버 오류. 무료 티어에서는 429 가 일상이다. */
export function isRetryable(status: number): boolean {
	return status === 408 || status === 429 || status >= 500;
}

async function callGemini(
	model: string,
	input: ExtractInput,
	env: ExtractEnv
): Promise<{ ok: true; body: GeminiResponse } | { ok: false; status: number; message: string }> {
	const prompt = input.hint?.trim() ? `${PROMPT}\n\n이 문서의 문맥: ${input.hint.trim()}` : PROMPT;
	const body = {
		contents: [
			{ parts: [{ inlineData: { mimeType: input.mimeType, data: input.data } }, { text: prompt }] }
		],
		generationConfig: {
			temperature: 0,
			responseMimeType: 'application/json',
			responseSchema: RESPONSE_SCHEMA,
			thinkingConfig: { thinkingLevel: env.thinkingLevel ?? DEFAULT_THINKING_LEVEL }
		}
	};

	// 타임아웃이 없으면 응답이 오지 않는 한 건이 처리 슬롯을 영원히 붙든다.
	// 사용자 화면에서는 진행률이 멈춘 채 아무 일도 일어나지 않는 것으로 보인다.
	let response: Response;
	try {
		response = await fetch(`${ENDPOINT}/${model}:generateContent`, {
			method: 'POST',
			// 키는 쿼리스트링이 아니라 헤더로 보낸다 — 접근 로그·프록시 기록에 남지 않도록.
			headers: { 'Content-Type': 'application/json', 'x-goog-api-key': env.apiKey },
			body: JSON.stringify(body),
			signal: AbortSignal.timeout(env.timeoutMs ?? DEFAULT_TIMEOUT_MS)
		});
	} catch (err) {
		const timedOut = err instanceof Error && err.name === 'TimeoutError';
		// 타임아웃은 408 로 옮긴다 — 재시도할 값어치가 있는 실패로 분류되도록.
		return {
			ok: false,
			status: timedOut ? 408 : 0,
			message: timedOut ? '응답이 제한 시간 안에 오지 않았습니다.' : String(err)
		};
	}

	const parsed = (await response.json().catch(() => ({}))) as GeminiResponse;
	if (!response.ok) {
		return {
			ok: false,
			status: response.status,
			message: parsed.error?.message ?? `HTTP ${response.status}`
		};
	}
	return { ok: true, body: parsed };
}

function readResult(model: string, body: GeminiResponse): ExtractResult {
	const text = (body.candidates?.[0]?.content?.parts ?? [])
		.map((part) => part.text ?? '')
		.join('')
		.trim();
	if (text.length === 0) throw new Error('모델 응답이 비어 있습니다.');

	const usage = body.usageMetadata ?? {};
	return {
		info: normalizeReceiptInfo(JSON.parse(text)),
		usage: {
			model,
			promptTokens: usage.promptTokenCount ?? 0,
			thoughtsTokens: usage.thoughtsTokenCount ?? 0,
			outputTokens: usage.candidatesTokenCount ?? 0
		}
	};
}

/**
 * 이미지 한 장에서 필드를 읽는다.
 *
 * 기본 모델이 **재시도해도 소용없는 이유**로 실패했으면 그대로 던지고, 그 밖의
 * 실패에서만 폴백 모델로 한 번 더 간다. 키가 틀렸는데 두 모델을 다 부르면
 * 사용자는 같은 오류를 두 배 기다린 뒤에 본다.
 */
export async function extractReceipt(input: ExtractInput, env: ExtractEnv): Promise<ExtractResult> {
	if (!env.apiKey) {
		throw new Error('GEMINI_API_KEY 가 설정되지 않았습니다. 호스트의 환경변수를 확인하세요.');
	}

	const primary = env.model ?? DEFAULT_MODEL;
	const fallback = env.fallbackModel ?? FALLBACK_MODEL;

	const first = await callGemini(primary, input, env);
	if (first.ok) return readResult(primary, first.body);
	if (isFatal(first.status) || primary === fallback) {
		throw new ExtractError(`Gemini 오류 (${first.status}): ${first.message}`, first.status);
	}

	const second = await callGemini(fallback, input, env);
	if (second.ok) return readResult(fallback, second.body);
	throw new ExtractError(`Gemini 오류 (${second.status}): ${second.message}`, second.status);
}

/** 상태 코드를 들고 다니는 오류. 호출 측이 429 를 알아보고 물러났다 다시 와야 한다. */
export class ExtractError extends Error {
	// 생성자 파라미터 프로퍼티(`readonly status: number`)를 쓰지 않는다 — node 의
	// 타입 스트립 실행(벤치)이 그 문법을 거부해서 벤치만 따로 깨진다.
	status: number;

	constructor(message: string, status: number) {
		super(message);
		this.name = 'ExtractError';
		this.status = status;
	}
}
