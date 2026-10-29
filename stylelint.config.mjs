// Gate do lint de estilos (US5). ignoreDisables impede que um disable inline burle o gate.
// O plugin e as regras são adicionados na feature de lint (tools/stylelint-plugin).
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
