# @patods/tokens-example

A framework-less [Vite](https://vite.dev/) app that consumes the **packaged tarball** of
`@patods/tokens` — never the workspace source — so it exercises the published package exactly as an
external consumer would (QA-06, Principle VII). It imports the generated CSS, switches brand and mode
at runtime via `data-patods-brand` / `data-patods-mode`, and shows that the resolved CSS values match
the typed `values` map (SC-006, SC-007).

## Running it

The app depends on `@patods/tokens` as a local tarball at `./vendor/patods-tokens-0.0.0.tgz`. Build
and pack the token package first, then install:

```bash
# from the repository root
pnpm pack:tokens          # builds @patods/tokens and packs the tarball into this app's vendor/
pnpm install              # installs the tarball into the app
pnpm --filter @patods/tokens-example dev
```

`vendor/` holds a generated artifact and is git-ignored. CI regenerates it before install (see the
`tokens-ci` workflow). Re-run `pnpm pack:tokens` whenever the token source changes.
