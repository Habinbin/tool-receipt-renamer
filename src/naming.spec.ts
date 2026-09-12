import { describe, expect, it } from 'vitest';

import {
	composeBaseName,
	createCustomToken,
	createFieldToken,
	fileName,
	formatAmount,
	formatDate,
	missingTokenLabels,
	nameSegments,
	resolveNames,
	sanitizeToken,
	uniqueName
} from './naming';
import { EMPTY_RECEIPT_INFO } from './receipt';
import { createRule } from './rules';
import type { NamingRule, ReceiptInfo } from './types';

function info(overrides: Partial<ReceiptInfo> = {}): ReceiptInfo {
	return { ...EMPTY_RECEIPT_INFO, ...overrides };
}

function rule(overrides: Partial<NamingRule> = {}): NamingRule {
	return { ...createRule('테스트'), ...overrides };
}

describe('formatDate', () => {
	it('구분자가 어떻든 같은 날짜로 편다', () => {
		for (const raw of ['2026-07-02', '2026.07.02', '2026/07/02', '20260702']) {
			expect(formatDate(raw, 'yyyyMMdd')).toBe('20260702');
		}
	});

	it('두 자리 연도는 2000년대로 편다', () => {
		expect(formatDate('26/06/23', 'yyyy-MM-dd')).toBe('2026-06-23');
	});

	it('날짜로 못 읽은 값은 형식을 씌우지 않고 원문을 남긴다', () => {
		// 틀린 날짜를 지어내느니 사람이 알아보게 두는 편이 낫다.
		expect(formatDate('날짜없음', 'yyyyMMdd')).toBe('날짜없음');
	});
});

describe('formatAmount', () => {
	it('원화는 천단위 쉼표와 원을 붙인다', () => {
		expect(formatAmount(36000, 'KRW', 'krw-suffix')).toBe('36,000원');
	});

	it('원화가 아니면 통화 코드를 뒤에 붙인다', () => {
		expect(formatAmount(1250, 'USD', 'krw-suffix')).toBe('1,250 USD');
	});

	it('금액이 없는 문서는 빈 문자열이다', () => {
		// 승차권처럼 금액 자체가 없는 문서. `0원` 이 파일명에 붙으면 안 된다.
		expect(formatAmount(null, 'KRW', 'krw-suffix')).toBe('');
		expect(formatAmount(0, 'KRW', 'plain')).toBe('');
	});
});

describe('sanitizeToken', () => {
	it('파일명에 못 쓰는 문자를 공백으로 바꾼다', () => {
		expect(sanitizeToken('유성/광주: 우등*')).toBe('유성 광주 우등');
	});

	it('한글과 공백은 건드리지 않는다', () => {
		expect(sanitizeToken('위대한 국밥')).toBe('위대한 국밥');
	});
});

