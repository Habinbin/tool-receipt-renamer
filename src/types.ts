/** 영수증에서 뽑아내는 필드와 파일명 규칙의 타입. UI·서버·테스트가 같은 것을 본다. */

/** 파일 한 건의 처리 상태. */
export type ReceiptStatus = 'pending' | 'parsing' | 'done' | 'error';

/** 파일명 토큰으로 쓸 수 있는 필드. `originalName` 만 추출이 아니라 파일 자체에서 온다. */
export type ReceiptField =
	| 'date'
	| 'documentType'
	| 'merchantName'
	| 'amount'
	| 'currency'
	| 'expenseCategory'
	| 'paymentMethod'
	| 'invoiceNumber'
	| 'originalName';

/** 모델이 읽어 낸 영수증 내용. */
export interface ReceiptInfo {
	/** 거래일. `YYYY-MM-DD` 를 기대하지만 모델이 어긋나게 줄 수 있어 문자열로 받는다. */
	date: string;
	documentType: string;
	merchantName: string;
	/** 최종 결제 총액. 승차권처럼 금액이 없는 문서는 `null` 이다 — 0 과 구분한다. */
	amount: number | null;
	currency: string;
	expenseCategory: string;
	paymentMethod: string;
	invoiceNumber: string;
	/** 0~1. 모델이 주지 않으면 `null`. */
	confidence: number | null;
	warnings: string[];
}

/** 이름에 들어갈 조각 하나. */
export type NamingToken =
	| { id: string; kind: 'field'; field: ReceiptField }
	| { id: string; kind: 'custom'; value: string };

export type DateFormat = 'yyyyMMdd' | 'yyMMdd' | 'yyyy-MM-dd' | 'yyyy.MM.dd' | 'raw';
export type AmountFormat = 'krw-suffix' | 'currency-code' | 'plain';
/** 값이 비었을 때 그 토큰을 건너뛸지, 자리를 지키는 표시를 넣을지. */
export type EmptyFieldPolicy = 'skip' | 'placeholder';

/**
 * 규칙 하나 — "이 상황의 영수증은 이렇게 부른다".
 *
 * 추출 결과(`ReceiptInfo`)와 규칙은 분리되어 있다. 그래서 규칙을 바꿔도 다시
 * 모델을 부르지 않고 이름만 즉시 다시 조립된다 — 이 툴의 존재 이유다.
 */
export interface NamingRule {
	id: string;
	name: string;
	separator: string;
	dateFormat: DateFormat;
	amountFormat: AmountFormat;
	emptyFieldPolicy: EmptyFieldPolicy;
	placeholder: string;
	/** 공백을 `_` 로 바꾼다. 파일명을 셸에서 다룰 때 편하다. */
	replaceSpacesWithUnderscore: boolean;
	tokens: NamingToken[];
	/**
	 * 이 규칙으로 처리할 때 모델에 얹는 문맥 한 줄.
	 *
	 * 예: "해외 출장 영수증이다. 날짜는 현지 기준으로 읽어라."
	 * 비우면 아무것도 얹지 않는다. 규칙을 바꾸면 이 값도 바뀌므로, 이미 추출된
	 * 파일은 사용자가 다시 요청할 때만 재추출된다.
	 */
	extractionHint: string;
}
