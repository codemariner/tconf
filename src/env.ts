 
/* eslint-disable @typescript-eslint/no-explicit-any */
import { z } from 'zod';

import log from './log.js';
import { deepMerge, MergeOpts } from './util.js';

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
 * This is the zod equivalent of the runtypes reflection API.
 */
function getValueType(keyPath: string[], schema: z.ZodTypeAny | undefined): z.ZodTypeAny | undefined {
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

	// DON'T unwrap effects here - coerce() needs to see the ZodEffects wrapper
	// to properly handle instanceof checks and other refinements

	// Handle intersections (zod uses ZodIntersection)
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

	// Traverse into object schema
	if (current instanceof z.ZodObject) {
		const [prop, ...remaining] = keyPath;
		const shape = (current as any)._def.shape();
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

	// Handle effects (transforms, refinements)
	// For instanceof checks (which use ZodEffects wrapping ZodAny), try to infer the type
	if (unwrapped instanceof z.ZodEffects) {
		const baseSchema = (unwrapped as any)._def.schema;
		// If the base schema is ZodAny, this might be z.instanceof()
		// Try common types and let the refinement validate
		if (baseSchema instanceof z.ZodAny || (baseSchema as any)._any) {
			// Try Date first
			const dateValue = new Date(value);
			if (!isNaN(dateValue.getTime())) {
				try {
					unwrapped.parse(dateValue);
					return dateValue;
				} catch {
					// Not a date, continue
				}
			}
			// Try RegExp
			try {
				const regexpValue = new RegExp(value);
				try {
					unwrapped.parse(regexpValue);
					return regexpValue;
				} catch {
					// Not a regexp
				}
			} catch {
				// Invalid regexp syntax
			}
		}
		// Unwrap for normal effects
		unwrapped = baseSchema;
	}

	// Handle literal types
	if (unwrapped instanceof z.ZodLiteral) {
		const literalValue = (unwrapped as any)._def.value;
		// Try coercing to same type as literal
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

	// Handle union types - try each alternative
	if (unwrapped instanceof z.ZodUnion) {
		const {options} = (unwrapped as any)._def;
		for (const option of options) {
			const unionValue = coerce(envVar, value, option);
			if (unionValue !== undefined) {
				return unionValue;
			}
		}
		logEnv(`unable to coerce value from env var "${envVar}" to any union variant`);
		return undefined;
	}

	// Handle enum types
	if (unwrapped instanceof z.ZodEnum) {
		const enumValues = (unwrapped as any)._def.values;
		if (enumValues.includes(value)) {
			return value;
		}
		logEnv(`env var "${envVar}" value "${value}" not in enum [${enumValues.join(', ')}]`);
		return undefined;
	}

	// Handle array types - split on comma and coerce each element
	if (unwrapped instanceof z.ZodArray) {
		const elementType = (unwrapped as any)._def.type;
		return value
			.split(',')
			.map((val) => coerce(envVar, val.trim(), elementType))
			.filter((v) => v !== undefined);
	}

	// Handle primitive types with zod's built-in coercion where possible
	if (unwrapped instanceof z.ZodString) {
		return value;
	}

	if (unwrapped instanceof z.ZodNumber) {
		// Use zod's built-in coerce for consistency
		try {
			return z.coerce.number().parse(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to number for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	if (unwrapped instanceof z.ZodBoolean) {
		// Use zod's built-in coerce
		try {
			return z.coerce.boolean().parse(value);
		} catch (error) {
			logEnv(`Unable to coerce "${value}" to boolean for env var "${envVar}": ${error}`);
			return undefined;
		}
	}

	// Handle Date - custom coercion (zod.coerce.date() might be too lenient)
	if (unwrapped instanceof z.ZodDate) {
		const date = new Date(value);
		if (isNaN(date.getTime())) {
			logEnv(`Unable to coerce "${value}" to Date for env var "${envVar}"`);
			return undefined;
		}
		return date;
	}

	// Handle z.instanceof(RegExp) and z.instanceof(Date)
	// Check _def.typeName for ZodType which is used for instanceof checks
	if ((unwrapped as any)._def?.typeName === 'ZodType') {
		const cls = (unwrapped as any)._def?.cls;
		if (cls === RegExp) {
			try {
				return new RegExp(value);
			} catch (error) {
				logEnv(`Unable to coerce "${value}" to RegExp for env var "${envVar}": ${error}`);
				return undefined;
			}
		}
		if (cls === Date) {
			const date = new Date(value);
			if (isNaN(date.getTime())) {
				logEnv(`Unable to coerce "${value}" to Date for env var "${envVar}"`);
				return undefined;
			}
			return date;
		}
	}

	// Default: return string if we can't determine type
	logEnv(`Unknown type for env var "${envVar}" (${(unwrapped as any)._def?.typeName || 'unknown'}), returning as string`);
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
	const defaultValue: string | undefined = matches[2]?.trim()?.match(/^["'](.+(?=["']$))["']$/)?.[1];
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
