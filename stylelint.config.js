// Raw color literals are banned outside the token layer: a component that
// hardcodes a color stops following the selected theme. Hex colors use
// Stylelint's syntax-aware rule so SVG url(#id) fragments are not mistaken
// for colors.
const colorLiteral = /\b(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color)\(|\blight-dark\(/i;

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
      '/^--/i': [colorLiteral],
      '/color$/i': [colorLiteral],
      '/^background/i': [colorLiteral],
      '/^border/i': [colorLiteral],
      '/^outline/i': [colorLiteral],
      '/^box-shadow$/i': [colorLiteral],
      '/^text-shadow$/i': [colorLiteral],
      '/^text-decoration$/i': [colorLiteral],
      '/^text-emphasis$/i': [colorLiteral],
      '/^column-rule$/i': [colorLiteral],
      '/^list-style/i': [colorLiteral],
      '/^(?:-webkit-)?mask(-|$)/i': [colorLiteral],
      '/^(fill|stroke)$/i': [colorLiteral],
      '/^filter$/i': [colorLiteral],
    },
    'color-named': 'never',
    'color-no-hex': true,
  },
  overrides: [
    {
      files: ['packages/ui/src/styles/tokens.css', 'apps/website/**'],
      rules: {
        'declaration-property-value-disallowed-list': null,
        'color-named': null,
        'color-no-hex': null,
      },
    },
  ],
};
