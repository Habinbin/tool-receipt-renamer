import { describe, expect, it, vi } from 'vitest';

import { runLimited, withRetry } from './queue';

describe('runLimited', () => {
	it('정해진 수보다 많이 동시에 돌지 않는다', async () => {
		let running = 0;
		let peak = 0;
		await runLimited([1, 2, 3, 4, 5, 6], 2, async () => {
			running += 1;
			peak = Math.max(peak, running);
			await new Promise((resolve) => setTimeout(resolve, 5));
			running -= 1;
		});
		expect(peak).toBe(2);
	});

	it('입력 전부를 한 번씩 처리한다', async () => {
		const seen: number[] = [];
		await runLimited([1, 2, 3, 4, 5], 3, async (item) => {
			seen.push(item);
		});
		expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
	});

	it('빈 목록에서도 멈추지 않는다', async () => {
		await expect(runLimited([], 3, async () => {})).resolves.toBeUndefined();
	});
});

describe('withRetry', () => {
	const sleep = async () => {};

	it('성공하면 다시 하지 않는다', async () => {
		const task = vi.fn().mockResolvedValue('ok');
		expect(await withRetry(task, { sleep })).toBe('ok');
		expect(task).toHaveBeenCalledTimes(1);
	});

	it('재시도할 값어치가 있으면 다시 한다', async () => {
		const task = vi.fn().mockRejectedValueOnce(new Error('429')).mockResolvedValue('ok');
		expect(await withRetry(task, { sleep })).toBe('ok');
		expect(task).toHaveBeenCalledTimes(2);
	});

	it('재시도해도 소용없는 실패는 즉시 던진다', async () => {
		const task = vi.fn().mockRejectedValue(new Error('키가 틀렸다'));
		await expect(withRetry(task, { sleep, isRetryable: () => false })).rejects.toThrow(
			'키가 틀렸다'
		);
		expect(task).toHaveBeenCalledTimes(1);
	});

	it('정해진 횟수를 넘기면 마지막 오류를 던진다', async () => {
		const task = vi.fn().mockRejectedValue(new Error('계속 429'));
		await expect(withRetry(task, { sleep, attempts: 3 })).rejects.toThrow('계속 429');
		expect(task).toHaveBeenCalledTimes(3);
	});

	it('기다리는 시간이 점점 길어진다', async () => {
		const delays: number[] = [];
		const task = vi.fn().mockRejectedValue(new Error('429'));
		await expect(
			withRetry(task, {
				sleep,
				attempts: 4,
				baseDelayMs: 1000,
				onRetry: (_attempt, delay) => delays.push(delay)
			})
		).rejects.toThrow();
		// 지터가 섞이므로 값은 범위로 본다 — 같은 순간 깨어나 다시 부딪히지 않도록.
		expect(delays[0]).toBeLessThan(delays[2]);
		expect(delays.length).toBe(3);
	});
});
