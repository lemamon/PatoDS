<!--
Sync Impact Report
- Version: (versionless template) → 1.0.0
- Principles: all new (I through XIII); none renamed or removed.
  I. Three declared sources, everything else derived; II. DTCG tokens as the single source of appearance;
  III. Agnostic core, native implementation per framework; IV. React and Vue parity verified
  by machine; V. Verifiable accessibility (NON-NEGOTIABLE); VI. Robust components by default;
  VII. Quality proven in a real browser, with blocking gates; VIII. AI agents
  consume the catalog, never guess; IX. Secure supply chain and publishing;
  X. Predictable versioning and explicit lifecycle; XI. Monorepo with enforced layer
  boundaries; XII. Incremental migration with coexistence; XIII. Single documentation verified in CI.
- Sections added: Scope, Platform and Security Constraints; Development Workflow and
  Quality Gates; Governance.
- Sections removed: none.
- Dependent templates: none changed (plan, spec and tasks read this constitution at runtime;
  the plan-template "Constitution Check" is filled from the list of gates in this
  constitution).
- Deferred TODOs:
  - TODO(PREFIXO): project prefix (`<prefixo>` in the Requirements) not yet defined.
-->

# PatoDS Constitution

PatoDS is a single design system that delivers the same appearance, the same API and the same level of
accessibility across React and Vue applications, queryable by people and by AI agents. The source of
requirements is the document "Multi-framework Design System Requirements" (version 2026-10-20),
hereinafter "Requirements". The cited IDs (ADR-xx, TOK-xx, CMP-xx, A11Y-xx, etc.) refer to it.

Convention: MUST and MUST NOT indicate a mandatory rule; SHOULD indicates a recommendation whose
exception requires a recorded justification; MAY indicates an option.

TODO(PREFIXO): the Requirements do not yet define the project prefix. Until it is defined, `<prefixo>`
is an intentional marker for the prefix used in tokens, classes, data attributes and in the registry
scope (TOK-04, TOK-05, CMP-05, ENG-20) and MUST be replaced by amendment once the value is defined.

## Core Principles

### I. Three declared sources, everything else derived

- There are exactly three declared sources: DTCG tokens (appearance), exported TypeScript types
  with API comments (API contract) and a per-component usage guidance file (hand-written metadata:
  when to use, stage, category and the remaining fields).
- The catalog MUST be compiled at build time from these sources, and the documentation site, MCP, CLI
  and the factual content of skills and usage instructions MUST obtain component data from it;
  a per-consumer custom extractor, a hosted service queried at runtime and the documentation site
  as a source MUST NOT be used (ADR-06, DOC-03, DOC-11, IA-02, IA-08, IA-13). Nothing derived is
  edited by hand.
- The procedural text of skills, in versioned templates with an owner, and the instructions file of
  the repository root (IA-09) are hand-written and are not derived (IA-08).
- The DOM contract and the dependency graph MUST be extracted at build time from the core and the packages.
- Generated artifacts that are versioned (catalog, skills) MUST be regenerated in CI, and CI
  MUST fail on any divergence (IA-02, IA-08).
- Catalog generation MUST be deterministic: two generations over the same commit, on different
  machines, produce the same hash (IA-04). Two builds from the same token source MUST produce
  byte-for-byte identical output (TOK-05).
- No consumer (docs, MCP, CLI, skills, example apps) MAY maintain a hand-written props table or token
  value (DOC-03, DOC-11).

Rationale: copies diverge. One source per fact and a single catalog as intermediary keep docs,
agents and packages aligned to the same version (ADR-05, ADR-06).

### II. DTCG tokens as the single source of appearance

- Every token MUST be in the single source in W3C DTCG format, validated by schema in CI (TOK-01).
- Tokens MUST follow three layers: primitive, semantic and component. Only primitives have a
  literal value; the other layers reference by alias (TOK-02).
- Component styles MUST consume only semantic or component tokens. A primitive token or literal value
  in a component style blocks the merge (TOK-03).
