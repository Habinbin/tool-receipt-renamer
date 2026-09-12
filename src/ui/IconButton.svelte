<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * 아이콘 하나만 있는 버튼. 목록 행의 제거·재시도·펼치기, 규칙 아카이브의 추가·복제가 쓴다.
	 *
	 * 이 정의가 없으면 각 컴포넌트가 같은 CSS 를 복사하게 되고, 실제로 그랬다 —
	 * ReceiptTable 과 RuleEditor 에 같은 `.icon` 규칙이 두 벌 있었다 (@control-contract #1).
	 *
	 * `title` 은 필수다. 아이콘만 있는 버튼은 그것 말고는 무슨 일을 하는지 알릴 방법이 없다.
	 */
	interface Props extends HTMLButtonAttributes {
		title: string;
		/** 누르면 되돌릴 수 없는 것 — 호버에서 위험색으로 물든다. */
		danger?: boolean;
		/**
		 * 칩 안처럼 이미 좁은 자리에 들어가는 판.
		 *
		 * 24×24 를 밑돌지만 **감싼 칩 전체가 클릭 대상**이라 실제 표적은 그보다 크다.
		 * 여기서 28px 을 고집하면 칩이 버튼 크기에 맞춰 부풀어 글자보다 커진다.
		 */
		compact?: boolean;
		children: Snippet;
	}

	let { title, danger = false, compact = false, children, ...rest }: Props = $props();
</script>

<button class="icon-btn" class:danger class:compact {title} aria-label={title} {...rest}>
	{@render children()}
</button>

<style>
	.icon-btn {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		/* 24×24 이상 — WCAG 2.2 AA 의 클릭 대상 최소 크기 (@control-contract #5). */
		width: 28px;
		height: 28px;
		border: none;
		border-radius: var(--radius-control);
		background-color: transparent;
		color: var(--ink-muted);
		cursor: pointer;
		transition:
			background-color 0.15s,
			color 0.15s;
	}

	.icon-btn.compact {
		width: 18px;
		height: 18px;
		color: inherit;
	}

	.icon-btn:hover:not(:disabled) {
		background-color: var(--surface-raised);
		color: var(--ink);
	}

	.icon-btn:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}

	.icon-btn.compact:hover:not(:disabled) {
		/* 칩의 색 위에서는 면을 깔지 않는다 — 칩 안에 또 하나의 판이 생긴다. */
		background-color: transparent;
		opacity: 0.6;
	}

	.icon-btn.danger:hover:not(:disabled) {
		color: var(--danger);
	}
</style>
