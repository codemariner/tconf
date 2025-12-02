/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

import { z } from 'zod';

import log from './log.js';
import { deepMerge, MergeOpts } from './util.js';
import { EnvOpts, getEnvConfig, interpolateEnv } from './env.js';
import { readConfigSync } from './file.js';
import { ConfigFormat, DeepPartial } from './types.js';
import { getParser } from './parsers.js';

export interface LoadConfigOpts<Schema extends z.ZodTypeAny | undefined = z.ZodTypeAny> {
	/** Format of configuration files. Defaults to 'yaml'. */
	format?: ConfigFormat;
	/** path to config directories */
	path: string | string[];
	/** Zod schema that defines the specification for the configuration. */
	schema?: Schema;
	/** Prefix used to name environment variables. Default is 'CONFIG_' */
	envPrefix?: string;
	/** object path separator key. Default is '__'. */
	envSeparator?: string;
	/** manually inject defaults */
	defaults?: Schema extends z.ZodTypeAny ? DeepPartial<z.infer<Schema>> : any;
	/**
	 * override the list of sources to read configuration from.
	 * Special tokens:
	 *   - `ENV`: read from process.env
	 *   - `NODE_ENV`: read from a file matching the basename as process.env.NODE_ENV
	 */
	sources?: string[];
	mergeOpts?: MergeOpts;
}

function getSourceNames(filePriority: string[]): string[] {
	return filePriority.reduce((accum: string[], name) => {
		if (name === 'NODE_ENV' && process.env.NODE_ENV) {
			accum.push(process.env.NODE_ENV);
		} else {
			accum.push(name);
		}
		return accum;
	}, []);
}

function getSourceDirectories(opts: Pick<LoadConfigOpts, 'path'>): string[] {
	const paths = Array.isArray(opts.path) ? opts.path : [opts.path];
	if (!paths.length) {
		throw new Error('At least one path value must be specified');
	}
	return paths;
}

function getConfigFromEnv(opts: LoadConfigOpts<z.ZodTypeAny | undefined>): any {
	const envOpts: EnvOpts = {
		envPrefix: opts.envPrefix,
		envSeparator: opts.envSeparator,
		mergeOpts: opts.mergeOpts,
		schema: opts.schema,
	};
	const result = getEnvConfig(envOpts);
	return result;
}

/**
 * Loads configuration files and merges them without validation.
 * This allows caching raw config for modular loading optimization.
 * Note: Interpolation still happens per-file before merging.
 */
export function loadRawConfig<Schema extends z.ZodTypeAny | undefined>(opts: LoadConfigOpts<Schema>): any {
	const { format = 'yaml', schema } = opts;

	const directories = getSourceDirectories(opts);

	const sourceNames = getSourceNames(opts.sources ?? ['default', 'NODE_ENV', 'ENV', 'local']);
	log(`loading files from ${directories.map((d) => `${d}/`).join(',')}: ${sourceNames.join(', ')}`);

	const parser = getParser(format);

	const configs = sourceNames.flatMap((sourceName) => {
		log(`processing source ${sourceName}`);
		if (sourceName === 'ENV') {
			return getConfigFromEnv(opts as any);
		}
		return directories.map((dir) => {
			const rawConfig = readConfigSync(path.join(dir, `${sourceName}.${format}`), parser);
			// Interpolate env vars in each config file BEFORE merging
			// This allows later layers to "delete" keys and reveal earlier layer values
			return schema ? interpolateEnv(rawConfig, schema) : rawConfig;
		});
	});

	const defaults = schema ? interpolateEnv(opts.defaults || {}, schema) : (opts.defaults || {});

	const config = deepMerge([defaults, ...configs], opts.mergeOpts);

	return config;
}

/**
 * Loads and validates configuration.
 */
export default function load<Schema extends z.ZodTypeAny | undefined>(
	opts: LoadConfigOpts<Schema>
): Schema extends z.ZodTypeAny ? z.infer<Schema> : any {
	const { schema } = opts;

	// Load raw config (interpolation happens per-file in loadRawConfig)
	const config = loadRawConfig(opts);

	// Validate with schema if provided
	if (schema) {
		return schema.parse(config) as Schema extends z.ZodTypeAny ? z.infer<Schema> : any;
	}

	return config as Schema extends z.ZodTypeAny ? z.infer<Schema> : any;
}