- Names MUST follow the documented convention, with the `<prefixo>` prefix and segments in a fixed
  order; the output MUST include CSS custom properties `--<prefixo>-*` and typed ESM modules (TOK-04
  through TOK-06).
- Brand and mode (light/dark) MUST be independent axes, selected by distinct attributes,
  applicable to any subtree with nested scopes (TOK-07, TOK-08, TOK-14).
- Every brand and mode combination MUST have the same set of semantic keys (TOK-09).
- Adding a brand MUST change only token files, never component code (TOK-07).
- Interactive controls MUST use a single height scale (TOK-13).
- Sync with the design tool MUST happen automatically on every published version, in the direction
  defined in Assumptions; the current assumption holds: the repository is the source, the tool
  receives the variables and no routine imports variables into the repository (DSN-01).
  A manual edit at the destination MUST be restored by the next sync and recorded in a log (DSN-03).
- Design tool variables MUST have names and hierarchy identical to the tokens, with brand and
  mode as independently swappable axes (DSN-04, DSN-05). Divergences between tool and code in tokens,
  icons, components, variants, properties and stage MUST be detected automatically, at least weekly
  and on every published version, each with a trackable item, owner and deadline (DSN-11).
- A stable or deprecated component with a visual representation MUST have a counterpart with the same
  name and stage in the design library (DSN-06); a stable component with a visual representation
  MUST have a design-code mapping with a snippet that compiles in CI (DSN-09).

Rationale: an open format, framework-neutral and readable by tools and agents (ADR-02); the
one-directional sync prevents the design tool from becoming an undeclared source.

### III. Agnostic core, native implementation per framework

- Styles MUST live in an agnostic CSS core, with prefixed classes and `@layer` layers,
  published by the styles package. React and Vue packages MUST NOT contain CSS rules and MUST
  apply the same core classes for each variant (ADR-03, CMP-04). CSS Modules, runtime CSS-in-JS
  and utility classes in the markup MUST NOT be used to style components (ADR-03).
- Each framework MUST have a native, idiomatic implementation, with native reactivity and SSR. Web
  Components, code generation from a single source and wrappers from one framework to the other
  MUST NOT be used (ADR-01).
- Interactive components MUST be built on headless primitives from a maintained library that is
  accessible in each framework (ADR-04, CMP-02). A one-off exception to CMP-02 requires an ADR;
  building custom headless primitives from scratch, adopting an already-styled library or reusing
  legacy components as an approach contradicts ADR-04 and requires an approved change request and a
  new ADR (GOV-07). The library choice follows the CMP-28 proof of concept and the decision in
  Assumptions.
- Each component MUST have a versioned DOM contract (classes, `data-<prefixo>-*` attributes, CSS
  variables). The core MUST NOT style selectors over the headless primitives' attributes (CMP-14).
- Components, CSS classes and public attributes MUST use the `<prefixo>` prefix (CMP-05).

Rationale: an idiomatic API in each app without degrading types, events or SSR; the cost of writing
the behavior twice is contained by Principles IV and VII.

### IV. React and Vue parity verified by machine

- Every published component MUST exist in both frameworks with the same conceptual API, expressed
  in the native idiom: `v-model` in Vue, `value` with a callback in React (CMP-03).
- Each component MUST have an equivalence table of props, events, slots, models and imperative
  APIs, with versioned normalization rules (CMP-03).
- CI MUST automatically compare the public surface of both packages. A divergence without an
  approved exception blocks the merge (CMP-12).
- The normalized DOM snapshot of each state MUST be identical between React and Vue and match the
  DOM contract (CMP-14).
- Each component MUST have a single behavior specification, run in both frameworks; a failure in
  either one blocks the merge (CMP-15).
- Stateful components MUST accept controlled and uncontrolled usage (CMP-07); collection components
  MUST infer the item type, including in a Vue template (CMP-25).

Rationale: without verifiable parity, the frameworks diverge and the apps inherit inconsistencies.

### V. Verifiable accessibility (NON-NEGOTIABLE)

- PatoDS MUST declare a single target conformance level; the current assumption holds, WCAG 2.2
  AA (A11Y-01).
