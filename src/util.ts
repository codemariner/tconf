 
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

 
export function deepMerge(objects: any[], opts?: MergeOpts): any {
	const mergeMethod = opts?.arrayMergeMethod === 'combine' ? combineMerge : overwriteMerge;
	return deepmerge.all(objects, { arrayMerge: mergeMethod });
}

export function isZodSchema(obj?: any): obj is z.ZodTypeAny {
	return obj instanceof z.ZodType;
}

export class ConfigurationError extends Error {}
