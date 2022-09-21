/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

import { Runtype, Static } from 'runtypes';

import log from './log';
import { deepMerge } from './util';
import { EnvOpts, getEnvConfig, interpolateEnv } from './env';
import { readConfigSync } from './file';
import { GetConfigOpts } from './types';
import { getParser } from './parsers';

export { DEFAULT_PREFIX, DEFAULT_SEPARATOR } from './env';
export * from './types';

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


function getSourceDirectories(opts:Pick<GetConfigOpts, 'path'>):string[] {
    if (!opts.path?.length) {
        throw new Error('At least one path value must be specified')
    }
	return Array.isArray(opts.path) ? opts.path : [opts.path];
}

function getConfigFromEnv(opts:GetConfigOpts<Runtype | undefined>):any {
	const envOpts: EnvOpts = {
		envPrefix: opts.envPrefix,
		envSeparator: opts.envSeparator,
		mergeOpts: opts.mergeOpts,
        schema: opts.schema
	};
	const result = getEnvConfig(envOpts);
    return result;
}


export default function load<Schema extends Runtype | undefined>(
	opts: GetConfigOpts<Schema>
): Schema extends Runtype ? Static<Schema> : any {
    const {
        format = 'yaml',
        schema
    } = opts;

    const directories = getSourceDirectories(opts)

	const sourceNames = getSourceNames(opts.sources ?? ['default', 'NODE_ENV', 'ENV', 'local']);
	log(`loading files from ${directories.map((d) => `${d}/`).join(',')}: ${sourceNames.join(', ')}`);

    const parser = getParser(format);

    const configs = sourceNames.flatMap((sourceName) => {
		if (sourceName === 'ENV') {
            return getConfigFromEnv(opts);
		}
		return directories.map((dir) => {
			const rawConfig = readConfigSync(path.join(dir, `${sourceName}.${format}`), parser);
			return interpolateEnv(rawConfig, schema);
		});
    })

    const defaults = opts.defaults ? interpolateEnv(opts.defaults, schema) : {};

	const config = deepMerge([defaults, ...configs], opts.mergeOpts);

	if (schema) {
		schema.check(config);
	}

	return config;
}
