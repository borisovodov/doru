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
  test('accepts the default settings shape', () => {
    const settings = {
      $schema: SETTINGS_SCHEMA_URL,
      ai: {
        provider: 'openai',
        baseUrl: 'https://api.openai.com/v1',
        apiKey: '',
        model: 'gpt-4o-mini',
      },
    };
    expect(SettingsFileSchema.safeParse(settings).success).toBe(true);
  });

  test('accepts an ACP provider, MCP servers and a theme', () => {
    const settings = {
      ai: { provider: 'acp', command: 'my-agent', args: ['--verbose'] },
      mcp: {
        servers: [{ name: 'web', command: 'npx', args: ['-y', 'pkg'], env: { KEY: 'value' } }],
      },
      theme: 'catppuccin',
    };
    expect(SettingsFileSchema.safeParse(settings).success).toBe(true);
  });

  test('rejects unknown provider ids, unknown keys and wrong types', () => {
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'openai-compatible' } }).success).toBe(false);
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'openai' }, extra: true }).success).toBe(false);
    expect(SettingsFileSchema.safeParse({ ai: { provider: 'openai', baseUrl: 42 } }).success).toBe(false);
    expect(
      SettingsFileSchema.safeParse({ mcp: { servers: [{ name: 'web' }] } }).success,
    ).toBe(false);
  });

  test('the published schema is 2020-12, strict and addressed at the URL', () => {
    const schema = settingsJsonSchema();
    expect(schema['$schema']).toBe('https://json-schema.org/draft/2020-12/schema');
    expect(schema['$id']).toBe(SETTINGS_SCHEMA_URL);
    expect(schema['additionalProperties']).toBe(false);
    const ai = (schema['properties'] as Record<string, Record<string, unknown>>)['ai'];
    const provider = ai?.['properties'] as Record<string, Record<string, unknown>> | undefined;
    expect(provider?.['provider']?.['default']).toBe('openai');
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
