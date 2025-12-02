import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import { fail } from 'assert';

import { z } from '../src/zod.js';
import { initialize } from '../src/index.js';

import { tconf } from './fixtures/modules/config/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

describe('tconf modular support', () => {
	it('should allow for registering configurations', () => {
		const config = tconf.register(
			'crypto',
			z.object({
				key: z.string(),
			})
		);

		expect(config).toMatchObject({
			key: '6K0CjNioiXER0qlXRDrOozWgbFZ9LmG/nnOjl0s4NqM=',
		});
	});

	it('should fail if registering more than once', () => {
		try {
			tconf.register(
				'crypto',
				z.object({
					key: z.string(),
				})
			);
			fail('should have failed');
		} catch (e) {
			expect(e).toBeTruthy();
		}
	});

	it('can be initialized without a global schema', () => {
		const config = initialize({
			path: path.join(__dirname, 'fixtures', 'modules', 'config'),
		});
		expect(config.get()).toBeTruthy();
	});
});
