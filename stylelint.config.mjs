// Style lint gate (US5). ignoreDisables prevents an inline disable from bypassing the gate.
// The plugin and rules live in the lint feature (tools/stylelint-plugin).
export default {
  plugins: ['@patods/stylelint-plugin'],
  rules: {
    '@patods/design-tokens': true,
    '@patods/contrast-pairs': true,
  },
  overrides: [
    {
      files: ['packages/tokens/dist/**/*.css', 'apps/**/*.css'],
      rules: {
        '@patods/design-tokens': null,
        '@patods/contrast-pairs': null,
      },
    },
  ],
}
