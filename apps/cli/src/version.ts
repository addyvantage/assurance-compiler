import { readFileSync } from 'node:fs';

/** Reads the CLI version from its package manifest, which sits beside both `src/` and `dist/`. */
export function readVersion(): string {
  const manifest: unknown = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  );
  if (
    typeof manifest === 'object' &&
    manifest !== null &&
    'version' in manifest &&
    typeof manifest.version === 'string'
  ) {
    return manifest.version;
  }
  throw new Error('The CLI package manifest does not declare a version.');
}
