# Tasks — multi-provider-cast

## 1. Cast map core

- [x] 1.1 Introduce a `cast` structure (role name → `provider/id`) inside the extension's default export, seeded from `--architect` / `--builder` flags with the existing built-in defaults
- [x] 1.2 Add a `castModel(role)` accessor and migrate every `architectModel()` / `builderModel()` call site (fusion, auto-validate, opinion handlers; footer cells; `hostModel` fallback) to it
- [ ] 1.3 Verify session pinning, footer cells, and `builderSpawn` host-fork behavior are byte-for-byte unchanged when the cast holds the default models (recipe smoke test: `just fh-workhorse` + `/opinion`) *(needs manual TUI run)*

## 2. Preflight (model-preflight capability)

- [x] 2.1 Implement `preflightCast(roles, ctx)`: for each cast member, `ctx.modelRegistry.find(provider, id)` + auth check (`hasConfiguredAuth` / provider auth status); collect all failures
- [x] 2.2 Build the failure panel/text: role, offending string, and remediation — `/login <provider>` + env var for auth failures; `models.json` stanza skeleton for unresolved ids; distinct catalog-refresh-error message when `modelRegistry.getError()` is set
- [x] 2.3 Wire preflight into the fusion, auto-validate, and opinion handlers so it runs BEFORE `mkArtifacts()` and before any spawn; all-or-nothing (one panel covering every failing member)
- [ ] 2.4 Verify headless parity: non-TUI invocation prints plain-text remediation and exits without side effects *(needs manual headless test)*

## 3. Cast sheet overlay + /roles (role-casting capability)

- [x] 3.1 Build the cast sheet component (self-contained `@earendil-works/pi-tui` component rendered via `ctx.ui.custom(..., { overlay: true })`): one row per role (role name, model, thinking level, auth marker), keyboard navigation, provider→model drill-down per row with **type-to-filter fuzzy search** (authenticated first, from `modelRegistry.getAll()`), manual `provider/id` entry row implementing `Focusable`, `t` cycling a row's thinking level (levels + inherit), SAVE action, RUN / Esc actions, and a multi-pick row type for future panel roles (reference: pi package `examples/extensions/overlay-qa-tests.ts` for overlay lifecycle/disposal)
- [x] 3.2 Define each command's declared cast (fusion: ARCHITECT/BUILDER/FUSION; auto-validate: VALIDATOR/BUILDER; opinion: ARCHITECT/BUILDER) and open the sheet at invocation in TUI mode, before preflight; RUN mutates the session cast, Esc aborts with zero side effects
- [x] 3.3 Skip the sheet entirely when `ctx.hasUI` is false / mode is not TUI (flag-seeded cast only), and honor inline `--cast-defaults` on any casted command as a per-invocation skip
- [x] 3.4 Register `/roles`: open the same sheet over all known roles outside any command, then print the resulting session cast (models + thinking levels) with project-file state
- [x] 3.5 Confirm in-memory persistence semantics: picks survive across commands within a session; disk writes happen ONLY via SAVE *(implementation: cast is a `const` object mutated in place, SAVE calls `saveProjectCastUsing`)*

## 4. Per-role thinking + disk persistence

- [x] 4.1 Cast map values become `{ model, thinking? }`: side flags seed defaults; roles without override inherit the side level at spawn time (including mid-session `/thinking` side changes)
- [x] 4.2 Extend `/thinking` to accept role names (`/thinking JUDGE low`) alongside sides; bare `/thinking` prints side defaults + role overrides
- [x] 4.3 Implement project cast file: SAVE writes `<cwd>/.fusion-harness.json`; boot loads it (defaults → file → flags → session); forgiving parse (unknown roles ignored, no boot-time model validation)

## 5. Recipes + docs

- [x] 5.1 justfile: add a parameterized `fh` recipe (`just fh ARCH=… BUILDER=…`) appending extra args, plus `fh-glm` (`zai/glm-5.2` architect · `zai/glm-5-turbo` builder) and `fh-zen` presets (Zen model ids confirmed against the live catalog)
- [x] 5.2 README: provider table (provider key, env var, `/login` path, catalog-refresh + `models.json` notes for brand-new model ids), cast sheet walkthrough (drill-down, fuzzy filter, thinking column, SAVE), `/roles` section, `--cast-defaults`, project cast file docs (incl. gitignore guidance), thinking-level/cost caveats for proxied providers

## 6. Validation

- [x] 6.1 `openspec validate multi-provider-cast` passes *(run in terminal)*
- [ ] 6.2 Manual matrix: `/opinion` on (anthropic+openai), (zai+zai), (opencode+opencode), and a mixed pair — each with sheet-confirm, one row overridden, and `--cast-defaults` *(needs manual TUI run with API keys)*
- [ ] 6.3 Persistence matrix: SAVE → restart → file seeds cast; flags override file; `/thinking JUDGE low` override resolves at spawn; fuzzy filter narrows a drill-down list *(needs manual TUI run)*
- [ ] 6.4 Negative tests: typo'd model id → resolution panel, no spawn, no artifacts dir; missing key → auth panel naming `/login` + env var; headless run of the same → plain-text remediation *(needs manual TUI run)*
