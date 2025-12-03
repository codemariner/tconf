import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import importPlugin from 'eslint-plugin-import';
import vitestPlugin from 'eslint-plugin-vitest';
import vitestGlobalsPlugin from 'eslint-plugin-vitest-globals';
import prettierConfig from 'eslint-config-prettier';
import globals from 'globals';

export default [
	// Ignore patterns (replaces .eslintignore)
	{
		ignores: ['dist/**', 'coverage/**', 'node_modules/**'],
	},

	// Base config for all files
	{
		files: ['**/*.{js,mjs,cjs,ts}'],
		languageOptions: {
			ecmaVersion: 2022,
			sourceType: 'module',
			globals: {
				...globals.node,
				...globals.es2021,
			},
		},
		plugins: {
			'@typescript-eslint': tseslint.plugin,
			import: importPlugin,
		},
		settings: {
			'import/resolver': {
				typescript: {
					alwaysTryTypes: true,
					project: './tsconfig.json',
				},
				node: {
					extensions: ['.js', '.jsx', '.ts', '.tsx'],
				},
			},
		},
		rules: {
			...js.configs.recommended.rules,
			...importPlugin.configs.recommended.rules,
			...importPlugin.configs.typescript.rules,

			// ESM requires .js extensions in imports, even for .ts files
			'import/extensions': [
				'error',
				'ignorePackages',
				{
					js: 'always',
					mjs: 'always',
					jsx: 'never',
					ts: 'never',
					tsx: 'never',
				},
			],
			'import/no-extraneous-dependencies': [
				'error',
				{
					devDependencies: [
						'test/**',
						'**/*.test.ts',
						'**/*.spec.ts',
						'vitest.config.ts',
						'eslint.config.js',
						'@(dev|test)/**',
					],
				},
			],
			'import/prefer-default-export': 'off',
			'import/no-cycle': 'off',
			'import/order': ['error', { 'newlines-between': 'always' }],

			// General rules
			'no-constant-condition': 'error',
			'no-debugger': 'error',
			'no-eq-null': 'error',
			'no-extra-boolean-cast': 'error',
			'no-label-var': 'error',
			'no-path-concat': 'error',
			'no-process-exit': 'error',
			'no-undef-init': 'error',
			'no-underscore-dangle': [
				'error',
				{
					allowAfterThis: true,
					allow: [
						'__html',
						'__PRELOADED_STATE__',
						'__Rewire__',
						'__ResetDependency__',
						'__reset__',
						'_embedded',
						'_links',
						'_error',
						'_id',
						'__resolverType__',
						'__resolveType',
						'__resolveObject',
						'__typename',
						'_source',
						'_routing',
						'_raw',
						'_def',
						'_any',
						'__filename',
						'__dirname',
					],
				},
			],
			'no-shadow': 'off',
			'no-unused-vars': [
				'error',
				{
					vars: 'local',
					args: 'after-used',
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'max-classes-per-file': 'off',
			'consistent-return': 'off',
			'default-case': 'off',
			camelcase: 'off',
			'no-restricted-syntax': ['error', 'ForInStatement', 'LabeledStatement', 'WithStatement'],
			'no-restricted-globals': [
				'error',
				{
					name: 'isFinite',
					message:
						'Use Number.isFinite instead https://github.com/airbnb/javascript#standard-library--isfinite',
				},
			],
			'sort-imports': [
				'error',
				{
					ignoreCase: true,
					ignoreDeclarationSort: true,
					ignoreMemberSort: false,
				},
			],
			'prefer-destructuring': ['error', { object: true, array: false }],
		},
	},

	// TypeScript-specific config (with type-aware linting)
	{
		files: ['src/**/*.ts', 'test/**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './tsconfig.json',
			},
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'@typescript-eslint/no-shadow': 'error',
			'@typescript-eslint/no-explicit-any': ['warn', { ignoreRestArgs: true }],
			'@typescript-eslint/explicit-function-return-type': ['error', { allowExpressions: true }],
			'@typescript-eslint/consistent-type-definitions': ['error', 'interface'],
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					vars: 'local',
					args: 'after-used',
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
			'@typescript-eslint/naming-convention': [
				'error',
				{
					selector: 'default',
					format: ['camelCase', 'UPPER_CASE', 'PascalCase'],
					leadingUnderscore: 'allow',
				},
				{
					selector: ['property', 'parameter', 'method'],
					format: ['camelCase'],
					prefix: ['__'],
					filter: {
						regex: '^__',
						match: true,
					},
				},
				{
					selector: 'variable',
					format: null,
					filter: {
						regex: '^__(filename|dirname)$',
						match: true,
					},
				},
			],
		},
	},

	// Config files (no type-aware linting)
	{
		files: ['*.config.{js,ts,mjs,cjs}'],
		languageOptions: {
			parser: tseslint.parser,
		},
		rules: {
			...tseslint.configs.recommended.rules,
			'@typescript-eslint/no-unused-vars': [
				'error',
				{
					vars: 'local',
					args: 'after-used',
					argsIgnorePattern: '^_',
					varsIgnorePattern: '^_',
					ignoreRestSiblings: true,
				},
			],
		},
	},

	// Test files config
	{
		files: ['**/*.test.ts', '**/*.spec.ts', 'test/**/*.ts'],
		languageOptions: {
			parser: tseslint.parser,
			parserOptions: {
				project: './test/tsconfig.json',
			},
			globals: {
				...vitestPlugin.environments.env.globals,
			},
		},
		plugins: {
			vitest: vitestPlugin,
			'vitest-globals': vitestGlobalsPlugin,
		},
		rules: {
			...vitestPlugin.configs.recommended.rules,
			...vitestGlobalsPlugin.configs.recommended.rules,
			'@typescript-eslint/no-explicit-any': 'off',
		},
	},

	// Prettier must be last to override other configs
	prettierConfig,
];
