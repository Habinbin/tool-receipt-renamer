<script lang="ts">
	import ChevronRightIcon from '@lucide/svelte/icons/chevron-right';

	import type { Snippet } from 'svelte';

	/**
	 * 가끔 만지는 설정을 접어 둔다.
	 *
	 * 상자를 만들지 않고 **선 하나**로 구역을 가른다 — 접힌 것이 넷이면 상자도 넷이 되어
	 * 화면이 다시 복잡해진다. `tool-timeseries-viewer` 의 `<details class="more">` 와
	 * 같은 방식이고, 이 툴에서는 정의를 한 곳에 둔다 (@control-contract #1).
	 *
	 * `value` 는 **접힌 채로도 무엇이 적용 중인지** 답한다. 이게 없으면 @tool-ux-principles
	 * §2 가 경고하는 "숨기면 사용자가 기능의 존재를 모른다" 에 걸린다.
	 */
	interface Props {
		title: string;
		/** 접힌 상태에서 제목 옆에 적는 현재값. 예: `_ · 20260702 · 36,000원` */
		value?: string;
		/** 기본은 닫힘. 접는 것은 "가끔 만지는 설정"이지 "지금 하는 일"이 아니다. */
		open?: boolean;
		children: Snippet;
	}

	let { title, value, open = false, children }: Props = $props();
</script>

<details class="fold" {open}>
	<summary>
		<ChevronRightIcon class="fold-mark" size={13} />
		<span class="title">{title}</span>
		{#if value}<span class="value">{value}</span>{/if}
	</summary>
	<div class="body">{@render children()}</div>
</details>

<style>
	.fold {
		border-top: 1px solid var(--line);
		/* 안쪽 여백은 계층이 아니라 크기다 — 사다리를 쓰지 않는다 (@spacing-ladder). */
		padding-top: var(--space-12);
	}

	summary {
		display: flex;
		align-items: center;
		gap: var(--gap-l3);
		cursor: pointer;
		color: var(--ink-muted);
		font-size: var(--text-caption);
		/*
			기본 ::marker 는 summary 에 flex 를 주는 순간 사라진다. 표식이 없으면
			"눌러서 여는 줄" 이라는 신호가 통째로 없어지므로 아이콘으로 직접 그린다.
		*/
		list-style: none;
	}

	summary::-webkit-details-marker {
		display: none;
	}

	summary :global(.fold-mark) {
		flex-shrink: 0;
		transition: transform 0.15s;
	}

	.fold[open] summary :global(.fold-mark) {
		transform: rotate(90deg);
	}

	.title {
		font-weight: 600;
		letter-spacing: 0.04em;
	}

	.value {
		min-width: 0;
		overflow: hidden;
		color: var(--ink-faint);
		font-family: var(--font-mono);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	/*
		닫혔을 때 본문을 명시적으로 숨긴다. `.body` 에 display 를 주는 순간 브라우저가
		details 에 걸어 두는 숨김이 덮여, **닫힌 채로 내용이 다음 줄 위에 겹친다.**
		전체 페이지 캡처로는 보이지 않고 `skill:ui-probe` 의 text-covered 가 잡았다.
	*/
	.fold:not([open]) .body {
		display: none;
	}

	.body {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		padding-top: var(--space-12);
	}
</style>