- Each component MUST have zero violations from the automated rules engine across the entire
  framework × theme × mode matrix, including after interaction steps (A11Y-02).
- Accessibility lint MUST be active in both frameworks, failing with an error or warning
  (A11Y-03).
- Interactive components MUST be operable by keyboard alone per the applicable APG pattern and
  show visible focus (A11Y-04, A11Y-05).
- Color tokens MUST meet the target level's contrast ratios, measured over a versioned manifest
  of pairs and with composited opacity (A11Y-09).
- State and meaning MUST NOT depend on color alone (A11Y-23).
- Each component MUST keep content and function at 320 px width, with 200% text zoom and
  increased text spacing, in the QA-05 matrix, except for the Table's internal scrolling
  (A11Y-21); each pointer target MUST measure at least 24 by 24 px, except for the spacing
  exception of criterion 2.5.8 (A11Y-19); the system's own content MUST NOT fully obscure
  the focused element (A11Y-18).
- Each component MUST publish, on its page and in the catalog, a conformance declaration with the
  criteria met, the known limitations and the date of the last review (A11Y-12); each automatic
  animation MUST meet criterion 2.2.2 or declare the applicable exception in the catalog
  (A11Y-24).
- Promotion to stable MUST require a manual audit by a person other than the author (A11Y-16) and,
  for the components listed in the Inventory, manual screen-reader testing in React and Vue (A11Y-08).
- Every exception MUST be in a versioned file with justification, owner and deadline, visible in the
  component's documentation. An expired exception fails CI. A disabled rule without a recorded
  exception is forbidden (A11Y-11).

Rationale: conformance that is contractually enforceable must be proven by test and audit, not
declared.

### VI. Robust components by default

- Server rendering: no component MAY use browser APIs in render or setup;
  zero errors and zero hydration warnings; CSS present in the initial HTML (CMP-08).
- React Server Components: every module with hooks or event handlers MUST have `use client`;
  the catalog MUST mark each component as server-safe or client-only (CMP-22).
- Security: raw HTML (`v-html`, `dangerouslySetInnerHTML`) MUST be blocked by lint
  (CMP-16); URL attributes MUST accept only schemes from a versioned allowlist, the same in both
  frameworks (CMP-17); components MUST work under CSP without `unsafe-eval` or `unsafe-inline`
  in `script-src`, with a configurable nonce (CMP-26).
- Imperative-API state MUST be isolated per request in SSR (CMP-20); Portal overlays MUST inherit
  brand and mode from the origin (CMP-21).
- Internationalization: internal texts and accessible names MUST come from props or translatable
  messages (CMP-09).
- Each component MUST render without providers, with documented defaults for theme, locale and
  routing (CMP-24).
- Incorrect-usage warnings MUST appear only in development, with a stable code and a link to the
  documentation; the production bundle MUST NOT contain their texts (CMP-23).
- Public types MUST be exported without `any` (CMP-11) and published as declarations alongside the
  compiled code (ENG-05); packages MUST be ESM with per-component tree-shaking, without losing CSS
  in the production build (ENG-04); icons MUST be loadable on demand with typed names (CMP-10).

Rationale: the design system runs in SPA, SSR and RSC apps under varied security policies; each
guarantee must hold without extra configuration.

### VII. Quality proven in a real browser, with blocking gates

- Behavior and accessibility MUST be validated by stories run as interaction and accessibility tests
  in a real browser, never in a simulated DOM, with a browser and fonts from a versioned environment
  and no external network (ADR-08, QA-01).
- Interaction tests MUST run on all engines from the browser list defined in Assumptions, nightly
  and before each publish; a failure on any engine MUST block the publish and open an issue
  automatically, and the pull request MAY run on a single engine (QA-12).
- All non-UI logic (utilities, hooks, composables, build scripts) MUST have a unit test (QA-02).
- Visual regression MUST be a mandatory merge check over the PR and merge-queue subset pinned in the
  versioned matrix of frameworks, themes, modes, widths and states, and the full matrix MUST be
  green before promotion to the main tag; a difference only passes with approval from a visual
  reviewer who is a design owner and not the PR author (QA-04, QA-05, ENG-26).
