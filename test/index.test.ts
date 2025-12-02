import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

import { z } from 'zod';

import { EnumRecord } from '../src/types.js';
import { DEFAULT_PREFIX } from '../src/env.js';
import load from '../src/load-config.js';

import spec from './fixtures/config/spec.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// for testing
class Foo {}

describe('getConfig', () => {
	beforeEach(() => {
		Object.keys(process.env).forEach((key) => {
			if (key.startsWith(DEFAULT_PREFIX)) {
				delete process.env[key];
			}
		});
	});

	it('should throw an error if at least one path is not specified', () => {
		expect(() => load({ path: [] })).toThrowError(/at least one/i);
	});

	it('should process a valid default configuration from file', () => {
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'default-only'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server',
				},
				sites: {
					US: { url: 'https://site.us' },
					CA: { url: 'https://site.ca' },
				},
			})
		);
	});

	it('should be able to process configuration files from multiple directories', () => {
		const result = load({
			path: [
				path.join(__dirname, 'fixtures', 'config', 'default-only'),
				path.join(__dirname, 'fixtures', 'config', 'no-default'),
			],
		});

		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'localhost',
				},
				sites: {
					US: { url: 'https://site.us' },
					CA: { url: 'https://site.ca' },
				},
			})
		);
	});

	it('should support overriding configuration sources', () => {
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
			sources: ['default'],
		});

		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server',
				},
				sites: {
					US: { url: 'https://site.us' },
					CA: { url: 'https://site.ca' },
				},
			})
		);
	});

	it('should merge environment config file', () => {
		process.env.NODE_ENV = 'development';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server.dev',
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should allow overrides from environment variables', () => {
		process.env.NODE_ENV = 'development';
		process.env.CONFIG_database__host = 'foo';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'foo',
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should coerce environment value to number, boolean, and date', () => {
		process.env.CONFIG_port = '1000';
		process.env.CONFIG_debug = 'true';
		process.env.CONFIG_startTime = '2021-12-11T00:00:00';
		const result = load({
			path: '',
			schema: z.object({
				port: z.number(),
				debug: z.boolean(),
				startTime: z.date(),
			}),
		});
		expect(result.port).toBe(1000);
		expect(result.debug).toBe(true);
		expect(result.startTime).toBeInstanceOf(Date);
	});

	it('should support Optional values when coercing from ENV', () => {
		process.env.NODE_ENV = 'development';
		process.env.CONFIG_database__database = 'dbName';
		process.env.CONFIG_database__options__maxPoolSize = '100';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server.dev',
					database: 'dbName',
					options: {
						maxPoolSize: 100,
					},
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should use default values for env templates', () => {
		process.env.URL_CA = 'test';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			sources: ['default', 'env-defaults'],
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server',
					port: 4000,
				},
				sites: {
					CA: {
						url: 'test',
					},
					US: {
						url: 'https://us.com',
					},
				},
			})
		);
	});

	it('should not error on invalid env coercion', () => {
		process.env.CONFIG_foo = 'true';
		expect(() =>
			load({
				path: '',
				schema: z.object({
					foo: z.instanceof(Foo),
				}),
			})
		).toThrow();
	});

	it('should ignore un-coercible env vars and warn', () => {
		process.env.CONFIG_foo = 'foo';
		process.env.CONFIG_bar = 'env-bar';
		const result = load({
			path: '',
			schema: z.object({
				foo: z.union([z.literal('foo'), z.literal('baz')]),
				bar: z.literal('bar'),
			}),
			defaults: {
				foo: 'baz',
				bar: 'bar',
			},
		});
		expect(result).toMatchObject({
			foo: 'foo', // allowed value set from env
			bar: 'bar', // default value, env is ignored
		});
	});

	it('should allow for environment overrides of intersect types', () => {
		process.env.CONFIG_foo = 'foo';
		process.env.CONFIG_bar = 'bar';
		const result = load({
			path: '',
			schema: z
				.object({
					foo: z.string(),
				})
				.merge(
					z
						.object({
							bar: z.string(),
						})
						.partial()
				),
		});
		expect(result).toMatchObject({
			foo: 'foo',
			bar: 'bar',
		});
	});

	it('should allow for environment overrides of enum record types', () => {
		process.env.CONFIG_US__foo = 'us';
		process.env.CONFIG_CA__foo = 'ca';
		const result = load({
			path: '',
			schema: EnumRecord(
				z.enum(['US', 'CA']),
				z.object({
					foo: z.string(),
				})
			),
		});
		expect(result).toMatchObject({
			US: { foo: 'us' },
			CA: { foo: 'ca' },
		});
	});

	it('should allow overrides from local config', () => {
		process.env.NODE_ENV = 'development';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'localhost',
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should perform final overrides from local config', () => {
		process.env.NODE_ENV = 'development';
		process.env.CONFIG_database__host = 'development-server';
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'localhost',
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should support json files', () => {
		process.env.NODE_ENV = 'development';
		const result = load({
			format: 'json',
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
		});
		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'localhost.json',
				},
				sites: {
					US: { url: 'https://site.us.dev.json' },
					CA: { url: 'https://site.ca.dev.json' },
				},
			})
		);
	});

	it('should support a custom logger configuration', () => {
		process.env.DEBUG = 'xm-config';
		process.env.NODE_ENV = 'development';
		const result = load({
			format: 'json',
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
		});
		expect(result).toBeTruthy();
	});

	it('should fail if the config file does not contain an object', () => {
		expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-config'),
				schema: spec,
			})
		).toThrow();
	});

	it('should fail if the config file does not contain an object when run synch', () => {
		expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-config'),
				schema: spec,
			})
		).toThrow();
	});

	it('should fail if there is an error parsing the config file', () => {
		expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-parse'),
				format: 'json',
				schema: spec,
			})
		).toThrow(/error.*parsing/i);
	});

	it('should fail if there is an error parsing the config file when run synch', () => {
		expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-parse'),
				format: 'json',
				schema: spec,
			})
		).toThrow(/error.*parsing/i);
	});

	it('should coerce regex env values', () => {
		process.env.CONFIG_nameMatch = '^foo-.*';

		const result = load({
			path: '',
			schema: z.object({
				nameMatch: z.instanceof(RegExp),
			}),
			defaults: {
				nameMatch: /asdf/,
			},
		});

		expect(result.nameMatch.test('asdf')).toBeFalsy();
		expect(result.nameMatch.test('foo-bar')).toBeTruthy();
	});

	it('should support env array values', () => {
		process.env.CONFIG_arrayValue = 'joe,smith';

		const result = load({
			path: '',
			format: 'json',
			sources: ['ENV'],
			schema: z.object({
				arrayValue: z.array(z.string()),
			}),
		});
		expect(result).toMatchObject<typeof result>(
			expect.objectContaining({
				arrayValue: ['joe', 'smith'],
			})
		);
	});

	it('should allow overriding arrayMerge behavior', () => {
		process.env.NODE_ENV = 'development';

		// default overwrite behavior
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
		});
		expect((result as any).rules).toHaveLength(2);
		expect((result as any).rules).toEqual(['local1', 'local2']);

		// combine behavior
		const result2 = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
			mergeOpts: { arrayMergeMethod: 'combine' },
		});
		expect((result2 as any).rules).toHaveLength(4);
		expect((result2 as any).rules).toEqual(['default', 'dev', 'local1', 'local2']);
	});

	it('should support schemaless synchronous parsing', () => {
		process.env.NODE_ENV = 'development';

		// default overwrite behavior
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
		});
		expect((result as any).rules).toHaveLength(2);
		expect((result as any).rules).toEqual(['local1', 'local2']);
	});

	it('should inject environment variable values from template value', () => {
		process.env.URL_US = 'foo-us';
		process.env.URL_CA = 'foo-ca';
		// port value should be coerced into a number
		process.env.PORT = '5432';

		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			sources: ['default', 'development', 'env-vars'],
			schema: spec,
		});

		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server',
					port: 5432,
				},
				sites: {
					US: { url: 'foo-us' },
					CA: { url: 'foo-ca' },
				},
			})
		);
	});

	it('should default unspecified values for expected environment variables', () => {
		delete process.env.URL_US;
		delete process.env.URL_CA;
		delete process.env.PORT;

		process.env.NODE_ENV = 'development';

		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			sources: ['default', 'development', 'env-vars'],
			schema: spec,
		});

		expect(result).toMatchObject(
			expect.objectContaining<typeof result>({
				database: {
					host: 'database.server',
				},
				sites: {
					US: { url: 'https://site.us.dev' },
					CA: { url: 'https://site.ca.dev' },
				},
			})
		);
	});

	it('should not fail on empty file', () => {
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-env'),
			format: 'yaml',
			sources: ['empty'],
		});
		expect(result).toStrictEqual({});
	});

	it('should support json5 format', () => {
		const result = load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json5',
			sources: ['default'],
			schema: spec,
		});
		expect(result).toMatchObject<typeof result>(
			expect.objectContaining({
				database: {
					host: 'database.server.json5',
				},
			})
		);
	});
});
