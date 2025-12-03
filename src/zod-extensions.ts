/**
 * Zod extensions for tconf
 * Custom schema types that aren't in Zod core
 */

import { z } from 'zod';

// brand type for RegExp schemas so we can identify them during coercion
export const REGEXP_BRAND = Symbol('tconf_regexp');

// brand type for URL schemas so we can identify them during coercion
export const URL_BRAND = Symbol('tconf_url');

/**
 * Validates RegExp objects (not regex patterns as strings)
 * For string patterns, use z.string().regex()
 */
export function regexObj(): z.ZodCustom<RegExp> {
	const schema = z.custom<RegExp>((val) => val instanceof RegExp, {
		message: 'Expected RegExp',
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[REGEXP_BRAND] = true;

	return schema;
}

/**
 * Validates URL objects (not URL strings)
 * For URL strings, use z.string().url()
 */
export function urlObj(): z.ZodCustom<URL> {
	const schema = z.custom<URL>((val) => val instanceof URL, {
		message: 'Expected URL',
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[URL_BRAND] = true;

	return schema;
}

export type ZodRegexObj = ReturnType<typeof regexObj>;

export type ZodURLObj = ReturnType<typeof urlObj>;
