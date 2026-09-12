# tool-receipt-renamer

영수증·카드전표·승차권을 뭉텅이로 넣으면 **읽어서 규칙대로 이름을 붙여 ZIP 으로** 내보낸다.
규칙은 상황별로 저장해 두고 갈아 끼운다 — 회계 제출용, 분류별 정리용, 감사 대비용처럼.

핵심은 **추출과 이름이 분리되어 있다**는 것이다. 한 번 읽어 둔 값은 규칙을 바꿔도
그대로 남고 이름만 다시 조립된다. 그래서 규칙을 갈아 끼우는 데 돈도 시간도 들지 않는다.

## 어디에 떠 있나

껍데기가 둘이고 동작은 하나다 (@standalone-tool-deployment).

| 껍데기         | 주소                                    | 비고                                              |
| -------------- | --------------------------------------- | ------------------------------------------------- |
| 단독 (`app/`)  | https://receipt-renamer-beta.vercel.app | Vercel. `GEMINI_API_KEY` 는 프로젝트 환경변수     |
| betlab-toolbox | `/receipt-renamer`                      | 연구실 서버(adapter-node). 툴박스가 키를 주입한다 |

## 클릭 예산 (@tool-ux-principles §1)

| 경로               | 행동 수                        |
| ------------------ | ------------------------------ |
| 기본 규칙으로 처리 | 드롭 → ZIP 내려받기 = **2**    |
| 규칙을 바꿔 가며   | 드롭 → 규칙 선택 → ZIP = **3** |
| 값이 틀려 고칠 때  | + 해당 줄 펼쳐 수정            |

## 화면

두 탭이 **서로 다른 질문**에 답한다 (@information-architecture).

| 탭   | 질문          | 내용                                                                  |
| ---- | ------------- | --------------------------------------------------------------------- |
| 처리 | 무엇으로 할까 | 드롭존 · 규칙 선택 · 진행률 · 파일 표(원본명 → 새 이름) · ZIP         |
| 규칙 | 어떻게 부를까 | 규칙 아카이브 · 토큰 순서 · 표기 · 추출 문맥 · JSON 내보내기/가져오기 |

## 서버가 필요한 이유

**오직 API 키 하나** (@client-first-processing). 축소·PDF 래스터·ZIP 은 전부 브라우저에서
끝나고, 서버 라우트는 Gemini 로 가는 얇은 프록시다. 4MB 사진이 그대로 올라가지 않도록
브라우저에서 1024px JPEG 로 줄여 보낸다 — 업로드가 1/10 이 된다.

껍데기가 `GEMINI_API_KEY` 를 주입한다. 툴은 `process.env` 도 `$env/*` 도 읽지 않는다.

```ts
// 껍데기의 src/routes/api/receipt-renamer/extract/+server.ts
import { env } from '$env/dynamic/private';
import { handleExtract } from '$tools/receipt-renamer/server';

export const POST = ({ request }) => handleExtract(request, { apiKey: env.GEMINI_API_KEY });
```

## 모델 선택 — 실측으로 정했다

`fixtures/golden.json` 의 영수증 8장을 사람이 직접 읽어 정답을 매겨 두고 `pnpm bench` 로 잰다.

| 모델 · thinking                   | 전부 맞은 장                | 생각 토큰 | 평균 지연 | 장당 비용 |
| --------------------------------- | --------------------------- | --------- | --------- | --------- |
| `gemini-3.1-flash-lite` · minimal | **8/8**                     | 0         | 7.8초     | 약 1원    |
| `gemini-3.1-flash-lite` · low     | 7/8                         | 818       | 8.7초     | 약 1원    |
| `gemini-3.6-flash`                | 무료 티어에서 **측정 불가** |           |           |           |

**주력이 lite 인 이유는 정확도가 아니라 무료 티어의 일일 한도다.**
`gemini-3.6-flash` 는 `GenerateRequestsPerDayPerProjectPerModel-FreeTier = 20/일` 이라
영수증 한 묶음에 하루치가 끝난다. 큰 모델은 lite 가 실패했을 때만 쓰는 예비로 돌렸다.

생각(thinking)을 더 시켜도 나아지지 않았다. 영수증 필드 읽기는 추론이 아니라 판독이다.
`thinkingBudget` 은 2.5 세대의 파라미터이며 **3.x 에 쓰면 400 을 돌려준다** — 올바른
경로는 `generationConfig.thinkingConfig.thinkingLevel` 이다.

> 무료 티어는 프롬프트와 응답이 구글의 제품 개선에 쓰인다(유료 티어는 아니다).
> 영수증에는 상호·카드 뒷자리·금액이 들어 있다. 이 툴은 그 조건을 알고 무료로 쓴다.

### 골든셋

실제 영수증이라 **이미지는 커밋하지 않는다.** `fixtures/golden.json`(정답지)만 git 에 있고
이미지는 `fixtures/receipts/`(무시됨)에 둔다. 벤치를 돌리려면:

