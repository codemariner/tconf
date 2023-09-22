![tconf](https://user-images.githubusercontent.com/33014/144646320-bb6cc527-18d6-4889-998e-e37fdc849170.png)
# Documentation

## Table of contents

* [Overview](#overview)
* [Dependencies](#dependencies)
* [Usage](#usage)
* [API](#api)
* [Environment Variable Mapping](#environment-variable-mapping)
* [Debugging](#debugging)
* [TODO](#todo)


## Overview

Configuration files are processed in a heiarchical manor in which a set of configurations from multiple sources are merged. This additionally includes:

1. Runtime validation of configuration values against a provided schema.
2. Coercion of environment variable values to expected types.
3. Support for JSON and YAML file formats.
4. NODE_ENV directed configuration.
5. Customizing overrides
6. Mapping from environment variables


With a given directory, by default, configuration files are loaded in the following manor (if found):

```shell
  default.yaml  ->  ${NODE_ENV}.yaml  ->  ENV variables  ->  local.yaml
```

in which 'local' configuration has the final override.


### Example

`config/default.yaml`:
```yaml
baseUrl: http://localhost
port: 3000
database:
  product_data:
    uri: 'postgres://db_user:password@postgres/defaultdb'
    options:
      connectionTimeoutMillis: 100
      idelTimeoutMillis: 100
```

`config/production.yaml`:
```yaml
database:
  product_data:
    uri: '${DB_URI}',
    options:
      connectionTimeoutMillis: 30000
      idleTimeoutMillis: 5000
```

`ENV`:
```
DB_URI="postgres://produser:prodpass@services-east.pgcloud.com:172777/v6"
CONFIG_port=1234
```

`config/local.yaml`:
```yaml
port: 4159
```


The resulting configuration object loaded while `NODE_ENV=production`:

```js
{
    baseUrl: 'http://localhost', // from defult.yaml
    port: 4159, // from local.yaml
    database: {
        product_data: {
            uri: 'postgres://produser:prodpass@services-east.pgcloud.com:172777/v6',  // mapped from ENV
            options: {
                connectionTimeoutMillis: 30000, // from production.yaml
                idleTimeoutMillis: 5000 // from production.yaml
            }
        }
    }
```


## Dependencies

Notable dependencies:

* runtypes - The schema used to validate configuration values is based on [runtypes](https://github.com/pelotom/runtypes). Not all possible type specifications are supported (YMMV). However, providing a runtype schema is not required.


## API

### initialize<T extends Runtype>(opts:TconfOpts<T>):Tconf<T>

Synchronously loads configurations based on provided options and returns an instance of Tconf.

```typescript
import path from 'path';

import { Number, Record, String } from 'runtypes';
import {initialize} from 'tconf';

const schema = Record({
    host: String,
}).And(Partial({
    port: Number,
}));

const tconf = initialize({
    path: path.join(__dirname, '..', 'config'),
    schema,
});

const config = tconf.get();

server.start(config.host, config.port ?? 3000);

```

#### Options

##### `path` (Required)
Path to directory, or set of paths for multiple directories, containing configuration files.

Single directory:
```typescript
const tconf = initialize({
    path: '../config'
})
```

Multiple directories:

```typescript
const tconf = initialize({
    path: [
      '../config',
      '../config/secret',
    ]
})
```

With the given example above with multiple directories, files will be iterated over in the following manor:

1. `config/default.yaml`
2. `config/secret/default.yaml`
3. `config/${NODE_ENV}.yaml`
4. `config/secret/${NODE_ENV}.yaml`
5. `config/local.yaml`
6. `config/secret/local.yaml`

##### `format` (Optional)
Defaults to `yaml`.  Possible values `'yaml'` or `'json'`.

##### `schema` (Optional) - Runtypes object.
If provided, validation and value coercion will be performed. Supported
types:
  - `number`
  - `boolean`
  - `Date`
  - `RegExp`
  - `Array<string|number|boolean|Date|RegExp>`

##### `envPrefix` (Optional)
Prefix used to identify environment variables.  Default: `'CONFIG_'`

```shell
CONFIG_server__host='http://myserver.com'

# => { server: { host: 'http://myserver.com' } }
```

With override:

```typescript
const tconf = initialize({
  path: '../config',
  envPrefix: 'CFG_',
});
const config = tconf.get();

// $ CFG_server__host='http://foo.com'
//
// => { server: { host: 'http://foo.com' } }

```

##### `envSeparator` (Optional)
Path separator for nested configurations to use in env variables.  Default: `'__'`

```yaml
database:
  options:
    maxPoolSize: 5
```
override via env variable:
```shell
CONFIG_database__options__maxPoolSize=10
```


##### `mergeOpts:{}` (Optional)

Defaults to `'overwrite'`.  Possible values `'combine'` or `'overwrite'`.

Internally, tconf will deeply merge objects.  By default, array properites are overwritten.

```typescript
const a = { obj: [{ name: 'joe' }, { name: 'john' }, 2] };
const b = { obj: [{ lastName: 'jack' }, 1] };

deepMerge(a,b);

// => { obj: [{ lastName: 'jack' }, 1] }
```

This behavior can be changed so that array properties are merged by specifying an `arrayMergeMethod` sub-option of `'combine'`.  When using this, the values at the same index are merged if they are objects, otherwise concatenated if they are primitives.

```typescript
const a = { obj: [{ name: 'joe' }     , { name: 'john' }, 1 ] }
const b = { obj: [{ lastName: 'jack' },                 , 2 ] }

deepMerge(a,b, { arrayMergeMethod: 'combine' })
// => { obj: [{ name: 'joe', lastName: 'jack' }, { name: 'john' }, 1, 2] }
```

mergeOpts usage:

```typescript
const tconf = initialize({
    path: '../config',
    mergeOpts: {
        arrayMergeMethod: 'combine'
    }
})
const config = tconf.get();
```

##### `defaults` (Optional)
JSON object that conforms to the schema

This is used as default configuration values. Particularly used for testing.

##### `sources` (Optional)
List of sources, in priority order, to process.  These values are either **base** file names, or the tokens `NODE_ENV` and `ENV`.

By default, the sources are defined in the following order:

1. `default`: Loads the file default.yaml
2. `NODE_ENV`: loads from a file with the same base name as NODE_ENV.  For example, `NODE_ENV=production` is translated as `production.yaml`
3. `ENV`: loads configuration from variables prefixed with `CONFIG_`
4. `local`: loads from the file local.yaml

Files are read across all specified paths in the same order.  Sample override:

```typescript
const tconf = initialize({
  format: 'json',
  path: ['config', 'config/secret'],
  sources: ['base', 'NODE_ENV', 'ENV', 'local']
})
const config = tconf.get()
```

The above will result in an untyped config object that merges all configurations found under two different directories.

### Tconf#register\<T extends Runtype\>(name:string, schema:T):Static\<typeof T\>
Registers a named configuration with associated schema. This will load, validate, and return the schema synchronously. This allows application modules to have their configuration managed by a common tconf instance.

## Modular Configuration

Application modules may register configuration with tconf while using the same configuration sources.

First, initialize your global configuration. This will establish the common location and options for loading configuration.

```typescript
// src/config.ts
import path from 'path';
import {initialize} from 'tconf';
import { Number, Record } from 'runtypes';

const Config = Record({
    api: Record({
        port: Number
    })
})

// exporting this so modules can register their configuration
export const tconf = initialize({
    path: path.join(__dirname, '..', 'config),
    schema: Config
})

export default tconf.get(); // Static<typeof Config>
```

Then in your module, register your local schema against a unique name.
```typescript
// src/modules/crypto/config.ts
import { tconf } from '../../config'
import { Record, String } from 'runtypes';

const Schema = Record({
    key: String
})

const config = tconf.register('crypto', Schema); // Static<typeof Schema>

export default config;
```


Module configuration is mapped to a named section in configuration files.
```yaml
# config/default.yaml
api:
  port: 3000

crypto: # <-- module config
  key: 6K0CjNioiXER0qlXRDrOozWgbFZ9LmG/nnOjl0s4NqM=
```

{% note %}
**Note:** Tconf will provide all configuration it finds and does not filter any out when requesting from the top level `tconf.get()`. However, when strictly typing with Runtypes and TypeScript, other module configuration types are not exposed. In this way, your application code can act as if it doesn't exist though it literally does.
{% endnote %}


## Environment Variable Mapping

In some cases, it's preferred to specify deployment related configuration based on environment variables.

### Mapping by field path.
Environment variable mapping is supported by default through the use of a environment variable name prefix followed by a field path. The prefix and field delimeter are configurable, but default usage could look like:

```shell
CONFIG_some__field="value"
```

which would assign the value to:
```json
{
  some: {
    field: "value"
  }
}
```

### Mapping by template variables.
To provide better interoperability between either existing environment variables or a non-path based variable naming conventions, variables can be directly mapped as interpolated values. For example:

```yaml
database:
  host: ${DB_HOST}
  username: ${DB_USERNAME}
  password: ${DB_PASSWORD}
```

The same merging and type coercion logic is applied. If any of the specified environment variables do not exist, the values will fall through to any specified defaults.

#### Default values
A default value may optionally be defined within the environment variable template. For example:

```yaml
database:
  host: ${DB_HOST:localhost}
  username: ${DB_USERNAME:user}
  password: ${DB_PASSWORD:"xSie:rJ39i023s"}
```

The default value follows after the `:` delimiter. Double or single quotes surrounding the value are optional.


## Debugging

This library uses `debug`. To print debug logging:

```shell
$ DEBUG=tconf* node ./run.js
```
