/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { Reflect, Runtype } from 'runtypes';
import { LiteralBase } from 'runtypes/lib/types/literal';

import log from './log';
import { deepMerge, isRuntype, MergeOpts } from './util';

const logEnv = log.extend('env');
const ENV_TEMPLATE_VALUE_REGEX = /\$\{([^:]+):?(.*)\}$/;

export const DEFAULT_PREFIX = 'CONFIG_';
export const DEFAULT_SEPARATOR = '__';

export interface EnvOpts {
	envPrefix?: string;
	envSeparator?: string;
	mergeOpts?: MergeOpts;
	schema?: Runtype;
}

function getValueType(keyPath: string[], obj: any): Runtype | undefined {
	if (!obj) {
		return undefined;
	}
	if (obj.tag === 'intersect') {
		for (let i = 0; i < obj.intersectees.length; i += 1) {
			const intersectee = obj.intersectees[i];
			const valueType = getValueType(keyPath, intersectee);
			if (valueType) {
				return valueType;
			}
		}
		return undefined;
	}
	if (obj.tag === 'optional') {
		// then we need to traverse into the optional
		return getValueType(keyPath, (obj as any).underlying);
	}

	if (keyPath.length === 1) {
		const valueType = obj.fields?.[keyPath[0]];
		if (!valueType) {
			logEnv(`did not find a type definition for ${keyPath[0]}`);
			return undefined;
		}
		if ((valueType as any).tag === 'optional') {
			return (valueType as any).underlying;
		}
		return valueType as Runtype;
	}
	if (obj.fields) {
		const [prop, ...remaining] = keyPath;
		return getValueType(remaining, obj.fields[prop]);
	}
	logEnv(`did not find a type definition for ${keyPath.join('.')}`);
	return undefined;
}

function coerce(envVar: string, value: string, valueType: Runtype | LiteralBase | Reflect): any {
	if (isRuntype(valueType)) {
		if (valueType.reflect.tag === 'instanceof') {
			const typeName = (valueType as any).ctor?.name;
			switch (typeName) {
				case 'Date':
					return new Date(value);
				case 'RegExp':
					return new RegExp(value);
				default:
					logEnv(`Unable to coerce value from env var "${envVar}" as type ${typeName}`);
					return undefined;
			}
		}
		if (valueType.reflect.tag === 'literal') {
			const coercedLiteralValue = coerce(envVar, value, valueType.reflect.value);
			if (coercedLiteralValue === valueType.reflect.value) {
				return coercedLiteralValue;
			}
			logEnv(
				`env var value for "${envVar}" does not match literal value "${valueType.reflect.value}"`
			);
			return undefined;
		}
		if (valueType.reflect.tag === 'union') {
			const { alternatives } = valueType.reflect;
			for (let i = 0; i < alternatives.length; i += 1) {
				const unionValue = coerce(envVar, value, alternatives[i]);
				if (unionValue !== undefined) {
					return unionValue;
				}
				logEnv(`unable to coerce value from env var "${envVar}" to allowed values`);
			}
			return undefined;
		}
		switch (valueType.reflect.tag) {
			case 'array':
				return value
					.split(',')
					.map((val) => coerce(envVar, val.trim(), (valueType as any).element));
			case 'number':
				return parseInt(value, 10);
			case 'boolean':
				return value.toLowerCase() === 'true';
			case 'string':
				return value;
			default:
				logEnv(`unable to coerce value from env var "${envVar}" as type ${valueType.reflect.tag}`);
				return undefined;
		}
	}
	switch (typeof valueType) {
		case 'number':
			return parseInt(value, 10);
		case 'boolean':
			return value.toLowerCase() === 'true';
		case 'string':
			return value;
		default:
			logEnv(`unable to coerce value from env var "${envVar}" as type ${typeof valueType}`);
			return undefined;
	}
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
		let value = v;
		if (schema) {
			logEnv(`retrieving type information from ${keyPath.join('.')}`);
			const valueType = getValueType(keyPath, schema);
			if (!valueType) {
				return accum;
			}
			logEnv(`coercing value to ${(valueType as Runtype).reflect?.tag || valueType}`);
			value = coerce(k, v, valueType);
		}

		if (value === undefined) {
			return accum;
		}

		const envConfig = keyPath.reverse().reduce((obj: { [_: string]: any }, prop, idx) => {
			if (idx === 0) {
				return {
					[prop]: value,
				};
			}
			return {
				[prop]: obj,
			};
		}, {});

		return deepMerge([accum, envConfig], mergeOpts);
	}, {});
}

export function getEnvValue(value:string):string|void {
    if (!value.length) {
        return
    }
    const matches = value.trim().match(ENV_TEMPLATE_VALUE_REGEX);
    if (!matches?.[1]) {
        return;
    }
    const envVar = matches[1];
    const envValue = process.env[envVar]

    if (envValue) {
        return envValue;
    }

    if (matches[2]) {
        const defaultValue = matches[2].trim()
        if (
            (defaultValue.startsWith('"') && defaultValue.endsWith('"')) ||
            (defaultValue.startsWith('\'') && defaultValue.endsWith('\''))
        ) {
            return defaultValue.substring(1, defaultValue.length - 1);
        }
        return defaultValue;
    }
    const defaultValue:string|undefined = matches[2]?.trim()?.match(/^["'](.+(?=["']$))["']$/)?.[1];
    if (!envValue) {
        return defaultValue
    }
    return envValue;
}

export function interpolateEnv(config: any, schema: unknown, fieldPath: string[] = []): any {
	Object.entries(config).forEach(([key, value]) => {
		const updatedPath = [...fieldPath, key];
		if (typeof value === 'string') {
			const match = value.trim().match(ENV_TEMPLATE_VALUE_REGEX);
			if (match) {
				const valueType = getValueType(updatedPath, schema);
				const envValue = getEnvValue(value) ?? '';
                if (!envValue) {
					// eslint-disable-next-line no-param-reassign
					delete config[key];
                } else {
				    // eslint-disable-next-line no-param-reassign
				    config[key] = coerce(key, envValue, valueType);
                }
			}
		} else if (value instanceof Object) {
			interpolateEnv(value, schema, updatedPath);
		}
	});
	return config;
}
