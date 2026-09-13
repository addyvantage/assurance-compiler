import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from './schema';

const url = process.env['DATABASE_URL'];
if (url === undefined) throw new Error('DATABASE_URL is not set.');

// One pool per process. Next.js dev reloads modules; the global keeps connections bounded.
const globalPool = globalThis as { assurePool?: Pool };
const pool = (globalPool.assurePool ??= new Pool({ connectionString: url, max: 10 }));

export const db = drizzle(pool, { schema });
export { schema };
