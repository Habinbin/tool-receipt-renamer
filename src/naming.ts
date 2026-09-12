import { normalizeDate } from './receipt';
import type {
	AmountFormat,
	DateFormat,
	EmptyFieldPolicy,
	NamingRule,
	NamingToken,
	ReceiptField,
	ReceiptInfo
} from './types';

export const FIELD_LABELS: Record<ReceiptField, string> = {
	date: '날짜',
	documentType: '문서종류',
	merchantName: '사용처',
	amount: '금액',
	currency: '통화',
	expenseCategory: '비용분류',
	paymentMethod: '결제수단',
	invoiceNumber: '승인번호',
	originalName: '원본파일명'
};

export const FIELD_ORDER: ReceiptField[] = [
	'date',
	'documentType',
	'merchantName',
	'amount',
	'expenseCategory',
	'paymentMethod',
	'invoiceNumber',
	'currency',
	'originalName'
];

/**
 * 태그 칩의 색 인덱스.
 *
 * 칩에는 글자가 있지만, 여러 개가 한 줄에 흐르면 **색이 먼저 읽힌다** — 규칙 카드와
 * 편집 패널을 나란히 놓았을 때 같은 조각인지 대조하는 것도 색이다. 그래서 필드마다
 * 고정된 칸을 준다. 색값 자체는 `ui/theme.css` 의 `--tag-*` 에만 있다 (@design-contract).
 *
 * `FIELD_ORDER` 의 자리를 그대로 쓰므로, 필드를 추가하면 팔레트도 같이 늘려야 한다.
 */
export function fieldColorIndex(token: NamingToken): number | null {
	if (token.kind === 'custom') return null; // 고정문구는 중립색 — 추출값이 아니다
	const index = FIELD_ORDER.indexOf(token.field);
	return index < 0 ? null : index;
}

