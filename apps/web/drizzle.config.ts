import { defineConfig } from 'drizzle-kit';

// drizzle-kit does not read .env.local on its own; Next.js does.
try {
  process.loadEnvFile('.env.local');
} catch {
  // Not present: DATABASE_URL must then come from the environment.
}

const url = process.env['DATABASE_URL'];
if (url === undefined) throw new Error('DATABASE_URL is not set.');

export default defineConfig({
  dialect: 'postgresql',
  schema: './lib/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
