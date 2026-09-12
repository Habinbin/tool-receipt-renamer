<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * 이름 조각 하나를 나타내는 태그.
	 *
	 * **규칙 카드와 편집 패널이 같은 정의를 쓴다.** 목록에서 고른 규칙이 오른쪽에서
	 * 어떻게 펼쳐지는지 대조하려면 두 곳의 칩이 같은 모양·같은 색이어야 한다 —
	 * 따로 그리면 언젠가 갈라진다 (@control-contract #1).
	 *
	 * 읽기 전용(카드)과 조작 가능(편집)은 같은 컨트롤의 **변형**이다 (#2).
	 */
	interface Props {
		/** `naming.ts` 의 `fieldColorIndex`. `null` 이면 고정문구 — 중립색. */
		color: number | null;
		/** 작은 판. 규칙 카드처럼 훑어보는 자리에서 쓴다. */
		compact?: boolean;
		/** 끌어서 옮기는 중. 어디서 출발했는지 남기려고 지우지 않고 흐리게 둔다. */
		dragging?: boolean;
		children: Snippet;
		/** 우측에 붙는 것 — 제거 버튼 등. 없으면 순수 데이터다. */
		trailing?: Snippet;
	}

	let { color, compact = false, dragging = false, children, trailing }: Props = $props();

	/*
	 * 색은 클래스로 고른다. `style:--tone={`var(--tag-${color})`}` 처럼 이름을 문자열로
	 * 조립하면 **어떤 토큰이 쓰이는지 소스에서 보이지 않아** design-lint 가 정의 여부를
	 * 검사할 수 없다. 팔레트가 늘면 여기와 theme.css 두 곳을 같이 고친다.
	 */
	const tone = $derived(color === null ? 'none' : String(color));
</script>

<span class="chip tone-{tone}" class:compact class:dragging>
	<span class="text">{@render children()}</span>
	{#if trailing}{@render trailing()}{/if}
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-l4);
		max-width: 100%;
		/* 트레이가 음각이라 칩에는 테두리를 두지 않는다 — 있으면 경계가 두 줄이 된다. */
		border-radius: var(--radius-pill);
		padding: var(--space-4) var(--space-12);
		/*
			바탕은 색조만 옅게 깔고, 글자는 같은 색을 어둡게 내려 쓴다.
			팔레트를 색상 구분만 보고 고르면(주황 #ff9500 등) 흰 바탕에서 2:1 이 나와
			읽히지 않는다 — 색은 구별을 위한 것이지 글자를 대신하지 않는다.
		*/
		background-color: color-mix(in srgb, var(--tone) 14%, transparent);
		/*
			밝은 테마에서는 색조를 어둡게 내리고, 어두운 테마에서는 밀어 올린다.
			한 방향만 쓰면 반대 테마에서 2:1 로 떨어져 글자가 사라진다 — gr-toolbox 의
			다크 모드에서 실제로 그랬다. 어느 쪽인지는 호스트가 정한 `color-scheme` 이
			알려 주므로 툴은 호스트를 몰라도 된다.
		*/
		color: light-dark(
			color-mix(in srgb, var(--tone) 58%, var(--tag-shade-light)),
			color-mix(in srgb, var(--tone) 78%, var(--tag-shade-dark))
		);
		font-size: var(--text-body-sm);
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
	}

	.tone-0 {
		--tone: var(--tag-0);
	}
	.tone-1 {
		--tone: var(--tag-1);
	}
	.tone-2 {
		--tone: var(--tag-2);
	}
	.tone-3 {
		--tone: var(--tag-3);
	}
	.tone-4 {
		--tone: var(--tag-4);
	}
	.tone-5 {
		--tone: var(--tag-5);
	}
	.tone-6 {
		--tone: var(--tag-6);
	}
	.tone-7 {
		--tone: var(--tag-7);
	}
	.tone-8 {
		--tone: var(--tag-8);
	}
	.tone-none {
		--tone: var(--tag-none);
	}

	.chip.compact {
		padding: var(--space-2) var(--space-8);
		font-size: var(--text-caption);
	}

	.chip.dragging {
		opacity: 0.4;
	}

	.text {
		overflow: hidden;
		text-overflow: ellipsis;
	}
</style>
