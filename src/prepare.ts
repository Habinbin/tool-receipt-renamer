/**
 * 드롭된 파일을 모델에 보낼 수 있는 작은 JPEG 한 장으로 만든다.
 *
 * 축소를 서버가 아니라 여기서 하는 이유:
 * - 4MB 사진을 그대로 올리면 업로드가 추출보다 오래 걸린다. 줄이면 1/10 이 된다.
 * - 서버가 이미지 라이브러리를 들 필요가 없어져, 서버 라우트가 **키를 숨기는 일만**
 *   하는 얇은 프록시가 된다 (@client-first-processing).
 *
 * 브라우저 전용이다. `onMount` 나 이벤트 핸들러 뒤에서만 부른다.
 */

/** 모델에 보내는 긴 변의 최대 픽셀. 영수증 글자는 이 크기면 충분히 읽힌다. */
const SEND_MAX = 1024;
/** 목록에 거는 썸네일. 원본을 그리면 50장에서 메모리가 무너진다. */
const THUMB_MAX = 320;
const JPEG_QUALITY = 0.8;

type PdfjsModule = typeof import('pdfjs-dist');
let pdfjsPromise: Promise<PdfjsModule> | null = null;

/** pdf.js 는 로드 시점에 브라우저 전역을 건드린다. 첫 사용 때 한 번만 들여온다. */
async function getPdfjs(): Promise<PdfjsModule> {
	if (pdfjsPromise === null) {
		pdfjsPromise = (async () => {
			const pdfjs = await import('pdfjs-dist');
			const workerUrl = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default;
			pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
			return pdfjs;
		})();
	}
	return pdfjsPromise;
}

export function isPdf(file: File): boolean {
	return file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
}

export function isImage(file: File): boolean {
	return (
		file.type.startsWith('image/') ||
		/\.(png|jpe?g|webp|gif|bmp|tiff?|heic|heif|avif)$/i.test(file.name)
	);
}

export function isSupported(file: File): boolean {
	return isPdf(file) || isImage(file);
}

/** 긴 변이 `max` 를 넘지 않는 캔버스로 옮겨 그린다. 이미 작으면 그대로 쓴다. */
function fit(source: ImageBitmap | HTMLCanvasElement, max: number): HTMLCanvasElement {
	const ratio = Math.min(1, max / Math.max(source.width, source.height));
	const canvas = document.createElement('canvas');
	canvas.width = Math.max(1, Math.round(source.width * ratio));
	canvas.height = Math.max(1, Math.round(source.height * ratio));
	const ctx = canvas.getContext('2d');
	if (ctx === null) throw new Error('캔버스를 만들 수 없습니다.');
	// 영수증은 대개 흰 바탕이다. 투명 PNG 를 JPEG 로 바꿀 때 검게 되지 않도록 깔아 둔다.
	ctx.fillStyle = '#ffffff';
	ctx.fillRect(0, 0, canvas.width, canvas.height);
	ctx.imageSmoothingQuality = 'high';
	ctx.drawImage(source, 0, 0, canvas.width, canvas.height);
	return canvas;
}

function toBase64Jpeg(canvas: HTMLCanvasElement): string {
	const url = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
	return url.slice(url.indexOf(',') + 1);
}

/** PDF 1쪽을 읽을 만한 해상도로 래스터한다. */
async function rasterizePdfFirstPage(file: File): Promise<HTMLCanvasElement> {
	const pdfjs = await getPdfjs();
	// 문서가 아니라 **로딩 작업**이 워커를 들고 있다. 정리는 이쪽에 해야 한다.
	const task = pdfjs.getDocument({ data: await file.arrayBuffer() });
	const pdf = await task.promise;
	try {
		const page = await pdf.getPage(1);
		const base = page.getViewport({ scale: 1 });
		// 먼저 보낼 크기에 맞춰 렌더한다. 크게 그렸다 줄이면 글자가 뭉갠다.
		const viewport = page.getViewport({
			scale: Math.min(4, SEND_MAX / Math.max(base.width, base.height))
		});
		const canvas = document.createElement('canvas');
		canvas.width = Math.round(viewport.width);
		canvas.height = Math.round(viewport.height);
		const ctx = canvas.getContext('2d');
		if (ctx === null) throw new Error('캔버스를 만들 수 없습니다.');
		ctx.fillStyle = '#ffffff';
		ctx.fillRect(0, 0, canvas.width, canvas.height);
		await page.render({ canvas, canvasContext: ctx, viewport }).promise;
		return canvas;
	} finally {
		// 원본 바이트와 워커를 붙들고 있으면 50장에서 메모리가 남지 않는다.
		await task.destroy();
	}
}

export interface PreparedFile {
	/** 모델에 보낼 base64 JPEG. `data:` 접두사 없음. */
	data: string;
	mimeType: 'image/jpeg';
	/** 화면 목록에 거는 작은 미리보기. data URL 이라 따로 해제할 것이 없다. */
	previewUrl: string;
	/** 보낼 이미지의 바이트 수. 사용자에게 업로드량을 보여줄 때 쓴다. */
	bytes: number;
}

/**
 * 파일 하나를 보낼 준비가 된 상태로 만든다.
 *
 * 실패하면 던진다 — 한 장이 깨졌다고 나머지가 멈추면 안 되므로, 부르는 쪽이
 * 파일마다 따로 잡아 그 줄만 오류로 표시한다 (@failure-checklist-first).
 */
export async function prepareFile(file: File): Promise<PreparedFile> {
	const full = isPdf(file)
		? await rasterizePdfFirstPage(file)
		: await createImageBitmap(file).then((bitmap) => {
				const canvas = fit(bitmap, SEND_MAX);
				bitmap.close();
				return canvas;
			});

	const data = toBase64Jpeg(full);
	const thumb = fit(full, THUMB_MAX);
	const previewUrl = thumb.toDataURL('image/jpeg', 0.7);

	return {
		data,
		mimeType: 'image/jpeg',
		previewUrl,
		// base64 는 원본 바이트의 4/3 이다.
		bytes: Math.round((data.length * 3) / 4)
	};
}
