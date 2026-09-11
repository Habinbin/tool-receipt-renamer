/**
 * 골든셋 회귀 — 추출 정확도를 숫자로 만든다.
 *
 * 이 툴의 품질 축은 UI 가 아니라 **추출 정확도**다. 프롬프트나 모델을 바꿨을 때
 * 좋아졌는지 나빠졌는지 감으로 말하지 않기 위해 있다.
 *
 *   pnpm bench                                   기본 설정으로
 *   pnpm bench --thinking=low --model=gemini-3.6-flash
 *
 * 정답지는 `fixtures/golden.json`, 이미지는 `fixtures/prepared/` 다. 이미지는 실제
 * 영수증이라 git 에 넣지 않는다 — 정답지만 커밋되고, 이미지가 없으면 여기서 멈춘다.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { join } from 'node:path';

import {
	DEFAULT_MODEL,
	DEFAULT_THINKING_LEVEL,
	extractReceipt,
	type ThinkingLevel
} from '../src/server/extract.ts';
import type { ReceiptInfo } from '../src/types.ts';

const ROOT = join(import.meta.dirname, '..');
const PREPARED = join(ROOT, 'fixtures/prepared');

/** 채점 대상 필드. `confidence`·`warnings` 는 정답이 하나가 아니라 제외한다. */
const FIELDS = [
	'date',
	'documentType',
	'merchantName',
	'amount',
	'currency',
	'expenseCategory',
	'paymentMethod',
	'invoiceNumber'
] as const;
type Field = (typeof FIELDS)[number];

interface GoldenEntry {
	file: string;
	trap: string;
	expected: Record<Field, string | number | null>;
	accept?: Partial<Record<Field, string[]>>;
}

function arg(name: string, fallback: string): string {
	const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
	return hit ? hit.slice(name.length + 3) : fallback;
}

/** 비교 전 표기 차이를 지운다. 공백·괄호·대소문자로 오답 처리하면 점수가 무의미해진다. */
function norm(value: unknown): string {
	if (value === null || value === undefined) return '';
	return String(value)
		.toLowerCase()
		.replace(/[\s()[\]{}.,/\\-]/g, '');
}

function matches(field: Field, got: unknown, entry: GoldenEntry): boolean {
	const expected = entry.expected[field];

	// 금액은 표기가 아니라 값이다. null(금액 없는 문서)과 0 을 구분한다.
	if (field === 'amount') return (got ?? null) === (expected ?? null);

	// 날짜는 구분자를 무시하고 숫자만 본다. 2026-07-02 와 2026.07.02 는 같은 답이다.
	if (field === 'date') {
		const digits = (v: unknown) => String(v ?? '').replace(/\D/g, '');
		return digits(got) === digits(expected);
	}

	const candidates = [expected, ...(entry.accept?.[field] ?? [])].map(norm);
	return candidates.includes(norm(got));
}

const KEY = process.env.GEMINI_API_KEY ?? readKeyFromDotEnv();
function readKeyFromDotEnv(): string {
	// 로컬에서 돌릴 때만 쓰는 편의. 껍데기의 .env 를 빌려 읽는다.
	for (const path of ['../../gr-toolbox/.env', '../../betlab-toolbox/.env', '.env']) {
		const full = join(ROOT, path);
		if (!existsSync(full)) continue;
		const hit = /^GEMINI_API_KEY=(.+)$/m.exec(readFileSync(full, 'utf8'));
		if (hit) return hit[1].trim();
	}
	return '';
}

