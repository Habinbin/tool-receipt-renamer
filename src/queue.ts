/**
 * 여러 장을 동시에, 그러나 너무 세게는 아니게 처리한다.
 *
 * 무료 티어에서 막히는 것은 요금이 아니라 **분당 요청 수**다. 30장을 한꺼번에
 * 던지면 절반이 429 로 돌아온다. 그래서 동시 실행을 좁게 잡고, 429 를 만나면
 * 물러났다 다시 온다.
 */

/** 동시에 날아가는 요청 수. 무료 티어의 분당 한도를 넘지 않도록 좁게 잡았다. */
export const DEFAULT_CONCURRENCY = 2;

export interface RetryOptions {
	/** 첫 시도까지 합한 최대 시도 횟수. */
	attempts?: number;
	/** 첫 재시도까지 기다리는 시간. 이후 2배씩 늘어난다. */
	baseDelayMs?: number;
	/** 대기 시간의 상한. */
	maxDelayMs?: number;
	/** 재시도할 값어치가 있는 실패인지 판정한다. */
	isRetryable?: (error: unknown) => boolean;
	/** 테스트에서 시간을 흘려보내기 위해 갈아 끼운다. */
	sleep?: (ms: number) => Promise<void>;
	/** 남은 대기 시간을 화면에 보여주고 싶을 때. */
	onRetry?: (attempt: number, delayMs: number, error: unknown) => void;
}

const defaultSleep = (ms: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, ms));

/**
 * 실패하면 점점 더 오래 기다렸다 다시 한다.
 *
 * 지터를 섞는 이유: 같은 순간 429 를 맞은 두 요청이 똑같이 1초 뒤에 깨어나면
 * 다시 동시에 부딪힌다. 조금씩 어긋나게 깨워야 한다.
 */
export async function withRetry<T>(task: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
	const attempts = options.attempts ?? 3;
	const base = options.baseDelayMs ?? 1000;
	const max = options.maxDelayMs ?? 16_000;
	const retryable = options.isRetryable ?? (() => true);
	const sleep = options.sleep ?? defaultSleep;

	let lastError: unknown;
	for (let attempt = 1; attempt <= attempts; attempt += 1) {
		try {
			return await task();
		} catch (error) {
			lastError = error;
			if (attempt === attempts || !retryable(error)) throw error;
			const delay = Math.min(max, base * 2 ** (attempt - 1));
			const jittered = Math.round(delay * (0.5 + Math.random() * 0.5));
			options.onRetry?.(attempt, jittered, error);
			await sleep(jittered);
		}
	}
	throw lastError;
}

/**
 * 목록을 정해진 수만큼만 동시에 처리한다.
 *
 * 한 건이 실패해도 나머지는 계속 간다 — 손상된 영수증 하나가 나머지 29장을
 * 실패시키면 안 된다 (@failure-checklist-first). 실패는 `worker` 안에서 잡아
 * 그 항목의 상태로 남기는 것이 호출자의 책임이다.
 */
export async function runLimited<T>(
	items: T[],
	limit: number,
	worker: (item: T, index: number) => Promise<void>
): Promise<void> {
	const queue = items.map((item, index) => ({ item, index }));
	const lanes = Array.from({ length: Math.max(1, Math.min(limit, queue.length)) }, async () => {
		for (;;) {
			const next = queue.shift();
			if (next === undefined) return;
			await worker(next.item, next.index);
		}
	});
	await Promise.all(lanes);
}
