/**
 * 규칙 아카이브 — 상황마다 다른 파일명 규칙을 만들어 두고 갈아 끼운다.
 *
 * 저장은 브라우저(localStorage), 공유는 JSON 파일이다. 서버에 두지 않는 이유는
 * 규칙이 개인의 작업 습관이지 공유 상태가 아니기 때문이다 (@client-first-processing).
 * 남에게 줄 때만 파일로 내보낸다.
 */

import { createCustomToken, createFieldToken, tokenId } from './naming';
import type {
	AmountFormat,
	DateFormat,
	EmptyFieldPolicy,
	NamingRule,
	NamingToken,
	ReceiptField
} from './types';

export const RULES_STORAGE_KEY = 'receipt_renamer_rules_v2';
export const ACTIVE_RULE_STORAGE_KEY = 'receipt_renamer_active_rule_v2';

/** 내보낸 파일이 이 툴의 것인지 알아보는 표식. 남의 JSON 을 삼키지 않기 위해 있다. */
export const EXPORT_KIND = 'betlab.receipt-renamer.rules';
export const EXPORT_VERSION = 1;

const BASE: Omit<NamingRule, 'id' | 'name' | 'tokens'> = {
	separator: '_',
	dateFormat: 'yyyyMMdd',
	amountFormat: 'krw-suffix',
	emptyFieldPolicy: 'skip',
	placeholder: '미확인',
	replaceSpacesWithUnderscore: false,
	extractionHint: ''
};

/**
 * 처음 열었을 때 비어 있지 않도록 깔아 두는 규칙들.
 *
 * 고정된 목록이 아니라 **씨앗**이다. 고치든 지우든 사용자 자유이고, 지운 것이
 * 다시 살아나지 않도록 저장된 목록이 비어 있어도 다시 깔지 않는다.
 */
export function starterRules(): NamingRule[] {
	return [
		{
			...BASE,
			id: 'starter-accounting',
			name: '회계 제출용',
			tokens: [
				createFieldToken('date'),
				createFieldToken('documentType'),
				createFieldToken('merchantName'),
				createFieldToken('amount')
			]
		},
		{
			...BASE,
			id: 'starter-category',
			name: '분류별 정리용',
			emptyFieldPolicy: 'placeholder',
			tokens: [
				createFieldToken('expenseCategory'),
				createFieldToken('date'),
				createFieldToken('merchantName')
			]
		},
		{
			...BASE,
			id: 'starter-audit',
			name: '감사 대비 (승인번호 포함)',
			dateFormat: 'yyyy-MM-dd',
			replaceSpacesWithUnderscore: true,
			tokens: [
				createFieldToken('date'),
				createFieldToken('merchantName'),
				createFieldToken('amount'),
				createFieldToken('invoiceNumber')
			]
		}
	];
}

export function createRule(name: string): NamingRule {
	return {
		...BASE,
		id: tokenId('rule'),
		name,
		tokens: [createFieldToken('date'), createFieldToken('merchantName'), createFieldToken('amount')]
	};
}

/** 토큰까지 새 id 로 복제한다. id 를 공유하면 한쪽을 고칠 때 다른 쪽이 함께 움직인다. */
export function cloneRule(rule: NamingRule, name: string): NamingRule {
	return {
		...rule,
		id: tokenId('rule'),
		name,
		tokens: rule.tokens.map((token) => ({ ...token, id: tokenId(token.kind) }))
	};
}

const DATE_FORMATS: DateFormat[] = ['yyyyMMdd', 'yyMMdd', 'yyyy-MM-dd', 'yyyy.MM.dd', 'raw'];
const AMOUNT_FORMATS: AmountFormat[] = ['krw-suffix', 'currency-code', 'plain'];
const FIELDS: ReceiptField[] = [
	'date',
	'documentType',
	'merchantName',
	'amount',
	'currency',
	'expenseCategory',
	'paymentMethod',
	'invoiceNumber',
	'originalName'
];

