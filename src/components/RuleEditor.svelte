<script lang="ts">
	/**
	 * 규칙 탭 — "이 상황의 영수증은 어떻게 부를까" 에 답하는 화면.
	 *
	 * 처리 탭과 다른 질문에 답하므로 계층을 따로 뒀다 (@information-architecture).
	 * 왼쪽이 아카이브(무엇이 있나), 오른쪽이 편집(이건 어떻게 생겼나)이다.
	 *
	 * **두 쪽이 같은 모양이다.** 카드도 편집 패널도 위에 이름, 아래에 음각 태그 트레이다.
	 * 그래서 왼쪽에서 고른 것이 오른쪽에서 어떻게 펼쳐지는지 대조할 필요가 없다 —
	 * 같은 그림이 크기만 다르게 두 번 있다.
	 */
	import PlusIcon from '@lucide/svelte/icons/plus';

	import Button from '../ui/Button.svelte';
	import Disclosure from '../ui/Disclosure.svelte';
	import IconButton from '../ui/IconButton.svelte';
	import TagChip from '../ui/TagChip.svelte';
	import TokenTray from './TokenTray.svelte';

	import {
		FIELD_LABELS,
		FIELD_ORDER,
		fieldColorIndex,
		fileName,
		formatAmount,
		formatDate,
		tokenLabel
	} from '../naming';
	import { addToken, createCustomToken, createFieldToken } from '../rules';
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
	/** 조각을 고르는 중. 트레이 안에서 열려, 고르면 바로 그 자리에 들어간다. */
	let adding = $state(false);

	const active = $derived(rules.find((rule) => rule.id === activeId) ?? rules[0]);
	/** 규칙을 고치는 즉시 보이는 결과. 저장 버튼을 누르고 확인하게 만들지 않는다. */
	const preview = $derived(
		active === undefined ? '' : fileName(sample.info, sample.originalName, active)
	);

	/** 아직 쓰지 않은 필드만 고를 수 있다 — 같은 필드를 두 번 넣을 일은 드물다. */
	const unused = $derived(
		FIELD_ORDER.filter(
			(field) => !active?.tokens.some((token) => token.kind === 'field' && token.field === field)
		)
	);

	/** 접힌 채로도 무엇이 적용 중인지 답한다. */
	const formatSummary = $derived(
		active === undefined
			? ''
			: [
					`구분자 ${active.separator}`,
					formatDate(sample.info.date, active.dateFormat),
					formatAmount(sample.info.amount, sample.info.currency, active.amountFormat)
				]
					.filter(Boolean)
					.join(' · ')
	);

	function patch(changes: Partial<NamingRule>): void {
		if (active !== undefined) onchange({ ...active, ...changes });
	}
</script>