describe('composeBaseName', () => {
	const receipt = info({
		date: '2026-07-02',
		documentType: '영수증',
		merchantName: '전북고속',
		amount: 36000,
		currency: 'KRW'
	});

	it('토큰 순서대로 구분자로 잇는다', () => {
		const r = rule({
			tokens: [
				createFieldToken('date'),
				createFieldToken('documentType'),
				createFieldToken('merchantName'),
				createFieldToken('amount')
			]
		});
		expect(composeBaseName(receipt, 'IMG_1.jpg', r)).toBe('20260702_영수증_전북고속_36,000원');
	});

	it('빈 값은 건너뛰어 구분자가 겹치지 않는다', () => {
		const r = rule({
			tokens: [
				createFieldToken('date'),
				createFieldToken('paymentMethod'), // 비어 있다
				createFieldToken('merchantName')
			]
		});
		expect(composeBaseName(receipt, 'IMG_1.jpg', r)).toBe('20260702_전북고속');
	});

	it('placeholder 정책이면 빈 자리를 표시로 채운다', () => {
		const r = rule({
			emptyFieldPolicy: 'placeholder',
			placeholder: '미확인',
			tokens: [createFieldToken('date'), createFieldToken('paymentMethod')]
		});
		expect(composeBaseName(receipt, 'IMG_1.jpg', r)).toBe('20260702_미확인');
	});

	it('규칙이 아무것도 못 채우면 원본 이름으로 돌아간다', () => {
		const r = rule({ tokens: [createFieldToken('merchantName')] });
		expect(composeBaseName(info(), 'IMG_0421.jpg', r)).toBe('IMG_0421');
	});

	it('토큰이 하나도 없어도 빈 이름을 만들지 않는다', () => {
		expect(composeBaseName(receipt, 'IMG_0421.jpg', rule({ tokens: [] }))).toBe('IMG_0421');
	});

	it('고정문구를 그대로 넣는다', () => {
		const r = rule({ tokens: [createCustomToken('2026상반기'), createFieldToken('date')] });
		expect(composeBaseName(receipt, 'IMG_1.jpg', r)).toBe('2026상반기_20260702');
	});

	it('공백을 밑줄로 바꾸는 규칙이면 결과에 공백이 남지 않는다', () => {
		const r = rule({
			replaceSpacesWithUnderscore: true,
			tokens: [createFieldToken('merchantName'), createFieldToken('amount')]
		});
		const name = composeBaseName(info({ merchantName: '고속 버스', amount: 36000 }), 'a.jpg', r);
		expect(name).not.toMatch(/\s/);
	});
});

describe('nameSegments', () => {
	const receipt = info({
		date: '2026-07-02',
		documentType: '영수증',
		merchantName: '전북고속',
		amount: 36000,
		currency: 'KRW'
	});

	/*
	 * 이 묶음이 지키는 것은 하나다 — **화면이 색으로 약속한 매칭과 실제 파일명이
	 * 어긋나지 않는다.** 조각을 이어 붙이면 반드시 `fileName` 과 같아야 한다.
	 */
	function joined(i: ReceiptInfo, original: string, r: NamingRule): string {
		return nameSegments(i, original, r)
			.map((segment) => segment.text)
			.join('');
	}

	it('이어 붙이면 fileName 과 같다', () => {
		const r = rule({
			tokens: [
				createFieldToken('date'),
				createFieldToken('documentType'),
				createFieldToken('merchantName'),
				createFieldToken('amount')
			]
		});
		expect(joined(receipt, 'IMG_1.jpg', r)).toBe(fileName(receipt, 'IMG_1.jpg', r));
	});

	it('공백을 밑줄로 바꿔도 이어 붙인 값이 fileName 과 같다', () => {
		// 조각마다 따로 변환하면 조각 경계에 걸친 공백 한 줄기가 밑줄 둘이 된다.
		const r = rule({
			replaceSpacesWithUnderscore: true,
			separator: ' ',
			tokens: [createFieldToken('merchantName'), createFieldToken('amount')]
		});
		const i = info({ merchantName: '고속 버스 ', amount: 36000 });
		expect(joined(i, 'a.jpg', r)).toBe(fileName(i, 'a.jpg', r));
	});

	it('되돌아간 원본 이름에도 조각이 붙는다', () => {
		const r = rule({ tokens: [] });
		expect(joined(receipt, 'IMG_0421.jpg', r)).toBe(fileName(receipt, 'IMG_0421.jpg', r));
	});

	it('값이 있는 항목마다 그 항목의 id 를 단다', () => {
		const date = createFieldToken('date');
		const merchant = createFieldToken('merchantName');
		const r = rule({ tokens: [date, merchant] });
		const owners = nameSegments(receipt, 'IMG_1.jpg', r)
			.filter((segment) => segment.tokenId !== null)
			.map((segment) => segment.tokenId);
		expect(owners).toEqual([date.id, merchant.id]);
	});

	it('구분자와 확장자는 어느 항목의 것도 아니다', () => {
		const r = rule({ tokens: [createFieldToken('date'), createFieldToken('merchantName')] });
		const orphans = nameSegments(receipt, 'IMG_1.jpg', r)
			.filter((segment) => segment.tokenId === null)
			.map((segment) => segment.text);
		expect(orphans).toEqual(['_', '.jpg']);
	});

	it('못 읽어 빈 항목은 조각을 만들지 않는다', () => {
		const r = rule({
			emptyFieldPolicy: 'skip',
			tokens: [createFieldToken('date'), createFieldToken('invoiceNumber')]
		});
		const i = info({ date: '2026-07-02' });
		expect(nameSegments(i, 'a.jpg', r).filter((s) => s.tokenId !== null)).toHaveLength(1);
	});
});

