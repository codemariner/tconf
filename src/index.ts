/* eslint-disable @typescript-eslint/no-explicit-any */

import { Record, Runtype, Static } from 'runtypes';

import load, { LoadConfigOpts } from './load-config';
import { DeepPartial } from './types';

export { DEFAULT_PREFIX, DEFAULT_SEPARATOR } from './env';
export * from './types';

export type TconfOpts<Schema extends Runtype> = Pick<
	LoadConfigOpts,
	'envPrefix' | 'envSeparator' | 'format' | 'mergeOpts' | 'path' | 'sources'
> & {
	schema?: Schema;
	defaults?: DeepPartial<Static<Schema>>;
};

export class Tconf<T extends Runtype> {
	private opts: TconfOpts<T>;

	private config: Static<T> = {};

	private registry: Map<string, Runtype> = new Map();

	private schema: Runtype;

	// eslint-disable-next-line no-useless-constructor
	constructor(opts: TconfOpts<T>) {
		this.opts = opts;
		this.schema = opts.schema ?? Record({});
		this.config = load({
			...opts,
			defaults: opts.defaults as any,
		});
	}

	/**
	 * Register a named configuration, validate, and return it. This will reload all configuration.
	 */
	register<Schema extends Runtype>(name: string, schema: Schema): Static<Schema> {
		if (this.registry.has(name)) {
			throw new Error(`Configuration for ${name} has already been registered`);
		}

		const moduleSchema = Record({
			[name]: schema,
		});

		this.schema = this.schema.And(moduleSchema);

		this.config = load({
			...this.opts,
			schema: this.schema,
		});

		this.registry.set(name, schema);

		// `load` will validate the schema and return the expected type
		return (this.config as any)[name];
	}

	/**
	 * Returns the entirtey of loaded configuration.
	 */
	get(): Static<T> {
		return this.config;
	}
}

/**
 * Initializes a common instance of tconf with the given options.
 */
export function initialize<T extends Runtype>(opts: TconfOpts<T>): Tconf<T> {
	return new Tconf(opts);
}
