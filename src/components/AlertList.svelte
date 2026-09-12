<script lang="ts">
	/**
	 * 내보내기 전에 알아야 할 것들. **한 자리**에 모은다.
	 *
	 * 전에는 같은 이야기가 세 곳에 흩어져 있었다 — 누락 필드는 행 배지로, 모델 경고는
	 * 행을 펼쳐야 보이는 곳에, "못 읽은 파일은 원본 이름으로 들어간다" 는 버튼 툴팁에.
	 * 셋 다 "이름이 틀릴 수 있다" 는 한 가지 사실인데 좌표가 달랐다.
	 *
	 * 여기 있는 것은 **지속되는 조건**이지 방금 일어난 사건이 아니다. 그래서 사라지지
	 * 않는다 — 사건은 화면 아래 알림줄(`store.message`)이 맡는다 (@information-architecture).
	 */
	import AlertTriangleIcon from '@lucide/svelte/icons/alert-triangle';

	export interface Alert {
		tone: 'warn' | 'bad';
		text: string;
	}

	let { alerts }: { alerts: Alert[] } = $props();
</script>

{#if alerts.length > 0}
	<ul class="alerts" aria-live="polite">
		{#each alerts as alert (alert.text)}
			<li class={alert.tone}>
				<AlertTriangleIcon size={13} />
				{alert.text}
			</li>
		{/each}
	</ul>
{/if}

<style>
	/* 면을 깔지 않는다 — 표 바로 위라서, 상자를 하나 더 두면 표와 경계가 겹친다. */
	.alerts {
		display: flex;
		flex-direction: column;
		gap: var(--gap-l4);
		margin: 0;
		padding: 0;
		list-style: none;
	}

	li {
		display: flex;
		align-items: center;
		gap: var(--gap-l4);
		font-size: var(--text-body-sm);
	}

	.warn {
		color: var(--warning);
	}

	.bad {
		color: var(--danger);
	}
</style>
