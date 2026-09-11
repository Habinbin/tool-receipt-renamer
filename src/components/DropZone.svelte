<script lang="ts">
	/**
	 * 파일을 받는 자리. 이 툴의 첫 행동이고, 클릭 예산의 1번이다.
	 *
	 * 파일이 없을 때는 화면을 채워 "여기다" 를 말하고, 들어온 뒤에는 한 줄로 줄어
	 * 결과에 자리를 내준다 — 같은 컴포넌트가 두 크기를 갖는다. 진입점을 둘로
	 * 나누면 같은 행동이 두 자리에 생긴다 (@information-architecture §한 기능은 한 자리).
	 */
	import UploadIcon from '@lucide/svelte/icons/upload';

	interface Props {
		/** 이미 받은 파일 수. 0 이면 큰 모습, 그 외에는 줄어든 모습. */
		count: number;
		disabled?: boolean;
		onfiles: (files: File[]) => void;
	}

	let { count, disabled = false, onfiles }: Props = $props();

	let dragging = $state(false);
	// dragenter/leave 는 자식 요소를 지날 때마다 쌍으로 발생한다. 깊이를 세지 않으면
	// 드롭존 안의 글자 위를 지나는 것만으로 강조가 깜빡인다.
	let depth = 0;
	let input: HTMLInputElement;

	function take(list: FileList | null): void {
		if (list === null || disabled) return;
		const files = Array.from(list);
		if (files.length > 0) onfiles(files);
	}

	function onDrop(event: DragEvent): void {
		event.preventDefault();
		depth = 0;
		dragging = false;
		take(event.dataTransfer?.files ?? null);
	}
</script>

<div
	class="zone"
	class:compact={count > 0}
	class:dragging
	class:disabled
	role="button"
	tabindex="0"
	ondragenter={(event) => {
		event.preventDefault();
		depth += 1;
		dragging = true;
	}}
	ondragover={(event) => event.preventDefault()}
	ondragleave={() => {
		depth -= 1;
		if (depth <= 0) dragging = false;
	}}
	ondrop={onDrop}
	onclick={() => input.click()}
	onkeydown={(event) => {
		if (event.key === 'Enter' || event.key === ' ') {
			event.preventDefault();
			input.click();
		}
	}}
>
	<UploadIcon size={count > 0 ? 16 : 28} strokeWidth={1.5} />
	<div class="text">
		<p class="lead">
			{count > 0 ? '영수증 더 넣기' : '영수증을 여기에 끌어다 놓으세요'}
		</p>
		{#if count === 0}
			<p class="hint">JPG · PNG · HEIC · PDF · 여러 장을 한 번에</p>
		{/if}
	</div>
</div>

<input
	bind:this={input}
	type="file"
	multiple
	accept="image/*,application/pdf,.heic,.heif"
	hidden
	onchange={(event) => {
		const target = event.currentTarget;
		take(target.files);
		// 같은 파일을 연달아 고를 수 있도록 비운다 — 안 그러면 두 번째 선택이 조용히 무시된다.
		target.value = '';
	}}
/>

<style>
	.zone {
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: var(--gap-l3);
		padding: var(--space-32);
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		color: var(--ink-muted);
		cursor: pointer;
		text-align: center;
		transition:
			border-color 0.15s,
			background-color 0.15s;
	}

	/* 파일이 들어온 뒤에는 한 줄로 줄어 결과에 자리를 내준다. */
	.zone.compact {
		flex-direction: row;
		gap: var(--gap-l4);
		padding: var(--space-12) var(--space-16);
	}

	.zone:hover:not(.disabled),
	.zone.dragging {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 4%, var(--surface));
		color: var(--accent-hover);
	}

	.zone.disabled {
		cursor: not-allowed;
		opacity: 0.5;
	}

	.text {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
	}

	.lead {
		margin: 0;
		color: var(--ink);
		font-size: var(--text-body);
		font-weight: 500;
	}

	.compact .lead {
		font-size: var(--text-body-sm);
		font-weight: 400;
		color: inherit;
	}

	.hint {
		margin: 0;
		font-size: var(--text-body-sm);
	}
</style>
