import { Literal, Record, Runtype, Static } from 'runtypes';

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

export interface EnumUnion extends Runtype<string> {
	alternatives: Literal<string>[];
}

/**
 * Supports enumerated keys for records like:
 *
 * ```
 * const SiteId = Union(
 *   Literal('US'),
 *   Literal('CA')
 * );
 *
 * const SiteOption = Record({
 *   url: String,
 * });
 *
 * const SiteConfig = Record({
 *   sites: EnumRecord(SiteId, SiteOption),
 * });
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
 * @param u
 * @param t
 */
export function EnumRecord<U extends EnumUnion, V extends Runtype>(
	u: U,
	t: V
): Record<{ [key in Static<typeof u>]: V }, false> {
	return Record(
		u.alternatives.reduce(
			(acc, k) => ({
				...acc,
				[k.value]: t,
			}),
			{}
		)
	) as unknown as Record<{ [key in Static<typeof u>]: V }, false>;
}