/** 파일명에 쓸 수 없는 문자. 한글·공백은 막지 않는다 — 한국어 파일명이 기본이다. */
const ILLEGAL = /[\\/:*?"<>|]/g;

export function tokenId(prefix: string): string {
	const random =
		typeof crypto !== 'undefined' && 'randomUUID' in crypto
			? crypto.randomUUID()
			: `${Date.now()}-${Math.random().toString(36).slice(2)}`;
	return `${prefix}-${random}`;
}

export function createFieldToken(field: ReceiptField): NamingToken {
	return { id: tokenId(field), kind: 'field', field };
}

export function createCustomToken(value = ''): NamingToken {
	return { id: tokenId('custom'), kind: 'custom', value };
}

export function tokenLabel(token: NamingToken): string {
	return token.kind === 'field' ? FIELD_LABELS[token.field] : '고정문구';
}

export function extOf(fileName: string): string {
	const match = /\.([^.]+)$/.exec(fileName);
	return match === null ? '' : match[1].toLowerCase();
}

export function stemOf(fileName: string): string {
	return fileName.replace(/\.[^.]+$/, '');
}

/**
 * 한 조각을 파일명에 넣을 수 있게 다듬는다.
 *
 * 금지 문자는 지우는 게 아니라 공백으로 바꾼다 — `A/B` 를 `AB` 로 붙이면 다른
 * 낱말이 되지만 `A B` 는 읽는 사람이 원래를 짐작할 수 있다.
 */
export function sanitizeToken(value: string): string {
	return value.replace(ILLEGAL, ' ').replace(/\s+/g, ' ').trim();
}

export function formatDate(raw: string, format: DateFormat): string {
	if (format === 'raw') return sanitizeToken(raw);
	const normalized = normalizeDate(raw);
	// 8자리로 못 편 값은 형식을 씌우지 않고 원문을 쓴다. 틀린 날짜를 지어내는 것보다 낫다.
	if (normalized.length !== 8) return sanitizeToken(raw);
	const [yyyy, mm, dd] = [normalized.slice(0, 4), normalized.slice(4, 6), normalized.slice(6, 8)];
	switch (format) {
		case 'yyMMdd':
			return `${yyyy.slice(2)}${mm}${dd}`;
		case 'yyyy-MM-dd':
			return `${yyyy}-${mm}-${dd}`;
		case 'yyyy.MM.dd':
			return `${yyyy}.${mm}.${dd}`;
		default:
			return `${yyyy}${mm}${dd}`;
	}
}

export function formatAmount(
	amount: number | null,
	currency: string,
	format: AmountFormat
): string {
	// 금액이 없는 문서(승차권)와 0원 결제를 구분하지 않는다 — 둘 다 이름에 넣을 게 없다.
	if (amount === null || amount <= 0) return '';
	const formatted = amount.toLocaleString('en-US');
	const code = sanitizeToken(currency || 'KRW').toUpperCase();
	if (format === 'plain') return formatted;
	if (format === 'currency-code') return `${code} ${formatted}`;
	return code === 'KRW' ? `${formatted}원` : `${formatted} ${code}`;
}

/** 토큰 하나가 내놓는 날것의 값. 빈 값 정책을 적용하기 **전** 이다. */
export function rawTokenValue(
	token: NamingToken,
	info: ReceiptInfo,
	originalName: string,
	rule: NamingRule
): string {
	if (token.kind === 'custom') return token.value;
	switch (token.field) {
		case 'date':
			return formatDate(info.date, rule.dateFormat);
		case 'amount':
			return formatAmount(info.amount, info.currency, rule.amountFormat);
		case 'originalName':
			return stemOf(originalName);
		default:
			return info[token.field] ?? '';
	}
}

function applyEmptyPolicy(value: string, policy: EmptyFieldPolicy, placeholder: string): string {
	const sanitized = sanitizeToken(value);
	if (sanitized.length > 0) return sanitized;
	return policy === 'placeholder' ? sanitizeToken(placeholder) : '';
}

export function tokenValue(
	token: NamingToken,
	info: ReceiptInfo,
	originalName: string,
	rule: NamingRule
): string {
	return applyEmptyPolicy(
		rawTokenValue(token, info, originalName, rule),
		rule.emptyFieldPolicy,
		rule.placeholder
	);
}

/** 값을 못 채운 토큰의 라벨들. 화면에 "무엇이 비었는지" 를 보여주는 데 쓴다. */
export function missingTokenLabels(
	info: ReceiptInfo,
	originalName: string,
	rule: NamingRule
): string[] {
	return rule.tokens
		.filter((token) => sanitizeToken(rawTokenValue(token, info, originalName, rule)).length === 0)
		.map(tokenLabel);
}

export function composeBaseName(info: ReceiptInfo, originalName: string, rule: NamingRule): string {
	const parts = rule.tokens
		.map((token) => tokenValue(token, info, originalName, rule))
		.filter((part) => part.length > 0);
	// 규칙이 아무것도 못 채웠으면 원본 이름으로 돌아간다. 빈 파일명은 만들지 않는다.
	const fallback = sanitizeToken(stemOf(originalName)) || 'receipt';
	const base = parts.length > 0 ? parts.join(rule.separator) : fallback;
	return rule.replaceSpacesWithUnderscore ? base.replace(/\s+/g, '_') : base;
}

export function fileName(info: ReceiptInfo, originalName: string, rule: NamingRule): string {
	const base = composeBaseName(info, originalName, rule);
	const ext = extOf(originalName);
	return ext.length > 0 ? `${base}.${ext}` : base;
}

/**
 * 이미 쓴 이름이면 꼬리를 붙인다.
 *
 * 같은 거래의 영수증과 카드전표처럼 **정말로** 같은 이름이 나오는 경우가 있다.
 * 덮어쓰면 ZIP 안에서 한 장이 조용히 사라지므로 반드시 갈라 놓는다.
 */
export function uniqueName(name: string, used: Set<string>, compactSuffix = false): string {
	if (!used.has(name)) return name;
	const dot = name.lastIndexOf('.');
	const stem = dot > 0 ? name.slice(0, dot) : name;
	const ext = dot > 0 ? name.slice(dot) : '';
	for (let i = 2; ; i += 1) {
		const candidate = compactSuffix ? `${stem}_${i}${ext}` : `${stem} (${i})${ext}`;
		if (!used.has(candidate)) return candidate;
	}
}

/** 목록 전체의 최종 파일명. 입력 순서대로 1:1 로 돌려준다. */
export function resolveNames(
	receipts: { info: ReceiptInfo; originalName: string }[],
	rule: NamingRule
): string[] {
	const used = new Set<string>();
	return receipts.map((receipt) => {
		const name = uniqueName(
			fileName(receipt.info, receipt.originalName, rule),
			used,
			rule.replaceSpacesWithUnderscore
		);
		used.add(name);
		return name;
	});
}
