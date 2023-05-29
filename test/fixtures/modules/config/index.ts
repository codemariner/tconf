import { Number, Record } from 'runtypes';

import { initialize } from '../../../../src';

const globalSchema = Record({
	api: Record({
		port: Number,
	}),
});

export const tconf = initialize({
	path: __dirname,
	schema: globalSchema,
});

export default tconf.get();
