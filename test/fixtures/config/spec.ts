import { Boolean, Literal, Number, Optional, Partial, Record, String, Union } from 'runtypes';

import { EnumRecord } from '../../../src';

const DatabaseConfig = Record({
	host: String,
	database: Optional(String),
	options: Optional(
		Partial({
			maxPoolSize: Number,
		})
	),
}).And(
	Partial({
		port: Number,
		debug: Boolean,
	})
);

const SiteId = Union(Literal('US'), Literal('CA'));

const SiteOptions = Record({
	url: String,
});

const SiteConfig = EnumRecord(SiteId, SiteOptions);

const Config = Record({
	database: DatabaseConfig,
	sites: SiteConfig,
});

export default Config;
