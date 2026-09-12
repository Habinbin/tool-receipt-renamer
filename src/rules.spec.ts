import { describe, expect, it } from 'vitest';

import { createFieldToken } from './naming';
import {
	cloneRule,
	createRule,
	exportRules,
	gapForPointer,
	importRules,
	isNoOpGap,
	mergeRules,
	moveToken,
	moveTokenToGap,
	normalizeRule,
	readRules,
	starterRules
} from './rules';
import type { ReceiptField } from './types';

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

/* ── 순서 바꾸기 ──────────────────────────────────────────────────── */

const FIVE: ReceiptField[] = ['date', 'documentType', 'merchantName', 'amount', 'invoiceNumber'];

/** 필드 다섯 개짜리 규칙. 순서를 `fields()` 로 읽어 비교한다. */
function ruleOf(fields: ReceiptField[] = FIVE) {
	return { ...createRule('순서'), tokens: fields.map(createFieldToken) };
}

function fields(rule: {
	tokens: { kind: string; field?: ReceiptField }[];
}): (ReceiptField | 'custom')[] {
	return rule.tokens.map((token) => (token.kind === 'field' ? token.field! : 'custom'));
}

describe('gapForPointer', () => {
	it('앞 절반이면 앞 틈, 뒤 절반이면 뒤 틈', () => {
		expect(gapForPointer(2, 10, 100)).toBe(2);
		expect(gapForPointer(2, 90, 100)).toBe(3);
	});

	it('마지막 항목의 뒤 절반은 마지막 틈을 가리킨다', () => {
		// 이게 안 되면 "맨 뒤로 옮기기" 가 포인터로 도달 불가능해진다 (@reorder-affordance #4).
		expect(gapForPointer(4, 90, 100)).toBe(5);
	});

	it('정확한 중간점은 앞 틈으로 고정한다', () => {
		// 경계에서 막대가 두 자리를 오가며 깜빡이지 않도록.
		expect(gapForPointer(2, 50, 100)).toBe(2);
	});
});

describe('isNoOpGap', () => {
	it('자기 앞·뒤 틈이면 제자리다', () => {
		expect(isNoOpGap(4, 4)).toBe(true);
		expect(isNoOpGap(4, 5)).toBe(true);
	});

	it('그 밖의 틈은 실제 이동이다', () => {
		expect(isNoOpGap(4, 3)).toBe(false);
		expect(isNoOpGap(4, 6)).toBe(false);
	});
});

describe('moveTokenToGap', () => {
	it('마지막 토큰을 맨 앞으로 옮긴다', () => {
		expect(fields(moveTokenToGap(ruleOf(), 4, 0))).toEqual([
			'invoiceNumber',
			'date',
			'documentType',
			'merchantName',
			'amount'
		]);
	});

	it('첫 토큰을 맨 뒤로 옮긴다', () => {
		// 마지막 틈(= 길이). 재정렬 구현에서 가장 흔히 빠지는 자리다.
		expect(fields(moveTokenToGap(ruleOf(), 0, 5))).toEqual([
			'documentType',
			'merchantName',
			'amount',
			'invoiceNumber',
			'date'
		]);
	});

	it('표시한 틈과 정확히 같은 자리에 들어간다', () => {
		expect(fields(moveTokenToGap(ruleOf(), 4, 2))).toEqual([
			'date',
			'documentType',
			'invoiceNumber',
			'merchantName',
			'amount'
		]);
	});

	it('위에서 내려오든 아래에서 올라가든 같은 틈이면 같은 결과다', () => {
		const down = moveTokenToGap(ruleOf(), 0, 3); // date 를 2와 3 사이로
		const up = moveTokenToGap(
			ruleOf(['documentType', 'merchantName', 'date', 'amount', 'invoiceNumber']),
			2,
			2
		);
		expect(fields(down)).toEqual(fields(up));
	});

	it('제자리에 놓으면 아무 일도 일어나지 않는다', () => {
		const rule = ruleOf();
		expect(moveTokenToGap(rule, 4, 4)).toBe(rule);
		expect(moveTokenToGap(rule, 4, 5)).toBe(rule);
	});

	it('범위 밖 입력이 목록을 망가뜨리지 않는다', () => {
		const rule = ruleOf();
		expect(moveTokenToGap(rule, -1, 2)).toBe(rule);
		expect(moveTokenToGap(rule, 5, 2)).toBe(rule);
		expect(moveTokenToGap(rule, 2, -1)).toBe(rule);
		expect(moveTokenToGap(rule, 2, 6)).toBe(rule);
	});

	it('어느 조합에서도 토큰을 잃거나 복제하지 않는다', () => {
		const rule = ruleOf();
		const ids = new Set(rule.tokens.map((token) => token.id));
		for (let from = 0; from < 5; from += 1) {
			for (let gap = 0; gap <= 5; gap += 1) {
				const next = moveTokenToGap(rule, from, gap);
				expect(next.tokens).toHaveLength(5);
				expect(new Set(next.tokens.map((token) => token.id))).toEqual(ids);
			}
		}
	});

	it('입력을 변형하지 않는다', () => {
		const rule = ruleOf();
		const before = fields(rule);
		moveTokenToGap(rule, 4, 0);
		expect(fields(rule)).toEqual(before);
	});

	it('토큰 밖 필드는 보존된다', () => {
		const rule = { ...ruleOf(), separator: '-', extractionHint: '해외 출장' };
		const next = moveTokenToGap(rule, 4, 0);
		expect(next.separator).toBe('-');
		expect(next.extractionHint).toBe('해외 출장');
	});
});

describe('moveToken 과 moveTokenToGap 의 일치', () => {
	it('키보드로 한 칸씩 옮긴 결과가 드래그 한 번과 같다', () => {
		// 두 경로가 갈라지면 버그를 한쪽에서만 보게 된다.
		let byKeyboard = ruleOf();
		const id = byKeyboard.tokens[4].id;
		for (let i = 0; i < 4; i += 1) byKeyboard = moveToken(byKeyboard, id, -1);
		expect(fields(byKeyboard)).toEqual(fields(moveTokenToGap(ruleOf(), 4, 0)));
	});
});