- Public types MUST have tests, with at least one negative case per component, and a versioned API
  report (QA-08).
- Example apps MUST consume the packaged tarball or the registry, never the source code
  (QA-06, ENG-10).
- Coverage, bundle budget, visual tolerance, flaky-test rate and the other thresholds
  MUST live in a single versioned file, changeable only with approval from a person designated by
  the requester (QA-14). The values follow Assumptions.
- Mandatory checks MUST block the merge, not merely warn. The flaky-test rate MUST
  be measured by re-runs with a divergent result, including quarantined tests, and stay
  within the threshold file's limit (QA-09); a quarantined test MUST NOT count as passing
  (QA-01). If QA-10 (Desirable) is contracted, each quarantined test MUST have a linked
  issue, owner and fix deadline.
- Stories, fixtures, examples and snapshots MUST use only synthetic data (QA-15).

Rationale: focus, layout and contrast are only reliable with real rendering; ignored warnings become
regressions.

### VIII. AI agents consume the catalog, never guess

- The catalog MUST be machine-readable, validated by a published JSON Schema versioned with the
  package, and contain the fields required by the Requirements (IA-01, IA-03).
- The catalog MUST be published within the UI packages it describes, generated from the same commit
  (IA-06), and stay outside the code imported by the app (ADR-06, QA-07).
- The MCP server and CLI MUST be local and read-only, with no disk writes, no network and no
  credentials (except telemetry enabled per Assumptions), and respond with the installed package's
  catalog, reporting its version (ADR-07, IA-05, IA-07, IA-13, IA-16).
- Each MCP tool MUST have versioned input and output schemas (IA-17); each CLI command MUST have
  JSON output validated against a JSON Schema and documented exit codes (IA-07). The
  public-API check covers the MCP and CLI schemas (IA-17, GOV-01).
- The factual content of skills and instructions MUST be generated from the catalog; procedural text
  stays in versioned templates with an owner, and lint MUST block hand-written component, prop or
  token names in them (IA-08).
- The deterministic routing suite MUST run on every pull request against the real catalog, without
  calling a language model, and block the merge when the rate falls below the threshold in the
  QA-14 file (IA-10); response-quality evals MUST run nightly and before each release and block the
  release below the threshold, except for a security-fix release, which proceeds with the result
  recorded (IA-14). The thresholds follow the current assumption: they are defined against a baseline
  measured at the start of Phase 3.
- Free text in the catalog with invisible Unicode or a URL outside the allowlist MUST fail the build
  (IA-18).

Rationale: agents err when they guess; a verifiable catalog matched to the installed version keeps
them correct.

### IX. Secure supply chain and publishing

- Versions MUST be published only by the pipeline, after approval from two people with MFA;
  no personal token MAY have publish permission (ENG-15, GOV-10).
- The `@<prefixo>` scope MUST be reserved in the public package registry, in an account designated
  by the requester; a daily check and a check before each publish MUST fail if the scope does not
  belong to that account (ENG-20).
- Every version MUST be released first under a pre-release tag and only then promoted to the main tag
  (ENG-26); publishing MUST be idempotent, with no partial version after a failure (ENG-27).
- Every version MUST have a signed provenance attestation and an SBOM (ENG-09, ENG-19).
- Tarballs MUST contain only files from a versioned allowlist, without install scripts, and include
  third-party notices and the `license` field defined in Assumptions (ENG-17, ENG-22).
- Dependencies MUST be installed from the lockfile in frozen mode (ENG-16); dependency install
  scripts MUST be blocked except for an allowlist (ENG-24); licenses MUST follow a versioned policy
  (ENG-21); deprecated direct dependencies MUST NOT exist (ENG-07); a new dependency MUST have owner
  approval (ENG-25).
- Third-party actions in CI MUST be pinned by SHA digest (ENG-18).
- Secrets MUST appear in an inventory with owner, scope, type and rotation deadline; a static secret
  MUST have a recorded justification that the provider does not offer a federated credential
  (ENG-13); a fork PR MUST NOT receive a write secret, and secret scanning MUST block the merge
  (ENG-14); the remote cache MUST be writable only by the protected branch (ENG-03).