```bash
cp <영수증들> fixtures/receipts/
python3 -c "…"           # 1024px JPEG 로 줄여 fixtures/prepared/ 에 넣는다
pnpm bench --model=gemini-3.1-flash-lite --thinking=minimal
```

정답지에는 각 장의 **함정**이 적혀 있다 — 잘린 가맹점명, 금액 없는 승차권, 영수증번호가
날짜처럼 생긴 건, 같은 거래의 두 문서(파일명 충돌), 사람이 붙인 원본 이름이 틀렸던 건.

## 실패 체크리스트 (@failure-checklist-first)

자동 테스트로 옮긴 것 — `pnpm test` (58개).

- [x] ZIP 안 파일 수 == 입력 수, 원본 바이트 그대로 (재인코딩 없음)
- [x] 같은 거래의 두 문서가 같은 이름이 되어도 서로 덮지 않는다 (`(2)` 로 갈라짐)
- [x] 금액 없는 문서는 `null` 이지 `0` 이 아니다 — 파일명에 `0원` 이 붙지 않는다
- [x] 규칙이 아무것도 못 채워도 빈 파일명을 만들지 않는다 (원본 이름으로 폴백)
- [x] 파일명에 `\ / : * ? " < > |` 가 들어가지 않는다. 한글·공백은 허용
- [x] 저장된 규칙이 깨져 있어도 규칙 전체를 잃지 않는다 (기본값으로 되돌림)
- [x] 내보낸 규칙 JSON 을 다시 읽으면 같은 규칙이다. id 가 겹쳐도 기존 것을 덮지 않는다
- [x] 동시 실행이 정해진 수를 넘지 않고, 429 에는 점점 더 오래 기다렸다 다시 간다
- [x] 손상된 한 건이 나머지를 실패시키지 않는다 (그 줄만 오류)
- [x] 첫 조각을 **맨 뒤**로, 마지막 조각을 맨 앞으로 옮길 수 있다 (틈 n 도달)
- [x] 제자리 틈·범위 밖이면 같은 객체를 돌려준다 (순서·번호 불변)
- [x] 어떤 조합에서도 조각을 잃거나 복제하지 않는다
- [x] 키보드로 한 칸씩 민 결과가 드래그 한 번과 같다

브라우저에서 실제로 확인한 것 — 영수증 8장:

- [x] 8장 전부 정확히 읽고, ZIP 안 8개가 원본과 바이트 단위로 일치
- [x] 승차권 두 장이 같은 이름 → `…전북고속.jpg` 와 `…전북고속 (2).jpg` 로 갈라짐
- [x] **규칙을 바꿨을 때 API 호출 0건**, 이름만 즉시 다시 조립됨
- [x] 콘솔 오류 0건, 420px 폭에서 가로 스크롤 없음
- [x] 드래그 중 삽입 막대가 **정확히 하나**, 제자리에서는 꺼진다
- [x] ESC 로 취소하면 순서가 그대로, `Alt+←/→` 로 옮겨도 포커스가 유지된다
- [x] **터치로도** 순서가 바뀐다
- [x] 파일이 들어오면 음각이 드롭존에서 규칙 구역으로 옮겨 간다

## 구조

```
src/
├── index.ts        manifest + App 만 export
├── manifest.ts     serverRoutes: ['extract']
├── types.ts        필드와 규칙의 타입
├── receipt.ts      모델 응답을 믿을 수 있는 모양으로 (순수)
├── naming.ts       토큰 조립·서식·중복 해소 (순수)
├── rules.ts        규칙 아카이브·저장·내보내기/가져오기 (순수)
├── queue.ts        동시 실행 제한·지수 백오프 (순수)
├── prepare.ts      브라우저 축소 / PDF 1쪽 래스터
├── state.svelte.ts 화면 상태 + 내용 해시 캐시
├── server/         Gemini 호출. env 를 주입받는다
└── ui/theme.css    계약 토큰 + 간격 사다리
app/                단독 배포 껍데기. 동작은 없다
```

## 명령

```bash
pnpm test     # 순수 로직 (node)
pnpm check    # 타입
pnpm bench    # 골든셋 정확도 (네트워크·키 필요)
pnpm dev      # 단독으로 띄우기
```

렌더 이후 검사(`skill:ui-probe`)는 개발 서버를 띄운 뒤 playwright 가 있는 repo 에서 돈다.
컨트롤 대부분이 파일이 들어온 뒤에야 나타나므로 시나리오를 함께 준다.

```bash
node ../.agents/skills/ui-probe/scripts/ui_probe.mjs \
  --base http://localhost:5183 --no-crawl --routes / \
  --scenario <이 repo>/ui-probe.scenario.mjs
```

남는 경고 둘은 의도한 것이고 근거가 소스에 적혀 있다 — `<button>` 네 종류(탭·주 행동·
아이콘·규칙 카드)는 같은 컨트롤의 변형이 아니라 서로 다른 종류이고, 체크박스는 16px 이되
클릭 대상은 감싼 라벨이다.
