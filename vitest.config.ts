import { defineConfig } from 'vitest/config';

export default defineConfig({
	test: {
		globals: true,
		environment: 'node',
		coverage: {
			provider: 'v8',
			reporter: ['text', 'text-summary', 'html'],
			include: ['src/**/*.ts'],
			exclude: ['**/*.test.ts', '**/*.spec.ts'],
			thresholds: {
				branches: 78,
				functions: 80,
				lines: 80,
				statements: 80,
			},
		},
	},
});
