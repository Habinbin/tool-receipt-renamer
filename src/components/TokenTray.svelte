<script lang="ts">
	/**
	 * 이름을 이루는 조각들. 끌어서 순서를 바꾼다.
	 *
	 * 왜 버튼이 아니라 드래그인가: 버튼은 **거리만큼 클릭을 요구한다.** 맨 아래 조각을
	 * 맨 앞으로 보내려면 네 번을 눌러야 했고, 그건 순서를 바꾸는 일이 아니라 세는 일이다.
	 * @reorder-affordance
	 *
	 * HTML5 드래그가 아니라 **Pointer Events** 를 쓴다. `dragstart` 는 터치에서 발생하지
	 * 않아, 그걸로 만들면 폰에서는 재정렬 수단이 아예 없어진다. Pointer Events 는
	 * 마우스·터치·펜을 한 코드로 받는다.
	 */
	import { tick } from 'svelte';

	import XIcon from '@lucide/svelte/icons/x';

	import IconButton from '../ui/IconButton.svelte';
	import TagChip from '../ui/TagChip.svelte';
	import { fieldToneIndex, tokenLabel } from '../naming';
	import { gapForPointer, isNoOpGap, moveToken, moveTokenToGap } from '../rules';
	import type { NamingRule, NamingToken } from '../types';

	interface Props {
		rule: NamingRule;
		onchange: (rule: NamingRule) => void;
		/** 트레이 안 우측 끝에 붙는 것 — 항목을 더하는 자리. */
		append?: import('svelte').Snippet;
	}

	let { rule, onchange, append }: Props = $props();

	let tray: HTMLUListElement;
	let dragIndex = $state<number | null>(null);
	let gapIndex = $state<number | null>(null);
	/** 스크린리더에 순서 변경을 알린다. 드래그와 키보드가 같은 문장을 쓴다. */
	let orderNote = $state('');

	/**
	 * 막대를 그릴 틈. 제자리면 `null`.
	 *
	 * 마크업이 이 값 **하나만** 읽으므로 "표시는 항상 하나" 가 조건문 실수로 깨질 수 없다
	 * (@reorder-affordance #3). 제자리에서 막대를 끄는 것은 #7 의 예고편이다 — 놓아도
	 * 아무 일이 없다는 걸 놓기 전에 알려 준다.
	 */
	const barGap = $derived(
		dragIndex === null || gapIndex === null || isNoOpGap(dragIndex, gapIndex) ? null : gapIndex
	);

	const last = $derived(rule.tokens.length - 1);

	/**
	 * 포인터가 가리키는 틈을 찾는다.
	 *
	 * 칩이 줄바꿈되므로 먼저 **세로로 같은 줄**을 고르고, 그 줄 안에서 가로 위치로 틈을
	 * 정한다. 어느 줄에도 안 걸리면(트레이 아래 여백 등) 마지막 틈으로 본다 — 맨 뒤로
	 * 보내려는 동작이 빈 곳에서 끊기지 않도록.
	 */
	function gapAt(x: number, y: number): number {
		const slots = [...tray.querySelectorAll<HTMLElement>('[data-slot]')];
		if (slots.length === 0) return 0;

		let best: { index: number; rect: DOMRect } | null = null;
		for (const [index, slot] of slots.entries()) {
			const rect = slot.getBoundingClientRect();
			const sameRow = y >= rect.top && y <= rect.bottom;
			if (!sameRow) continue;
			// 같은 줄 안에서는 포인터에 가장 가까운 칩을 고른다 — 칩 사이 틈 위에서도 끊기지 않게.
			if (
				best === null ||
				Math.abs(x - (rect.left + rect.width / 2)) <
					Math.abs(x - (best.rect.left + best.rect.width / 2))
			) {
				best = { index, rect };
			}
		}
		if (best === null) return slots.length;
		return gapForPointer(best.index, x - best.rect.left, best.rect.width);
	}

	function startDrag(event: PointerEvent, index: number): void {
		// 마우스는 주 버튼만. 칩 안의 ✕ 는 자기가 이벤트를 멈춘다.
		if (event.button !== 0) return;
		dragIndex = index;
		gapIndex = index;
		(event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
	}

	function moveDrag(event: PointerEvent): void {
		if (dragIndex === null) return;
		// 터치에서 트레이를 끌면 페이지가 스크롤되려 한다. touch-action 과 함께 막는다.
		event.preventDefault();
		gapIndex = gapAt(event.clientX, event.clientY);
	}

	function endDrag(): void {
		if (dragIndex !== null && gapIndex !== null) {
			const moved = rule.tokens[dragIndex];
			const next = moveTokenToGap(rule, dragIndex, gapIndex);
			// 제자리면 `moveTokenToGap` 이 같은 객체를 돌려준다 — 그게 곧 no-op 판정이다.
			if (next !== rule) {
				onchange(next);
				announce(moved, next);
			}
		}
		dragIndex = null;
		gapIndex = null;
	}

	/** ESC 는 순서를 그대로 둔 채 드래그만 거둔다 (@reorder-affordance #8). */
	function cancelDrag(): void {
		dragIndex = null;
		gapIndex = null;
	}

	/** 키보드 재정렬. 드래그와 **같은 산술**을 지나간다. */
	async function nudge(event: KeyboardEvent, token: NamingToken): Promise<void> {
		if (!event.altKey) return;
		const delta = event.key === 'ArrowLeft' ? -1 : event.key === 'ArrowRight' ? 1 : 0;
		if (delta === 0) return;
		event.preventDefault(); // 브라우저 히스토리 이동을 막는다
		const next = moveToken(rule, token.id, delta);
		if (next === rule) return; // 끝에서는 아무 일도 없다
		onchange(next);
		announce(token, next);
		// 같은 조각을 계속 밀 수 있어야 한다 — 한 번에 한 칸씩 Tab 을 다시 하게 만들지 않는다.
		await tick();
		tray.querySelector<HTMLElement>(`[data-token="${token.id}"]`)?.focus();
	}

	function announce(token: NamingToken, next: NamingRule): void {
		const to = next.tokens.findIndex((item) => item.id === token.id) + 1;
		orderNote = `${tokenLabel(token)}을(를) ${to}번째로 옮겼습니다. 전체 ${next.tokens.length}개.`;
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape' && dragIndex !== null) cancelDrag();
	}}
