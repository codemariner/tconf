# Change Log

All notable changes to this project will be documented in this file.

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
