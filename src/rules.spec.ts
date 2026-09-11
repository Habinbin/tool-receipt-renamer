import { describe, expect, it } from 'vitest';

import { createFieldToken } from './naming';
import {
	cloneRule,
	createRule,
	exportRules,
	importRules,
	mergeRules,
	moveToken,
	normalizeRule,
	readRules,
	starterRules
} from './rules';

describe('readRules', () => {
	it('한 번도 저장한 적 없으면 씨앗 규칙을 깐다', () => {
		expect(readRules(null).length).toBeGreaterThan(0);
	});

	it('전부 지운 상태는 그대로 존중한다', () => {
		// 빈 배열은 "아직 없음" 이 아니라 "사용자가 지웠음" 이다. 되살리면 안 된다.
		expect(readRules('[]')).toEqual([]);
	});

	it('깨진 저장값이면 씨앗으로 돌아간다', () => {
		expect(readRules('{ 이건 JSON 이 아니다').length).toBeGreaterThan(0);
	});

	it('알 수 없는 값이 섞여 있어도 규칙을 잃지 않는다', () => {
		const stored = JSON.stringify([
			{
				id: 'a',
				name: '규칙',
				dateFormat: '외계형식',
				tokens: [{ kind: 'field', field: '없는필드' }]
			}
		]);
		const [rule] = readRules(stored);
		expect(rule.name).toBe('규칙');
		expect(rule.dateFormat).toBe('yyyyMMdd'); // 기본값으로 되돌린다
		expect(rule.tokens).toEqual([]); // 모르는 토큰만 버린다
	});
});

describe('normalizeRule', () => {
	it('객체가 아니면 거절한다', () => {
		expect(normalizeRule('규칙')).toBeNull();
		expect(normalizeRule(null)).toBeNull();
	});

	it('추출 힌트를 보존한다', () => {
		const rule = normalizeRule({ id: 'a', name: 'n', extractionHint: '해외 출장' });
		expect(rule?.extractionHint).toBe('해외 출장');
	});
});

describe('cloneRule', () => {
	it('규칙과 토큰 모두 새 id 를 받는다', () => {
		const original = createRule('원본');
		const copy = cloneRule(original, '사본');
		expect(copy.id).not.toBe(original.id);
		const ids = new Set([...original.tokens, ...copy.tokens].map((token) => token.id));
		expect(ids.size).toBe(original.tokens.length + copy.tokens.length);
	});
});

describe('moveToken', () => {
	const rule = {
		...createRule('r'),
		tokens: [createFieldToken('date'), createFieldToken('merchantName'), createFieldToken('amount')]
	};

	it('한 칸 옮긴다', () => {
		const moved = moveToken(rule, rule.tokens[0].id, 1);
		expect(moved.tokens.map((t) => (t.kind === 'field' ? t.field : ''))).toEqual([
			'merchantName',
			'date',
			'amount'
		]);
	});

	it('끝에서 더 밀면 아무 일도 없다', () => {
		expect(moveToken(rule, rule.tokens[0].id, -1)).toBe(rule);
		expect(moveToken(rule, rule.tokens[2].id, 1)).toBe(rule);
	});
});

describe('내보내기와 가져오기', () => {
	it('내보낸 것을 그대로 다시 읽으면 같은 규칙이다', () => {
		const rules = starterRules();
		const result = importRules(exportRules(rules));
		expect(result.ok).toBe(true);
		if (result.ok) expect(result.rules).toEqual(rules);
	});

	it('규칙 배열만 든 날것의 JSON 도 받아 준다', () => {
		// 사람이 손으로 만든 파일을 거절하면 형식을 물으러 오게 된다.
		const result = importRules(JSON.stringify(starterRules()));
		expect(result.ok).toBe(true);
	});

	it('JSON 이 아니면 이유를 알려준다', () => {
		const result = importRules('영수증');
		expect(result).toEqual({ ok: false, reason: 'JSON 으로 읽을 수 없는 파일입니다.' });
	});

	it('규칙이 없는 JSON 은 거절한다', () => {
		expect(importRules('{"kind":"뭔가다른것"}').ok).toBe(false);
	});
});

describe('mergeRules', () => {
	it('id 가 겹쳐도 기존 규칙을 덮지 않는다', () => {
		const existing = starterRules();
		const merged = mergeRules(existing, starterRules());
		expect(merged.length).toBe(existing.length * 2);
		expect(new Set(merged.map((rule) => rule.id)).size).toBe(merged.length);
	});

	it('같은 이름은 꼬리를 붙여 구분한다', () => {
		const merged = mergeRules(existingOne(), existingOne());
		expect(merged.map((rule) => rule.name)).toEqual(['회계 제출용', '회계 제출용 (2)']);
	});

	function existingOne() {
		return [starterRules()[0]];
	}
});
