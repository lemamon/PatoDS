// Style lint gate (US5, lint-rules.md §6). Runs the two PatoDS rules over the on-disk fixtures.
// `--ignore-disables` (wired in the CLI) stops an inline `stylelint-disable` from bypassing the gate.
// Only the valid fixtures and the gate-probe are governed; everything else is unmatched, so the gate
// never touches the example app's CSS or the generated token CSS (lint-rules.md §3, §6).
//
// The manifest is referenced by package specifier (`@patods/tokens/meta/*`), resolved from the plugin
// package that declares the devDependency (§2.1/§2.2). The control registry and the synthetic contrast
// manifest/surfaces are the fixture copies; the core feature swaps in the derived registry and the real
// `packages/tokens/contrast/` data over the core CSS glob (§6).
export default {
  plugins: ['@patods/stylelint-plugin'],
  // No rule runs globally; the override below governs only the fixtures and the gate-probe. The empty map
  // satisfies Stylelint's "a configuration must declare rules" requirement without touching other files.
  rules: {},
  overrides: [
    {
      files: [
        'tools/stylelint-plugin/fixtures/*/valid/*.css',
        'tools/stylelint-plugin/fixtures/gate-probe/*.css',
      ],
      rules: {
        'patods/design-tokens': [
          true,
          {
            manifestPath: '@patods/tokens/meta/tokens.manifest.json',
            controlRegistryPath: './tools/stylelint-plugin/fixtures/registry.fixture.json',
          },
        ],
        'patods/contrast-pairs': [
          true,
          {
            manifestPath: '@patods/tokens/meta/tokens.manifest.json',
            contrastManifestPath: './tools/stylelint-plugin/fixtures/contrast/manifest.json',
            surfacesPath: './tools/stylelint-plugin/fixtures/contrast/surfaces.json',
            controlRegistryPath: './tools/stylelint-plugin/fixtures/registry.fixture.json',
          },
        ],
      },
    },
    // Core feature: adds an override for the core CSS, with the derived registry
    // (source "dom-contract" or "orientation") and the real manifest of packages/tokens/contrast/.
  ],
}
