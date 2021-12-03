![tconf](https://user-images.githubusercontent.com/33014/144646320-bb6cc527-18d6-4889-998e-e37fdc849170.png)

Adapting [12 factor app configuration](https://12factor.net/config) to a type checked, application focused world view.

## Overview

[12 factor app](https://12factor.net/config) guidelines for configuration promotes "strict separation of config from code" through the use of environment variables. While this is beneficial from a deployment perspective, how this is impelemented in many cases falls short of adequately supporting complex configuration with an application.

Typical approaches involve referencing `process.env` directly, perhaps with additional support through a library like [dotenv](https://github.com/motdotla/dotenv). These applications often end up working with a flat list of variables.

```typescript
const {
    DB_HOST,
    DB_USERNAME,
    DB_PASSWORD,
    // ...
} = process.env;
```
As configuration becomes more complex, this flat structure becomes combersome to deal with and reason about. To combat this, it's useful to organize your configuration into heirarchies. This is often an excerise left for the developer; mapping from a flat list of env vars into a desired shape, including type coercian and validation. For example, a desired end state for your configuration might look like:
```typescript
api: {
  baseUrl: string
  port?: number
  debugMode?: boolean
  auth: {
    secret: string
  }
}
database: {
  host: string
  username: string
  password: string
  driverOpts?: {
    connectionTimeout?: number
    queryTimeout?: number
  }
}
...
```
Representing this as a flat list of env vars is **not** an effective way to work with your configuration. _tconf_ addresses this by allowing authors to specify the desired shape and type of their configuration and performs mapping and coercian from environment variables automatically.

## Getting Started

### 1. install
```
npm install tconf
```

### 2. create config specification (optional)
tconf utilizes [runtypes]() for runtime type checking and as a schema for your config. This represents what you want your config to look like.

```typescript
// src/config.ts
import { Boolean, Optional, Record, Static, String } from 'runtypes';

const ApiConfig = Record({  
    port: number,
    debug: Optional(Boolean)
})
const DatabaseConfig = Record({
  host: String,
  username: String,
  password: Optional(String)
})

const Config = Record({
    api: ApiConfig,
    database: DatabaseConfig
});
export type Config = Static<typeof Config>;
```

where the type `Config` is inferred as:
```typescript
interface Config {
  api: {
    port: number
    debug?: boolean
  },
  database: {
    host: string
    username: string
    password?: string
  }
}
```


If you aren't using TypeScript or don't care about having your configuration statically typed, coerced, and validated then you can skip this.

### 3. map to env var names (optional)
Create a config file that defines a mapping of env vars. tconf provides support for template variables that can be used for env var interpolation (similar to docker compose).

```yaml
# config/env.yaml
api:
  port: ${API_PORT}
database:
  host: ${DB_HOST}
  username: ${DB_USER}
  password: ${DB_PASSWORD}
```

This is *also* optional. _tconf_ natively supports configuration mapping following a path naming convention. (you can set *any* configuration value using an environment variable). Only do this style of mapping if you need to refer to some specifically named environment variable to your config. The file name doesn't matter, and it doesn't have to only contain interpolation variables.

### 4. load your configuration

```typescript
// src/config.ts
import loadConfig from 'tconf'

export default loadConfig({
  // directories containing configuration files
  path: path.join(__dirname, '..', 'config'),
  // the runtypes Config object (optional)
  schema: Config,
  // sources to look for config, in this case the files
  // default.yaml, ${NODE_ENV}.yaml, and env.yaml
  sources: ['default', 'NODE_ENV', 'env'],
})

```
_tconf_ will import configurations from the defined sources (or a set of defaults) from the specified directories. Also values are merged in the order of the specified sources

### 5. use it
```typescript
// src/foo.ts
import config from './config'
import dbConnect from './db'

const conn = await dbConnect(config.database);
```


## Documentation

Please see [the documentation](./DOC.md) for more detailed information and capabilities of _tconf_.