import { defineConfig } from 'vitest/config';

/**
 * 툴 패키지는 자기 테스트 설정을 직접 갖는다.
 *
 * 이게 없으면 vitest 가 상위 디렉토리를 훑어 껍데기(toolbox)의 vite.config.ts 를
 * 집어온다. 툴은 submodule 로 껍데기 안에 놓이므로, 단독 체크아웃에서는 통과하고
 * packages/ 아래에서는 깨지는 상황이 생긴다. 어디에 놓이든 같아야 한다.
 */
export default defineConfig({
	test: {
		root: import.meta.dirname,
		include: ['src/**/*.spec.ts'],
		environment: 'node'
	}
});
