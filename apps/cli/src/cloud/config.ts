import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { join } from 'node:path';

export const DEFAULT_SERVER = 'http://localhost:3000';
export const CLIENT_ID = 'assure-cli';

/** Per-user configuration. Holds links and a small retry spool; never a credential. */
export function configDirectory(env: NodeJS.ProcessEnv = process.env): string {
  if (process.platform === 'win32') {
    return join(env['APPDATA'] ?? join(homedir(), 'AppData', 'Roaming'), 'assure');
  }
  return join(env['XDG_CONFIG_HOME'] ?? join(homedir(), '.config'), 'assure');
}

export interface RepositoryLink {
  readonly server: string;
  readonly repositoryId: string;
  readonly repositoryName: string;
}

interface LinksFile {
  readonly version: 1;
  readonly links: Record<string, RepositoryLink>;
}

export function normalizeServer(url: string): string {
  const parsed = new URL(url);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('The server URL must start with http:// or https://.');
  }
  return parsed.origin;
}

async function readLinks(): Promise<LinksFile> {
  try {
    const parsed = JSON.parse(
      await readFile(join(configDirectory(), 'links.json'), 'utf8'),
    ) as unknown;
    if (
      parsed !== null &&
      typeof parsed === 'object' &&
      (parsed as { version?: unknown }).version === 1 &&
      typeof (parsed as { links?: unknown }).links === 'object'
    ) {
      return parsed as LinksFile;
    }
  } catch {
    // Missing or unreadable: start empty.
  }
  return { version: 1, links: {} };
}

export async function readLink(root: string): Promise<RepositoryLink | undefined> {
  return (await readLinks()).links[root];
}

export async function writeLink(root: string, link: RepositoryLink): Promise<void> {
  const current = await readLinks();
  await mkdir(configDirectory(), { recursive: true, mode: 0o700 });
  await writeFile(
    join(configDirectory(), 'links.json'),
    `${JSON.stringify({ version: 1, links: { ...current.links, [root]: link } }, null, 2)}\n`,
    { mode: 0o600 },
  );
}

/** Reports that could not be delivered wait here, at most `SPOOL_LIMIT`, oldest dropped first. */
const SPOOL_LIMIT = 20;

export interface SpooledReport {
  readonly server: string;
  readonly runId: string;
  readonly report: unknown;
}

export async function spoolReport(entry: SpooledReport): Promise<string> {
  const directory = join(configDirectory(), 'spool');
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const existing = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  for (const stale of existing.slice(0, Math.max(0, existing.length + 1 - SPOOL_LIMIT))) {
    await rm(join(directory, stale), { force: true });
  }
  const file = join(directory, `${String(Date.now())}-${entry.runId}.json`);
  await writeFile(file, JSON.stringify(entry), { mode: 0o600 });
  return file;
}

export async function listSpool(): Promise<{ file: string; entry: SpooledReport }[]> {
  const directory = join(configDirectory(), 'spool');
  let names: string[];
  try {
    names = (await readdir(directory)).filter((name) => name.endsWith('.json')).sort();
  } catch {
    return [];
  }
  const entries: { file: string; entry: SpooledReport }[] = [];
  for (const name of names) {
    const file = join(directory, name);
    try {
      entries.push({ file, entry: JSON.parse(await readFile(file, 'utf8')) as SpooledReport });
    } catch {
      await rm(file, { force: true });
    }
  }
  return entries;
}
