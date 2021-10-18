/* eslint-disable no-sync */
/* eslint-disable @typescript-eslint/no-explicit-any */
import fs from 'fs';
import path from 'path';

import Bluebird from 'bluebird';
import yaml from 'js-yaml';
import { Literal, Record, Runtype, Static } from 'runtypes';
import { LiteralBase } from 'runtypes/lib/types/literal';
import debug from 'debug';

import { deepMerge, MergeOpts } from './util';

export const DEFAULT_PREFIX = 'CONFIG_';
export const DEFAULT_SEPARATOR = '__';

const log = debug('tconf');
const logEnv = log.extend('env');

export type DeepPartial<T> = {
	[P in keyof T]?: T[P] extends (infer U)[]
		? DeepPartial<U>[]
		: T[P] extends ReadonlyArray<infer U>
		? ReadonlyArray<DeepPartial<U>>
		: DeepPartial<T[P]>;
};

export type ConfigFormat = 'yaml' | 'json';

export interface GetConfigOpts<T extends Runtype | unknown> {
	/** Format of configuration files.  Defaults to 'yaml'. */
	format?: ConfigFormat;
	/** path to config directories */
	path: string | string[];
	/** Runtype object that defines the specification for the configuration. */
	schema?: T;
	/** Prefix used to name environment variables.  Default is 'CONFIG_' */
	envPrefix?: string;
	/** object path separator key.  Default is '__'. */
	envSeparator?: string;
	/** manually inject defaults */
	defaults?: T extends Runtype ? DeepPartial<Static<T>> : any;
	/**
	 * override the list of sources to read configuration from.
	 * Special tokens:
	 *   - `ENV`: read from process.env
	 *   - `NODE_ENV`: read from a file matching the basename as process.env.NODE_ENV
	 */
	sources?: string[];
	mergeOpts?: MergeOpts;
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
	return (Record(
		u.alternatives.reduce(
			(acc, k) => ({
				...acc,
				[k.value]: t,
			}),
			{}
		)
	) as unknown) as Record<{ [key in Static<typeof u>]: V }, false>;
}

export class ConfigurationError extends Error {}

interface FileParser {
	(text: string): any;
}
const yamlParser: FileParser = (text: string): any => yaml.load(text);
const jsonParser: FileParser = (text: string): any => JSON.parse(text);

function isRuntype(obj?: any): obj is Runtype {
	return !!(obj?.tag && obj?.reflect);
}

function getValueType(keyPath: string[], obj: any): Runtype | undefined {
	if (!obj) {
		return undefined;
	}
	if (obj.tag === 'intersect') {
		for (let i = 0; i < obj.intersectees.length; i += 1) {
			const intersectee = obj.intersectees[i];
			const valueType = getValueType(keyPath, intersectee);
			if (valueType) {
				return valueType;
			}
		}
		return undefined;
	}
	if (keyPath.length === 1) {
		const valueType = obj.fields?.[keyPath[0]];
		if (!valueType) {
			logEnv(`did not find a type definition for ${keyPath[0]}`);
			return undefined;
		}
		return valueType as Runtype;
	}
	if (obj.fields) {
		const [prop, ...remaining] = keyPath;
		return getValueType(remaining, obj.fields[prop]);
	}
	logEnv(`did not find a type definition for ${keyPath.join('.')}`);
	return undefined;
}

function coerce(envVar: string, value: string, valueType: Runtype | LiteralBase): any {
	if (isRuntype(valueType)) {
		if (valueType.reflect.tag === 'instanceof') {
			const typeName = (valueType as any).ctor?.name;
			switch (typeName) {
				case 'Date':
					return new Date(value);
				case 'RegExp':
					return new RegExp(value);
				default:
					logEnv(`Unable to coerce value from env var "${envVar}" as type ${typeName}`);
					return undefined;
			}
		}
		if (valueType.reflect.tag === 'literal') {
			const coercedLiteralValue = coerce(envVar, value, valueType.reflect.value);
			if (coercedLiteralValue === valueType.reflect.value) {
				return coercedLiteralValue;
			}
			logEnv(
				`env var value for "${envVar}" does not match literal value "${valueType.reflect.value}"`
			);
			return undefined;
		}
		if (valueType.reflect.tag === 'union') {
			const { alternatives } = valueType.reflect;
			for (let i = 0; i < alternatives.length; i += 1) {
				const unionValue = coerce(envVar, value, alternatives[i]);
				if (unionValue !== undefined) {
					return unionValue;
				}
				logEnv(`unable to coerce value from env var "${envVar}" to allowed values`);
			}
			return undefined;
		}
		switch (valueType.reflect.tag) {
			case 'number':
				return parseInt(value, 10);
			case 'boolean':
				return value.toLowerCase() === 'true';
			case 'string':
				return value;
			default:
				logEnv(`unable to coerce value from env var "${envVar}" as type ${valueType.reflect.tag}`);
				return undefined;
		}
	}
	switch (typeof valueType) {
		case 'number':
			return parseInt(value, 10);
		case 'boolean':
			return value.toLowerCase() === 'true';
		case 'string':
			return value;
		default:
			logEnv(`unable to coerce value from env var "${envVar}" as type ${typeof valueType}`);
			return undefined;
	}
}

