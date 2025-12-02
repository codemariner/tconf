![tconf](https://user-images.githubusercontent.com/33014/144646320-bb6cc527-18d6-4889-998e-e37fdc849170.png)

# tconf Reference Documentation

Complete reference guide for tconf - type-safe, hierarchical configuration for Node.js applications.

## Table of Contents

* [Overview](#overview)
* [Installation](#installation)
* [Quick Start](#quick-start)
* [Configuration Loading](#configuration-loading)
  * [Load Order](#load-order)
  * [Hierarchical Merging](#hierarchical-merging)
  * [Multiple Configuration Directories](#multiple-configuration-directories)
* [API Reference](#api-reference)
  * [initialize()](#initialize)
  * [Tconf#get()](#tconfget)
  * [Tconf#register()](#tconfregister)
* [Configuration Options](#configuration-options)
  * [path](#path-required)
  * [schema](#schema-optional)
  * [format](#format-optional)
  * [sources](#sources-optional)
  * [envPrefix](#envprefix-optional)
  * [envSeparator](#envseparator-optional)
  * [mergeOpts](#mergeopts-optional)
  * [defaults](#defaults-optional)
* [Type System](#type-system)
  * [Zod Schema Integration](#zod-schema-integration)
  * [Supported Types](#supported-types)
  * [Type Coercion](#type-coercion)
  * [Custom Extensions](#custom-extensions)
* [Environment Variables](#environment-variables)
  * [Path-Based Mapping](#path-based-mapping)
  * [Template Interpolation](#template-interpolation)
  * [Default Values](#default-values)
  * [Type Coercion from Environment](#type-coercion-from-environment)
* [Modular Configuration](#modular-configuration)
  * [Pattern](#pattern)
  * [Module Registration](#module-registration)
  * [Type Safety](#type-safety)
* [Array Merging](#array-merging)
  * [Overwrite Strategy](#overwrite-strategy)
  * [Combine Strategy](#combine-strategy)
* [File Formats](#file-formats)
  * [YAML](#yaml)
  * [JSON](#json)
  * [JSON5](#json5)
* [Debugging](#debugging)
* [Examples](#examples)
  * [Basic Configuration](#basic-configuration)
  * [Production Deployment](#production-deployment)
  * [Microservices](#microservices)
  * [Testing](#testing)
* [Migration Guide](#migration-guide)
* [Troubleshooting](#troubleshooting)

---

## Overview

tconf provides hierarchical configuration management with TypeScript type safety powered by [Zod](https://zod.dev/). It solves common configuration challenges:

- **Type Safety**: Full TypeScript inference from Zod schemas
- **Hierarchical Loading**: Merge configurations from multiple sources (files, env vars)
- **Automatic Coercion**: Environment variables automatically converted to correct types
- **12-Factor Compatible**: First-class environment variable support
- **Modular**: Register isolated configuration for different modules
- **Multiple Formats**: Support for YAML, JSON, and JSON5

### Core Concepts

Configuration files are loaded and merged in a hierarchical manner:

```
default.yaml → ${NODE_ENV}.yaml → ENV variables → local.yaml
```

Each layer overrides values from previous layers, with `local.yaml` having final priority.

---

## Installation

```bash
npm install tconf
```

**Requirements:**
- Node.js >= 20
- TypeScript >= 5 (optional but recommended)

---

## Quick Start

**1. Define your schema:**

```typescript
// src/config.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const Config = z.object({
  api: z.object({
    port: z.number(),
    debug: z.boolean().optional(),
  }),
  database: z.object({
    host: z.string(),
    password: z.string(),
  }),
});

export const tconf = initialize({
  path: './config',
  schema: Config,
});

export default tconf.get();
```

**2. Create config files:**

```yaml
# config/default.yaml
api:
  port: 3000
database:
  host: localhost
  password: dev-password
```

```yaml
# config/production.yaml
database:
  host: prod-db.example.com
  password: ${DB_PASSWORD}
```

**3. Use your configuration:**

```typescript
import config from './config';

console.log(config.api.port); // Type-safe access with IntelliSense
```

---

## Configuration Loading

### Load Order

By default, tconf loads configuration from these sources in order:

1. **default**: `default.yaml` (or `.json`/`.json5` based on format)
2. **NODE_ENV**: `${NODE_ENV}.yaml` (e.g., `production.yaml`, `development.yaml`)
3. **ENV**: Environment variables prefixed with `CONFIG_`
4. **local**: `local.yaml` (typically in `.gitignore` for developer overrides)

Later sources override earlier ones using deep merging.

### Hierarchical Merging

Given these files:

**config/default.yaml:**
```yaml
api:
  host: localhost
  port: 3000
  timeout: 5000
database:
  host: localhost
  port: 5432
```

**config/production.yaml:**
```yaml
api:
  host: api.example.com
  timeout: 30000
database:
  host: ${DB_HOST}
```

**Environment:**
```bash
NODE_ENV=production
DB_HOST=prod-db.example.com
CONFIG_api__port=8080
```

**Result:**
```javascript
{
  api: {
    host: 'api.example.com',     // from production.yaml
    port: 8080,                  // from ENV (CONFIG_api__port)
    timeout: 30000               // from production.yaml
  },
  database: {
    host: 'prod-db.example.com', // from production.yaml template (${DB_HOST})
    port: 5432                   // from default.yaml
  }
}
```

### Multiple Configuration Directories

You can specify multiple directories to load configurations from:

```typescript
const tconf = initialize({
  path: [
    './config',
    './config/secrets',
  ],
  schema: Config,
});
```

Files are processed in order across all directories:

1. `config/default.yaml`
2. `config/secrets/default.yaml`
3. `config/${NODE_ENV}.yaml`
4. `config/secrets/${NODE_ENV}.yaml`
5. Environment variables
6. `config/local.yaml`
7. `config/secrets/local.yaml`

This pattern is useful for:
- Separating sensitive configuration (secrets directory)
- Sharing common configuration across projects
- Organizing large configuration sets

---

## API Reference

### initialize()

```typescript
function initialize<T extends z.ZodTypeAny>(opts: TconfOpts<T>): Tconf<T>
```

Synchronously loads configuration files, merges them hierarchically, validates against the schema, and returns a `Tconf` instance.

**Parameters:**
- `opts`: Configuration options (see [Configuration Options](#configuration-options))

**Returns:** `Tconf<T>` instance

**Example:**
```typescript
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const schema = z.object({
  host: z.string(),
  port: z.number().optional(),
});

const tconf = initialize({
  path: './config',
  schema,
});

const config = tconf.get();
```

---

### Tconf#get()

```typescript
get(): z.infer<T>
```

Returns the validated, typed configuration object.

**Returns:** Configuration object with TypeScript types inferred from the schema

**Example:**
```typescript
const config = tconf.get();
console.log(config.api.port); // TypeScript knows this is a number
```

---

### Tconf#register()

```typescript
register<Schema extends z.ZodTypeAny>(
  name: string,
  schema: Schema
): z.infer<Schema>
```

Registers a named configuration section with its own schema. This allows modules to define their own configuration requirements while sharing the same configuration sources.

**Performance Note:** Files are only read once during `initialize()`. Calling `register()` only re-validates the cached configuration with the expanded schema - no file I/O occurs.

**Parameters:**
- `name`: Unique name for this configuration section
- `schema`: Zod schema for this section

**Returns:** Typed configuration object for this section

**Example:**
```typescript
// src/modules/auth/config.ts
import { z } from 'tconf/zod';
import { tconf } from '../../config';

const AuthConfig = z.object({
  secret: z.string(),
  expiresIn: z.number(),
});

export default tconf.register('auth', AuthConfig);
```

```yaml
# config/default.yaml
auth:
  secret: dev-secret
  expiresIn: 3600
```

---

## Configuration Options

### path (Required)

**Type:** `string | string[]`

Path to directory (or array of directories) containing configuration files.

**Single directory:**
```typescript
const tconf = initialize({
  path: './config',
  schema: Config,
});
```

**Multiple directories:**
```typescript
const tconf = initialize({
  path: ['./config', './config/secrets'],
  schema: Config,
});
```

**Relative paths:** Resolved relative to the current working directory.

---

### schema (Optional)

**Type:** `z.ZodTypeAny`

Zod schema for validation and type inference. If omitted, configuration is loaded without validation.

**Example:**
```typescript
import { z } from 'tconf/zod';

const Config = z.object({
  api: z.object({
    port: z.number(),
    host: z.string(),
  }),
  features: z.object({
    analytics: z.boolean().optional(),
  }).optional(),
});

const tconf = initialize({
  path: './config',
  schema: Config,
});

// config is fully typed
const config = tconf.get();
```

**Without schema:**
```typescript
const tconf = initialize({
  path: './config',
});

const config = tconf.get(); // config: any
```

---

### format (Optional)

**Type:** `'yaml' | 'json' | 'json5'`
**Default:** `'yaml'`

File format for configuration files.

**Example:**
```typescript
const tconf = initialize({
  path: './config',
  format: 'json',
  schema: Config,
});
```

This will look for `default.json`, `production.json`, etc.

---

### sources (Optional)

**Type:** `string[]`
**Default:** `['default', 'NODE_ENV', 'ENV', 'local']`

Ordered list of configuration sources to load and merge.

**Special tokens:**
- `'NODE_ENV'`: Loads file named after the `NODE_ENV` environment variable
- `'ENV'`: Loads from environment variables

**Custom sources:**
```typescript
const tconf = initialize({
  path: './config',
  sources: ['base', 'NODE_ENV', 'custom', 'ENV', 'local'],
  schema: Config,
});
```

This loads: `base.yaml` → `${NODE_ENV}.yaml` → `custom.yaml` → ENV vars → `local.yaml`

**Override example (skip local):**
```typescript
const tconf = initialize({
  path: './config',
  sources: ['default', 'NODE_ENV', 'ENV'],
  schema: Config,
});
```

---

### envPrefix (Optional)

**Type:** `string`
**Default:** `'CONFIG_'`

Prefix for environment variables that should be mapped to configuration.

**Example:**
```typescript
const tconf = initialize({
  path: './config',
  envPrefix: 'APP_',
  schema: Config,
});
```

Now use:
```bash
APP_api__port=8080
```

Instead of:
```bash
CONFIG_api__port=8080
```

---

### envSeparator (Optional)

**Type:** `string`
**Default:** `'__'`

Separator for nested configuration paths in environment variables.

**Example:**
```typescript
const tconf = initialize({
  path: './config',
  envSeparator: '_',
  schema: Config,
});
```

Now use:
```bash
CONFIG_database_options_maxPoolSize=10
```

Instead of:
```bash
CONFIG_database__options__maxPoolSize=10
```

**Note:** Use caution with single `_` separator if your field names contain underscores.

---

### mergeOpts (Optional)

**Type:** `{ arrayMergeMethod?: 'overwrite' | 'combine' }`
**Default:** `{ arrayMergeMethod: 'overwrite' }`

Controls how arrays are merged when combining configuration sources.

See [Array Merging](#array-merging) for detailed explanation.

---

### defaults (Optional)

**Type:** `DeepPartial<z.infer<Schema>>`

Default configuration values to use as the base layer (before all file-based sources).

Useful for:
- Testing (override config without files)
- Providing hardcoded defaults
- Programmatic configuration

**Example:**
```typescript
const tconf = initialize({
  path: './config',
  schema: Config,
  defaults: {
    api: {
      port: 3000,
      host: 'localhost',
    },
  },
});
```

---

## Type System

### Zod Schema Integration

tconf uses [Zod](https://zod.dev/) for runtime validation and TypeScript type inference. Import Zod from `tconf/zod` to get tconf's custom extensions:

```typescript
import { z } from 'tconf/zod'; // ✅ Includes z.regexp() and z.url()
import { z } from 'zod';        // ❌ Standard Zod (missing tconf extensions)
```

### Supported Types

tconf supports all Zod types, with automatic coercion for environment variables:

**Basic types:**
```typescript
const Config = z.object({
  name: z.string(),
  port: z.number(),
  enabled: z.boolean(),
  tags: z.array(z.string()),
});
```

**Date objects:**
```typescript
const Config = z.object({
  createdAt: z.date(),
});
```

```bash
CONFIG_createdAt="2024-01-01T00:00:00Z"
# Coerced to: new Date("2024-01-01T00:00:00Z")
```

**RegExp objects (tconf extension):**
```typescript
const Config = z.object({
  pattern: z.regexp(),
});
```

```bash
CONFIG_pattern="^foo-.*"
# Coerced to: new RegExp("^foo-.*")
```

**URL objects (tconf extension):**
```typescript
const Config = z.object({
  apiEndpoint: z.url(),
});
```

```bash
CONFIG_apiEndpoint="https://api.example.com/v1"
# Coerced to: new URL("https://api.example.com/v1")
```

**Optional values:**
```typescript
const Config = z.object({
  debug: z.boolean().optional(),
  timeout: z.number().optional(),
});
```

**Enums:**
```typescript
const Config = z.object({
  environment: z.enum(['development', 'staging', 'production']),
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});
```

**Unions:**
```typescript
const Config = z.object({
  port: z.union([z.number(), z.string()]), // Accept either type
  mode: z.union([z.literal('auto'), z.boolean()]),
});
```

**Literals:**
```typescript
const Config = z.object({
  version: z.literal('v1'),
  maxRetries: z.literal(3),
  enabled: z.literal(true),
});
```

**Complex objects:**
```typescript
const Config = z.object({
  database: z.object({
    host: z.string(),
    port: z.number(),
    credentials: z.object({
      username: z.string(),
      password: z.string(),
    }),
    options: z.object({
      ssl: z.boolean(),
      poolSize: z.number(),
    }).optional(),
  }),
});
```

**Intersections:**
```typescript
const BaseConfig = z.object({
  host: z.string(),
});

const ExtendedConfig = z.object({
  port: z.number(),
});

const Config = z.intersection(BaseConfig, ExtendedConfig);
// or: const Config = BaseConfig.merge(ExtendedConfig);
```

**Records with enum keys:**
```typescript
import { z } from 'tconf/zod';
import { EnumRecord } from 'tconf';

const SiteId = z.enum(['US', 'CA', 'UK']);
const SiteConfig = z.object({
  url: z.string(),
  locale: z.string(),
});

const Config = z.object({
  sites: EnumRecord(SiteId, SiteConfig),
});
```

```yaml
# config/default.yaml
sites:
  US:
    url: https://example.com
    locale: en-US
  CA:
    url: https://example.ca
    locale: en-CA
  UK:
    url: https://example.co.uk
    locale: en-GB
```

### Type Coercion

tconf automatically coerces environment variable string values to match your schema types:

| Schema Type | Example Env Var | Coerced Value | Type |
|-------------|----------------|---------------|------|
| `z.number()` | `CONFIG_port=3000` | `3000` | `number` |
| `z.boolean()` | `CONFIG_debug=true` | `true` | `boolean` |
| `z.date()` | `CONFIG_createdAt=2024-01-01` | `new Date("2024-01-01")` | `Date` |
| `z.regexp()` | `CONFIG_pattern=^test` | `new RegExp("^test")` | `RegExp` |
| `z.url()` | `CONFIG_api=https://api.com` | `new URL("https://api.com")` | `URL` |
| `z.array(z.string())` | `CONFIG_tags=a,b,c` | `['a', 'b', 'c']` | `string[]` |
| `z.literal(3)` | `CONFIG_retries=3` | `3` | `3` |
| `z.enum([...])` | `CONFIG_env=production` | `'production'` | `string` |

**Boolean coercion:**
- `'true'` → `true`
- `'false'` → `false`
- Other values cause validation error

**Array coercion:**
Arrays are parsed by splitting on commas:
```bash
CONFIG_tags=foo,bar,baz
# Result: ['foo', 'bar', 'baz']
```

**Number array:**
```bash
CONFIG_ports=3000,4000,5000
# With schema: z.array(z.number())
# Result: [3000, 4000, 5000]
```

### Custom Extensions

tconf extends Zod with additional schema types for common JavaScript objects:

#### z.regexp()

Validates and coerces to `RegExp` objects.

```typescript
import { z } from 'tconf/zod';

const Config = z.object({
  pattern: z.regexp(),
});
```

**From files:**
```yaml
pattern: ^foo-.*
```

**From environment:**
```bash
CONFIG_pattern="^test-\d+"
```

**Usage:**
```typescript
const config = tconf.get();
config.pattern.test('foo-bar'); // true or false
```

#### z.url()

Validates and coerces to `URL` objects.

**Note:** This overrides Zod's built-in `z.url()` which validates URL strings. tconf's version validates `URL` objects instead.

```typescript
import { z } from 'tconf/zod';

const Config = z.object({
  apiEndpoint: z.url(),
});
```

**From files:**
```yaml
apiEndpoint: https://api.example.com/v1
```

**From environment:**
```bash
CONFIG_apiEndpoint="https://api.example.com/v1"
```

**Usage:**
```typescript
const config = tconf.get();
console.log(config.apiEndpoint.hostname); // 'api.example.com'
console.log(config.apiEndpoint.pathname); // '/v1'
console.log(config.apiEndpoint.protocol); // 'https:'
```

---

## Environment Variables

tconf provides two strategies for mapping environment variables to configuration:

1. **Path-based mapping**: Use prefixed env vars with paths (e.g., `CONFIG_database__host`)
2. **Template interpolation**: Use template syntax in config files (e.g., `${DB_HOST}`)

Both strategies support automatic type coercion and can be used together.

### Path-Based Mapping

Environment variables prefixed with `CONFIG_` (or custom prefix) are automatically mapped to configuration paths.

**Syntax:**
```
{PREFIX}{path}{SEPARATOR}{path}{SEPARATOR}...
```

**Default prefix:** `CONFIG_`
**Default separator:** `__`

**Examples:**

```bash
# Simple value
CONFIG_port=8080
# → { port: 8080 }

# Nested object
CONFIG_api__host=example.com
# → { api: { host: 'example.com' } }

# Deep nesting
CONFIG_database__options__maxPoolSize=100
# → { database: { options: { maxPoolSize: 100 } } }

# Array of strings
CONFIG_tags=frontend,backend,api
# → { tags: ['frontend', 'backend', 'api'] }
```

**Custom prefix:**
```typescript
const tconf = initialize({
  path: './config',
  envPrefix: 'APP_',
  schema: Config,
});
```

```bash
APP_port=8080
```

**Custom separator:**
```typescript
const tconf = initialize({
  path: './config',
  envSeparator: '_',
  schema: Config,
});
```

```bash
CONFIG_database_host=localhost
```

### Template Interpolation

Reference environment variables directly in configuration files using `${VAR_NAME}` syntax.

**Example:**

```yaml
# config/production.yaml
database:
  host: ${DB_HOST}
  port: ${DB_PORT}
  username: ${DB_USER}
  password: ${DB_PASSWORD}
api:
  secret: ${API_SECRET}
  endpoint: ${API_ENDPOINT}
```

```bash
# Environment
DB_HOST=prod-db.example.com
DB_PORT=5432
DB_USER=dbuser
DB_PASSWORD=secure123
API_SECRET=my-secret-key
API_ENDPOINT=https://api.example.com
```

**Result:**
```javascript
{
  database: {
    host: 'prod-db.example.com',
    port: 5432,              // Coerced to number
    username: 'dbuser',
    password: 'secure123'
  },
  api: {
    secret: 'my-secret-key',
    endpoint: new URL('https://api.example.com') // Coerced to URL if schema specifies z.url()
  }
}
```

### Default Values

Template variables support default values using the `:` delimiter:

```yaml
database:
  host: ${DB_HOST:localhost}
  port: ${DB_PORT:5432}
  username: ${DB_USER:postgres}
  password: ${DB_PASSWORD:"default:password"}
```

**Syntax:**
```
${ENV_VAR_NAME:default_value}
```

**Quotes:** Optional, but required if default value contains special characters like `:`

**Examples:**

```yaml
# Simple default
timeout: ${TIMEOUT:5000}

# String default
name: ${APP_NAME:myapp}

# Default with special characters (requires quotes)
password: ${DB_PASS:"pa$$w0rd:123"}

# URL default
apiUrl: ${API_URL:"https://api.default.com"}
```

If the environment variable is not set, the default value is used and coerced according to the schema.

### Type Coercion from Environment

All environment variable values (both path-based and template) are strings initially. tconf automatically coerces them based on your schema:

**Number:**
```bash
CONFIG_port=3000
CONFIG_timeout=5000
```

```typescript
const Config = z.object({
  port: z.number(),
  timeout: z.number(),
});
// Result: { port: 3000, timeout: 5000 }
```

**Boolean:**
```bash
CONFIG_debug=true
CONFIG_enableCache=false
```

```typescript
const Config = z.object({
  debug: z.boolean(),
  enableCache: z.boolean(),
});
// Result: { debug: true, enableCache: false }
```

**Date:**
```bash
CONFIG_startTime=2024-01-01T00:00:00Z
```

```typescript
const Config = z.object({
  startTime: z.date(),
});
// Result: { startTime: Date object }
```

**RegExp:**
```bash
CONFIG_pattern=^user-\d+
```

```typescript
const Config = z.object({
  pattern: z.regexp(),
});
// Result: { pattern: /^user-\d+/ }
```

**URL:**
```bash
CONFIG_apiEndpoint=https://api.example.com/v1
```

```typescript
const Config = z.object({
  apiEndpoint: z.url(),
});
// Result: { apiEndpoint: URL object }
```

**Array:**
```bash
CONFIG_allowedOrigins=https://example.com,https://app.example.com
```

```typescript
const Config = z.object({
  allowedOrigins: z.array(z.string()),
});
// Result: { allowedOrigins: ['https://example.com', 'https://app.example.com'] }
```

**Enum:**
```bash
CONFIG_logLevel=info
```

```typescript
const Config = z.object({
  logLevel: z.enum(['debug', 'info', 'warn', 'error']),
});
// Result: { logLevel: 'info' }
```

**Union (tries types in order):**
```bash
CONFIG_port=3000
```

```typescript
const Config = z.object({
  port: z.union([z.number(), z.string()]),
});
// Result: { port: 3000 } (coerced to number, first option)
```

**Literal:**
```bash
CONFIG_maxRetries=3
CONFIG_enabled=true
```

```typescript
const Config = z.object({
  maxRetries: z.literal(3),
  enabled: z.literal(true),
});
// Result: { maxRetries: 3, enabled: true }
```

---

## Modular Configuration

Large applications often have multiple modules that each need their own configuration. tconf supports this through the `register()` method.

### Pattern

**1. Create a global tconf instance:**

```typescript
// src/config.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const Config = z.object({
  app: z.object({
    name: z.string(),
    port: z.number(),
  }),
});

export const tconf = initialize({
  path: './config',
  schema: Config,
});

export default tconf.get();
```

**2. Register module-specific configuration:**

```typescript
// src/modules/database/config.ts
import { z } from 'tconf/zod';
import { tconf } from '../../config';

const DatabaseConfig = z.object({
  host: z.string(),
  port: z.number(),
  credentials: z.object({
    username: z.string(),
    password: z.string(),
  }),
});

export default tconf.register('database', DatabaseConfig);
```

```typescript
// src/modules/cache/config.ts
import { z } from 'tconf/zod';
import { tconf } from '../../config';

const CacheConfig = z.object({
  ttl: z.number(),
  maxSize: z.number(),
});

export default tconf.register('cache', CacheConfig);
```

**3. Define configuration in files:**

```yaml
# config/default.yaml
app:
  name: MyApp
  port: 3000

database:
  host: localhost
  port: 5432
  credentials:
    username: devuser
    password: devpass

cache:
  ttl: 3600
  maxSize: 1000
```

**4. Use in modules:**

```typescript
// src/modules/database/connection.ts
import config from './config';

export function connect() {
  return createConnection({
    host: config.host,
    port: config.port,
    username: config.credentials.username,
    password: config.credentials.password,
  });
}
```

### Module Registration

The `register()` method:
- Accepts a unique name and schema
- Re-validates the cached configuration with the expanded schema
- Returns typed configuration for that module
- **Does not re-read files** (performance optimization)

**Performance:**
Configuration files are read only once during `initialize()`. Each call to `register()` only validates the cached data against the new schema - no disk I/O occurs.

### Type Safety

Each module gets its own typed configuration without knowing about other modules:

```typescript
// src/modules/database/config.ts
const config = tconf.register('database', DatabaseConfig);
// config is typed as: { host: string; port: number; credentials: { username: string; password: string } }

// TypeScript error - 'cache' doesn't exist on this module's config
config.cache; // ❌ Error
```

The global config from `tconf.get()` includes all registered modules, but TypeScript only shows the explicitly defined schema types.

---

## Array Merging

tconf supports two strategies for merging array values from different configuration sources:

### Overwrite Strategy

**Default behavior.** Arrays from later sources completely replace arrays from earlier sources.

```typescript
const tconf = initialize({
  path: './config',
  // mergeOpts not specified, defaults to 'overwrite'
});
```

**Example:**

```yaml
# config/default.yaml
rules:
  - rule1
  - rule2
  - rule3
```

```yaml
# config/production.yaml
rules:
  - prodRule1
  - prodRule2
```

**Result:**
```javascript
{
  rules: ['prodRule1', 'prodRule2'] // production.yaml completely replaces default.yaml
}
```

### Combine Strategy

Arrays are merged by combining elements. Objects at the same index are deep merged, primitives are concatenated.

```typescript
const tconf = initialize({
  path: './config',
  mergeOpts: {
    arrayMergeMethod: 'combine',
  },
});
```

**Example with objects:**

```yaml
# config/default.yaml
servers:
  - name: api
    port: 3000
  - name: worker
    port: 4000
```

```yaml
# config/production.yaml
servers:
  - host: api.example.com
  - host: worker.example.com
```

**Result:**
```javascript
{
  servers: [
    { name: 'api', port: 3000, host: 'api.example.com' },    // Merged
    { name: 'worker', port: 4000, host: 'worker.example.com' } // Merged
  ]
}
```

**Example with primitives:**

```yaml
# config/default.yaml
tags:
  - javascript
  - typescript
```

```yaml
# config/production.yaml
tags:
  - node
  - production
```

**Result:**
```javascript
{
  tags: ['javascript', 'typescript', 'node', 'production'] // Concatenated
}
```

**Mixed example:**

```yaml
# config/default.yaml
items:
  - id: 1
  - id: 2
  - simple-value
```

```yaml
# config/production.yaml
items:
  - name: first
  - another-value
```

**Result:**
```javascript
{
  items: [
    { id: 1, name: 'first' },  // Objects merged
    { id: 2 },                 // No corresponding element in production.yaml
    'simple-value',            // Primitive from default.yaml
    'another-value'            // Primitive from production.yaml
  ]
}
```

---

## File Formats

### YAML

**Default format.** Most readable for configuration files.

**Extension:** `.yaml` or `.yml`

```yaml
# config/default.yaml
api:
  host: localhost
  port: 3000
  features:
    - authentication
    - caching
    - logging

database:
  host: localhost
  port: 5432
  options:
    ssl: true
    poolSize: 10
```

**Usage:**
```typescript
const tconf = initialize({
  path: './config',
  // format: 'yaml' is the default
});
```

### JSON

Standard JSON format.

**Extension:** `.json`

```json
{
  "api": {
    "host": "localhost",
    "port": 3000,
    "features": [
      "authentication",
      "caching",
      "logging"
    ]
  },
  "database": {
    "host": "localhost",
    "port": 5432,
    "options": {
      "ssl": true,
      "poolSize": 10
    }
  }
}
```

**Usage:**
```typescript
const tconf = initialize({
  path: './config',
  format: 'json',
});
```

### JSON5

JSON with comments and relaxed syntax.

**Extension:** `.json5`

```json5
{
  // API configuration
  api: {
    host: 'localhost',
    port: 3000,
    features: [
      'authentication',
      'caching',
      'logging',
    ],
  },

  // Database settings
  database: {
    host: 'localhost',
    port: 5432,
    options: {
      ssl: true,
      poolSize: 10,
    },
  },
}
```

**Usage:**
```typescript
const tconf = initialize({
  path: './config',
  format: 'json5',
});
```

---

## Debugging

tconf uses the [`debug`](https://www.npmjs.com/package/debug) module for logging.

**Enable debug output:**

```bash
DEBUG=tconf* node app.js
```

**Output includes:**
- Files being loaded
- Merge operations
- Environment variable mappings
- Type coercion details
- Validation errors

**Example output:**
```
tconf Loading config from: ./config/default.yaml +0ms
tconf Loading config from: ./config/production.yaml +5ms
tconf Applying ENV variable: CONFIG_api__port=8080 +1ms
tconf Coerced CONFIG_api__port to number: 8080 +0ms
tconf Loading config from: ./config/local.yaml +2ms
tconf Validation successful +3ms
```

**Selective debugging:**

```bash
# Only file loading
DEBUG=tconf:file node app.js

# Only env variable mapping
DEBUG=tconf:env node app.js
```

---

## Examples

### Basic Configuration

**Minimal setup:**

```typescript
// config.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const Config = z.object({
  port: z.number(),
  host: z.string(),
});

export default initialize({ path: './config', schema: Config }).get();
```

```yaml
# config/default.yaml
port: 3000
host: localhost
```

```typescript
// app.ts
import config from './config';

console.log(`Server running on ${config.host}:${config.port}`);
```

### Production Deployment

**Using environment variables and templates:**

```typescript
// config.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const Config = z.object({
  app: z.object({
    name: z.string(),
    port: z.number(),
    env: z.enum(['development', 'staging', 'production']),
  }),
  database: z.object({
    url: z.string(),
    ssl: z.boolean(),
    poolSize: z.number(),
  }),
  redis: z.object({
    url: z.string(),
    ttl: z.number(),
  }),
  secrets: z.object({
    jwtSecret: z.string(),
    apiKey: z.string(),
  }),
});

export const tconf = initialize({
  path: './config',
  schema: Config,
});

export default tconf.get();
```

```yaml
# config/default.yaml
app:
  name: MyApp
  port: 3000
  env: development

database:
  url: postgres://localhost/myapp_dev
  ssl: false
  poolSize: 5

redis:
  url: redis://localhost:6379
  ttl: 3600

secrets:
  jwtSecret: dev-secret
  apiKey: dev-api-key
```

```yaml
# config/production.yaml
app:
  env: production
  port: ${PORT:8080}

database:
  url: ${DATABASE_URL}
  ssl: true
  poolSize: ${DB_POOL_SIZE:20}

redis:
  url: ${REDIS_URL}
  ttl: ${CACHE_TTL:7200}

secrets:
  jwtSecret: ${JWT_SECRET}
  apiKey: ${API_KEY}
```

**Deployment:**

```bash
NODE_ENV=production \
DATABASE_URL=postgres://prod-db.example.com/myapp \
REDIS_URL=redis://prod-cache.example.com:6379 \
JWT_SECRET=super-secret-key \
API_KEY=prod-api-key \
node app.js
```

### Microservices

**Shared configuration across services:**

```typescript
// libs/config/src/base.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';

const BaseConfig = z.object({
  service: z.object({
    name: z.string(),
    port: z.number(),
  }),
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']),
    format: z.enum(['json', 'text']),
  }),
  tracing: z.object({
    enabled: z.boolean(),
    endpoint: z.url().optional(),
  }),
});

export const tconf = initialize({
  path: ['./config/shared', './config'],
  schema: BaseConfig,
});

export default tconf.get();
```

```typescript
// services/user-service/src/config.ts
import { z } from 'tconf/zod';
import { tconf } from '@libs/config/base';

const UserServiceConfig = z.object({
  database: z.object({
    url: z.string(),
    poolSize: z.number(),
  }),
  auth: z.object({
    jwtSecret: z.string(),
    tokenExpiry: z.number(),
  }),
});

export default tconf.register('userService', UserServiceConfig);
```

```yaml
# config/shared/default.yaml
service:
  port: 3000

logging:
  level: info
  format: json

tracing:
  enabled: true
```

```yaml
# services/user-service/config/default.yaml
service:
  name: user-service

userService:
  database:
    url: postgres://localhost/users
    poolSize: 10
  auth:
    jwtSecret: dev-secret
    tokenExpiry: 3600
```

### Testing

**Override configuration for tests:**

```typescript
// test/helpers/config.ts
import { z } from 'tconf/zod';
import { initialize } from 'tconf';
import { Config } from '../../src/config';

export function createTestConfig(overrides = {}) {
  return initialize({
    path: './config',
    schema: Config,
    defaults: {
      database: {
        url: 'postgres://localhost/test_db',
        ssl: false,
        poolSize: 1,
      },
      redis: {
        url: 'redis://localhost:6379/1',
        ttl: 100,
      },
      ...overrides,
    },
  }).get();
}
```

```typescript
// test/integration/api.test.ts
import { createTestConfig } from '../helpers/config';

describe('API Integration Tests', () => {
  it('should connect to test database', () => {
    const config = createTestConfig({
      database: {
        url: 'postgres://localhost/specific_test_db',
      },
    });

    // Use config for test...
  });
});
```

---

## Migration Guide

### From v3.x (runtypes) to v4.x (Zod)

v4.0 is a breaking change that replaces runtypes with Zod and moves to ESM.

**Key changes:**

1. **Import from `tconf/zod` instead of `zod`:**

```typescript
// Before (v3)
import * as rt from 'runtypes';

// After (v4)
import { z } from 'tconf/zod';
```

2. **Schema syntax changes:**

```typescript
// Before (v3)
const Config = rt.Record({
  port: rt.Number,
  host: rt.String,
  debug: rt.Optional(rt.Boolean),
});

// After (v4)
const Config = z.object({
  port: z.number(),
  host: z.string(),
  debug: z.boolean().optional(),
});
```

3. **Type inference:**

```typescript
// Before (v3)
type Config = rt.Static<typeof Config>;

// After (v4)
type Config = z.infer<typeof Config>;
```

4. **Optional fields:**

```typescript
// Before (v3)
rt.Optional(rt.String)

// After (v4)
z.string().optional()
```

5. **Union types:**

```typescript
// Before (v3)
rt.Union(rt.Literal('a'), rt.Literal('b'))

// After (v4)
z.enum(['a', 'b'])
// or
z.union([z.literal('a'), z.literal('b')])
```

6. **Intersection:**

```typescript
// Before (v3)
Schema1.And(Schema2)

// After (v4)
z.intersection(Schema1, Schema2)
// or
Schema1.merge(Schema2)
```

7. **ESM imports:**

All imports now require `.js` extensions in TypeScript files (for ESM compatibility):

```typescript
// After (v4)
import { initialize } from 'tconf';
import config from './config.js'; // Note .js extension
```

8. **Node version:**

v4 requires Node.js >= 20.

---

## Troubleshooting

### Configuration not loading

**Problem:** Configuration values are not being loaded.

**Solutions:**
1. Check that files exist at the specified path
2. Verify file format matches the `format` option
3. Enable debug logging: `DEBUG=tconf* node app.js`
4. Check that `NODE_ENV` is set correctly

### Type coercion not working

**Problem:** Environment variables remain strings instead of being coerced.

**Solutions:**
1. Ensure you're importing from `tconf/zod`: `import { z } from 'tconf/zod'`
2. Verify the schema type matches the expected coercion (e.g., `z.number()` for numbers)
3. Check environment variable naming (prefix, separator)
4. Enable debug logging to see coercion attempts

### Schema validation errors

**Problem:** Application throws validation errors on startup.

**Solutions:**
1. Check that all required fields have values in at least one configuration source
2. Verify environment variable templates are set: `${VAR_NAME}` requires `VAR_NAME` to exist
3. Use default values in templates: `${VAR_NAME:default}`
4. Make fields optional: `z.string().optional()`
5. Review the error message for specific field paths

### Environment variables not overriding

**Problem:** Environment variables are not overriding file-based config.

**Solutions:**
1. Check the variable name format: `CONFIG_path__to__field`
2. Verify the `envPrefix` (default `CONFIG_`)
3. Verify the `envSeparator` (default `__`)
4. Ensure `ENV` is in the `sources` list (it is by default)
5. Check if `local.yaml` is overriding the env var (local has highest priority)

### Module registration not working

**Problem:** `register()` doesn't find module configuration.

**Solutions:**
1. Ensure configuration files have a top-level key matching the module name
2. Verify the module name passed to `register()` matches the YAML key exactly
3. Check that files are being loaded (debug logging)

### RegExp or URL types not working

**Problem:** `z.regexp()` or `z.url()` not recognized.

**Solutions:**
1. Import from `tconf/zod`, not `zod`: `import { z } from 'tconf/zod'`
2. These are tconf custom extensions, not available in standard Zod
3. Check that your schema uses these types correctly

### Merging behavior unexpected

**Problem:** Arrays or objects not merging as expected.

**Solutions:**
1. Understand the merge order: default → NODE_ENV → ENV → local
2. Check `arrayMergeMethod` setting (default is `'overwrite'`)
3. Use `'combine'` for array concatenation: `mergeOpts: { arrayMergeMethod: 'combine' }`
4. Remember that Date, RegExp, and URL objects are treated as atomic (not merged)

### TypeScript types not inferred

**Problem:** Configuration object has `any` type.

**Solutions:**
1. Ensure you're passing a `schema` to `initialize()`
2. Use `const` for schema definition: `const Config = z.object({...})`
3. Import `z` from `tconf/zod`
4. Check that your IDE's TypeScript server is running correctly

---

**For more examples and guides, see [README.md](./README.md).**

**For issues and feature requests, visit [GitHub Issues](https://github.com/codemariner/tconf/issues).**
