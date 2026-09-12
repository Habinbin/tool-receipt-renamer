<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * 이름 조각 하나를 나타내는 태그.
	 *
	 * **규칙 카드와 편집 패널이 같은 정의를 쓴다.** 목록에서 고른 규칙이 오른쪽에서
	 * 어떻게 펼쳐지는지 대조하려면 두 곳의 칩이 같은 모양이어야 한다 —
	 * 따로 그리면 언젠가 갈라진다 (@control-contract #1).
	 *
	 * 읽기 전용(카드)과 조작 가능(편집)은 같은 컨트롤의 **변형**이다 (#2).
	 *
	 * **면에는 색을 칠하지 않는다** (@color-is-not-structure). 전에는 필드마다 다른
	 * 파스텔을 면에 14% 로 섞었는데, 그 면은 음각 트레이와 1.09–1.19:1 이라 눈이
	 * 경계를 못 잡았다. 칩이 칩임은 **밝기**가 말한다 — 흰 면과 실선 테두리.
	 *
	 * `tone` 은 그것과 다른 일을 한다. 결과 이름의 해당 부분과 **같은 색으로 글자를
	 * 칠해** 둘이 짝임을 보인다. 색이 범주를 말하는 게 아니라 두 자리를 잇는다.
	 */
	interface Props {
		/**
		 * `naming.ts` 의 `fieldToneIndex`. 결과 이름의 같은 조각과 색을 맞춘다.
		 * `null`·생략이면 잇지 않는다 — 규칙 카드처럼 짝이 화면에 없는 자리다.
		 */
		tone?: number | null;
		/** 작은 판. 규칙 카드처럼 훑어보는 자리에서 쓴다. */
		compact?: boolean;
		/** 끌어서 옮기는 중. 어디서 출발했는지 남기려고 지우지 않고 흐리게 둔다. */
		dragging?: boolean;
		children: Snippet;
		/** 우측에 붙는 것 — 제거 버튼 등. 없으면 순수 데이터다. */
		trailing?: Snippet;
	}

	let { tone = null, compact = false, dragging = false, children, trailing }: Props = $props();
</script>

<span class="chip tone-{tone ?? 'none'}" class:compact class:dragging>
	<span class="text">{@render children()}</span>
	{#if trailing}{@render trailing()}{/if}
</span>

<style>
	/*
		음각 트레이(`--tray`) 위에 놓이므로 칩은 그보다 **밝다.** 면의 밝기는 한 방향으로만
		간다 — sunken < surface (@theme-contract §면 셋의 뜻).

		테두리를 두는 이유: 흰 면과 트레이의 차이는 1.29:1 이라 묶음 표시로는 되지만
		(@color-is-not-structure #4) 누를 수 있는 것의 경계로는 모자라다 (#3 은 3:1 을
		요구한다). 색은 `--control-edge` 가 정한다 — 호스트의 옅은 선·잉크 토큰에
		얹었다가 gr-toolbox 에서 2.56:1 로 주저앉았다. theme.css 의 주석 참조.

		`Button` 의 `variant="chip"`(조각 더하기)은 **점선·투명**이다. 그래서 색 없이도
		채워진 것=놓인 조각(데이터), 비어 있는 것=더하는 자리(행동)로 갈린다
		(@information-architecture #3).
	*/
	.chip {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-l4);
		max-width: 100%;
		border: 1px solid var(--control-edge);
		border-radius: var(--radius-pill);
		padding: var(--space-4) var(--space-12);
		background-color: var(--surface);
		/* 잇는 색은 글자에만 온다. 면은 어느 항목이든 같다 — 위 주석 참조. */
		color: var(--tone, var(--ink));
		font-size: var(--text-body-sm);
		font-weight: 500;
		line-height: 1.4;
		white-space: nowrap;
	}

	.tone-0 {
		--tone: var(--tone-0);
	}

	.tone-1 {
		--tone: var(--tone-1);
	}

	.tone-2 {
		--tone: var(--tone-2);
	}

	.tone-3 {
		--tone: var(--tone-3);
	}

	.tone-4 {
		--tone: var(--tone-4);
	}

	.tone-5 {
		--tone: var(--tone-5);
	}

	.tone-6 {
		--tone: var(--tone-6);
	}

	.tone-7 {
		--tone: var(--tone-7);
	}

	.tone-8 {
		--tone: var(--tone-8);
	}
	.tone-none {
		--tone: var(--tone-none);
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
