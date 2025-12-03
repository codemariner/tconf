/* eslint-disable @typescript-eslint/no-explicit-any */
import * as z from 'zod';

import log from './log.js';
import { deepMerge, MergeOpts } from './util.js';
import { REGEXP_BRAND, URL_BRAND } from './zod-extensions.js';

const logEnv = log.extend('env');
const ENV_TEMPLATE_VALUE_REGEX = /\$\{([^:]+):?(.*)\}$/;

export const DEFAULT_PREFIX = 'CONFIG_';
export const DEFAULT_SEPARATOR = '__';

export interface EnvOpts {
	envPrefix?: string;
	envSeparator?: string;
	mergeOpts?: MergeOpts;
	schema?: z.ZodTypeAny;
}

/**
 * Traverses a zod schema to find the type definition for a given key path.
 */
function getValueType(
	keyPath: string[],
	schema: z.ZodTypeAny | undefined,
): z.ZodTypeAny | undefined {
	if (!schema) {
		return undefined;
	}

	let current = schema;

	// Unwrap optional, nullable, default schemas
	while (
		current instanceof z.ZodOptional ||
		current instanceof z.ZodNullable ||
		current instanceof z.ZodDefault
	) {
		current = (current as any)._def.innerType || (current as any)._def.type;
	}

	// handle intersections
	if (current instanceof z.ZodIntersection) {
		// Try left side first, then right side
		const leftType = getValueType(keyPath, (current as any)._def.left);
		if (leftType) return leftType;
		const rightType = getValueType(keyPath, (current as any)._def.right);
		if (rightType) return rightType;
		return undefined;
	}

	// Base case: we've reached the end of the path
	if (keyPath.length === 0) {
		return current;
	}

	if (current instanceof z.ZodObject) {
		const [prop, ...remaining] = keyPath;
		const { shape } = (current as any)._def;
		const fieldSchema = shape[prop];

		if (!fieldSchema) {
			logEnv(`did not find a type definition for ${prop} in object schema`);
			return undefined;
		}

		return getValueType(remaining, fieldSchema);
	}

	logEnv(`did not find a type definition for ${keyPath.join('.')}`);
	return undefined;
}

/**
 * Coerces a string value from environment variable to the expected type.
 * Implements hybrid approach: uses zod coercion where possible, custom logic for special cases.
 */