- Distributed fonts, icons and logos MUST appear in an inventory with origin, license and
  redistribution right (ENG-23).
- Dependency vulnerabilities MUST be fixed within deadlines by severity: critical 7 days,
  high 30, medium 90 (ENG-11). A confirmed vulnerability in PatoDS code MUST have an advisory and a
  fixed version in each supported major version, with the affected versions deprecated in the
  registry (GOV-15), following the published security policy (GOV-14).

Rationale: a design system is a dependency of every app; compromising it compromises them all.

### X. Predictable versioning and explicit lifecycle

- All published packages MUST follow SemVer 2.0.0, and the public-API check in CI MUST
  block a break without a major increment (GOV-01). This check also covers the MCP and CLI
  schemas (IA-17) and the warning-code list (CMP-23); an incompatible change to the catalog JSON
  Schema MUST ship only in a major version (IA-03). The single-version or independent-version
  strategy MUST be recorded in an ADR; the current assumption of a single version holds.
- Commit messages MUST follow Conventional Commits, enforced by a local hook and a CI check
  (GOV-02); the changelog MUST be generated for each version, with incompatible changes in their
  own section (GOV-03).
- Each component MUST declare, in the usage guidance file, a stage: experimental, beta,
  stable or deprecated; a missing or invalid stage fails the build (GOV-04).
- Promotion to stable MUST pass the versioned definition of done, verified in CI (GOV-13).
- Deprecation MUST respect the minimum deadline from Assumptions before removal (except a security
  removal with an advisory) and have a migration guide with a replacement and a before-and-after
  example (GOV-05, GOV-06).
- The previous major MUST be supported for the deadline defined in Assumptions, fixed in a published
  policy; a critical-severity fix unrelated to security MUST also ship in the supported previous
  major, within the ACE-04 deadline (GOV-18).
- Each mechanical incompatible change in a major MUST have a codemod with fixtures (GOV-17).

Rationale: consumer apps only upgrade with confidence when breaks are rare, announced and
assisted.

### XI. Monorepo with enforced layer boundaries

- Tokens, core, libraries and tools MUST live in a single monorepo (ADR-09).
- The layers MUST follow tokens → core → frameworks. Tools (catalog generator, lint,
  codemods, mappings, DSN-09 snippets) MUST depend on the UI only as a devDependency (ENG-01).
- Layers and allowed edges MUST be in a versioned file; a forbidden edge fails CI, and
  each new layer MUST be added to it in the phase it is created (ENG-01, ACE-08).
- CI MUST run only the tasks of the affected packages and their dependents, with a full run
  daily and when the lockfile, toolchain or workflows change (ENG-02).
- If ENG-12 (Desirable) is contracted, each shared asset (icons, fonts, token CSS)
  MUST have a single source package, with no identical file published in more than one package
  (ENG-12).

Rationale: cross-layer changes ship in a single PR and parity stays verifiable, without accidental
coupling between packages.

### XII. Incremental migration with coexistence

- PatoDS MUST coexist with the legacy design systems on the same page without style conflicts:
  classes and variables only with `<prefixo>`, published `@layer` names and order, with a guide
  to wrap the legacy CSS in a lower layer (MIG-07, MIG-14).
- Legacy migration codemods MUST cover all the swaps classified as exact in the MIG-02 and MIG-03
  tables, and only those, be idempotent and produce code that passes typecheck, lint and tests
  without manual editing (MIG-05, ADR-10).
- Similar swaps or those without an equivalent MUST use agent skills that open a PR without automatic
  merge, always with recorded human approval (MIG-06).
- Migration MUST be possible in independent batches, with per-batch deploy and rollback (MIG-09).
- The vendor MUST NOT change the consumer apps' files: codemods run on them only in simulation mode,
  and the kit is validated in its own test apps (MIG-13, Scope).
- Progress MUST be measured by the automated usage inventory (MIG-01, MIG-11).

Rationale: a one-shot swap concentrates risk and stalls the teams; batch migration delivers value
without stopping the product (ADR-10).

