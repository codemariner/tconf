# Migration Guide: v3.x to v4.0.0

This guide will help you migrate from tconf v3.x (runtypes + CommonJS) to v4.0.0 (zod + ESM).

## Breaking Changes

### 1. Pure ESM Package
**v4.0.0 is now a pure ESM package.** This means:
- You must use `import` instead of `require()`
- Your project must support ESM (Node.js 20+ recommended)
- `package.json` must include `"type": "module"` or use `.mjs` file extensions

### 2. Runtypes → Zod
The schema validation library has changed from runtypes to zod.

### 3. Minimum Node.js Version
- **Old**: Node.js 16+
- **New**: Node.js 18+

## Migration Steps

### Step 1: Update Dependencies

```bash
npm install tconf@^4.0.0
# or
pnpm add tconf@^4.0.0
```

### Step 2: Convert to ESM

If your project is still using CommonJS, convert it to ESM:

**package.json:**
```json
{
  "type": "module"
}
```

**Update imports:**
```typescript
// Old (CommonJS)
const { initialize } = require('tconf');

// New (ESM)
import { initialize } from 'tconf';
```

### Step 3: Migrate Schemas from Runtypes to Zod

Here's a comprehensive conversion guide:

#### Basic Types

| Runtypes | Zod |
|----------|-----|
| `String` | `z.string()` |
| `Number` | `z.number()` |
| `Boolean` | `z.boolean()` |
| `Null` | `z.null()` |
| `Undefined` | `z.undefined()` |

#### Objects

```typescript
// Old (Runtypes)
import { Record, String, Number } from 'runtypes';

const Config = Record({
  host: String,
  port: Number
});

// New (Zod)
import { z } from 'zod';

const Config = z.object({
  host: z.string(),
  port: z.number()
});
```

#### Optional Fields

```typescript
// Old (Runtypes)
import { Record, String, Optional } from 'runtypes';

const Config = Record({
  host: String,
  port: Optional(Number)
});

// New (Zod)
import { z } from 'zod';

const Config = z.object({
  host: z.string(),
  port: z.number().optional()
});
```

#### Partial Objects

```typescript
// Old (Runtypes)
import { Record, Partial, String, Number } from 'runtypes';

const Config = Record({
  host: String,
}).And(Partial({
  port: Number,
  debug: Boolean
}));

// New (Zod)
import { z } from 'zod';

const Config = z.object({
  host: z.string(),
  port: z.number().optional(),
  debug: z.boolean().optional()
});

// Or using .partial()
const Config = z.object({
  host: z.string()
}).merge(z.object({
  port: z.number(),
  debug: z.boolean()
}).partial());
```

#### Intersections

```typescript
// Old (Runtypes)
const Config = SchemaA.And(SchemaB);

// New (Zod)
const Config = z.intersection(SchemaA, SchemaB);
// or
const Config = SchemaA.merge(SchemaB);
```

#### Unions

```typescript
// Old (Runtypes)
import { Union, Literal } from 'runtypes';

const Status = Union(
  Literal('active'),
  Literal('inactive')
);

// New (Zod)
import { z } from 'zod';

const Status = z.union([
  z.literal('active'),
  z.literal('inactive')
]);

// Or use enum for simpler cases
const Status = z.enum(['active', 'inactive']);
```

#### Arrays

```typescript
// Old (Runtypes)
import { Array, String } from 'runtypes';

const Tags = Array(String);

// New (Zod)
import { z } from 'zod';

const Tags = z.array(z.string());
```

#### Dates and RegExp

```typescript
// Old (Runtypes)
import { InstanceOf } from 'runtypes';

const Config = Record({
  startTime: InstanceOf(Date),
  pattern: InstanceOf(RegExp)
});

// New (Zod)
import { z } from 'zod';

const Config = z.object({
  startTime: z.date(),
  pattern: z.instanceof(RegExp)
});
```

#### Type Inference

```typescript
// Old (Runtypes)
import { Static } from 'runtypes';

type Config = Static<typeof Config>;

// New (Zod)
import { z } from 'zod';

type Config = z.infer<typeof Config>;
```