function coerce(envVar: string, value: string, valueType: z.ZodTypeAny | undefined): any {
	if (!valueType) {
		logEnv(`No type information for "${envVar}", returning string value`);
		return value;
	}

	// Unwrap optional/nullable/default
	let unwrapped = valueType;
	while (
		unwrapped instanceof z.ZodOptional ||
		unwrapped instanceof z.ZodNullable ||
		unwrapped instanceof z.ZodDefault
	) {
		unwrapped = (unwrapped as any)._def.innerType || (unwrapped as any)._def.type;
	}

	// handle transforms
	// v4 renamed ZodEffects to ZodTransform
	if (unwrapped instanceof z.ZodTransform) {
		const baseSchema = (unwrapped as any)._def.schema;
		unwrapped = baseSchema;
	}

	// custom tconf extension (z.regexp()) using a brand marker
	if ((unwrapped as any)[REGEXP_BRAND] === true) {
		try {
			return new RegExp(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to RegExp for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	// custom tconf extension (z.url())
	if ((unwrapped as any)[URL_BRAND] === true) {
		try {
			return new URL(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to URL for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	if (unwrapped instanceof z.ZodLiteral) {
		// v4 uses _def.values (array), v3 used _def.value (single value)
		const literalValues = (unwrapped as any)._def.values || [(unwrapped as any)._def.value];
		const literalValue = literalValues[0];

		if (typeof literalValue === 'string' && value === literalValue) {
			return value;
		}
		if (typeof literalValue === 'number') {
			const numValue = parseInt(value, 10);
			if (numValue === literalValue) return numValue;
		}
		if (typeof literalValue === 'boolean') {
			const boolValue = value.toLowerCase() === 'true';
			if (boolValue === literalValue) return boolValue;
		}
		logEnv(`env var value for "${envVar}" does not match literal value "${literalValue}"`);
		return undefined;
	}

	if (unwrapped instanceof z.ZodUnion) {
		const { options } = (unwrapped as any)._def;
		for (const option of options) {
			const unionValue = coerce(envVar, value, option);
			if (unionValue !== undefined) {
				return unionValue;
			}
		}
		logEnv(`unable to coerce value from env var "${envVar}" to any union variant`);
		return undefined;
	}

	if (unwrapped instanceof z.ZodEnum) {
		// V4: enum values are in .options property
		const enumValues = (unwrapped as any).options;
		if (enumValues && enumValues.includes(value)) {
			return value;
		}
		logEnv(`env var "${envVar}" value "${value}" not in enum [${enumValues?.join(', ')}]`);
		return undefined;
	}

	if (unwrapped instanceof z.ZodArray) {
		const elementType = (unwrapped as any)._def.type;
		return value
			.split(',')
			.map((val) => coerce(envVar, val.trim(), elementType))
			.filter((v) => v !== undefined);
	}

	if (unwrapped instanceof z.ZodString) {
		return value;
	}

	if (unwrapped instanceof z.ZodNumber) {
		try {
			return z.coerce.number().parse(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to number for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	if (unwrapped instanceof z.ZodBoolean) {
		try {
			return z.coerce.boolean().parse(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to boolean for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	if (unwrapped instanceof z.ZodDate) {
		const date = new Date(value);
		if (isNaN(date.getTime())) {
			logEnv(`Unable to coerce "${value}" to Date for env var "${envVar}"`);
			return undefined;
		}
		return date;
	}

	// NOTE: z.instanceof(RegExp) and z.instanceof(Date) are handled by the ZodCustom
	// path earlier in this function (Zod v4 creates ZodCustom for instanceof checks)

	// return string if we can't determine type
	logEnv(
		`Unknown type for env var "${envVar}" (${(unwrapped as any)._def?.typeName || 'unknown'}), returning as string`,
	);
	return value;
}

export function getEnvConfig(opts: EnvOpts): any {
	const {
		envPrefix = DEFAULT_PREFIX,
		envSeparator = DEFAULT_SEPARATOR,
		mergeOpts = { arrayMergeMethod: 'overwrite' },
		schema,
	} = opts;

	logEnv('inspecting environment variables');
	const entries = Object.entries(process.env).filter(([k]) => k.startsWith(envPrefix));

	return entries.reduce((accum, [k, v]) => {
		if (!v) {
			logEnv(`"${k}" has no value`);
			return accum;
		}

		logEnv(`processing env var "${k}"`);
		const keyPath = k.substring(envPrefix.length).split(envSeparator);
		let value: any = v;

		if (schema) {
			logEnv(`retrieving type information from ${keyPath.join('.')}`);
			const valueType = getValueType(keyPath, schema);
			if (!valueType) {
				return accum;
			}
			logEnv(`coercing value to ${(valueType as any)._def?.typeName || 'unknown'}`);
			value = coerce(k, v, valueType);
		}

		if (value === undefined) {
			return accum;
		}

		const envConfig = keyPath.reverse().reduce((obj: { [_: string]: any }, prop, idx) => {
			if (idx === 0) {
				return { [prop]: value };
			}
			return { [prop]: obj };
		}, {});

		return deepMerge([accum, envConfig], mergeOpts);
	}, {});
}

export function getEnvValue(value: string): string | void {
	if (!value.length) {
		return;
	}
	const matches = value.trim().match(ENV_TEMPLATE_VALUE_REGEX);
	if (!matches?.[1]) {
		return;
	}
	const envVar = matches[1];
	const envValue = process.env[envVar];

	if (envValue) {
		return envValue;
	}

	if (matches[2]) {
		const defaultValue = matches[2].trim();
		if (
			(defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
			(defaultValue.startsWith("'") && defaultValue.endsWith("'"))
		) {
			return defaultValue.substring(1, defaultValue.length - 1);
		}
		return defaultValue;
	}
	const defaultValue: string | undefined = matches[2]
		?.trim()
		?.match(/^["'](.+(?=["']$))["']$/)?.[1];
	if (!envValue) {
		return defaultValue;
	}
	return envValue;
}

export function interpolateEnv(config: any, schema: unknown, fieldPath: string[] = []): any {
	Object.entries(config).forEach(([key, value]) => {
		const updatedPath = [...fieldPath, key];
		if (typeof value === 'string') {
			const match = value.trim().match(ENV_TEMPLATE_VALUE_REGEX);
			if (match) {
				const valueType = getValueType(updatedPath, schema as z.ZodTypeAny);
				const envValue = getEnvValue(value) ?? '';
				if (!envValue) {
					delete config[key];
				} else {
					config[key] = coerce(key, envValue, valueType);
				}
			}
		} else if (value instanceof Object) {
			interpolateEnv(value, schema, updatedPath);
		}
	});
	return config;
}
