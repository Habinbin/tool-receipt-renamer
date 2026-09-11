import type { ReceiptInfo } from './types';

/** 아무것도 못 읽었을 때의 상태. 사용자가 손으로 채워 넣는 출발점이기도 하다. */
export const EMPTY_RECEIPT_INFO: ReceiptInfo = {
	date: '',
	documentType: '',
	merchantName: '',
	amount: null,
	currency: 'KRW',
	expenseCategory: '',
	paymentMethod: '',
	invoiceNumber: '',
	confidence: null,
	warnings: []
};

/**
 * 날짜 문자열에서 8자리 `YYYYMMDD` 를 뽑는다.
 *
 * 두 자리 연도는 2000년대로 편다 — 영수증에 1900년대는 오지 않는다.
 * 그 외에는 빈 문자열을 준다. 형식을 못 믿을 때 조용히 지어내지 않기 위함이다.
 */
export function normalizeDate(raw: unknown): string {
	if (typeof raw !== 'string') return '';
	const digits = raw.trim().replace(/[^\d]/g, '');
	if (digits.length === 8) return digits;
	if (digits.length === 6) return `20${digits}`;
	return '';
}

/**
 * 금액을 정수로 만든다.
 *
 * `null` 은 "금액이 없는 문서"(승차권 등)라는 뜻이고 0 과 다르다 — 0 으로 뭉개면
 * 파일명에 `0원` 이 붙는다. 그래서 못 읽은 값도 0 이 아니라 `null` 이다.
 */
export function parseAmount(raw: unknown): number | null {
	if (typeof raw === 'number') return Number.isFinite(raw) ? Math.round(raw) : null;
	if (typeof raw !== 'string') return null;
	// 천단위 쉼표는 버리고 소수점은 남긴다. `36,000` → 36000, `12.50` → 13.
	const cleaned = raw.replace(/,/g, '').replace(/[^\d.]/g, '');
	if (cleaned.length === 0) return null;
	const parsed = Number.parseFloat(cleaned);
	return Number.isFinite(parsed) ? Math.round(parsed) : null;
}

/**
 * 모델 응답을 신뢰할 수 있는 모양으로 좁힌다.
 *
 * 스키마를 강제해도 값의 **내용**까지는 보장되지 않는다 — 빈 문자열, 범위를 벗어난
 * confidence, 문자열로 온 금액은 여전히 온다. 그 방어는 여기 한 곳에만 둔다.
 */
export function normalizeReceiptInfo(raw: unknown): ReceiptInfo {
	const obj = (raw ?? {}) as Record<string, unknown>;
	const str = (key: string): string => (typeof obj[key] === 'string' ? obj[key].trim() : '');
	const currency = str('currency').toUpperCase();

	return {
		date: str('date'),
		documentType: str('documentType'),
		merchantName: str('merchantName'),
		amount: parseAmount(obj.amount),
		currency: currency.length > 0 ? currency : 'KRW',
		expenseCategory: str('expenseCategory'),
		paymentMethod: str('paymentMethod'),
		invoiceNumber: str('invoiceNumber'),
		confidence:
			typeof obj.confidence === 'number' && Number.isFinite(obj.confidence)
				? Math.max(0, Math.min(1, obj.confidence))
				: null,
		warnings: Array.isArray(obj.warnings)
			? obj.warnings.filter((item): item is string => typeof item === 'string')
			: []
	};
}
