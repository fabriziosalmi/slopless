# 1.1.0 — 2026-08-31

The regex tier was silently disabled on most modern TypeScript. This release fixes
the scanner bug behind it, then reworks the rules the bug had been masking.

## Fixed — engine

- **A single template literal disabled every regex rule for the rest of the file.**
  `extractProtectedRanges` never called `reScanTemplateToken`, so the scanner read the
  closing backtick of `` `hi ${name}` `` as the start of a new, unterminated literal
  and marked everything after it as "inside a string". On this repository's own source
  that meant slopless reported **0 findings**; it now reports 33. Across 400 real-world
  library files it was swallowing ~10% of all findings, and far more on template-heavy code.
- `VBC-800 floating-promise` walked the *parent* chain looking for `.catch()`, which
  lives on the *callee* chain. `save().catch(() => {})` was reported as unhandled.
- The same rule could report the same line twice when its regex had several matching
  alternatives; findings are now deduplicated per rule and line.
- `match.exclude` was parsed and never used, so `VBC-208`, `VBC-913` and `VBC-914`
  silently ignored their own exclusion lists. Replaced by `exclude_files` (path globs)
  and `exclude_selectors` (the enclosing CSS selector), both implemented.
- AST checks: `else if` chains counted as nesting depth (`VBC-065` called a flat
  five-branch chain five levels deep), arrow functions were invisible to the depth and
  async checks, `VBC-909` flagged the standard `interface A extends B {}` idiom, and
  `VBC-077` treated the substring `set` inside `offset`, `dataset` and `asset` as a mutation.

## Added

- **`match.scan`** — every rule declares the lexical scope its matches must live in:
  `code` (default), `strings`, `comments` or `all`. This is what stops `VBC-005 use-var`
  from firing inside a commented-out line, and what lets `VBC-901 hardcoded-ip-v4` see
  the IPs in string literals it used to skip entirely.
- **`match.multiline`** — evaluates a regex against the whole file. Twelve rules were
  written with patterns that could only match across lines while the engine fed them
  one line at a time, so they could never fire: `VBC-035` (icon-only button),
  `VBC-101` (img without alt), `VBC-054`, `VBC-104`, `VBC-042`, `VBC-123`, `VBC-131`,
  `VBC-161`, `VBC-172`, `VBC-946` and others.
- **`supersedes`** — a specific rule silences the general ones on the same line.
  `// TODO: implement this` used to raise four findings; it now raises one.
- **`tests`** — every rule carries at least one snippet it must flag and one it must
  leave alone, executed by `rule-fixtures.test.ts`. The suite fails if a rule ships
  without them. Rules driven by git, the network or the type graph declare
  `tests.external` naming the test file that covers them, and that pointer is verified.
- `async-without-await` AST check, replacing `VBC-201`'s unfixable regex (which
  contained a `(?!!await)` typo and could only ever match a one-line function).
- Test suite grew from 67 to 560 tests across 8 files; all 147 rules are now covered.

## Changed — rules

- `VBC-004 sql-injection-concatenation` missed `query("SELECT ... " + id)` — the
  canonical injection — because it required the quote *after* the `+`, while firing on
  `'Update ' + count + ' items'` at error severity. Rewritten around SQL statement shape.
- `VBC-096` used `[^/\\n]`, a class excluding the letter **n**, so any regex literal
  containing an `n` was skipped. Now flags long regex literals regardless of content.
- `VBC-015 magic-numbers` flagged `const ONE_SECOND_MS = 1000` — the named constant it
  asks you to write. `VBC-904 magic-string` flagged `throw new Error('...')` and
  `console.log('...')`. `VBC-347 passive-voice` flagged "is advanced" and "was tired".
  `VBC-936` matched "alpha" inside "alphabetical". `VBC-113` matched `maximum-scale=10`
  as if it were `=1`. `VBC-215` flagged `window.location =` and every `window.x ===`
  comparison. `VBC-086` fired when `rel="noopener"` preceded `target="_blank"`.
  All narrowed.
- `VBC-921` no longer hardcodes 2020–2023 as "outdated"; it flags a copyright pinned to
  a single year, which never goes stale.
- Overlapping rules separated so exactly one fires: `VBC-150`/`VBC-907` (tracked vs
  unattributed debt markers), `VBC-398`/`VBC-917` (punctuation vs shouting),
  `VBC-007`/`VBC-940` (money as a float literal vs float arithmetic on money),
  `VBC-070`/`VBC-941` (innerHTML vs the sinks innerHTML cannot see).
- `VBC-800` moved from `rules/type_checks.yaml` to `rules/VBC-800.yaml` and renamed
  from `Floating Promise` to `floating-promise`, matching every other rule.
- Categories consolidated to six: `core`, `security`, `clean-code`, `ux-dx`, `docs`, `git`.

## Docs

- Rule pages now show the scope, file types, exclusions, precedence and the executable
  examples, so the documentation cannot drift from the tested behaviour.

# 1.0.1 — 2026-08-31

- GitHub Action (`uses: fabriziosalmi/slopless@v1`): composite, runs the bundled `dist/index.js` with no npm install; `patterns`, `config`, `format` (SARIF included), `type-check`, `args` inputs.
- `dist/index.js` now bundles the runtime deps (tsup `noExternal`) and is committed for the Action; the rest of `dist/` stays untracked, and CI fails if the committed bundle drifts from the source.
- slopless is clean on itself (the one VBC-084 long line wrapped); CI dogfoods the Action on every push.
- Dependencies: `npm audit fix` + vitepress/vitest/tsup bumped — 0 production vulnerabilities; 3 dev-only esbuild dev-server advisories remain upstream (no fix available; no dev server runs in CI). VS Code extension package: 0.
- Docs on GitHub Pages via Actions (VitePress, base /slopless/).

# Changelog

This file documents all notable changes to this project.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [Unreleased]

### Added
- 26 new rules covering currency float math, jQuery reliance, committed IDE settings,
  fake test assertions, glassmorphism overuse, missing project health files, and more
- `--format score` output mode with a 0–100 Slop Score and letter grade
- `git_check` handlers for `missing_contributing`, `missing_security`, `missing_changelog`,
  `committed_ide_settings`, and `missing_readme`
- Real test suite using Vitest with fixture-based regression tests
- CONTRIBUTING.md, SECURITY.md, LICENSE, and CHANGELOG.md (this file)

### Fixed
- Removed dead `import()` Promise in `regex-checker.ts` that was never awaited
- Narrowed VBC-090 regex to remove false positives on "magic", "hack", minimizers, and filler words
- Implemented `commit_message_too_short` handler (VBC-926 was previously a no-op)
- Updated rule count in README from 111+ to 136+
- Removed "guarantee zero false positives" claim from README; replaced with accurate description
- Updated USO.md command examples from `npx ts-node src/index.ts` to `npx slopless`

---

## [1.0.0] — 2025-01-01

### Added
- Initial release with 110 rules across security, clean-code, UX/DX, and documentation categories
- Multi-tiered analysis engine: regex, AST, semantic, heuristic, and TypeScript type checks
- Protected regex engine (AST-aware string/comment range exclusion for JS/TS files)
- `--fix` auto-correction for select rules (e.g., `var` → `let`)
- `--format json` and `--format sarif` output modes
- `--type-check` flag for floating Promise detection via `ts.createProgram`
- `--init` command generating `slopless.config.json` and `.sloplessignore`
- Concurrency pooling to prevent OOM on large monorepos
- SHA-256 file hash caching (`.sloplesscache`)
- LSP server for VS Code / Cursor IDE integration
