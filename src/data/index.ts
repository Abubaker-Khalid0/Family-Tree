/**
 * Data module — single entry point for all family tree data access.
 *
 * Consumers should import from `@/data` (this barrel) rather than
 * reaching into internal files like `data-access.ts` or `family-data.ts`.
 * This ensures that swapping the static data source for an API
 * requires changes only within this module.
 */

export { createDataAccess, dataAccess } from './data-access';
