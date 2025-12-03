/**
 * Zod extensions for tconf
 * Custom schema types that aren't in Zod core
 */

import { z } from 'zod';

// brand type for RegExp schemas so we can identify them during coercion
export const REGEXP_BRAND = Symbol('tconf_regexp');

// brand type for URL schemas so we can identify them during coercion
export const URL_BRAND = Symbol('tconf_url');

export function regexp(): z.ZodCustom<RegExp> {
	const schema = z.custom<RegExp>((val) => val instanceof RegExp, {
		message: 'Expected RegExp',
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[REGEXP_BRAND] = true;

	return schema;
}

export function url(): z.ZodCustom<URL> {
	const schema = z.custom<URL>((val) => val instanceof URL, {
		message: 'Expected URL',
	});

	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[URL_BRAND] = true;

	return schema;
}

export type ZodRegExp = ReturnType<typeof regexp>;

export type ZodURL = ReturnType<typeof url>;
