// Raw color literals are banned outside the token layer: a component that
// hardcodes a color stops following the selected theme.
const colorLiteral = /(#[0-9a-f]{3,8}\b|\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\blight-dark\()/i;

export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/out/**',
    '**/release/**',
    '**/coverage/**',
    'apps/website/.vitepress/cache/**',
    'apps/website/.vitepress/dist/**',
    'apps/desktop/build/llama/**',
    'apps/desktop/build/Icon.icon/**',
  ],
  rules: {
    // CSS Modules in this repo use both camelCase and kebab-case class names.
    'selector-class-pattern': ['^[a-z][a-zA-Z0-9-]*$', { message: 'Use camelCase or kebab-case class names.' }],
    // These prefixes are required by Chromium for text gradients and masks.
    'property-no-vendor-prefix': [
      true,
      {
        ignoreProperties: [
          '-webkit-appearance',
          '-webkit-mask-image',
          '-webkit-background-clip',
          '-webkit-text-fill-color',
        ],
      },
    ],
    // Colors come from --doru-* tokens. The token layer and the website
    // palette are the only places that may define literal colors.
    'declaration-property-value-disallowed-list': {
      '/^--/': [colorLiteral],
      '/color$/': [colorLiteral],
      '/^background/': [colorLiteral],
      '/^border/': [colorLiteral],
      '/^outline/': [colorLiteral],
      '/^box-shadow$/': [colorLiteral],
      '/^text-shadow$/': [colorLiteral],
      '/^text-decoration$/': [colorLiteral],
      '/^text-emphasis$/': [colorLiteral],
      '/^column-rule$/': [colorLiteral],
      '/^(fill|stroke)$/': [colorLiteral],
      '/^filter$/': [colorLiteral],
    },
    'color-named': 'never',
  },
  overrides: [
    {
      files: ['packages/ui/src/styles/tokens.css', 'apps/website/**'],
      rules: {
        'declaration-property-value-disallowed-list': null,
        'color-named': null,
      },
    },
  ],
};
