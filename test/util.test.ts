import { deepMerge } from '../src/util.js';

describe('util', () => {
	const data = [
		{
			a: 'a',
			nums: [{ foo: 'a' }, {}, {}, 1],
		},
		{
			a: 'b',
			nums: [{}, { foo: 'b' }, {}, 2],
		},
		{
			a: 'c',
			// eslint-disable-next-line no-sparse-arrays
			nums: [{ foo: 'c' }, , { foo: 'z' }, 3],
		},
	];

	it('deepMerge should overwrite array properties by default', () => {
		const result = deepMerge(data);
		expect(result).toMatchObject({
			a: 'c',
			nums: [{ foo: 'c' }, undefined, { foo: 'z' }, 3],
		});
	});

	it('deepMerge should combine objects in arrays', () => {
		const result = deepMerge(data, { arrayMergeMethod: 'combine' });

		expect(result).toMatchObject({
			a: 'c',
			nums: [{ foo: 'c' }, { foo: 'b' }, { foo: 'z' }, 1, 2, 3],
		});
	});
});
