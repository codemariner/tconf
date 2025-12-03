/**
 * re-export zod with tconf extensions.
 * Users should import from 'tconf/zod' to get the version tconf expects
 * plus custom schema types like z.regexp() and z.url()
 */

import * as zodNamespace from 'zod';

import { regexp, url } from './zod-extensions.js';

const { z: zodCore } = zodNamespace;

// Create a Proxy around zodCore that adds/overrides our custom extensions
// NOTE: We override Zod's built-in z.url() (which validates strings) with our version (which validates URL objects)
export const z = new Proxy(zodCore, {
	get(target, prop) {
		// our custom extensions
		if (prop === 'regexp') {
			return regexp;
		}
		if (prop === 'url') {
			return url;
		}
		// everything else delegates to zodCore
		return Reflect.get(target, prop);
	},
	has(target, prop) {
		if (prop === 'regexp' || prop === 'url') {
			return true;
		}
		return Reflect.has(target, prop);
	},
}) as unknown as Omit<typeof zodCore, 'url'> & { regexp: typeof regexp; url: typeof url };

export type * from 'zod';

export { regexp, url } from './zod-extensions.js';
export type { ZodRegExp, ZodURL } from './zod-extensions.js';