function normalizeToken(raw: unknown): NamingToken | null {
	if (raw === null || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	if (obj.kind === 'custom') {
		return {
			id: typeof obj.id === 'string' ? obj.id : tokenId('custom'),
			kind: 'custom',
			value: typeof obj.value === 'string' ? obj.value : ''
		};
	}
	if (obj.kind === 'field' && FIELDS.includes(obj.field as ReceiptField)) {
		return {
			id: typeof obj.id === 'string' ? obj.id : tokenId('field'),
			kind: 'field',
			field: obj.field as ReceiptField
		};
	}
	return null;
}

/**
 * 바깥에서 온 규칙을 믿을 수 있는 모양으로 좁힌다.
 *
 * localStorage 는 사람이 편집할 수 있고, 가져오기 파일은 남이 만든 것이다.
 * 모르는 값은 버리지 말고 기본값으로 **되돌린다** — 규칙 한 줄이 이상하다고
 * 규칙 전체를 잃는 편이 더 나쁘다.
 */
export function normalizeRule(raw: unknown): NamingRule | null {
	if (raw === null || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const tokens = Array.isArray(obj.tokens)
		? obj.tokens.map(normalizeToken).filter((token): token is NamingToken => token !== null)
		: [];

	const text = (key: string, fallback: string): string =>
		typeof obj[key] === 'string' && obj[key].length > 0 ? (obj[key] as string) : fallback;

	return {
		id: text('id', tokenId('rule')),
		name: text('name', '이름 없는 규칙'),
		separator: typeof obj.separator === 'string' ? obj.separator : BASE.separator,
		dateFormat: DATE_FORMATS.includes(obj.dateFormat as DateFormat)
			? (obj.dateFormat as DateFormat)
			: BASE.dateFormat,
		amountFormat: AMOUNT_FORMATS.includes(obj.amountFormat as AmountFormat)
			? (obj.amountFormat as AmountFormat)
			: BASE.amountFormat,
		emptyFieldPolicy: obj.emptyFieldPolicy === 'placeholder' ? 'placeholder' : 'skip',
		placeholder: text('placeholder', BASE.placeholder),
		replaceSpacesWithUnderscore: obj.replaceSpacesWithUnderscore === true,
		extractionHint: typeof obj.extractionHint === 'string' ? obj.extractionHint : '',
		tokens
	};
}

/**
 * 저장된 문자열을 규칙 목록으로 읽는다.
 *
 * `null`(한 번도 저장한 적 없음)일 때만 씨앗을 깐다. 저장된 값이 빈 배열이면
 * 사용자가 전부 지운 것이므로 그대로 존중한다.
 */
export function readRules(stored: string | null): NamingRule[] {
	if (stored === null) return starterRules();
	try {
		const parsed = JSON.parse(stored) as unknown;
		if (!Array.isArray(parsed)) return starterRules();
		return parsed.map(normalizeRule).filter((rule): rule is NamingRule => rule !== null);
	} catch {
		return starterRules();
	}
}

export interface RuleExport {
	kind: typeof EXPORT_KIND;
	version: number;
	exportedAt: string;
	rules: NamingRule[];
}

export function exportRules(rules: NamingRule[]): string {
	const payload: RuleExport = {
		kind: EXPORT_KIND,
		version: EXPORT_VERSION,
		exportedAt: new Date().toISOString(),
		rules
	};
	return JSON.stringify(payload, null, '\t');
}

export type ImportResult = { ok: true; rules: NamingRule[] } | { ok: false; reason: string };

/**
 * 내보낸 파일을 읽는다.
 *
 * 규칙 배열만 든 날것의 JSON 도 받아 준다 — 사람이 손으로 만든 파일을 거절하면
 * "형식이 뭔지" 를 물으러 오게 된다.
 */
export function importRules(text: string): ImportResult {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		return { ok: false, reason: 'JSON 으로 읽을 수 없는 파일입니다.' };
	}

	const list = Array.isArray(parsed)
		? parsed
		: parsed !== null && typeof parsed === 'object' && Array.isArray((parsed as RuleExport).rules)
			? (parsed as RuleExport).rules
			: null;

	if (list === null) return { ok: false, reason: '규칙 목록을 찾지 못했습니다.' };

	const rules = list.map(normalizeRule).filter((rule): rule is NamingRule => rule !== null);
	if (rules.length === 0) return { ok: false, reason: '읽을 수 있는 규칙이 없습니다.' };
	return { ok: true, rules };
}

/**
 * 가져온 규칙을 기존 목록에 합친다.
 *
 * id 가 겹치면 **덮어쓰지 않고** 새 id 로 들여온다. 같은 이름이 둘 생기는 건
 * 눈에 보이지만, 덮어쓴 규칙이 사라진 건 보이지 않는다.
 */
export function mergeRules(existing: NamingRule[], incoming: NamingRule[]): NamingRule[] {
	const taken = new Set(existing.map((rule) => rule.id));
	const names = new Set(existing.map((rule) => rule.name));
	const added = incoming.map((rule) => {
		const id = taken.has(rule.id) ? tokenId('rule') : rule.id;
		let name = rule.name;
		for (let i = 2; names.has(name); i += 1) name = `${rule.name} (${i})`;
		taken.add(id);
		names.add(name);
		return { ...rule, id, name };
	});
	return [...existing, ...added];
}

/** 토큰을 한 칸 옮긴다. 끝에서 더 밀면 아무 일도 일어나지 않는다. */
export function moveToken(rule: NamingRule, tokenId: string, delta: number): NamingRule {
	const index = rule.tokens.findIndex((token) => token.id === tokenId);
	const next = index + delta;
	if (index < 0 || next < 0 || next >= rule.tokens.length) return rule;
	const tokens = [...rule.tokens];
	[tokens[index], tokens[next]] = [tokens[next], tokens[index]];
	return { ...rule, tokens };
}

export function addToken(rule: NamingRule, token: NamingToken): NamingRule {
	return { ...rule, tokens: [...rule.tokens, token] };
}

export function removeToken(rule: NamingRule, id: string): NamingRule {
	return { ...rule, tokens: rule.tokens.filter((token) => token.id !== id) };
}

export function updateCustomToken(rule: NamingRule, id: string, value: string): NamingRule {
	return {
		...rule,
		tokens: rule.tokens.map((token) =>
			token.id === id && token.kind === 'custom' ? { ...token, value } : token
		)
	};
}

export { createCustomToken, createFieldToken };
