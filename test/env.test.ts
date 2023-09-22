/* eslint-disable no-template-curly-in-string */
import { getEnvValue } from "../src/env"

describe('env', () => {
    describe('getEnvValue', () => {

    const testCases:[string,[string,string|undefined]][] =
            [
                [' ${FOO} ', ['FOO', undefined]],
                ['foo${FOO}foo', ['FOO', undefined]],
                ['bar${FOO:someInlineValue}', ['FOO', 'someInlineValue']],
                ['bar${FOO:{embeded:{value:"here"}}}', ['FOO','{embeded:{value:"here"}}']],
                ['bar${FOO:{embeded:{value:"here"}}}}', ['FOO','{embeded:{value:"here"}}}']],
                ['${FOO:"http://foo.bar"}', ['FOO','http://foo.bar']],
            ];

    testCases.forEach(([value, [_, finalValue]]) => {
        it(`given ${value}, value should be ${finalValue} `, () => {
            expect(getEnvValue(value)).toBe(finalValue);
        })
    });

    })

})