### XIII. Single documentation verified in CI

- PatoDS MUST have a single documentation site; each component page MUST show React and Vue examples
  and API, and CI MUST fail if a supported framework's version is missing (DOC-01).
- Each component MUST have runnable examples for all documented variants and states; an example that
  does not compile against the current types, does not render or uses a deprecated API MUST fail the
  build (DOC-04).
- Fundamentals of tokens, colors, typography and icons MUST be generated from the published packages
  (DOC-05); a broken internal link or anchor MUST block the merge (DOC-12).
- Each publishable package MUST have a README with purpose, installation, minimal usage and a link to
  the full documentation (DOC-08); each framework's quick-start guide MUST be run in CI in an empty
  project (DOC-07).
- Each published version's changelog MUST be on the site within 24 hours (DOC-09), and each major
  supported MUST keep browsable documentation generated from the catalog of that version's commit
  (DOC-15).

Rationale: hand-written documentation ages faster than the components; generated and verified in CI,
it tracks the installed version.

## Scope, Platform and Security Constraints

**Scope**

- Supported frameworks: React and Vue. Angular and Web Components are outside this contract.
- Out of scope, except by change request: chart and data-visualization components,
  data palettes, an illustration library, components specific to a single product,
  hosting of AI services and migration of the consumer apps' code.
- The component Inventory in the Requirements closes the list and the nine categories (CMP-01).
  A component outside the Inventory requires an RFC (GOV-08) and an approved change request (GOV-16).
- Priority: a Mandatory ID or Inventory item blocks acceptance of the phase it belongs to;
  a Desirable one only enters if contracted and is then accepted by the same criteria in the
  indicated phase; an Optional one only enters by an approved change request. Specs and plans
  MUST NOT include an uncontracted Desirable item or an Optional item without an approved change
  request.

**Platform**

- CI MUST test in a matrix the floor and the latest version of React, Vue, Node and TypeScript;
  `peerDependencies` and `engines` MUST match the tested floor; CSS MUST be validated against a
  versioned browser list (ENG-08).
- Each brand's CSS, with both modes, MUST be importable without the other brands (ENG-06).

**Privacy and data**

- Stories, fixtures, examples and snapshots MUST NOT contain real personal data; personal
  documents (e.g., CPF, CNPJ) and emails outside a reserved domain MUST be blocked by a CI scan,
  and photos MUST come from a synthetic or licensed bank, with origin and license in a versioned
  record (QA-15).
- Telemetry of the agent tools, if any, MUST be off by default, with no personal data, free text or
  source code (IA-12, current assumption).
- The site's editable examples MUST run in an iframe with a sandbox on a separate origin; the site
  MUST NOT load third-party trackers without recorded approval from the requester (DOC-16).

**Open decisions**

This constitution does not decide the items in the "Assumptions and open decisions" section of the
Requirements. Until a decision is made, each line's current assumption holds. Specs and plans MUST
cite the assumption they adopt and MUST NOT fix a value different from it without a change request.

## Development Workflow and Quality Gates

**Spec Kit Workflow**

- Every feature MUST follow the Spec Kit workflow (specify → plan → tasks → implement) and cite the
  IDs of the Requirements it meets; a requirement without a source ID requires justification in the
  spec.