/>

<ul
	class="tray"
	bind:this={tray}
	onpointermove={moveDrag}
	onpointerup={endDrag}
	onpointercancel={cancelDrag}
>
	{#each rule.tokens as token, index (token.id)}
		<li
			class="slot"
			class:insert-before={barGap === index}
			class:insert-after={barGap === rule.tokens.length && index === last}
			data-slot
		>
			<TagChip tone={fieldToneIndex(token)} dragging={dragIndex === index}>
				<!--
					손잡이는 진짜 버튼이다. `<li>` 에 tabindex 를 주면 보조기술이 그것을
					조작 가능한 것으로 읽지 못하고, 칩 안의 ✕ 를 버튼 안에 넣으면 버튼이
					겹친다. 그래서 손잡이와 ✕ 를 **형제**로 둔다.
				-->
				<button
					class="grip"
					type="button"
					data-token={token.id}
					aria-label="{tokenLabel(token)}, {index +
						1}번째. 끌어서 옮기거나 Alt와 좌우 화살표를 씁니다"
					onpointerdown={(event) => startDrag(event, index)}
					onkeydown={(event) => nudge(event, token)}
				>
					{tokenLabel(token)}
				</button>
				{#if token.kind === 'custom'}
					<input
						class="custom"
						value={token.value}
						placeholder="직접 입력할 문구"
						size={Math.max(4, token.value.length || 4)}
						aria-label="고정문구 내용"
						oninput={(event) =>
							onchange({
								...rule,
								tokens: rule.tokens.map((item) =>
									item.id === token.id && item.kind === 'custom'
										? { ...item, value: event.currentTarget.value }
										: item
								)
							})}
					/>
				{/if}
				{#snippet trailing()}
					<IconButton
						title="{tokenLabel(token)} 제거"
						compact
						onclick={() =>
							onchange({ ...rule, tokens: rule.tokens.filter((item) => item.id !== token.id) })}
					>
						<XIcon size={12} />
					</IconButton>
				{/snippet}
			</TagChip>
		</li>
	{/each}

	{#if append}
		<li class="slot add">{@render append()}</li>
	{/if}
</ul>

<p class="visually-hidden" role="status" aria-live="polite">{orderNote}</p>

<style>
	/*
		받는 자리 — 눌린 면이 "여기에 항목을 놓는다" 를 말한다. 칩에 테두리를 두지 않는
		이유도 여기 있다: 음각 위에 테두리 상자를 얹으면 경계가 두 줄로 보인다.
	*/
	.tray {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-l3);
		margin: 0;
		border-radius: var(--radius-panel);
		padding: var(--space-12);
		background-color: var(--tray);
		list-style: none;
		/* 터치에서 칩을 끌 때 페이지가 같이 스크롤되지 않게 한다. */
		touch-action: none;
	}

	.slot {
		position: relative; /* 삽입 막대의 기준 */
		display: flex;
		max-width: 100%;
	}

	/* 손잡이 — 칩의 글자 자체가 잡는 자리다. 별도 아이콘을 붙이면 칩이 길어진다. */
	.grip {
		display: inline-flex;
		align-items: center;
		/* 클릭 대상 24px 이상 (@control-contract #5). 칩이 그만큼 높아진다. */
		min-height: 24px;
		border: none;
		padding: 0;
		background-color: transparent;
		color: inherit;
		cursor: grab;
		font-family: var(--font);
		font-size: inherit;
		font-weight: inherit;
		touch-action: none;
	}

	.grip:active {
		cursor: grabbing;
	}

	/*
		놓일 자리 표시. 항목이 아니라 두 칩 **사이의 틈** 가운데에 선다.
		절대 배치라 어떤 칩도 밀지 않는다 — 막대 때문에 칩이 움직이면 겨눈 틈이
		어디였는지 다시 알 수 없게 된다. 가로로 흐르는 목록이므로 세로 막대다.
	*/
	.slot.insert-before::before,
	.slot.insert-after::after {
		content: '';
		position: absolute;
		top: 0;
		bottom: 0;
		width: var(--space-2);
		border-radius: var(--radius-pill);
		background-color: var(--accent);
		pointer-events: none; /* 막대가 포인터를 삼키면 틈 판정이 자기 위에서 멈춘다 */
	}

	.slot.insert-before::before {
		left: calc(-1 * var(--gap-l3) / 2 - var(--space-2) / 2);
	}

	/* 마지막 틈. 별도 항목을 끼우면 gap 이 하나 더 생겨 트레이가 넓어진다. */
	.slot.insert-after::after {
		right: calc(-1 * var(--gap-l3) / 2 - var(--space-2) / 2);
	}

	/* 고정문구는 칩 안에서 바로 고친다 — 따로 입력 줄을 두면 항목과 값이 떨어진다. */
	.custom {
		min-width: 0;
		border: none;
		border-bottom: 1px solid currentColor;
		border-radius: 0;
		padding: 0;
		background-color: transparent;
		color: inherit;
		font-size: inherit;
		font-weight: inherit;
	}

	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip-path: inset(50%);
		white-space: nowrap;
	}
</style>