function getEnvConfig(
	prefix: string,
	separator: string,
	spec?: Runtype,
	mergeOpts?: MergeOpts
): any {
	log('inspecting environment variables');
	const entries = Object.entries(process.env).filter(([k]) => k.startsWith(prefix));
	return entries.reduce((accum, [k, v]) => {
		if (!v) {
			logEnv(`"${k}" has no value`);
			return accum;
		}
		logEnv(`processing env var "${k}"`);
		const keyPath = k.substr(prefix.length).split(separator);
		let value = v;
		if (spec) {
			logEnv(`retrieving type information from ${keyPath.join('.')}`);
			const valueType = getValueType(keyPath, spec);
			if (!valueType) {
				return accum;
			}
			logEnv(`coercing value to ${(valueType as Runtype).reflect?.tag || valueType}`);
			value = coerce(k, v, valueType);
		}

		if (value === undefined) {
			return accum;
		}

		const envConfig = keyPath.reverse().reduce((obj: { [_: string]: any }, prop, idx) => {
			if (idx === 0) {
				return {
					[prop]: value,
				};
			}
			return {
				...accum,
				[prop]: obj,
			};
		}, {});

		return deepMerge([accum, envConfig], mergeOpts);
	}, {});
}

function readEnvConfig(opts: GetConfigOpts<Runtype | unknown>, schema?: Runtype): any {
	return getEnvConfig(
		opts.envPrefix ?? DEFAULT_PREFIX,
		opts.envSeparator ?? DEFAULT_SEPARATOR,
		schema,
		opts?.mergeOpts
	);
}

async function readConfig(
	filePath: string,
	parser: FileParser,
	sync?: boolean
): typeof sync extends true ? any : Promise<any> {
	if (!fs.existsSync(filePath)) {
		log(`config file ${filePath} not found`);
		return {};
	}
	log('parsing config', filePath);
	let data;
	try {
		const contents = await fs.promises.readFile(filePath, { encoding: 'utf-8' });
		data = parser(contents);
	} catch (e) {
		log(`error parsing configuration file ${filePath}`, e);
		throw new ConfigurationError(
			`Error while parsing configuration file ${filePath}: ${e.message}`
		);
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new ConfigurationError(
			`Invalid configuration from ${filePath}. Configuration should be an object.`
		);
	}
	return data;
}

function readConfigSync(filePath: string, parser: FileParser): any {
	if (!fs.existsSync(filePath)) {
		log(`config file ${filePath} not found`);
		return {};
	}
	log('parsing config', filePath);
	let data;
	try {
		const contents = fs.readFileSync(filePath, { encoding: 'utf-8' });
		data = parser(contents);
	} catch (e) {
		log(`error parsing configuration file ${filePath}`, e);
		throw new ConfigurationError(
			`Error while parsing configuration file ${filePath}: ${e.message}`
		);
	}
	if (typeof data !== 'object' || data === null || Array.isArray(data)) {
		throw new ConfigurationError(
			`Invalid configuration from ${filePath}. Configuration should be an object.`
		);
	}
	return data;
}

function getBaseNames(filePriority: string[]): string[] {
	return filePriority.reduce((accum: string[], name) => {
		if (name === 'NODE_ENV' && process.env.NODE_ENV) {
			accum.push(process.env.NODE_ENV);
		} else {
			accum.push(name);
		}
		return accum;
	}, []);
}

function mergeAndCheck<T extends Runtype | unknown>(
	defaults: any,
	configs: any[],
	schema?: Runtype,
	opts?: MergeOpts
): T extends Runtype ? Static<T> : any {
	const config = deepMerge([defaults, ...configs], opts);

	if (schema) {
		schema.check(config);
	}

	return config;
}

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
function getInfo<T extends Runtype | unknown>(opts: GetConfigOpts<T>) {
	const baseDirs = Array.isArray(opts.path) ? opts.path : [opts.path];
	if (!baseDirs.length) {
		throw new Error('At least one path value must be specified');
	}

	const defaults = opts.defaults ?? {};
	const schema = isRuntype(opts.schema) ? opts.schema : undefined;

	const format = opts.format ? opts.format : 'yaml';
	const [fileExt, parser] = format === 'yaml' ? ['yaml', yamlParser] : ['json', jsonParser];

	const baseNames = getBaseNames(opts.sources ?? ['default', 'NODE_ENV', 'ENV', 'local']);
	log(`loading files from ${baseDirs.map((d) => `${d}/`).join(',')}: ${baseNames.join(', ')}`);
	return {
		baseDirs,
		baseNames,
		defaults,
		fileExt,
		parser,
		schema,
	};
}

export default async function load<T extends Runtype | unknown>(
	opts: GetConfigOpts<T>
): Promise<T extends Runtype ? Static<T> : any> {
	const { baseDirs, baseNames, defaults, fileExt, parser, schema } = getInfo(opts);

	const configs = await Bluebird.reduce(
		baseNames,
		async (accum: any[], sourceName) => {
			if (sourceName === 'ENV') {
				accum.push(readEnvConfig(opts, schema));
				return accum;
			}

			await Bluebird.each(baseDirs, async (dir) =>
				accum.push(await readConfig(path.join(dir, `${sourceName}.${fileExt}`), parser))
			);

			return accum;
		},
		[]
	);

	return mergeAndCheck(defaults, configs, schema, opts.mergeOpts);
}

export function loadSync<T extends Runtype | unknown>(
	opts: GetConfigOpts<T>
): T extends Runtype ? Static<T> : any {
	const { baseDirs, baseNames, defaults, fileExt, parser, schema } = getInfo(opts);

	const configs = baseNames.reduce((accum: any[], sourceName) => {
		if (sourceName === 'ENV') {
			accum.push(readEnvConfig(opts, schema));
			return accum;
		}

		baseDirs.forEach((dir) => {
			accum.push(readConfigSync(path.join(dir, `${sourceName}.${fileExt}`), parser));
		});

		return accum;
	}, []);

	return mergeAndCheck(defaults, configs, schema, opts.mergeOpts);
}
