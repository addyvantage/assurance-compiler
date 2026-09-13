import { fileURLToPath } from 'node:url';

// Next.js loads .env.local itself; vitest does not.
try {
  process.loadEnvFile(fileURLToPath(new URL('../../.env.local', import.meta.url)));
} catch {
  // Absent: DATABASE_URL and BETTER_AUTH_SECRET must come from the environment.
}