<div class="editor">
	<aside class="archive">
		<div class="archive-head">
			<h2>규칙</h2>
			<IconButton title="새 규칙" onclick={oncreate}><PlusIcon size={15} /></IconButton>
		</div>

		<ul class="rule-list">
			{#each rules as rule (rule.id)}
				<li>
					<!--
						카드는 순수 데이터다 — 행마다 지우기를 달면 목록이 데이터 반, 행동 반이
						된다 (@information-architecture #3). 지우기는 "지금 보고 있는 규칙" 에
						대한 행동이라 편집 쪽 관리 묶음에 산다.
					-->
					<button
						class="rule"
						aria-current={rule.id === activeId ? 'true' : undefined}
						onclick={() => onselect(rule.id)}
					>
						<span class="rule-name">{rule.name}</span>
						<span class="rule-tray">
							{#each rule.tokens as token (token.id)}
								<TagChip color={fieldColorIndex(token)} compact>{tokenLabel(token)}</TagChip>
							{/each}
						</span>
					</button>
				</li>
			{/each}
		</ul>

		<Disclosure title="규칙 파일" value="{rules.length}개">
			<Button variant="outlined" compact onclick={onexport}>파일로 내보내기</Button>
			<Button variant="outlined" compact onclick={() => fileInput.click()}>파일에서 가져오기</Button
			>
		</Disclosure>
	</aside>

	{#if active !== undefined}
		<section class="detail">
			<!--
				이 화면에 온 이유가 "그래서 이름이 뭐가 되나" 이므로, 답이 제목보다 세다.
				카드(면+반경)가 아니라 헤어라인 띠로 둔다 — 위는 결과, 아래는 그 결과를
				만드는 입력이라는 뜻이고, 상자를 하나 더 두면 트레이와 경계가 겹친다.
			-->
			<div class="preview">
				<span class="preview-label">이 규칙으로 붙는 이름</span>
				<p class="preview-name" aria-live="polite">{preview}</p>
			</div>

			<label class="field name">
				<span>규칙 이름</span>
				<input
					value={active.name}
					oninput={(event) => patch({ name: event.currentTarget.value })}
				/>
			</label>

			<div class="group">
				<div class="group-head">
					<h3>이름의 순서</h3>
					<span class="hint">끌어서 옮깁니다 · Alt+←/→</span>
				</div>

				<TokenTray rule={active} {onchange}>
					{#snippet append()}
						<Button variant="chip" onclick={() => (adding = !adding)}>
							{adding ? '닫기' : '＋ 조각 더하기'}
						</Button>
						{#if adding}
							{#each unused as field (field)}
								<Button
									variant="chip"
									onclick={() => onchange(addToken(active, createFieldToken(field)))}
								>
									{FIELD_LABELS[field]}
								</Button>
							{/each}
							<Button
								variant="chip"
								onclick={() => onchange(addToken(active, createCustomToken()))}
							>
								고정문구
							</Button>
						{/if}
					{/snippet}
				</TokenTray>
			</div>

			<Disclosure title="표기" value={formatSummary}>
				<div class="grid">
					<label class="field">
						<span>구분자</span>
						<input
							value={active.separator}
							maxlength="3"
							oninput={(event) => patch({ separator: event.currentTarget.value })}
						/>
					</label>
					<label class="field">
						<span>날짜</span>
						<select
							value={active.dateFormat}
							onchange={(event) =>
								patch({ dateFormat: event.currentTarget.value as NamingRule['dateFormat'] })}
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
							onchange={(event) =>
								patch({ amountFormat: event.currentTarget.value as NamingRule['amountFormat'] })}
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
							onchange={(event) =>
								patch({
									emptyFieldPolicy: event.currentTarget.value as NamingRule['emptyFieldPolicy']
								})}
						>
							<option value="skip">건너뛴다</option>
							<option value="placeholder">표시를 넣는다</option>
						</select>
					</label>
					<!--
						조건부로 나타났다 사라지면 열 수가 바뀌어 보고 있던 줄을 잃는다.
						자리는 두고 흐리게 한다 (@tool-ux-principles §2).
					-->
					<label class="field" class:muted={active.emptyFieldPolicy === 'skip'}>
						<span>넣을 표시</span>
						<input
							value={active.placeholder}
							disabled={active.emptyFieldPolicy === 'skip'}
							placeholder="안 넣음"
							oninput={(event) => patch({ placeholder: event.currentTarget.value })}
						/>
					</label>
				</div>

				<label class="check">
					<input
						type="checkbox"
						checked={active.replaceSpacesWithUnderscore}
						onchange={(event) =>
							patch({ replaceSpacesWithUnderscore: event.currentTarget.checked })}
					/>
					<span>공백을 밑줄(_)로 바꾼다</span>
				</label>
			</Disclosure>

			<Disclosure title="읽을 때 줄 문맥" value={active.extractionHint ? '설정됨' : '없음'}>
				<p class="note">
					이 규칙으로 처리할 영수증이 어떤 것인지 한 줄로 알려 주면 값을 더 정확히 읽습니다. 비워
					두어도 됩니다.
				</p>
				<textarea
					rows="2"
					placeholder="예: 해외 출장 영수증이다. 금액은 현지 통화이고 날짜는 현지 기준이다."
					value={active.extractionHint}
					oninput={(event) => patch({ extractionHint: event.currentTarget.value })}></textarea>
			</Disclosure>

			<Disclosure title="이 규칙 관리">
				<Button variant="outlined" compact onclick={onduplicate}>이 규칙 복제</Button>
				<Button
					variant="ghost"
					compact
					disabled={rules.length <= 1}
					onclick={() => ondelete(active.id)}
				>
					이 규칙 지우기
				</Button>
			</Disclosure>
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

	.archive-head,
	.group-head {
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

	.hint {
		color: var(--ink-faint);
		font-size: var(--text-caption);
	}

	.rule-list {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	/*
		카드도 편집 패널과 같은 모양이다 — 위에 이름, 아래에 음각 트레이.

		`ui-probe` 의 `multiple-filled-emphasis` 가 "면으로 강조된 항목이 셋" 이라고
		보고하지만, 여기서 눌린 면은 강조가 아니라 **구조**다. 카드와 편집 패널이 같은
		그림이어야 무엇이 무엇으로 펼쳐지는지 대조할 필요가 없어진다. 현재 항목의 표시는
		면이 아니라 `aria-current` 와 테두리 색이 맡는다 — 그건 여전히 하나뿐이다.
	*/
	.rule {
		display: flex;
		width: 100%;
		flex-direction: column;
		gap: var(--gap-l4);
		border: 1px solid var(--line);
		border-radius: var(--radius-panel);
		padding: var(--space-12);
		background-color: var(--surface);
		cursor: pointer;
		text-align: left;
		font-family: var(--font);
	}

	.rule[aria-current='true'] {
		border-color: var(--accent);
	}

	.rule-name {
		color: var(--ink);
		font-size: var(--text-body-sm);
		font-weight: 500;
	}

	.rule-tray {
		display: flex;
		flex-wrap: wrap;
		gap: var(--gap-l4);
		border-radius: var(--radius-control);
		padding: var(--space-8);
		background-color: var(--tray);
	}

	.preview {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		border-bottom: 1px solid var(--line);
		padding-bottom: var(--space-16);
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
		font-size: var(--text-title);
		font-weight: 600;
		white-space: nowrap;
	}

	.group {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l3);
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

	.field.muted {
		opacity: 0.5;
	}

	.name {
		max-width: 320px;
	}

	.check {
		display: flex;
		min-height: 24px;
		align-items: center;
		align-self: flex-start;
		gap: var(--gap-l4);
		color: var(--ink);
		cursor: pointer;
		font-size: var(--text-body-sm);
	}

	.note {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-caption);
	}
</style>
