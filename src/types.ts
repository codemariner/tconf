import { z } from 'zod';

import { Formats } from './parsers.js';

export type Maybe<T> = T | undefined;

/* eslint-disable @typescript-eslint/no-explicit-any */
export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends ReadonlyArray<infer U>
		? ReadonlyArray<DeepPartial<U>>
		: DeepPartial<T[P]>;
};

export type ConfigFormat = Formats;

// Type alias for zod schemas
export type ZodSchema = z.ZodTypeAny;

// Helper to infer type from zod schema (equivalent to runtypes Static<>)
export type InferSchema<T extends ZodSchema> = z.infer<T>;

/**
 * Supports enumerated keys for records like:
 *
 * ```
 * const SiteId = z.enum(['US', 'CA']);
 *
 * const SiteOption = z.object({
 *   url: z.string(),
 * });
 *
 * const SiteConfig = EnumRecord(SiteId, SiteOption);
 * ```
 *
 * ```
 * sites:
 *   US:
 *     url: 'http://us.site.com'
 *   CA:
 *     url: 'http://ca.site.com'
 * ```
 *
 * @param enumSchema - zod enum schema
 * @param valueSchema - zod schema for the values
 */
export function EnumRecord<
	T extends z.ZodEnum<[string, ...string[]]>,
	V extends ZodSchema
>(
	enumSchema: T,
	valueSchema: V
): z.ZodObject<Record<z.infer<T>, V>> {
	const keys = enumSchema.options as string[];
	const shape = keys.reduce((acc, key) => {
		acc[key] = valueSchema;
		return acc;
	}, {} as Record<string, V>);

	return z.object(shape) as z.ZodObject<Record<z.infer<T>, V>>;
}
