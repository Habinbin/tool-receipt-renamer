<script lang="ts">
	/**
	 * 규칙 탭 — "이 상황의 영수증은 어떻게 부를까" 에 답하는 화면.
	 *
	 * 처리 탭과 다른 질문에 답하므로 계층을 따로 뒀다 (@information-architecture).
	 * 왼쪽이 아카이브(무엇이 있나), 오른쪽이 편집(이건 어떻게 생겼나)이다.
	 */
	import ArrowDownIcon from '@lucide/svelte/icons/arrow-down';
	import ArrowUpIcon from '@lucide/svelte/icons/arrow-up';
	import CopyIcon from '@lucide/svelte/icons/copy';
	import DownloadIcon from '@lucide/svelte/icons/download';
	import PlusIcon from '@lucide/svelte/icons/plus';
	import TrashIcon from '@lucide/svelte/icons/trash-2';
	import UploadIcon from '@lucide/svelte/icons/upload';
	import XIcon from '@lucide/svelte/icons/x';

	import { FIELD_LABELS, FIELD_ORDER, fileName, tokenLabel } from '../naming';
	import {
		addToken,
		createCustomToken,
		createFieldToken,
		moveToken,
		removeToken,
		updateCustomToken
	} from '../rules';
	import type { NamingRule, ReceiptInfo } from '../types';

	interface Props {
		rules: NamingRule[];
		activeId: string;
		/** 미리보기에 쓸 값. 처리 중인 영수증이 있으면 그것, 없으면 예시. */
		sample: { info: ReceiptInfo; originalName: string };
		onselect: (id: string) => void;
		onchange: (rule: NamingRule) => void;
		oncreate: () => void;
		onduplicate: () => void;
		ondelete: (id: string) => void;
		onexport: () => void;
		onimport: (text: string) => void;
	}

	let {
		rules,
		activeId,
		sample,
		onselect,
		onchange,
		oncreate,
		onduplicate,
		ondelete,
		onexport,
		onimport
	}: Props = $props();

	let fileInput: HTMLInputElement;

	const active = $derived(rules.find((rule) => rule.id === activeId) ?? rules[0]);
	/** 규칙을 고치는 즉시 보이는 결과. 저장 버튼을 누르고 확인하게 만들지 않는다. */
	const preview = $derived(
		active === undefined ? '' : fileName(sample.info, sample.originalName, active)
	);

	/** 아직 쓰지 않은 필드만 추가 목록에 보인다 — 같은 필드를 두 번 넣을 일은 드물다. */
	const unused = $derived(
		FIELD_ORDER.filter(
			(field) => !active?.tokens.some((token) => token.kind === 'field' && token.field === field)
		)
	);

	function patch(changes: Partial<NamingRule>): void {
		if (active !== undefined) onchange({ ...active, ...changes });
	}
</script>