### Step 4: Update Initialization Code

The initialization API remains the same:

```typescript
// Old (v3.x)
import { initialize } from 'tconf';
import { Config } from './schema';

const tconf = initialize({
  path: './config',
  schema: Config
});

const config = tconf.get();

// New (v4.0.0) - Same!
import { initialize } from 'tconf';
import { Config } from './schema';

const tconf = initialize({
  path: './config',
  schema: Config
});

const config = tconf.get();
```

### Step 5: Update Module Registration

Module registration API is unchanged, just update the schema:

```typescript
// Old (v3.x)
import { tconf } from './config';
import { Record, String } from 'runtypes';

const Schema = Record({
  apiKey: String
});

const config = tconf.register('auth', Schema);

// New (v4.0.0)
import { z } from 'zod';
import { tconf } from './config';

const Schema = z.object({
  apiKey: z.string()
});

const config = tconf.register('auth', Schema);
```

## Environment Variable Coercion

Environment variable coercion works the same way but now uses zod's type system:

**Supported automatic coercions:**
- `z.string()` - No coercion needed
- `z.number()` - Coerces string to number
- `z.boolean()` - Coerces "true"/"false" strings
- `z.date()` - Parses date strings
- `z.instanceof(RegExp)` - Creates RegExp from string pattern
- `z.array()` - Splits comma-separated values

**Example:**

```yaml
# config/default.yaml
api:
  port: ${API_PORT:3000}
  debug: ${DEBUG:false}
```

```typescript
const Config = z.object({
  api: z.object({
    port: z.number(),
    debug: z.boolean()
  })
});
```

```bash
# These will be automatically coerced
export API_PORT=8080     # → 8080 (number)
export DEBUG=true        # → true (boolean)
```

## Performance Improvements

v4.0.0 includes significant performance improvements:

- **Modular loading optimization**: Configuration files are now loaded once and cached. The `register()` method re-validates the cached configuration without re-reading files from disk.
- **Faster tests**: Migrated from Jest to Vitest for faster test execution with native ESM support.

## Testing Migration

If you were using Jest, you may want to consider migrating to Vitest (though Jest with ESM support also works):

```json
// package.json
{
  "scripts": {
    "test": "vitest run"
  },
  "devDependencies": {
    "vitest": "^1.0.0"
  }
}
```

## Example: Complete Migration

### Before (v3.x with Runtypes)

```typescript
// config/schema.ts
import { Record, String, Number, Boolean, Optional, Static } from 'runtypes';

export const DatabaseConfig = Record({
  host: String,
  port: Number,
}).And(Partial({
  username: String,
  password: String
}));

export const ApiConfig = Record({
  port: Number,
  debug: Optional(Boolean)
});

export const Config = Record({
  database: DatabaseConfig,
  api: ApiConfig
});

export type Config = Static<typeof Config>;

// config/index.ts
const { initialize } = require('tconf');
const { Config } = require('./schema');

const tconf = initialize({
  path: __dirname,
  schema: Config
});

module.exports = tconf.get();
```

### After (v4.0.0 with Zod)

```typescript
// config/schema.ts
import { z } from 'zod';

export const DatabaseConfig = z.object({
  host: z.string(),
  port: z.number(),
  username: z.string().optional(),
  password: z.string().optional()
});

export const ApiConfig = z.object({
  port: z.number(),
  debug: z.boolean().optional()
});

export const Config = z.object({
  database: DatabaseConfig,
  api: ApiConfig
});

export type Config = z.infer<typeof Config>;

// config/index.ts
import { initialize } from 'tconf';
import { Config } from './schema.js';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const tconf = initialize({
  path: __dirname,
  schema: Config
});

export default tconf.get();
```

## Need Help?

If you encounter issues during migration:

1. Check the [documentation](./DOC.md)
2. Review the [test files](./test) for examples
3. Open an issue on [GitHub](https://github.com/codemariner/tconf/issues)