async function main(): Promise<void> {
	// 아무것도 안 주면 툴이 실제로 쓰는 설정을 잰다 — 기본값이 곧 회귀 대상이다.
	const thinking = arg('thinking', DEFAULT_THINKING_LEVEL) as ThinkingLevel;
	const model = arg('model', DEFAULT_MODEL);
	const label = `${model}__${thinking}`;

	const golden = JSON.parse(readFileSync(join(ROOT, 'fixtures/golden.json'), 'utf8')) as {
		receipts: GoldenEntry[];
	};

	if (!existsSync(PREPARED)) {
		console.error(
			`이미지가 없습니다: ${PREPARED}\n실제 영수증은 커밋하지 않습니다. README 의 골든셋 항목을 보세요.`
		);
		process.exit(1);
	}

	console.log(`\n모델 ${model} · thinking ${thinking} · ${golden.receipts.length}장\n`);

	const rows: {
		entry: GoldenEntry;
		info?: ReceiptInfo;
		wrong: Field[];
		ms: number;
		tokens: { in: number; thoughts: number; out: number };
		error?: string;
	}[] = [];

	for (const entry of golden.receipts) {
		const jpg = join(PREPARED, entry.file.replace(/\.[^.]+$/, '.jpg'));
		const data = readFileSync(jpg).toString('base64');
		const started = Date.now();
		try {
			const { info, usage } = await extractReceipt(
				{ data, mimeType: 'image/jpeg' },
				{ apiKey: KEY, model, fallbackModel: model, thinkingLevel: thinking }
			);
			const wrong = FIELDS.filter((field) => !matches(field, info[field], entry));
			rows.push({
				entry,
				info,
				wrong,
				ms: Date.now() - started,
				tokens: { in: usage.promptTokens, thoughts: usage.thoughtsTokens, out: usage.outputTokens }
			});
			const mark = wrong.length === 0 ? '✅' : '❌';
			console.log(
				`${mark} ${entry.file.padEnd(24)} ${String(Date.now() - started).padStart(5)}ms  ` +
					(wrong.length === 0 ? '전부 일치' : `틀림: ${wrong.join(', ')}`)
			);
			for (const field of wrong) {
				console.log(
					`     ${field}: 정답 ${JSON.stringify(entry.expected[field])} ← 응답 ${JSON.stringify(info[field])}`
				);
			}
		} catch (err) {
			const message = err instanceof Error ? err.message : String(err);
			rows.push({
				entry,
				wrong: [...FIELDS],
				ms: Date.now() - started,
				tokens: { in: 0, thoughts: 0, out: 0 },
				error: message
			});
			console.log(`💥 ${entry.file.padEnd(24)} ${message.slice(0, 120)}`);
		}
	}

	// 필드별 정확도 — 어느 필드가 약한지가 프롬프트를 고칠 곳을 가리킨다.
	console.log('\n필드별 정확도');
	for (const field of FIELDS) {
		const hit = rows.filter((row) => !row.wrong.includes(field)).length;
		const bar = '█'.repeat(hit) + '·'.repeat(rows.length - hit);
		console.log(`  ${field.padEnd(16)} ${bar} ${hit}/${rows.length}`);
	}

	const perfect = rows.filter((row) => row.wrong.length === 0).length;
	const tokens = rows.reduce(
		(acc, row) => ({
			in: acc.in + row.tokens.in,
			thoughts: acc.thoughts + row.tokens.thoughts,
			out: acc.out + row.tokens.out
		}),
		{ in: 0, thoughts: 0, out: 0 }
	);
	const avgMs = Math.round(rows.reduce((sum, row) => sum + row.ms, 0) / rows.length);

	// 2026년 요금 (2027-01-01 부터 2배). thinking 토큰은 출력으로 과금된다.
	const price = model.includes('lite') ? { in: 0.25, out: 1.5 } : { in: 0.75, out: 3.75 };
	const usd = (tokens.in * price.in + (tokens.out + tokens.thoughts) * price.out) / 1_000_000;

	console.log(
		`\n전부 맞은 장: ${perfect}/${rows.length}` +
			`\n평균 지연: ${avgMs}ms` +
			`\n토큰: 입력 ${tokens.in} · 생각 ${tokens.thoughts} · 출력 ${tokens.out}` +
			`\n비용: $${usd.toFixed(5)} (장당 약 ${Math.round((usd / rows.length) * 1400)}원)\n`
	);

	mkdirSync(join(ROOT, 'bench/results'), { recursive: true });
	writeFileSync(
		join(ROOT, `bench/results/${label}.json`),
		JSON.stringify(
			{ model, thinking, perfect, total: rows.length, avgMs, tokens, usd, rows },
			null,
			'\t'
		)
	);
}

await main();
