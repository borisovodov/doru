import { describe, expect, test } from 'vitest';
import {
  SETTINGS_SCHEMA_URL,
  THEME_SCHEMA_URL,
  SettingsFileSchema,
  ThemeFileSchema,
  settingsJsonSchema,
  themeJsonSchema,
} from '../src/main/schemas';

describe('settings schema', () => {
  test('accepts per-provider settings', () => {
    const settings = {
      $schema: SETTINGS_SCHEMA_URL,
      ai: {
        provider: 'ollama',
        providers: {
          ollama: {
            baseUrl: 'http://localhost:11434/v1',
            model: 'llama3.3',
          },
        },
      },
    };
    expect(SettingsFileSchema.safeParse(settings).success).toBe(true);
  });

  test('accepts an ACP provider and a theme', () => {
    const settings = {
      ai: {
        provider: 'acp',
        providers: { acp: { command: 'my-agent', args: ['--verbose'] } },
      },
      theme: 'catppuccin',
    };
    expect(SettingsFileSchema.safeParse(settings).success).toBe(true);
  });

  test('keeps any provider id as plain text and rejects unknown keys and wrong types', () => {
    // Provider ids are free-form strings: the runtime falls back to the
    // default preset for ids it does not know, so no id can invalidate a
    // settings file.
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'openai-compatible' } }).success).toBe(true);
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'ollama' } }).success).toBe(true);
    expect(SettingsFileSchema.safeParse({ ai: { provider: 42 } }).success).toBe(false);
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'ollama' }, extra: true }).success).toBe(false);
    expect(SettingsFileSchema.safeParse({ ai: { providers: { ollama: { baseUrl: 42 } } } }).success).toBe(false);
    // The old flat settings shape is gone: unknown fields fail validation
    // and the file is replaced with the default template.
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'ollama', baseUrl: 'http://x' } }).success).toBe(false);
    // The raw MCP host section is gone: unknown top-level sections still fail.
    expect(SettingsFileSchema.safeParse({ mcp: { servers: [] } }).success).toBe(false);
  });

  test('keeps the reasoning level as plain text and rejects wrong types', () => {
    // Reasoning levels are free-form strings: levels the running version
    // does not know fall back to the provider default at runtime, so no
    // value can invalidate a settings file.
    expect(
      SettingsFileSchema.safeParse({ ai: { providers: { ollama: { reasoning: 'high' } } } }).success,
    ).toBe(true);
    expect(
      SettingsFileSchema.safeParse({ ai: { providers: { ollama: { reasoning: 'some-future-level' } } } }).success,
    ).toBe(true);
    expect(SettingsFileSchema.safeParse({ ai: { providers: { ollama: { reasoning: 42 } } } }).success).toBe(false);
  });

  test('the published schema is 2020-12, strict and addressed at the URL', () => {
    const schema = settingsJsonSchema();
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema['$id']).toBe(SETTINGS_SCHEMA_URL);
    expect(schema['additionalProperties']).toBe(false);
    const ai = (schema['properties'] as Record<string, Record<string, unknown>>)['ai'];
    const provider = ai?.['properties'] as Record<string, Record<string, unknown>> | undefined;
    expect(provider?.['provider']?.['default']).toBe('ollama');
  });
});

describe('theme schema', () => {
  test('accepts a bundled-theme shape', () => {
    const theme = {
      $schema: THEME_SCHEMA_URL,
      name: 'Test',
      dark: { 'bg-canvas': '#000000', fg: 'rgb(1, 2, 3)' },
      light: { 'bg-canvas': '#ffffff' },
    };
    expect(ThemeFileSchema.safeParse(theme).success).toBe(true);
  });

  test('rejects malformed palettes and unknown keys', () => {
    expect(ThemeFileSchema.safeParse({ dark: { 'bad key': '#fff' } }).success).toBe(false);
    expect(ThemeFileSchema.safeParse({ dark: { fg: 42 } }).success).toBe(false);
    expect(ThemeFileSchema.safeParse({ comment: true }).success).toBe(false);
  });

  test('the published schema is addressed at the URL', () => {
    expect(themeJsonSchema()['$id']).toBe(THEME_SCHEMA_URL);
  });
});
