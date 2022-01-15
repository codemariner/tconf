/* eslint-disable @typescript-eslint/no-explicit-any */
import path from 'path';

import { Runtype, Static } from 'runtypes';

import log from './log';
import { deepMerge, isRuntype } from './util';
import { getEnvConfig, interpolateEnv } from './env';
import { jsonParser, readConfigSync, yamlParser } from './file';
import { GetConfigOpts } from './types';

export const DEFAULT_PREFIX = 'CONFIG_';
export const DEFAULT_SEPARATOR = '__';

export * from './types';

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

export default function load<T extends Runtype | unknown>(
	opts: GetConfigOpts<T>
): T extends Runtype ? Static<T> : any {
	const { baseDirs, baseNames, defaults, fileExt, parser, schema } = getInfo(opts);

	const configs = baseNames.reduce((accum: any[], sourceName) => {
		if (sourceName === 'ENV') {
			const prefix = opts.envPrefix ?? DEFAULT_PREFIX;
			const sep = opts.envSeparator ?? DEFAULT_SEPARATOR;
			const envConfig = getEnvConfig(prefix, sep, schema, opts?.mergeOpts);
			accum.push(envConfig);
			return accum;
		}

		baseDirs.forEach((dir) => {
			const rawConfig = readConfigSync(path.join(dir, `${sourceName}.${fileExt}`), parser);
			accum.push(interpolateEnv(rawConfig, schema));
		});

		return accum;
	}, []);

	const config = deepMerge([defaults, ...configs], opts.mergeOpts);

	if (schema) {
		schema.check(config);
	}

	return config;
}
