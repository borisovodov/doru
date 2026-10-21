import { z } from 'zod';

/** The published editor schema for `settings.json`. */
export const SETTINGS_SCHEMA_URL = 'https://doru.family/settings.json';
/** The published editor schema for theme palette files. */
export const THEME_SCHEMA_URL = 'https://doru.family/theme.json';

const PROVIDER_IDS = [
  'openai',
  'anthropic',
  'gemini',
  'openrouter',
  'deepseek',
  'ollama',
  'lmstudio',
  'custom',
  'acp',
] as const;

export const AiSectionSchema = z
  .strictObject({
    provider: z
      .enum(PROVIDER_IDS)
      .optional()
      .describe(
        'Provider preset id. "acp" spawns an Agent Client Protocol agent (see "command") instead of calling an HTTP API.',
      ),
    baseUrl: z
      .string()
      .optional()
      .describe('API base URL. Empty means the preset\'s default endpoint. Ignored for provider "acp".'),
    model: z
      .string()
      .optional()
      .describe(
        'Model name. Empty means the preset\'s first default model. The DORU_AI_MODEL environment variable overrides this value. Ignored for provider "acp".',
      ),
    reasoning: z
      .enum(['none', 'minimal', 'low', 'medium', 'high', 'xhigh', 'max'])
      .optional()
      .describe(
        'Reasoning level for models that support it, translated to each provider\'s native mechanism. Absent means the provider default.',
      ),
    apiKey: z
      .string()
      .optional()
      .describe(
        'API key in plaintext. On first load the app encrypts it with the OS keychain, moves it to "apiKeyEncrypted" and removes this field. The DORU_AI_API_KEY environment variable overrides any stored key.',
      ),
    apiKeyEncrypted: z
      .string()
      .optional()
      .describe(
        'API key encrypted with the OS keychain (safeStorage), base64-encoded. Written by the app; do not edit by hand.',
      ),
    command: z
      .string()
      .optional()
      .describe('For provider "acp" only: the agent binary to spawn.'),
    args: z
      .array(z.string())
      .optional()
      .describe('For provider "acp" only: arguments for the agent command.'),
  })
  .describe('AI provider settings for the agent chat.');

export const McpServerSchema = z.strictObject({
  name: z.string().describe('Tool namespace, e.g. "web" for web:search.'),
  command: z.string().describe('Executable to run (npx, a binary path, …).'),
  args: z.array(z.string()).optional().describe('Arguments for the command.'),
  env: z
    .record(z.string(), z.string())
    .optional()
    .describe('Extra environment variables, e.g. API keys the server needs.'),
});

export const McpSectionSchema = z
  .strictObject({
    servers: z.array(McpServerSchema).optional(),
  })
  .describe(
    'Optional external MCP servers whose tools the in-app agent can use (web search, FamilySearch, filesystem, …). Each server is spawned as a subprocess; tools are prefixed with the server name, e.g. "web:search".',
  );

export const SettingsFileSchema = z
  .strictObject({
    $schema: z
      .string()
      .optional()
      .describe(
        'Reference to the settings schema; enables autocompletion and validation in editors that understand JSON Schema.',
      ),
    ai: AiSectionSchema.optional(),
    mcp: McpSectionSchema.optional(),
    theme: z
      .string()
      .optional()
      .describe(
        'Theme id: the file name (without the .json extension) of a bundled theme or of a file in <userData>/themes. Defaults to "doru". The operating system appearance decides which palette applies.',
      ),
  })
  .describe(
    'Settings for the Dóru desktop app (settings.json in the app\'s data directory). The file is JSONC — comments are allowed and changes are picked up live while the app is running. Defaults live in the app; the file only records explicit overrides, which the app writes when settings change.',
  );

/** Every key becomes a `--doru-<key>` CSS custom property. */
export const ThemePaletteSchema = z
  .record(z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9-]*$/), z.string())
  .describe(
    'CSS custom-property values: every key becomes --doru-<key> in the app stylesheet. Values may be any CSS value (hex, rgb(), gradients, …). See the theme guide for the standard variables.',
  );

export const ThemeFileSchema = z
  .strictObject({
    $schema: z
      .string()
      .optional()
      .describe(
        'Reference to the theme schema; enables autocompletion and validation in editors that understand JSON Schema.',
      ),
    name: z.string().optional().describe('Display name. Falls back to the file name (the theme id).'),
    dark: ThemePaletteSchema.optional(),
    light: ThemePaletteSchema.optional(),
  })
  .describe(
    'A Dóru theme: one palette file with a dark and a light section. The operating system appearance decides which palette applies. The file name (without the .json extension) is the theme id.',
  );

/** The published `settings.json` schema: generated from `SettingsFileSchema`. */
export function settingsJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(SettingsFileSchema) as Record<string, unknown>;
  const properties = schema['properties'] as Record<string, Record<string, unknown>>;
  const aiProperties = properties['ai']?.['properties'] as
    | Record<string, Record<string, unknown>>
    | undefined;
  const provider = aiProperties?.['provider'];
  if (provider) {
    provider['default'] = 'openai';
  }
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: SETTINGS_SCHEMA_URL,
    title: 'Dóru app settings',
    ...schema,
  };
}

/** The published `theme.json` schema: generated from `ThemeFileSchema`. */
export function themeJsonSchema(): Record<string, unknown> {
  const schema = z.toJSONSchema(ThemeFileSchema) as Record<string, unknown>;
  return {
    $schema: 'https://json-schema.org/draft/2020-12/schema',
    $id: THEME_SCHEMA_URL,
    title: 'Dóru color theme',
    ...schema,
  };
}
