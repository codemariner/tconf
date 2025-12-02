module.exports = {
	env: {
		node: true,
	},
	globals: {
		// Vitest globals
		describe: 'readonly',
		it: 'readonly',
		expect: 'readonly',
		beforeEach: 'readonly',
		afterEach: 'readonly',
		beforeAll: 'readonly',
		afterAll: 'readonly',
		vi: 'readonly',
	},
	rules: {
		// ts overrides to be a little looser in tests
		'@typescript-eslint/no-non-null-assertion': ['off'],
		'@typescript-eslint/explicit-function-return-type': ['off'],
		'@typescript-eslint/explicit-member-accessibility': ['off'],
		'@typescript-eslint/no-explicit-any': ['off'],
		'@typescript-eslint/no-object-literal-type-assertion': ['off'],
	},
};
