# Change Log

All notable changes to this project will be documented in this file.

## [4.1.0] - 2025-12-02

### Breaking Changes

* The default zod `url()` and `regex()` are no longer overridden. Instead, you can import `urlObj()` and `regexObj()`. Example:
  ```js
  import * as z from 'tconf/zod'

  const schema = z.object({
    url: z.urlObj()
  })
  ```


## [4.0.0] - 2025-12-02

### Breaking Changes

**This is a major release with breaking changes. Please see [MIGRATION.md](./MIGRATION.md) for a complete migration guide.**

* **Pure ESM Package**: tconf is now a pure ESM package. You must use `import` instead of `require()`. Your project must include `"type": "module"` in package.json or use `.mjs` file extensions.

* **Runtypes → Zod**: Replaced runtypes with zod for schema validation and type inference.
  - `Record({})` → `z.object({})`
  - `Optional(Type)` → `Type.optional()`
  - `Static<typeof T>` → `z.infer<T>`
  - See [MIGRATION.md](./MIGRATION.md) for complete conversion guide

* **Node.js 18+**: Minimum Node.js version increased from 16 to 18.

* **Jest → Vitest**: Test framework migrated from Jest to Vitest (internal change, does not affect library users).

### Features

* **Bundled Zod 4**: tconf now includes Zod 4.x as a direct dependency and exports it for use via `import { z } from 'tconf/zod'`. This ensures version compatibility and eliminates peer dependency conflicts. Users should import Zod from `tconf/zod` rather than installing it separately.

* **Custom Type Extensions**: Added tconf-specific extensions to Zod:
  - `z.regexp()` - Validates and coerces to `RegExp` objects from string patterns
  - `z.url()` - Validates and coerces to `URL` objects (overrides Zod's built-in string URL validator)
  - Import from `tconf/zod` to access these extensions

* **Performance Optimization**: Modular configuration loading optimized - files are now loaded once and cached. The `register()` method re-validates cached configuration without re-reading files from disk.

* **Hybrid Coercion System**: Automatic type coercion now uses zod's built-in coercion for primitives (`z.coerce.number()`, `z.coerce.boolean()`) with custom logic for complex types (Date, RegExp, URL, arrays). Date parsing uses JavaScript's native `new Date()` constructor.

* **Better Type Inference**: Improved type safety with zod's TypeScript-first schema validation and automatic type inference.

* **Enhanced Documentation**: Completely rewritten documentation:
  - README.md now concise and example-focused for quick starts
  - DOC.md provides comprehensive reference guide with all features, API documentation, examples, and troubleshooting

### Technical Details

* Implemented zod schema introspection API (equivalent to runtypes reflection API) to traverse schemas and extract type information for environment variable coercion.

* Fixed template variable interpolation to happen per-file before merging, allowing undefined templates to reveal earlier layer values (preserves default value fallback behavior).

* Full ESM support with proper module resolution using `"moduleResolution": "bundler"`.

### Migration

See [MIGRATION.md](./MIGRATION.md) for step-by-step migration instructions from v3.x to v4.0.0.

## [3.1.0]

### Features
* Support default values for environment variable templates. 
  * example:
    ```yaml
    api:
      port: ${PORT:3000}
    ```

### Chores
* Update runtypes to 6.7.0

## [3.0.0]

### Features
* Add support for modular configuration.

### Breaking Changes
* The default `load` function has been removed, though it is still available. Callers should instead use the new `initialize` function to load configuration and get an instance of `Tconf`.

  * before:
    ```typescript
    import loadConfig from 'tconf';
   
    const config = loadConfig({...})
   
    export default config;
    ```
  * after:
    ```typescript
    import { initialize } from 'tconf';

    // export our tconf instance so modules can register their own configuration
    // (without having to make it global to the entire application)
    export const tconf = initialize({...})

    export default tconf.get();
    ```

## [2.2.2]

### Chores
* Upgrade eslint packages.

### Bug Fixes
* `Optional` fields now processed correctly when performing env coercion.
  For example, the following should be able to be mapped correctly from
  env vars:
  ```typescript
  const DbConfig = Record({
    host: String,
	database: Optional(String),
  });
  ```
  This was previously failing to recognize the `Optional`.
* Fixed an issue with env config merging. Nested properties were being assigned
  at the wrong path.


## [2.2.1]

### Chores
* Add LICENSE file
* Only include required files in package

## [2.2.0]

### Chores
* Clean up code
* Update README
* Package updates

### Features
* Add support for coercion of env vars to array
* Ignore empty files

## [2.1.2]

### Chores
* Update dependencies.


## [2.1.1]

### Bug Fixes
* Add missing parsers file.


## [2.1.0]

### Chores
* Code reorganization
* README update
### Features
* Add support for json5
* Add `format` config value for 'yml'. This is also used as the file extension. Previously, only '.yaml' was supported. You can now use '.yml' or '.yaml'.
