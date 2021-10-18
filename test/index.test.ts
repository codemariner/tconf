/* eslint-disable jest/expect-expect */
import path from 'path';

import { Boolean, InstanceOf, Literal, Number, Partial, Record, String, Union } from 'runtypes';

import load, { DEFAULT_PREFIX, EnumRecord, loadSync } from '../src/index';

import spec from './fixtures/config/spec';

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

	it('should throw an error if at least one path is not specified', async () => {
		await expect(() => load({ path: [] })).rejects.toThrowError(/at least one/i);
	});

	it('should process a valid default configuration from file', async () => {
		const result = await load({
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

	it('should synchronous loading', async () => {
		const result = loadSync({
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

	it('should be able to process configuration files from multiple directories', async () => {
		const result = await load({
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

	it('should support overriding configuration sources', async () => {
		const result = await load({
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

	it('should merge environment config file', async () => {
		process.env.NODE_ENV = 'development';
		const result = await load({
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

	it('should allow overrides from environment variables', async () => {
		process.env.NODE_ENV = 'development';
		process.env.CONFIG_database__host = 'foo';
		const result = await load({
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

	it('should coerce environment value to number, boolean, and date', async () => {
		process.env.CONFIG_port = '1000';
		process.env.CONFIG_debug = 'true';
		process.env.CONFIG_startTime = '12-11-2021T00:00:00';
		const result = await load({
			path: '',
			schema: Record({
				port: Number,
				debug: Boolean,
				startTime: InstanceOf(Date),
			}),
		});
		expect(result.port).toBe(1000);
		expect(result.debug).toBe(true);
		expect(result.startTime).toBeInstanceOf(Date);
	});

	it('should not error on invalid env coercion', async () => {
		process.env.CONFIG_foo = 'true';
		await expect(() =>
			load({
				path: '',
				schema: Record({
					foo: InstanceOf(Foo),
				}),
			})
		).rejects.toThrow();
	});

	it('should ignore un-coercible env vars and warn', async () => {
		process.env.CONFIG_foo = 'foo';
		process.env.CONFIG_bar = 'env-bar';
		const result = await load({
			path: '',
			schema: Record({
				foo: Union(Literal('foo'), Literal('baz')),
				bar: Literal('bar'),
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

	it('should allow for environment overrides of intersect types', async () => {
		process.env.CONFIG_foo = 'foo';
		process.env.CONFIG_bar = 'bar';
		const result = await load({
			path: '',
			schema: Record({
				foo: String,
			}).And(
				Partial({
					bar: String,
				})
			),
		});
		expect(result).toMatchObject({
			foo: 'foo',
			bar: 'bar',
		});
	});

	it('should allow for environment overrides of enum record types', async () => {
		process.env.CONFIG_US__foo = 'us';
		process.env.CONFIG_CA__foo = 'ca';
		const result = await load({
			path: '',
			schema: EnumRecord(
				Union(Literal('US'), Literal('CA')),
				Record({
					foo: String,
				})
			),
		});
		expect(result).toMatchObject({
			US: { foo: 'us' },
			CA: { foo: 'ca' },
		});
	});

	it('should allow overrides from local config', async () => {
		process.env.NODE_ENV = 'development';
		const result = await load({
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

	it('should perform final overrides from local config', async () => {
		process.env.NODE_ENV = 'development';
		process.env.CONFIG_database__host = 'development-server';
		const result = await load({
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

	it('should support json files', async () => {
		process.env.NODE_ENV = 'development';
		const result = await load({
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

	it('should support a custom logger configuration', async () => {
		process.env.DEBUG = 'xm-config';
		process.env.NODE_ENV = 'development';
		const result = await load({
			format: 'json',
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			schema: spec,
		});
		expect(result).toBeTruthy();
	});

	it('should fail if the config file does not contain an object', async () => {
		await expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-config'),
				schema: spec,
			})
		).rejects.toThrow();
	});

	it('should fail if the config file does not contain an object when run synch', async () => {
		expect(() =>
			loadSync({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-config'),
				schema: spec,
			})
		).toThrow();
	});

	it('should fail if there is an error parsing the config file', async () => {
		await expect(() =>
			load({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-parse'),
				format: 'json',
				schema: spec,
			})
		).rejects.toThrow(/error.*parsing/i);
	});

	it('should fail if there is an error parsing the config file when run synch', async () => {
		expect(() =>
			loadSync({
				path: path.join(__dirname, 'fixtures', 'config', 'invalid-parse'),
				format: 'json',
				schema: spec,
			})
		).toThrow(/error.*parsing/i);
	});

	it('should coerce regex env values', async () => {
		process.env.CONFIG_nameMatch = '^foo-.*';

		const result = await load({
			path: '',
			schema: Record({
				nameMatch: InstanceOf(RegExp),
			}),
			defaults: {
				nameMatch: /asdf/,
			},
		});

		expect(result.nameMatch.test('asdf')).toBeFalsy();
		expect(result.nameMatch.test('foo-bar')).toBeTruthy();
	});

	it('should allow overriding arrayMerge behavior', async () => {
		process.env.NODE_ENV = 'development';

		// default overwrite behavior
		const result = await load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
		});
		expect((result as any).rules).toHaveLength(2);
		expect((result as any).rules).toEqual(['local1', 'local2']);

		// combine behavior
		const result2 = await load({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
			mergeOpts: { arrayMergeMethod: 'combine' },
		});
		expect((result2 as any).rules).toHaveLength(4);
		expect((result2 as any).rules).toEqual(['default', 'dev', 'local1', 'local2']);
	});

	it('should support schemaless synchronous parsing', async () => {
		process.env.NODE_ENV = 'development';

		// default overwrite behavior
		const result = loadSync({
			path: path.join(__dirname, 'fixtures', 'config', 'with-local'),
			format: 'json',
		});
		expect((result as any).rules).toHaveLength(2);
		expect((result as any).rules).toEqual(['local1', 'local2']);
	});
});
