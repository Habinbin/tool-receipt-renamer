import { describe, expect, it } from 'vitest';

import { normalizeDate, normalizeReceiptInfo, parseAmount } from './receipt';

describe('parseAmount', () => {
	it('천단위 쉼표와 단위를 걷어낸다', () => {
		expect(parseAmount('36,000원')).toBe(36000);
		expect(parseAmount('KRW 1,250')).toBe(1250);
	});

	it('소수는 반올림한다', () => {
		expect(parseAmount('12.50')).toBe(13);
	});

	it('금액이 없는 문서는 null 이다', () => {
		// 승차권처럼 금액이 아예 없는 문서. 0 으로 바꾸면 파일명에 `0원` 이 붙는다.
		expect(parseAmount(null)).toBeNull();
		expect(parseAmount('')).toBeNull();
		expect(parseAmount('금액없음')).toBeNull();
	});

	it('0 은 0 으로 남긴다', () => {
		expect(parseAmount(0)).toBe(0);
	});
});

describe('normalizeDate', () => {
	it('구분자가 무엇이든 여덟 자리로 편다', () => {
		expect(normalizeDate('2026. 07. 02.')).toBe('20260702');
	});

	it('여섯 자리는 2000년대로 본다', () => {
		expect(normalizeDate('260702')).toBe('20260702');
	});

	it('자릿수가 맞지 않으면 비운다', () => {
		// 승인번호 같은 긴 숫자를 날짜로 착각하지 않기 위해.
		expect(normalizeDate('28124330')).toBe('28124330'); // 여덟 자리는 통과시킨다
		expect(normalizeDate('202607021542')).toBe('');
		expect(normalizeDate('7월 2일')).toBe('');
	});
});

describe('normalizeReceiptInfo', () => {
	it('없는 필드를 빈 값으로 채운다', () => {
		expect(normalizeReceiptInfo({})).toEqual({
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
		});
	});

	it('문자열로 온 금액도 정수로 만든다', () => {
		expect(normalizeReceiptInfo({ amount: '36,000' }).amount).toBe(36000);
	});

	it('confidence 를 0~1 로 가둔다', () => {
		expect(normalizeReceiptInfo({ confidence: 7 }).confidence).toBe(1);
		expect(normalizeReceiptInfo({ confidence: -3 }).confidence).toBe(0);
		expect(normalizeReceiptInfo({ confidence: '높음' }).confidence).toBeNull();
	});

	it('통화를 대문자로 맞춘다', () => {
		expect(normalizeReceiptInfo({ currency: 'usd' }).currency).toBe('USD');
	});

	it('warnings 에 문자열이 아닌 것이 섞이면 걸러낸다', () => {
		expect(normalizeReceiptInfo({ warnings: ['흐림', 42, null] }).warnings).toEqual(['흐림']);
	});
});
