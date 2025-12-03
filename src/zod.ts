/**
 * Re-export zod with tconf extensions.
 *
 * Users should import from 'tconf/zod' to get the version tconf expects.
 * This ensures you're using the same zod version as tconf for compatibility.
 *
 * Custom schema types:
 * - regexObj(): Validates RegExp objects (not string patterns - use z.string().regex() for that)
 * - urlObj(): Validates URL objects (not URL strings - use z.string().url() for that)
 */

// Re-export everything from zod as-is (preserves z.infer, z.input, z.output)
export * from 'zod';

// Export custom tconf extensions as standalone functions
export { regexObj, urlObj } from './zod-extensions.js';
export type { ZodRegexObj, ZodURLObj } from './zod-extensions.js';
