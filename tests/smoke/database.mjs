import { testDatabaseUrl } from '../helpers/test-database.mjs';

// Imported before any application module creates its pg pool.
process.env.DATABASE_URL = testDatabaseUrl('SMOKE_DATABASE_URL').toString();
