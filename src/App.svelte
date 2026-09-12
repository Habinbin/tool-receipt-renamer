<script lang="ts">
	/**
	 * 툴의 본문. 헤더·제목·바깥 여백은 그리지 않는다 — 호스트의 몫이다
	 * (@theme-contract §헤더는 호스트가 그린다, @layout-consistency).
	 *
	 * 화면은 두 탭이다. 서로 다른 질문에 답하므로 나뉘어 있다:
	 *   처리 — 무엇으로 할까 (넣고, 보고, 내보낸다)
	 *   규칙 — 어떻게 부를까 (만들고, 고치고, 주고받는다)
	 *
	 * 클릭 예산: 드롭 → ZIP = 2. 규칙을 바꾸면 3 (@tool-ux-principles §1).
	 */
	import { onMount } from 'svelte';

	import DownloadIcon from '@lucide/svelte/icons/download';
	import RefreshCwIcon from '@lucide/svelte/icons/refresh-cw';

	import '@fontsource-variable/noto-sans-kr';
	import './ui/theme.css';

	import Button from './ui/Button.svelte';
	import DropZone from './components/DropZone.svelte';
	import ReceiptTable from './components/ReceiptTable.svelte';
	import RuleEditor from './components/RuleEditor.svelte';

	import { missingTokenLabels, resolveNames } from './naming';
	import { EMPTY_RECEIPT_INFO } from './receipt';
	import {
		ACTIVE_RULE_STORAGE_KEY,
		RULES_STORAGE_KEY,
		cloneRule,
		createRule,
		exportRules,
		importRules,
		mergeRules,
		readRules
	} from './rules';
	import { ReceiptStore } from './state.svelte';
	import type { NamingRule, ReceiptInfo } from './types';

	type Tab = 'process' | 'rules';

	const store = new ReceiptStore();

	let tab = $state<Tab>('process');
	let rules = $state<NamingRule[]>([]);
	let activeRuleId = $state('');
	let exporting = $state(false);
	let notice = $state('');

	/** 규칙 편집 화면의 미리보기에 쓰는 가짜 영수증. 파일이 없어도 결과가 보여야 한다. */
	const SAMPLE = {
		info: {
			...EMPTY_RECEIPT_INFO,
			date: '2026-07-02',
			documentType: '영수증',
			merchantName: '전북고속',
			amount: 36000,
			currency: 'KRW',
			expenseCategory: '교통',
			paymentMethod: '카드',
			invoiceNumber: '28124330'
		} satisfies ReceiptInfo,
		originalName: 'IMG_0421.jpg'
	};

	const activeRule = $derived(rules.find((rule) => rule.id === activeRuleId) ?? rules[0]);
	const names = $derived(activeRule === undefined ? [] : resolveNames(store.receipts, activeRule));
	const missing = $derived(
		activeRule === undefined
			? []
			: store.receipts.map((receipt) =>
					missingTokenLabels(receipt.info, receipt.originalName, activeRule)
				)
	);
	/** 내보낼 수 있는 것만 센다 — 아직 못 읽은 것을 넣으면 원본 이름으로 나간다. */
	const ready = $derived(store.receipts.filter((receipt) => receipt.status === 'done').length);
	/** 규칙 미리보기는 실제로 넣은 첫 장을 쓴다. 자기 영수증으로 봐야 확신이 선다. */
	const sample = $derived(store.receipts.find((receipt) => receipt.status === 'done') ?? SAMPLE);

	onMount(() => {
		rules = readRules(localStorage.getItem(RULES_STORAGE_KEY));
		const stored = localStorage.getItem(ACTIVE_RULE_STORAGE_KEY);
		activeRuleId = rules.some((rule) => rule.id === stored) ? stored! : (rules[0]?.id ?? '');
	});

	// 규칙은 고치는 즉시 저장된다. 저장 버튼을 두면 안 누르고 나가는 사람이 생긴다.
	$effect(() => {
		if (rules.length === 0) return;
		localStorage.setItem(RULES_STORAGE_KEY, JSON.stringify(rules));
		localStorage.setItem(ACTIVE_RULE_STORAGE_KEY, activeRuleId);
	});

	function updateRule(next: NamingRule): void {
		rules = rules.map((rule) => (rule.id === next.id ? next : rule));
	}

	function addRule(): void {
		const rule = createRule(`규칙 ${rules.length + 1}`);
		rules = [...rules, rule];
		activeRuleId = rule.id;
	}

	function duplicateRule(): void {
		if (activeRule === undefined) return;
		const copy = cloneRule(activeRule, `${activeRule.name} 사본`);
		rules = [...rules, copy];
		activeRuleId = copy.id;
	}

	function deleteRule(id: string): void {
		// 규칙을 지우는 것은 되돌릴 수 없으므로 묻는다. 그 밖의 동작에는 확인을 붙이지 않는다.
		const target = rules.find((rule) => rule.id === id);
		if (target === undefined || rules.length <= 1) return;
		if (!confirm(`"${target.name}" 규칙을 지울까요?`)) return;
		rules = rules.filter((rule) => rule.id !== id);
		if (activeRuleId === id) activeRuleId = rules[0].id;
	}

	function downloadRules(): void {
		const blob = new Blob([exportRules(rules)], { type: 'application/json' });
		saveBlob(blob, `영수증-규칙-${stamp()}.json`);
		notice = `규칙 ${rules.length}개를 파일로 내보냈습니다.`;
	}

	function loadRules(text: string): void {
		const result = importRules(text);
		if (!result.ok) {
			notice = `가져오지 못했습니다 — ${result.reason}`;
			return;
		}
		rules = mergeRules(rules, result.rules);
		notice = `규칙 ${result.rules.length}개를 가져왔습니다. 기존 규칙은 그대로 둡니다.`;
	}

	async function exportZip(): Promise<void> {
		if (activeRule === undefined || store.receipts.length === 0) return;
		exporting = true;
		notice = '';
		try {
			const { default: JSZip } = await import('jszip');
			const zip = new JSZip();
			for (const [index, receipt] of store.receipts.entries()) {
				// 원본 바이트를 그대로 넣는다. 다시 인코딩하면 화질만 잃는다.
				zip.file(names[index], receipt.file);
			}
			const blob = await zip.generateAsync({ type: 'blob' });
			saveBlob(blob, `영수증_${activeRule.name}_${stamp()}.zip`);
			notice = `${store.receipts.length}개 파일을 ZIP 으로 내보냈습니다.`;
		} catch (error) {
			notice = `내보내기에 실패했습니다 — ${error instanceof Error ? error.message : String(error)}`;
		} finally {
			exporting = false;
		}
	}

	function stamp(): string {
		const now = new Date();
		const pad = (n: number) => String(n).padStart(2, '0');
		return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
	}

	function saveBlob(blob: Blob, fileName: string): void {
		const url = URL.createObjectURL(blob);
		const link = document.createElement('a');
		link.href = url;
		link.download = fileName;
		link.click();
		// 즉시 해제하면 일부 브라우저에서 저장이 취소된다. 한 틱 뒤에 놓아 준다.
		setTimeout(() => URL.revokeObjectURL(url), 1000);
	}
