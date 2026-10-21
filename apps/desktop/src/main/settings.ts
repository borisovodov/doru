import { app } from 'electron';
import { existsSync, mkdirSync, readFileSync, writeFileSync, watch } from 'node:fs';
import { join } from 'node:path';
import { applyEdits, modify, parse, type ParseError } from 'jsonc-parser';
import { z } from 'zod';
import { log } from './log';
import { SettingsFileSchema } from './schemas';

export const APP_SETTINGS_FILE = 'settings.json';

export const DEFAULT_SETTINGS = `{
  "$schema": "https://doru.family/settings.json"
}
`;

/**
 * The single owner of the app settings file (settings.json in userData).
 * Everything that needs settings goes through `readSettings`; there is
 * exactly one parser and one file watcher for the whole main process.
 */

/** JSONC: trailing commas are allowed (the shipped default file uses one). */
const PARSE_OPTIONS = { allowTrailingComma: true };

export function settingsFilePath(): string {
  return join(app.getPath('userData'), APP_SETTINGS_FILE);
}

export function readSettings(): Record<string, unknown> {
  const file = settingsFilePath();
  mkdirSync(app.getPath('userData'), { recursive: true });
  if (!existsSync(file)) {
    writeFileSync(file, DEFAULT_SETTINGS);
  }

  const parseErrors: ParseError[] = [];
  const settings =
    (parse(readFileSync(file, 'utf8'), parseErrors, PARSE_OPTIONS) as Record<string, unknown> | undefined) ??
    {};

  if (parseErrors.length > 0) {
    log.warn(
      `settings.json is not valid JSONC (${parseErrors[0]?.error ?? 'syntax error'}) — replaced with defaults`,
    );
    writeFileSync(file, DEFAULT_SETTINGS);
    return parse(DEFAULT_SETTINGS, [], PARSE_OPTIONS) as Record<string, unknown>;
  }

  const result = SettingsFileSchema.safeParse(settings);
  if (!result.success) {
    log.warn(
      `settings.json does not match the settings schema — replaced with defaults:\n${z.prettifyError(result.error)}`,
    );
    writeFileSync(file, DEFAULT_SETTINGS);
    return parse(DEFAULT_SETTINGS, [], PARSE_OPTIONS) as Record<string, unknown>;
  }

  return settings;
}

/**
 * Applies JSONC edits sequentially (jsonc-parser keeps formatting and
 * comments intact) and writes the result back.
 */
export function writeSettingsEdits(edits: Array<{ path: (string | number)[]; value?: unknown }>): void {
  const file = settingsFilePath();
  readSettings();
  let text = readFileSync(file, 'utf8');
  for (const edit of edits) {
    const next = modify(text, edit.path, edit.value, { formattingOptions: { insertSpaces: true, tabSize: 2 } });
    text = applyEdits(text, next);
  }
  writeFileSync(file, text);
}

export function watchSettings(onChange: () => void): void {
  readSettings(); // ensure the file exists before fs.watch subscribes to it
  try {
    const watcher = watch(settingsFilePath(), () => onChange());
    watcher.unref();
  } catch {
    log.warn('could not watch the app settings file');
  }
}
