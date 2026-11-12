export default {
  extends: ['stylelint-config-standard'],
  ignoreFiles: [
    '**/node_modules/**',
    '**/dist/**',
    '**/out/**',
    '**/release/**',
    '**/coverage/**',
    '**/storybook-static/**',
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
      { ignoreProperties: ['-webkit-mask-image', '-webkit-background-clip', '-webkit-text-fill-color'] },
    ],
  },
};
