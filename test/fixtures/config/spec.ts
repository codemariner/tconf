import { z } from '../../../src/zod.js';
import { EnumRecord } from '../../../src/index.js';

const DatabaseConfig = z
	.object({
		host: z.string(),
		database: z.string().optional(),
		options: z
			.object({
				maxPoolSize: z.number(),
			})
			.partial()
			.optional(),
	})
	.merge(
		z
			.object({
				port: z.number(),
				debug: z.boolean(),
			})
			.partial()
	);

const SiteId = z.enum(['US', 'CA']);

const SiteOptions = z.object({
	url: z.string(),
});

const SiteConfig = EnumRecord(SiteId, SiteOptions);

const Config = z.object({
	database: DatabaseConfig,
	sites: SiteConfig,
});

export default Config;
