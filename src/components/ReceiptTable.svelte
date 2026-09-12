<script lang="ts">
	/**
	 * 결과를 내보내기 **전에** 보여 주는 자리 (@tool-ux-principles §3).
	 *
	 * 한 줄이 "원본 이름 → 새 이름" 하나를 말한다. 읽어 낸 값이 틀렸으면 그 자리에서
	 * 고칠 수 있고, 고치면 새 이름이 즉시 다시 조립된다.
	 */
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';
	import ChevronDownIcon from '@lucide/svelte/icons/chevron-down';
	import LoaderIcon from '@lucide/svelte/icons/loader-circle';
	import RotateCcwIcon from '@lucide/svelte/icons/rotate-ccw';
	import XIcon from '@lucide/svelte/icons/x';

	import IconButton from '../ui/IconButton.svelte';
	import { FIELD_LABELS } from '../naming';
	import type { ReceiptFile } from '../state.svelte';
	import type { ReceiptInfo } from '../types';

	interface Props {
		receipts: ReceiptFile[];
		/** 규칙까지 적용된 최종 이름. `receipts` 와 같은 순서·같은 길이다. */
		names: string[];
		/** 이름을 못 채운 토큰들. 어디가 비었는지 사람이 알아야 고칠 수 있다. */
		missing: string[][];
		onremove: (id: string) => void;
		onretry: (id: string) => void;
		onedit: (id: string, patch: Partial<ReceiptInfo>) => void;
	}

	let { receipts, names, missing, onremove, onretry, onedit }: Props = $props();

	/** 펼쳐서 값을 고치는 중인 줄. 한 번에 하나만 연다 — 여러 줄을 열면 표가 아니게 된다. */
	let openId = $state<string | null>(null);

	/** 고칠 수 있는 필드. `originalName` 은 파일에서 오는 값이라 뺀다. */
	const EDITABLE = [
		'date',
		'documentType',
		'merchantName',
		'amount',
		'expenseCategory',
		'paymentMethod',
		'invoiceNumber'
	] as const;
</script>