- Each plan's "Constitution Check" MUST answer, at minimum, "yes" or "no" to the questions
  below; every "no" answer is a violation and follows the exception rule of this section:
  1. Does all component or token data (API, appearance, usage metadata) come from the three declared
     sources and does every consumer obtain it from the generated catalog, with no hand-maintained
     copy? (I)
  2. Does every component style consume only semantic or component tokens, with no primitive token
     nor literal value, and does sync with the design tool follow the current direction, with
     divergences detected? (II)
  3. Do the framework packages remain without CSS rules, the core without a selector over a headless
     primitive's attribute, and does every interactive component use a primitive from the headless
     library? (III)
  4. Does the change keep API, DOM and behavior parity between React and Vue? (IV)
  5. Does each affected component have rules-engine, keyboard, visible-focus, reflow and target-size
     tests, do the color tokens pass contrast, is there a conformance declaration and is every
     accessibility exception recorded per A11Y-11? (V)
  6. Do SSR, RSC, CSP, i18n and provider-less usage remain valid? (VI)
  7. Do the tests run in a real browser, on the required engine matrix, and do the thresholds come
     from the QA-14 file? (VII)
  8. Does agent data come from the catalog and do the tools remain read-only, with no network nor
     credentials? (VIII)
  9. Do dependencies, secrets, publishing and assets follow the supply-chain rules? (IX)
  10. Does the change respect SemVer, lifecycle stage and deprecation policy? (X)
  11. Do the layer boundaries remain valid? (XI)
  12. Does coexistence with legacy remain conflict-free? (XII)
  13. Does the documentation cover React and Vue, is it generated from the catalog, does it have
      examples that compile against the current types, a README per package and valid links? (XIII)
  14. Is the feature within scope and the component Inventory, does it respect the contracted
      priority and cite the current assumption of each open decision it adopts? (Scope,
      Platform and Security Constraints)
- A violation MUST NOT proceed without a formal exception provided for in the Requirements (e.g., an
  A11Y-11 record, an approved CMP-12 exception, a CMP-02 one-off exception ADR, a requester-approved
  GOV-17 reason), recorded in the plan's "Complexity Tracking". Contradicting ADR-01 through ADR-10
  is not a plan exception: it requires a change request approved by the requester and a new ADR
  (GOV-07).

**Decisions and review**

- Every architecture decision MUST be recorded in a numbered ADR, with status and date, before it is
  implemented; a PR with an architecture label MUST link an accepted ADR. An ADR that changes ADR-01
  through ADR-10 MUST cite a change request approved by the requester, and the CI check MUST reject a
  PR without that approval (GOV-07).
- Every new component or incompatible API change MUST have an approved RFC, with features, states,
  the applicable APG pattern and a keyboard map (GOV-08).
- The owners file MUST cover 100% of directories; a merge requires approval from the area's owner;
  visual snapshots have at least one design owner (GOV-09).

**Traceability and acceptance**

- Each contracted ID MUST appear in a versioned traceability matrix that links it to a CI check or
  retained evidence, with IDs from future phases marked as planned; an ID from an in-progress or
  already-accepted phase without a check or evidence, or with a nonexistent check, fails CI (ACE-02).
- Each phase MUST end in an acceptance package with the evidence for each ID (ACE-01).
- Every check that promises blocking MUST be proven by a recorded deliberate violation, when the
  Requirements so require.
- Phase 1 only begins after approval of the headless proof-of-concept report (CMP-28) and the
  delivery plan (ACE-09); each phase only begins once the outputs of the phases it depends on are
  accepted.

## Governance

- Precedence: Requirements and approved change requests > this constitution > specs, plans and
  tasks > other practices. A conflict between this constitution and the Requirements is resolved by
  amending the constitution.
- Amendments MUST be made by a PR that changes `.specify/memory/constitution.md`, with the Sync
  Impact Report in the PR description and approval from that file's owner in the owners file (GOV-09).
- An amendment that reflects a change to ADR-01 through ADR-10, to a current assumption, to a
  threshold, to a Mandatory requirement or the inclusion of an Optional requirement MUST cite the
  change request approved by the requester and, when architectural, the new ADR (GOV-07).
- Versioning of this constitution follows SemVer: MAJOR for the removal or incompatible redefinition
  of a principle or governance rule; MINOR for a new principle or section or materially expanded
  guidance; PATCH for clarification and wording without a change of meaning.
- Conformance: `/speckit-plan` applies the "Constitution Check" gates; `/speckit-analyze`
  treats a conflict with this constitution as CRITICAL; PR reviewers MUST verify the affected
  principles; each phase acceptance package MUST include a conformance review against this
  constitution.
- Runtime guidance for code agents lives in the instructions file at the repository root (e.g.,
  `AGENTS.md`, IA-09), which MUST NOT contradict this constitution.

**Version**: 1.0.0 | **Ratified**: 2026-10-21 | **Last Amended**: 2026-10-21
