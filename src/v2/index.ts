import * as rt from "runtypes";
import escalade from 'escalade/sync';

import log from '@lib/log.js';
import { deepMerge } from "@lib/util.js";
import legacyLoad from "@lib/load-config.js";

const TConfOptional = rt.Partial({
        envPrefix: rt.String,
        sources: rt.Array(rt.String),
        arrayMergePolicy: rt.Union(rt.Literal('combine'), rt.Literal('overwrite'))
})
const TConfConfig = rt.Record({
    configFilePath: rt.String,
    path: rt.Array(rt.String).Or(rt.String)
}).And(TConfOptional)

type TConfConfig = rt.Static<typeof TConfConfig>;

const defaultConfig:rt.Static<typeof TConfOptional> = {
    envPrefix: 'CONFIG',
    sources: ['default', '${NODE_ENV}', 'ENV']
}

const cache:Record<string,any> = {};

function getTconfConfig(): TConfConfig {
    const configPath = escalade.default(__dirname, (_dir, names) => {
        if (names.includes('tconf-config.js')) {
            return 'tconf-config.js'
        }
    })
    if (!configPath) {
        throw new Error('Unable to find tconf-config.js.')
    }

    if (!cache[configPath]) {
        log(`initializing configuration from ${configPath}`)
    } else {
        console.warn(`WARN: configuration has already been loaded`)
    }
    const rawTConfConfig = require(configPath);
    const config = TConfConfig.check({
        ...rawTConfConfig,
        configFilePath: configPath
    });

    return deepMerge([defaultConfig, config], {arrayMergeMethod: 'overwrite'})
}


function loadUserConfig<Schema extends rt.Runtype|undefined>(
    tconfConfig:TConfConfig, namespace:string|undefined, schema?:Schema
):Schema extends rt.Runtype ? rt.Static<Schema> : any {
    let config = cache[tconfConfig.configFilePath];
    if (!config) {
        config = legacyLoad({
            path: tconfConfig.path,
            envPrefix: tconfConfig.envPrefix,
            mergeOpts: {
                arrayMergeMethod: tconfConfig.arrayMergePolicy ?? 'combine'
            },
            schema,
            sources: tconfConfig.sources
        })
        cache[tconfConfig.configFilePath] = config;
    }

    if (namespace) {
        if (schema) {
            return schema.check(config[namespace]) as any
        }
        return config[namespace]
    }

    if (schema) {
        return schema.check(config) as any
    }

    return config;
}

export interface LoadOpts<T extends rt.Runtype|undefined> {
    namespace?:string;
    schema?: T;
    configFilePath?: string;
}

export function load<Schema extends rt.Runtype | undefined>(
    opts:LoadOpts<Schema>
):Schema extends rt.Runtype ? rt.Static<Schema> : any {
    const tconfConfig = getTconfConfig()

    return loadUserConfig(tconfConfig, opts.namespace, opts.schema);
}
