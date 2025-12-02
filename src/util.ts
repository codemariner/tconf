/* eslint-disable @typescript-eslint/no-explicit-any */
import deepmerge from 'deepmerge';
import { z } from 'zod';

export interface MergeOpts {
	arrayMergeMethod: 'combine' | 'overwrite';
}

const combineMerge = (target: any[], source: any[], options: any): any[] => {
	const destination = target.slice();

	source.forEach((item, index) => {
		if (typeof destination[index] === 'undefined') {
			destination[index] = options.cloneUnlessOtherwiseSpecified(item, options);
		} else if (options.isMergeableObject(item)) {
			destination[index] = deepmerge(target[index], item, options);
		} else if (target.indexOf(item) === -1) {
			destination.push(item);
		}
	});
	return destination;
};

function overwriteMerge<T>(_destinationArray: T[], sourceArray: T[]): T[] {
	return sourceArray;
}

/**
 * Custom check for whether an object should be merged.
 * We don't want to merge special object types like Date, RegExp, URL, etc.
 * These should be treated as atomic values and replaced, not merged.
 */
function isMergeableObject(value: any): boolean {
	// Don't merge special object types - treat them as atomic values
	if (value instanceof Date || value instanceof RegExp || value instanceof URL) {
		return false;
	}

	// Check if it's an object at all
	const isNonNullObject = value !== null && typeof value === 'object';
	if (!isNonNullObject) {
		return false;
	}

	// Arrays are handled separately by arrayMerge option, but should still be considered mergeable
	if (Array.isArray(value)) {
		return true;
	}

	// For objects, check if they're plain objects (not class instances)
	const proto = Object.getPrototypeOf(value);
	return proto === null || proto === Object.prototype;
}

export function deepMerge(objects: any[], opts?: MergeOpts): any {
	const mergeMethod = opts?.arrayMergeMethod === 'combine' ? combineMerge : overwriteMerge;
	return deepmerge.all(objects, {
		arrayMerge: mergeMethod,
		isMergeableObject,
	});
}

export function isZodSchema(obj?: any): obj is z.ZodTypeAny {
	return obj instanceof z.ZodType;
}

export class ConfigurationError extends Error {}
