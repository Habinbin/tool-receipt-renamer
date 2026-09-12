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
		children: Snippet;
	}

	let { title, danger = false, children, ...rest }: Props = $props();
</script>

<button class="icon-btn" class:danger {title} aria-label={title} {...rest}>
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

	.icon-btn:hover:not(:disabled) {
		background-color: var(--surface-raised);
		color: var(--ink);
	}

	.icon-btn:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}

	.icon-btn.danger:hover:not(:disabled) {
		color: var(--danger);
	}
</style>