</script>

<div class="tool-root">
	<nav class="tabs" aria-label="화면">
		<button class="tab" class:selected={tab === 'process'} onclick={() => (tab = 'process')}>
			처리
			{#if store.receipts.length > 0}<span class="count">{store.receipts.length}</span>{/if}
		</button>
		<button class="tab" class:selected={tab === 'rules'} onclick={() => (tab = 'rules')}>
			규칙<span class="count">{rules.length}</span>
		</button>
	</nav>

	{#if tab === 'process'}
		<section class="process">
			<DropZone
				count={store.receipts.length}
				disabled={exporting}
				onfiles={(files) => store.add(files, activeRule?.extractionHint ?? '')}
			/>

			{#if store.receipts.length > 0}
				<!-- 주 행동과 진행률은 언제나 같은 자리에 있다 (@layout-consistency #3). -->
				<div class="bar">
					<label class="rule-pick">
						<span>규칙</span>
						<select value={activeRuleId} onchange={(e) => (activeRuleId = e.currentTarget.value)}>
							{#each rules as rule (rule.id)}
								<option value={rule.id}>{rule.name}</option>
							{/each}
						</select>
					</label>

					<p class="progress" aria-live="polite">
						{#if store.working}
							{store.done} / {store.receipts.length} 읽는 중
						{:else if store.failed > 0}
							{store.done}개 완료 · <span class="bad">{store.failed}개 실패</span>
						{:else}
							{store.done}개 완료
						{/if}
					</p>

					<div class="bar-actions">
						<Button
							variant="ghost"
							compact
							onclick={() => store.clear()}
							disabled={exporting || store.working}>전체 비우기</Button
						>
						{#if activeRule?.extractionHint}
							<Button
								variant="outlined"
								compact
								onclick={() => store.reextractAll(activeRule.extractionHint)}
								disabled={store.working || exporting}
							>
								<RefreshCwIcon size={14} /> 이 규칙으로 다시 읽기
							</Button>
						{/if}
						<Button
							variant="filled"
							onclick={exportZip}
							disabled={exporting || store.receipts.length === 0}
							title={ready < store.receipts.length
								? '아직 못 읽은 파일은 원본 이름으로 들어갑니다'
								: undefined}
						>
							<DownloadIcon size={16} />
							{exporting ? '내보내는 중…' : 'ZIP 내려받기'}
						</Button>
					</div>
				</div>

				<ReceiptTable
					receipts={store.receipts}
					{names}
					{missing}
					onremove={(id) => store.remove(id)}
					onretry={(id) => store.retry(id, activeRule?.extractionHint ?? '')}
					onedit={(id, patch) => store.edit(id, patch)}
				/>
			{/if}
		</section>
	{:else}
		<RuleEditor
			{rules}
			activeId={activeRuleId}
			{sample}
			onselect={(id) => (activeRuleId = id)}
			onchange={updateRule}
			oncreate={addRule}
			onduplicate={duplicateRule}
			ondelete={deleteRule}
			onexport={downloadRules}
			onimport={loadRules}
		/>
	{/if}

	{#if notice || store.message}
		<p class="notice" aria-live="polite">{notice || store.message}</p>
	{/if}
</div>

<style>
	.tool-root {
		display: flex;
		width: 100%;
		min-height: 0;
		flex: 1;
		flex-direction: column;
		gap: var(--gap-l2);
	}

	/*
	 * ui-probe 의 `control-variant-sprawl` 이 이 화면에서 <button> 네 모양을 센다:
	 * 탭 · 주 행동(Button) · 아이콘 버튼(IconButton) · 규칙 카드.
	 * 정의는 전부 `ui/` 에 하나씩 있고 즉석 컨트롤은 없다 — 넷은 같은 컨트롤의
	 * 변형이 아니라 **서로 다른 종류**다. 탭은 화면을 고르고, 카드는 대상을 고르며,
	 * 주 행동은 일을 시킨다. 하나로 합치면 셋이 같은 일을 한다고 읽힌다.
	 */
	.tabs {
		display: flex;
		gap: var(--gap-l4);
		border-bottom: 1px solid var(--line);
	}

	.tab {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		margin-bottom: -1px;
		border: none;
		border-bottom: 2px solid transparent;
		padding: var(--space-8) var(--space-12);
		background-color: transparent;
		color: var(--ink-muted);
		cursor: pointer;
		font-family: var(--font);
		font-size: var(--text-body-sm);
		font-weight: 500;
	}

	.tab.selected {
		border-bottom-color: var(--accent);
		color: var(--ink);
	}

	.count {
		border-radius: var(--radius-pill);
		padding: 2px 8px;
		background-color: var(--surface-sunken);
		/* 가라앉은 면 위에서는 muted 가 3.9:1 로 AA 에 못 미친다. 숫자는 정보다. */
		color: var(--ink);
		font-size: var(--text-caption);
	}

	.process {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l2);
	}

	.bar {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: var(--gap-l3);
	}

	.rule-pick {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		color: var(--ink-muted);
		font-size: var(--text-body-sm);
	}

	.progress {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-body-sm);
	}

	.bad {
		color: var(--danger);
	}

	.bar-actions {
		display: flex;
		align-items: center;
		gap: var(--gap-l3);
		margin-left: auto;
	}

	.notice {
		margin: 0;
		color: var(--ink-muted);
		font-size: var(--text-body-sm);
	}
</style>
