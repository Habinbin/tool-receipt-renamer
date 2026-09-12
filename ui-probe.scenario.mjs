/**
 * ui-probe 시나리오 — 상태가 있는 화면을 연다.
 *
 * 이 툴의 컨트롤은 대부분 파일이 들어온 뒤에야 나타난다(규칙 셀렉트, 상태 배지,
 * 아이콘 버튼, 값 수정 입력). 빈 화면만 재면 드롭존 하나밖에 못 본다.
 *
 * 영수증 두 장만 쓴다 — 컨트롤을 다 그리는 데 그 이상은 필요 없고,
 * 무료 티어 호출을 아낀다.
 */
import fs from 'node:fs';
import path from 'node:path';

/**
 * 벤치와 같은 폴더를 쓴다. 실제 영수증이라 커밋되지 않으므로(README 의 골든셋 항목),
 * 없으면 파일 단계를 건너뛰고 규칙 탭만 잰다 — 이미지가 없다고 검사를 못 하면 안 된다.
 */
const RECEIPTS = path.join(import.meta.dirname, 'fixtures/receipts');

export default async function ({ page, base, probe }) {
	const files = fs.existsSync(RECEIPTS)
		? fs
				.readdirSync(RECEIPTS)
				.filter((n) => /\.(jpg|png)$/i.test(n))
				.slice(0, 2)
				.map((n) => path.join(RECEIPTS, n))
		: [];

	const out = [];

	// 1) 규칙 탭 — 셀렉트·입력·칩·토큰 행이 전부 여기 있다.
	await page.goto(`${base}/`, { waitUntil: 'networkidle' });
	// 하이드레이트를 기다린다. 마크업은 SSR 로 이미 있어서, 그 전에 누르면 클릭은
	// 성공하는데 아무 일도 일어나지 않는다 — 규칙 목록이 채워지면 하이드레이트된 것이다.
	await page.waitForFunction(() => document.querySelectorAll('.count').length > 0);
	await page.getByRole('button', { name: /규칙/ }).first().click();
	// 태그 트레이가 이 화면의 주 내용이다. select 는 접힌 '표기' 안으로 들어갔다.
	await page.waitForSelector('.tray .grip');
	out.push({ name: '규칙 탭', findings: await probe() });

	// 접어 둔 것도 재야 한다 — 열었을 때 겹치거나 잘리는지는 닫힌 채로는 안 보인다.
	for (const fold of await page.$$('details.fold summary')) await fold.click();
	await page.waitForSelector('details.fold[open] select');
	out.push({ name: '규칙 탭 (전부 펼침)', findings: await probe() });

	if (files.length === 0) {
		console.warn('fixtures/receipts 가 비어 있어 파일 단계를 건너뛴다.');
		return out;
	}

	// 2) 처리 탭 — 파일이 들어온 뒤의 목록·배지·아이콘 버튼.
	await page.getByRole('button', { name: /처리/ }).first().click();
	await page.setInputFiles('input[type=file][multiple]', files);
	await page.waitForFunction(
		() => !document.body.innerText.includes('읽는 중') && !document.body.innerText.includes('대기'),
		null,
		{ timeout: 180000 }
	);
	out.push({ name: '처리 탭 (파일 2장)', findings: await probe() });

	// 3) 값 수정 — 줄을 펼치면 입력이 7개 나온다.
	await page.getByTitle('값 고치기').first().click();
	await page.waitForSelector('input[type=number]');
	out.push({ name: '값 수정 펼침', findings: await probe() });

	return out;
}
