/* eslint-disable @typescript-eslint/no-explicit-any */

import { z } from 'zod';

import load, { LoadConfigOpts, loadRawConfig } from './load-config.js';
import { DeepPartial } from './types.js';

export { DEFAULT_PREFIX, DEFAULT_SEPARATOR } from './env.js';
export * from './types.js';

export type TconfOpts<Schema extends z.ZodTypeAny> = Pick<
	LoadConfigOpts,
	'envPrefix' | 'envSeparator' | 'format' | 'mergeOpts' | 'path' | 'sources'
> & {
	schema?: Schema;
	defaults?: DeepPartial<z.infer<Schema>>;
};

export class Tconf<T extends z.ZodTypeAny> {
	private config: z.infer<T>;

	private registry: Map<string, z.ZodTypeAny> = new Map();

	private schema: z.ZodTypeAny;

	private rawConfig: any; // Cache raw unvalidated config

	constructor(opts: TconfOpts<T>) {
		this.schema = opts.schema ?? z.object({});
		// Load files once and cache raw config
		this.rawConfig = loadRawConfig({
			...opts,
			defaults: opts.defaults as any,
		});
		// Validate with initial schema
		this.config = load({
			...opts,
			defaults: opts.defaults as any,
		}) as z.infer<T>;
	}

	/**
	 * Register a named configuration, validate, and return it.
	 * This will re-validate cached configuration with expanded schema (no file I/O).
	 */
	register<Schema extends z.ZodTypeAny>(name: string, schema: Schema): z.infer<Schema> {
		if (this.registry.has(name)) {
			throw new Error(`Configuration for ${name} has already been registered`);
		}

		const moduleSchema = z.object({
			[name]: schema,
		});

		// Use z.intersection to merge schemas
		this.schema = z.intersection(this.schema as z.ZodObject<any>, moduleSchema);

		// Re-validate cached config with expanded schema (no file I/O!)
		this.config = this.schema.parse(this.rawConfig) as z.infer<T>;

		this.registry.set(name, schema);

		// `parse` will validate the schema and return the expected type
		return (this.config as any)[name];
	}

	/**
	 * Returns the entirety of loaded configuration.
	 */
	get(): z.infer<T> {
		return this.config;
	}
}

/**
 * Initializes a common instance of tconf with the given options.
 */
export function initialize<T extends z.ZodTypeAny>(opts: TconfOpts<T>): Tconf<T> {
	return new Tconf(opts);
}
