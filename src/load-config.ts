/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

import { Runtype, Static } from 'runtypes';

import log from './log';
import { deepMerge, MergeOpts } from './util';
import { EnvOpts, getEnvConfig, interpolateEnv } from './env';
import { readConfigSync } from './file';
import { ConfigFormat, DeepPartial } from './types';
import { getParser } from './parsers';

export interface LoadConfigOpts<Schema extends Runtype | undefined = Runtype> {
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

function getConfigFromEnv(opts: LoadConfigOpts<Runtype | undefined>): any {
	const envOpts: EnvOpts = {
		envPrefix: opts.envPrefix,
		envSeparator: opts.envSeparator,
		mergeOpts: opts.mergeOpts,
		schema: opts.schema,
	};
	const result = getEnvConfig(envOpts);
	return result;
}

export default function load<Schema extends Runtype | undefined>(
	opts: LoadConfigOpts<Schema>
): Schema extends Runtype ? Static<Schema> : any {
	const { format = 'yaml', schema } = opts;

	const directories = getSourceDirectories(opts);

	const sourceNames = getSourceNames(opts.sources ?? ['default', 'NODE_ENV', 'ENV', 'local']);
	log(`loading files from ${directories.map((d) => `${d}/`).join(',')}: ${sourceNames.join(', ')}`);

	const parser = getParser(format);

	const configs = sourceNames.flatMap((sourceName) => {
		log(`processing source ${sourceName}`);
		if (sourceName === 'ENV') {
			return getConfigFromEnv(opts);
		}
		return directories.map((dir) => {
			const rawConfig = readConfigSync(path.join(dir, `${sourceName}.${format}`), parser);
			return interpolateEnv(rawConfig, schema);
		});
	});

	const defaults = opts.defaults ? interpolateEnv(opts.defaults, schema) : {};

	const config = deepMerge([defaults, ...configs], opts.mergeOpts);

	if (schema) {
		schema.check(config);
	}

	return config;
}
