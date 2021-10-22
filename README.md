# tconf

Provides type-checked heirarchical configuration support with value coercion of enviornment variables.

## Table of contents

* [Overview](#overview)
* [Install](#install)
* [Dependencies](#dependencies)
* [Usage](#usage)
* [API](#api)
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

## Install

```sh
$ npm install tconf
```

## Dependencies

Notable dependencies:

* runtypes - The schema used to validate configuration values is based on [runtypes](https://github.com/pelotom/runtypes). Not all possible type specifications are supported (YMMV). However, providing a runtype schema is not required.


## API

### load(opts:GetConfigOpts<T>)
```typescript
load<T extends Runtype | unknown>(opts:GetConfigOpts<T>): T extends Runtype ? Static<T> : any
```

Default exported function. Load configurations based on provided options.

```typescript
import path from 'path';

import { Number, Record, String } from 'runtypes';
import loadConfig from 'tconf';

const schema = Record({
    host: String,
}).And(Partial({
    port: Number,
}));

const config = await loadConfig({
    path: path.join(__dirname, '..', 'config'),
    schema,
});
// -> config has the type from schema (Static<typeof schema>) which is the same as
// 
// interface schema {
//     host: string;
//     port?: number;
// }

server.start(config.host, config.port ?? 3000);

```

### loadSync(opts:GetConfigOpts<T>)
Synchronous version of the load function.

### Options

#### `path` (Required)
Path to directory, or set of paths for multiple directories, containing configuration files.

Single directory:
```typescript
const config = load({
    path: '../config'
})
```

Multiple directories:

```typescript
const config = load({
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

#### `format` (Optional)
Defaults to `yaml`.  Possible values `'yaml'` or `'json'`.

#### `schema` (Optional) - Runtypes object.
If not provided, no validation or environment coercion will be performed.

#### `envPrefix` (Optional)
Prefix used to identify environment variables.  Default: `'CONFIG_'`

```shell
CONFIG_server__host='http://myserver.com'

# => { server: { host: 'http://myserver.com' } }
```

With override:

```typescript
const config = load({
  path: '../config',
  envPrefix: 'CFG_',
});

// $ CFG_server__host='http://foo.com'
//
// => { server: { host: 'http://foo.com' } }

```

#### `envSeparator` (Optional)
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


#### `mergeOpts:{}` (Optional)

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
const config = load({
    path: '../config',
    mergeOpts: {
        arrayMergeMethod: 'combine'
    }
})
```

#### `defaults` (Optional)
JSON object that conforms to the schema

This is used as default configuration values. Particularly used for testing.

#### `sources` (Optional)
List of sources, in priority order, to process.  These values are either **base** file names, or the tokens `NODE_ENV` and `ENV`.

By default, the sources are defined in the following order:

1. `default`: Loads the file default.yaml
2. `NODE_ENV`: loads from a file with the same base name as NODE_ENV.  For example, `NODE_ENV=production` is translated as `production.yaml`
3. `ENV`: loads configuration from variables prefixed with `CONFIG_`
4. `local`: loads from the file local.yaml

Files are read across all specified paths in the same order.  Sample override:

```typescript
const config = load({
  format: 'json',
  path: ['config', 'config/secret'],
  sources: ['base', 'NODE_ENV', 'ENV', 'local']
})
```

The above will result in an untyped config object that merges all configurations found under two different directories.

## Environment Variable Mapping

In some situations, it's preferred to specify deployment related configuration based on environment variables.

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


## Debugging

This library uses `debug`. To print debug logging:

```shell
$ DEBUG=tconf* node ./run.js
```

## TODO
- Support mapping from specified environment variables.


