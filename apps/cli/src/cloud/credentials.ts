const SERVICE = 'assure-cli';

/**
 * The CLI token lives in the operating system credential store (macOS Keychain, Windows
 * Credential Manager, Secret Service on Linux), keyed by server origin. The native module is
 * loaded only when a cloud command needs it, so local verification never depends on it.
 */
async function entry(server: string) {
  const { Entry } = await import('@napi-rs/keyring');
  return new Entry(SERVICE, server);
}

export async function readToken(server: string): Promise<string | undefined> {
  try {
    return (await entry(server)).getPassword() ?? undefined;
  } catch (error) {
    throw new Error(`Could not read the credential store: ${describe(error)}`, { cause: error });
  }
}

export async function writeToken(server: string, token: string): Promise<void> {
  try {
    (await entry(server)).setPassword(token);
  } catch (error) {
    throw new Error(`Could not write to the credential store: ${describe(error)}`, {
      cause: error,
    });
  }
}

export async function deleteToken(server: string): Promise<void> {
  try {
    (await entry(server)).deletePassword();
  } catch {
    // Already absent, or the store is unavailable; nothing to keep.
  }
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
