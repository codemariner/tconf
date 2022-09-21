import { Literal, Record, Runtype, Static } from 'runtypes';

import { Formats } from './parsers';
import { MergeOpts } from './util';

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

interface Warning {
	source: string;
	path: string;
	message: string;
}
interface WarningHandler {
	(warning: Warning): unknown;
}

export interface GetConfigOpts<Schema extends Runtype | undefined = Runtype> {
	/** Format of configuration files.  Defaults to 'yaml'. */
	format?: ConfigFormat;
	/** path to config directories */
	path: string | string[];
	/** Runtype object that defines the specification for the configuration. */
	schema?: Schema;
	/** Prefix used to name environment variables.  Default is 'CONFIG_' */
	envPrefix?: string;
	/** object path separator key.  Default is '__'. */
	envSeparator?: string;
	/** manually inject defaults */
	defaults?: Schema extends Runtype ? DeepPartial<Static<Schema>> : any;
	/**
	 * override the list of sources to read configuration from.
	 * Special tokens:
	 *   - `ENV`: read from process.env
	 *   - `NODE_ENV`: read from a file matching the basename as process.env.NODE_ENV
	 */
	sources?: string[];
	mergeOpts?: MergeOpts;
	warnings?: WarningHandler;
}

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
