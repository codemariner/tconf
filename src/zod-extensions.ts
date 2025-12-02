/**
 * Zod extensions for tconf
 * Custom schema types that aren't in Zod core
 */

import { z } from 'zod';

// Brand type for RegExp schemas so we can identify them during coercion
export const REGEXP_BRAND = Symbol('tconf_regexp');

// Brand type for URL schemas so we can identify them during coercion
export const URL_BRAND = Symbol('tconf_url');

/**
 * Helper function to create a RegExp schema
 * Usage: z.regexp()
 *
 * Note: Due to limitations with DeepPartial and complex Zod types,
 * TypeScript may not fully infer the RegExp type. Use type assertions where needed.
 * The runtime type is correctly coerced to RegExp from environment variables.
 */
export function regexp(): z.ZodCustom<RegExp> {
	const schema = z.custom<RegExp>((val) => val instanceof RegExp, {
		message: 'Expected RegExp',
	});

	// Mark this schema with our brand for runtime identification during env coercion
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[REGEXP_BRAND] = true;

	return schema;
}

/**
 * Helper function to create a URL schema
 * Usage: z.url()
 *
 * Note: Due to limitations with DeepPartial and complex Zod types,
 * TypeScript may not fully infer the URL type. Use type assertions where needed.
 * The runtime type is correctly coerced to URL from environment variables.
 */
export function url(): z.ZodCustom<URL> {
	const schema = z.custom<URL>((val) => val instanceof URL, {
		message: 'Expected URL',
	});

	// Mark this schema with our brand for runtime identification during env coercion
	// eslint-disable-next-line @typescript-eslint/no-explicit-any
	(schema as any)[URL_BRAND] = true;

	return schema;
}

/**
 * Custom RegExp schema type
 * Uses z.custom() with a brand for identification during env var coercion
 */
export type ZodRegExp = ReturnType<typeof regexp>;

/**
 * Custom URL schema type
 * Uses z.custom() with a brand for identification during env var coercion
 */
export type ZodURL = ReturnType<typeof url>;
