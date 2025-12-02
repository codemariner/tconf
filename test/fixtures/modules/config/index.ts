import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { z } from 'zod';

import { initialize } from '../../../../src/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const globalSchema = z.object({
	api: z.object({
		port: z.number(),
	}),
});

export const tconf = initialize({
	path: __dirname,
	schema: globalSchema,
});

export default tconf.get();
