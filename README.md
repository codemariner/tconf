![tconf](https://user-images.githubusercontent.com/33014/144646320-bb6cc527-18d6-4889-998e-e37fdc849170.png)

[![Version](https://img.shields.io/npm/v/tconf.svg)](https://npmjs.org/package/tconf) [![Downloads/month](https://img.shields.io/npm/dm/tconf.svg)](https://npmjs.org/package/tconf) [![License](https://img.shields.io/npm/l/tconf.svg)](https://github.com/codemariner/tconf/blob/master/package.json)

Type-safe, hierarchical configuration for Node.js applications with automatic environment variable coercion.

## Quick Start

```bash
npm install tconf
```

**Define your schema:**

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

**Create config files:**

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

**Use your config:**

```typescript
import config from './config';

console.log(config.api.port); // Type-safe access
```

**Override with environment variables:**

```bash
# Automatic path-based mapping
CONFIG_api__port=8080 node app.js

# Or template interpolation
DB_PASSWORD=secret NODE_ENV=production node app.js
```

## Key Features

- **Type-Safe**: Full TypeScript support with Zod schema validation
- **Hierarchical Merging**: Combine `default.yaml` → `${NODE_ENV}.yaml` → env vars → `local.yaml`
- **Auto Type Coercion**: Environment variables automatically converted to `number`, `boolean`, `Date`, `RegExp`, `URL`, and arrays
- **Multiple Formats**: YAML, JSON, JSON5
- **Modular**: Register isolated configuration for different modules
- **12-Factor Compatible**: Supports environment variable configuration

## Example: Type Coercion

Environment variables are automatically coerced based on your schema (no need to add `.coerce`):

```typescript
import * as z from 'tconf/zod';

const Config = z.object({
  port: z.number(),
  enabled: z.boolean(),
  created: z.date(),
  apiUrl: z.urlObj(),    // Validates URL objects (use z.string().url() for URL strings)
  pattern: z.regexObj(), // Validates RegExp objects (use z.string().regex() for patterns)
});

// Environment variables
// CONFIG_port=3000
// CONFIG_enabled=true
// CONFIG_created=2024-01-01T00:00:00Z
// CONFIG_apiUrl=https://api.example.com
// CONFIG_pattern=^foo-.*

const config = tconf.get();
config.port;     // 3000 (number)
config.enabled;  // true (boolean)
config.created;  // Date object
config.apiUrl;   // URL object
config.pattern;  // RegExp object
```

## Example: Modular Configuration

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

## Documentation

See [full documentation](./DOC.md) for:
- Complete API reference
- Environment variable mapping strategies
- Merge behavior customization
- Advanced usage patterns

## Why tconf?

Traditional environment variable approaches fall short for complex applications:

**Before:**
```typescript
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASS,
  API_PORT,
  API_DEBUG,
  // ... dozens more
} = process.env;

const dbPort = parseInt(DB_PORT || '5432'); // Manual coercion
const apiDebug = API_DEBUG === 'true';      // Manual coercion
```

**With tconf:**
```yaml
# config/default.yaml
database:
  host: ${DB_HOST:localhost}
  user: ${DB_USER:postgres}
  password: ${DB_PASSWORD:password}
```

```typescript
// src/config.ts
import { initialize } from 'tconf'
import * as z from 'tconf/zod'

const Config = z.object({
  database: z.object({
    host: z.string(),
    user: z.string(),
    password: z.string(),
  })
})
const tconf = initialize({ path: '../config', schema: Config })
const config = tconf.get();
// Hierarchical, typed, validated, and coerced automatically
```

## Requirements

- Node.js >= 18
- TypeScript >= 5 (optional, but recommended)

## License

MIT
