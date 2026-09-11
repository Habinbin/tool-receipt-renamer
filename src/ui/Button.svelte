<script lang="ts">
	import type { Snippet } from 'svelte';
	import type { HTMLButtonAttributes } from 'svelte/elements';

	/**
	 * filled 는 주 행동 하나, outlined 는 그 짝, ghost 는 인라인 링크.
	 * filled 둘을 나란히 쌓지 않는다.
	 */
	type Variant = 'filled' | 'outlined' | 'ghost';

	interface Props extends HTMLButtonAttributes {
		variant?: Variant;
		/** 작은 컨트롤용. 서비스 카드의 알약 버튼 크기(14px)에 해당한다. */
		compact?: boolean;
		children: Snippet;
	}

	let { variant = 'outlined', compact = false, children, ...rest }: Props = $props();
</script>

<button class="btn {variant}" class:compact {...rest}>
	{@render children()}
</button>

<style>
	.btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		gap: var(--gap-l4);
		border-radius: var(--radius-pill);
		padding: 11px 15px;
		font-family: var(--font);
		font-size: var(--text-body);
		line-height: 1.2;
		font-weight: 500;
		border: 1px solid transparent;
		cursor: pointer;
		transition:
			background-color 0.2s,
			border-color 0.2s,
			opacity 0.2s;
	}

	.btn.compact {
		padding: 8px 15px;
		font-size: var(--text-body-sm);
	}

	.btn:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}

	.filled {
		background-color: var(--accent);
		color: var(--on-accent);
	}

	.filled:hover:not(:disabled) {
		background-color: var(--accent-hover);
	}

	.outlined {
		background-color: transparent;
		border-color: var(--accent-hover);
		color: var(--accent-hover);
	}

	.outlined:hover:not(:disabled) {
		background-color: color-mix(in srgb, var(--accent-hover) 6%, transparent);
	}

	.ghost {
		background-color: transparent;
		color: var(--accent-hover);
		padding: var(--space-4) var(--space-8);
	}

	.ghost:hover:not(:disabled) {
		text-decoration: underline;
	}
</style>