describe('fileName', () => {
	it('확장자를 소문자로 유지한다', () => {
		const r = rule({ tokens: [createFieldToken('merchantName')] });
		expect(fileName(info({ merchantName: '어선e' }), 'IMG_1.JPG', r)).toBe('어선e.jpg');
	});

	it('확장자가 없으면 붙이지 않는다', () => {
		const r = rule({ tokens: [createFieldToken('merchantName')] });
		expect(fileName(info({ merchantName: '어선e' }), 'scan', r)).toBe('어선e');
	});
});

describe('uniqueName', () => {
	it('겹치면 꼬리를 붙인다', () => {
		expect(uniqueName('a.jpg', new Set(['a.jpg']))).toBe('a (2).jpg');
		expect(uniqueName('a.jpg', new Set(['a.jpg', 'a (2).jpg']))).toBe('a (3).jpg');
	});

	it('밑줄 규칙에서는 꼬리에도 공백을 쓰지 않는다', () => {
		expect(uniqueName('a.jpg', new Set(['a.jpg']), true)).toBe('a_2.jpg');
	});
});

describe('resolveNames', () => {
	it('입력과 1:1 로 대응한다', () => {
		const r = rule({ tokens: [createFieldToken('merchantName')] });
		const list = [
			{ info: info({ merchantName: 'A' }), originalName: '1.jpg' },
			{ info: info({ merchantName: 'B' }), originalName: '2.jpg' },
			{ info: info({ merchantName: 'C' }), originalName: '3.jpg' }
		];
		expect(resolveNames(list, r)).toEqual(['A.jpg', 'B.jpg', 'C.jpg']);
	});

	it('같은 거래의 두 문서가 같은 이름이 되어도 서로를 덮지 않는다', () => {
		// 골든셋의 실제 사례 — KOBUS 영수증과 카드전표는 날짜·금액·사용처가 모두 같다.
		const r = rule({ tokens: [createFieldToken('date'), createFieldToken('amount')] });
		const same = info({ date: '2026-07-02', amount: 36000 });
		const names = resolveNames(
			[
				{ info: same, originalName: 'a.jpg' },
				{ info: same, originalName: 'b.png' }
			],
			r
		);
		expect(new Set(names).size).toBe(2);
	});
});

describe('missingTokenLabels', () => {
	it('못 채운 토큰의 이름을 알려준다', () => {
		const r = rule({
			tokens: [
				createFieldToken('date'),
				createFieldToken('amount'),
				createFieldToken('merchantName')
			]
		});
		const labels = missingTokenLabels(info({ date: '2026-07-02' }), 'a.jpg', r);
		expect(labels).toEqual(['금액', '사용처']);
	});

	it('placeholder 로 채워지는 자리도 비었다고 본다', () => {
		// 화면에는 "무엇이 비어서 미확인이 되었는지" 가 보여야 한다.
		const r = rule({ emptyFieldPolicy: 'placeholder', tokens: [createFieldToken('amount')] });
		expect(missingTokenLabels(info(), 'a.jpg', r)).toEqual(['금액']);
	});
});