<ul class="rows">
	{#each receipts as receipt, index (receipt.id)}
		{@const open = openId === receipt.id}
		<li class="row" class:open>
			<div class="line">
				{#if receipt.previewUrl}
					<img class="thumb" src={receipt.previewUrl} alt="" />
				{:else}
					<div class="thumb placeholder"></div>
				{/if}

				<div class="names">
					<p class="original">{receipt.originalName}</p>
					<!--
						실패해도 이름을 지우지 않는다. 못 읽은 파일은 원본 이름으로 ZIP 에
						들어가는데, 화면에서만 감추면 산출물과 어긋난다.
					-->
					<p class="final">
						{names[index]}
						{#if receipt.status === 'error'}<span class="as-is">원본 이름 그대로</span>{/if}
					</p>
					{#if receipt.status === 'error'}
						<p class="error">{receipt.error}</p>
					{/if}
				</div>

				<div class="state">
					{#if receipt.status === 'parsing'}
						<span class="badge working"><LoaderIcon size={13} class="spin" /> 읽는 중</span>
					{:else if receipt.status === 'pending'}
						<span class="badge">대기</span>
					{:else if receipt.status === 'error'}
						<span class="badge bad"><AlertTriangleIcon size={13} /> 실패</span>
					{:else if missing[index].length > 0}
						<span class="badge warn">
							<AlertTriangleIcon size={13} />
							{missing[index].join(' · ')} 없음
						</span>
					{:else if receipt.info.warnings.length > 0}
						<!-- 읽기 경고는 접어 두지 않는다 — 펼쳐야 보이면 아무도 안 본다. -->
						<span class="badge warn">
							<AlertTriangleIcon size={13} />
							경고 {receipt.info.warnings.length}
						</span>
					{/if}
				</div>

				<div class="actions">
					{#if receipt.status === 'error'}
						<IconButton title="다시 읽기" onclick={() => onretry(receipt.id)}>
							<RotateCcwIcon size={15} />
						</IconButton>
					{/if}
					<span class="chevron" class:rotated={open}>
						<IconButton
							title="값 고치기"
							aria-expanded={open}
							onclick={() => (openId = open ? null : receipt.id)}
						>
							<ChevronDownIcon size={15} />
						</IconButton>
					</span>
					<IconButton title="이 파일만 빼기" onclick={() => onremove(receipt.id)}>
						<XIcon size={15} />
					</IconButton>
				</div>
			</div>

			{#if open}
				<div class="editor">
					{#each EDITABLE as field (field)}
						<label>
							<span>{FIELD_LABELS[field]}</span>
							{#if field === 'amount'}
								<input
									type="number"
									value={receipt.info.amount ?? ''}
									placeholder="금액 없음"
									oninput={(event) => {
										const raw = event.currentTarget.value.trim();
										// 비우면 0 이 아니라 "금액 없는 문서" 로 돌아간다.
										onedit(receipt.id, { amount: raw === '' ? null : Number(raw) });
									}}
								/>
							{:else}
								<input
									type="text"
									value={receipt.info[field]}
									oninput={(event) => onedit(receipt.id, { [field]: event.currentTarget.value })}
								/>
							{/if}
						</label>
					{/each}
					{#if receipt.info.warnings.length > 0}
						<p class="warnings">모델 경고: {receipt.info.warnings.join(' · ')}</p>
					{/if}
				</div>
			{/if}
		</li>
	{/each}
</ul>

<style>
	.rows {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.row {
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		background-color: var(--surface);
		overflow: hidden;
	}

	.row.open {
		border-color: var(--line-strong);
	}

	.line {
		display: flex;
		align-items: center;
		gap: var(--gap-l3);
		padding: var(--space-12);
	}

	.thumb {
		width: var(--thumb);
		height: var(--thumb);
		flex-shrink: 0;
		border-radius: var(--radius-control);
		border: 1px solid var(--line);
		/* cover 로 자르면 영수증이 어떤 것인지 알아볼 수 없다 — 전체가 보여야 한다. */
		object-fit: contain;
		background-color: var(--surface-raised);
	}

	.thumb.placeholder {
		background-color: var(--surface-sunken);
	}

	.names {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-l4);
	}

	.original,
	.final,
	.error {
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.original {
		color: var(--ink-muted);
		font-size: var(--text-caption);
	}

	.final {
		color: var(--ink);
		font-size: var(--text-body-sm);
		font-weight: 500;
		font-family: var(--font-mono);
	}

	.error {
		color: var(--danger);
		font-size: var(--text-body-sm);
	}

	.as-is {
		margin-left: var(--gap-l4);
		color: var(--danger);
		font-family: var(--font);
		font-size: var(--text-caption);
		font-weight: 400;
	}

	.state {
		flex-shrink: 0;
	}

	.badge {
		display: inline-flex;
		align-items: center;
		gap: var(--gap-l4);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		background-color: var(--surface-raised);
		color: var(--ink-muted);
		font-size: var(--text-caption);
		white-space: nowrap;
	}

	.badge.warn {
		color: var(--warning);
		background-color: color-mix(in srgb, var(--warning) 10%, transparent);
	}

	.badge.bad {
		color: var(--danger);
		background-color: color-mix(in srgb, var(--danger) 10%, transparent);
	}

	.badge.working {
		color: var(--accent-hover);
		background-color: color-mix(in srgb, var(--accent) 10%, transparent);
	}

	.actions {
		display: flex;
		flex-shrink: 0;
		gap: var(--gap-l4);
	}

	/* 회전은 버튼이 아니라 감싼 자리가 맡는다 — 버튼 정의는 한 곳(IconButton)에 둔다. */
	.chevron {
		display: inline-flex;
		transition: transform 0.15s;
	}

	.chevron.rotated {
		transform: rotate(180deg);
	}

	.editor {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
		gap: var(--gap-l3);
		padding: var(--space-16);
		border-top: 1px solid var(--line);
		background-color: var(--surface-raised);
	}

	label {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		font-size: var(--text-caption);
		color: var(--ink-muted);
	}

	.warnings {
		grid-column: 1 / -1;
		margin: 0;
		color: var(--warning);
		font-size: var(--text-caption);
	}

	:global(.spin) {
		animation: spin 1s linear infinite;
	}

	@keyframes spin {
		to {
			transform: rotate(360deg);
		}
	}
</style>
