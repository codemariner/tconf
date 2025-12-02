/* eslint-disable @typescript-eslint/explicit-module-boundary-types */
/* eslint-disable @typescript-eslint/no-explicit-any */
import deepmerge from 'deepmerge';
import { z } from 'zod';

export interface MergeOpts {
	arrayMergeMethod: 'combine' | 'overwrite';
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function overwriteMerge<T>(_destinationArray: T[], sourceArray: T[]): T[] {
	return sourceArray;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function deepMerge(objects: any[], opts?: MergeOpts): any {
	const mergeMethod = opts?.arrayMergeMethod === 'combine' ? combineMerge : overwriteMerge;
	return deepmerge.all(objects, { arrayMerge: mergeMethod });
}

export function isZodSchema(obj?: any): obj is z.ZodTypeAny {
	return obj instanceof z.ZodType;
}

export class ConfigurationError extends Error {}
