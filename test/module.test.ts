import { fail } from 'assert';
import path from 'path';

import { Record, String } from 'runtypes';

import { initialize } from '../src';

import { tconf } from './fixtures/modules/config';

describe('tconf modular support', () => {
	it('should allow for registering configurations', () => {
		const config = tconf.register(
			'crypto',
			Record({
				key: String,
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
				Record({
					key: String,
				})
			);
			fail('should have failed');
		} catch (e) {
			// eslint-disable-next-line jest/no-conditional-expect
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
