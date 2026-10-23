import { app } from 'electron';
import { chmodSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { log } from './log';

/**
 * Machine secrets (the AI provider API keys) live in
 * `<userData>/secrets.json`, separate from settings.json so that sharing
 * settings never leaks keys. Keys are stored per provider id, so switching
 * providers swaps the right key. Written with 0600 permissions: readable
 * and writable only by the owning user account. This mirrors how OpenCode,
 * the GitHub CLI and .netrc store credentials — no OS keychain, so no
 * system permission dialogs when the app reads back what it wrote itself.
 */

export const SECRETS_FILE = 'secrets.json';

interface SecretsJson {
  /** API keys keyed by provider id; empty values are treated as absent. */
  apiKeys?: Record<string, string>;
}

export function secretsFilePath(): string {
  return join(app.getPath('userData'), SECRETS_FILE);
}

function readSecrets(): SecretsJson {
  const file = secretsFilePath();
  if (!existsSync(file)) {
    return {};
  }
  try {
    return JSON.parse(readFileSync(file, 'utf8')) as SecretsJson;
  } catch {
    log.warn('secrets.json is not valid JSON — stored API keys were ignored');
    return {};
  }
}

function writeSecrets(secrets: SecretsJson): void {
  mkdirSync(app.getPath('userData'), { recursive: true });
  const file = secretsFilePath();
  writeFileSync(file, `${JSON.stringify(secrets, null, 2)}\n`, { mode: 0o600 });
  // Normalize permissions on existing files regardless of the umask.
  chmodSync(file, 0o600);
}

export function loadAiApiKey(providerId: string): string {
  return readSecrets()['apiKeys']?.[providerId] ?? '';
}

export function saveAiApiKey(providerId: string, key: string): void {
  const secrets = readSecrets();
  writeSecrets({ ...secrets, apiKeys: { ...(secrets['apiKeys'] ?? {}), [providerId]: key } });
}

export function clearAiApiKey(providerId: string): void {
  const secrets = readSecrets();
  const apiKeys = { ...(secrets['apiKeys'] ?? {}) };
  delete apiKeys[providerId];
  if (Object.keys(apiKeys).length === 0) {
    rmSync(secretsFilePath(), { force: true });
  } else {
    writeSecrets({ ...secrets, apiKeys });
  }
}