<div class="editor">
	<aside class="archive">
		<div class="archive-head">
			<h2>규칙</h2>
			<div class="archive-actions">
				<button class="icon" onclick={oncreate} title="새 규칙"><PlusIcon size={15} /></button>
				<button class="icon" onclick={onduplicate} title="이 규칙 복제"
					><CopyIcon size={15} /></button
				>
				<button class="icon" onclick={onexport} title="파일로 내보내기"
					><DownloadIcon size={15} /></button
				>
				<button class="icon" onclick={() => fileInput.click()} title="파일에서 가져오기">
					<UploadIcon size={15} />
				</button>
			</div>
		</div>

		<ul class="rule-list">
			{#each rules as rule (rule.id)}
				<li>
					<button
						class="rule"
						class:selected={rule.id === activeId}
						onclick={() => onselect(rule.id)}
					>
						<span class="rule-name">{rule.name}</span>
						<span class="rule-sample">{fileName(sample.info, sample.originalName, rule)}</span>
					</button>
					<button
						class="icon danger"
						onclick={() => ondelete(rule.id)}
						title="이 규칙 지우기"
						disabled={rules.length <= 1}
					>
						<TrashIcon size={14} />
					</button>
				</li>
			{/each}
		</ul>
	</aside>

	{#if active !== undefined}
		<section class="detail">
			<div class="preview">
				<span class="preview-label">이 규칙으로 붙는 이름</span>
				<p class="preview-name">{preview}</p>
			</div>

			<div class="group">
				<label class="field">
					<span>규칙 이름</span>
					<input value={active.name} oninput={(e) => patch({ name: e.currentTarget.value })} />
				</label>
			</div>

			<div class="group">
				<h3>이름의 순서</h3>
				<ul class="tokens">
					{#each active.tokens as token, index (token.id)}
						<li class="token">
							<span class="token-label">{tokenLabel(token)}</span>
							{#if token.kind === 'custom'}
								<input
									class="token-input"
									value={token.value}
									placeholder="넣을 문구"
									oninput={(e) =>
										onchange(updateCustomToken(active, token.id, e.currentTarget.value))}
								/>
							{/if}
							<div class="token-actions">
								<button
									class="icon"
									disabled={index === 0}
									onclick={() => onchange(moveToken(active, token.id, -1))}
									title="앞으로"><ArrowUpIcon size={14} /></button
								>
								<button
									class="icon"
									disabled={index === active.tokens.length - 1}
									onclick={() => onchange(moveToken(active, token.id, 1))}
									title="뒤로"><ArrowDownIcon size={14} /></button
								>
								<button
									class="icon danger"
									onclick={() => onchange(removeToken(active, token.id))}
									title="빼기"><XIcon size={14} /></button
								>
							</div>
						</li>
					{/each}
				</ul>

				<div class="add-row">
					{#each unused as field (field)}
						<button
							class="chip"
							onclick={() => onchange(addToken(active, createFieldToken(field)))}
						>
							+ {FIELD_LABELS[field]}
						</button>
					{/each}
					<button class="chip" onclick={() => onchange(addToken(active, createCustomToken()))}>
						+ 고정문구
					</button>
				</div>
			</div>

			<div class="group">
				<h3>표기</h3>
				<div class="grid">
					<label class="field">
						<span>구분자</span>
						<input
							value={active.separator}
							maxlength="3"
							oninput={(e) => patch({ separator: e.currentTarget.value })}
						/>
					</label>
					<label class="field">
						<span>날짜</span>
						<select
							value={active.dateFormat}
							onchange={(e) =>
								patch({ dateFormat: e.currentTarget.value as NamingRule['dateFormat'] })}
						>
							<option value="yyyyMMdd">20260702</option>
							<option value="yyMMdd">260702</option>
							<option value="yyyy-MM-dd">2026-07-02</option>
							<option value="yyyy.MM.dd">2026.07.02</option>
							<option value="raw">읽은 그대로</option>
						</select>
					</label>
					<label class="field">
						<span>금액</span>
						<select
							value={active.amountFormat}
							onchange={(e) =>
								patch({ amountFormat: e.currentTarget.value as NamingRule['amountFormat'] })}
						>
							<option value="krw-suffix">36,000원</option>
							<option value="currency-code">KRW 36,000</option>
							<option value="plain">36,000</option>
						</select>
					</label>
					<label class="field">
						<span>못 읽은 값</span>
						<select
							value={active.emptyFieldPolicy}
							onchange={(e) =>
								patch({
									emptyFieldPolicy: e.currentTarget.value as NamingRule['emptyFieldPolicy']
								})}
						>
							<option value="skip">건너뛴다</option>
							<option value="placeholder">표시를 넣는다</option>
						</select>
					</label>
					{#if active.emptyFieldPolicy === 'placeholder'}
						<label class="field">
							<span>넣을 표시</span>
							<input
								value={active.placeholder}
								oninput={(e) => patch({ placeholder: e.currentTarget.value })}
							/>
						</label>
					{/if}
				</div>

				<label class="check">
					<input
						type="checkbox"
						checked={active.replaceSpacesWithUnderscore}
						onchange={(e) => patch({ replaceSpacesWithUnderscore: e.currentTarget.checked })}
					/>
					<span>공백을 밑줄(_)로 바꾼다</span>
				</label>
			</div>

			<div class="group">
				<h3>읽을 때 줄 문맥</h3>
				<p class="note">
					이 규칙으로 처리할 영수증이 어떤 것인지 한 줄로 알려 주면 값을 더 정확히 읽습니다. 비워
					두어도 됩니다.
				</p>
				<textarea
					rows="2"
					placeholder="예: 해외 출장 영수증이다. 금액은 현지 통화이고 날짜는 현지 기준이다."
					value={active.extractionHint}
					oninput={(e) => patch({ extractionHint: e.currentTarget.value })}></textarea>
			</div>
		</section>
	{/if}
</div>

<input
	bind:this={fileInput}
	type="file"
	accept="application/json,.json"
	hidden
	onchange={async (event) => {
		const file = event.currentTarget.files?.[0];
		event.currentTarget.value = '';
		if (file !== undefined) onimport(await file.text());
	}}
/>

<style>
	.editor {
		display: grid;
		grid-template-columns: minmax(220px, 300px) 1fr;
		gap: var(--gap-l1);
		align-items: start;
	}

	@media (max-width: 720px) {
		.editor {
			grid-template-columns: 1fr;
			gap: var(--gap-l2);
		}
	}

	.archive,
	.detail {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l2);
	}

	.archive-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: var(--gap-l3);
	}

	h2 {
		margin: 0;
		font-size: var(--text-body);
		font-weight: 600;
	}

	h3 {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-caption);
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}

	.archive-actions {
		display: flex;
		gap: var(--gap-l4);
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.rule-list li {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
	}

	.rule {
		display: flex;
		min-width: 0;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-l4);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		padding: var(--space-8) var(--space-12);
		background-color: var(--surface);
		cursor: pointer;
		text-align: left;
		font-family: var(--font);
	}

	.rule.selected {
		border-color: var(--accent);
		background-color: color-mix(in srgb, var(--accent) 5%, var(--surface));
	}

	.rule-name {
		color: var(--ink);
		font-size: var(--text-body-sm);
		font-weight: 500;
	}

	.rule-sample {
		overflow: hidden;
		color: var(--ink-faint);
		font-family: var(--font-mono);
		font-size: var(--text-caption);
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		padding: var(--space-16);
		background-color: var(--surface-raised);
	}

	.preview-label {
		color: var(--ink-muted);
		font-size: var(--text-caption);
	}

	.preview-name {
		margin: 0;
		overflow-x: auto;
		color: var(--ink);
		font-family: var(--font-mono);
		font-size: var(--text-body);
		font-weight: 500;
		white-space: nowrap;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
	}

	.tokens {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	.token {
		display: flex;
		align-items: center;
		gap: var(--gap-l3);
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		padding: var(--space-8) var(--space-12);
		background-color: var(--surface);
	}

	.token-label {
		flex-shrink: 0;
		font-size: var(--text-body-sm);
	}

	.token-input {
		flex: 1;
		min-width: 0;
	}

	.token-actions {
		display: flex;
		margin-left: auto;
		gap: var(--gap-l4);
	}

	.add-row {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-l3);
	}

	.chip {
		border: 1px dashed var(--line-strong);
		border-radius: var(--radius-pill);
		padding: 4px 12px;
		background-color: transparent;
		color: var(--ink-muted);
		cursor: pointer;
		font-family: var(--font);
		font-size: var(--text-caption);
	}

	.chip:hover {
		border-color: var(--accent);
		border-style: solid;
		color: var(--accent-hover);
	}

	.grid {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
		gap: var(--gap-l3);
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		color: var(--ink-muted);
		font-size: var(--text-caption);
	}

	.check {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		color: var(--ink);
		font-size: var(--text-body-sm);
	}

	.note {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-caption);
	}

	input,
	select,
	textarea {
		border: 1px solid var(--line);
		border-radius: var(--radius-control);
		padding: 8px 12px;
		background-color: var(--surface);
		color: var(--ink);
		font-family: var(--font);
		font-size: var(--text-body-sm);
	}

	textarea {
		resize: vertical;
	}

	.check input {
		width: auto;
	}

	.icon {
		display: grid;
		flex-shrink: 0;
		place-items: center;
		width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--radius-control);
		background-color: transparent;
		color: var(--ink-muted);
		cursor: pointer;
	}

	.icon:hover:not(:disabled) {
		background-color: var(--surface-raised);
		color: var(--ink);
	}

	.icon:disabled {
		cursor: not-allowed;
		opacity: 0.3;
	}

	.icon.danger:hover:not(:disabled) {
		color: var(--danger);
	}
</style>
