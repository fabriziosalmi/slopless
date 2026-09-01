---
title: Changelog
description: Release notes for slopless, and what changed in each version.
editLink: false
---

# 1.2.0 - 2026-09-01

An audio workstation, where the vocabulary of the domain collides head-on with
rules written for web applications. Errors fell from 29 to 13 and total findings
from 1881 to 1300.

- **`VBC-338` reported "master" 486 times**, every one of them a master bus,
  master EQ or master section. That is audio engineering, from master recording,
  and not what inclusive-language guidance is about. The rule now looks for the
  contexts that guidance actually names: master/slave pairs, `master branch` and
  the like, allowlist and blocklist wording, and "sanity check".
- **`VBC-940` and `VBC-007` read an effect's wet/dry `amount` as money**, because
  `amount`, `balance`, `total` and `rate` were on the currency word list and mean
  something in every domain. Only unambiguous words remain: price, cost, fee,
  tax, subtotal, payment, invoice, salary, refund, charge.
- **`VBC-921` flagged 135 correct copyright notices** carrying the current year.
  Rewriting it in 1.1.2 to avoid a hardcoded year range traded an annual staleness
  for firing on every current notice. A rule about time needs to know the time, so
  it is a heuristic check now and compares against the year the run happens in. A
  notice ending in the current year, in a range, or in "present" is correct.

## Fixed

- **`exclude_files` only worked in the regex tier.** A rule could declare an
  exclusion and still fire from the AST, semantic, heuristic or type checker,
  which is what happened the moment `VBC-921` moved tiers. It is a shared check
  now and every checker honours it.

# 1.1.9 - 2026-09-01

The first Python repository, and it answered a question about the whole rollout
rather than about itself.

- **`VBC-103` reported 68 well-written comment headers and no ASCII art.** Every
  hit was a `# ---` rule wrapping an explanatory paragraph, which is a Python
  documentation convention, and the opposite of the decoration the rule was
  written for. It now looks for three or more consecutive comment lines made of
  shape with no words between them: a banner is furniture, a rule around a
  heading is punctuation.
- **`VBC-015` counted test data as magic numbers.** A parametrised table of
  scores is data, not a constant waiting to be named. It skips test paths now,
  matching what `VBC-003`, `VBC-019`, `VBC-034` and `VBC-901` already did.

# 1.1.8 - 2026-09-01

A regression I shipped in 1.1.6, and the reason my own harness missed it.

- **The Action stopped writing its report whenever errors were found.** Composite
  steps run under `bash -e`. Building the report in a temp file meant the failing
  `node` call now killed the script before the file could be moved into place, so
  the output never appeared and any upload gated on it was skipped. Exit 1 means
  errors were found, which is precisely the case people install this for, so the
  report went missing exactly when it mattered. Errexit is now disabled
  explicitly, since the script captures the exit code and re-raises it itself.
- **`run-action-locally.sh` was not running the step the way a runner does.** It
  invoked plain `bash` rather than `bash --noprofile --norc -e -o pipefail`, so
  the harness built to prove the Action works in production diverged from
  production in the one flag that mattered. It uses the runner's flags now, and
  reproduces the regression above when the fix is reverted.

# 1.1.7 - 2026-09-01

A repository with a Python backend and a TypeScript frontend, where 35% of the
errors came from its own test suite.

- **Tests contain the patterns security rules look for, on purpose.**
  `_is_blocked("chmod 777 /usr/bin/python")` is a test asserting that the app
  blocks that command; a path sanitiser's fixtures contain absolute paths; an
  httpx ASGI client uses `base_url="http://test"`, which reaches no network at
  all. `VBC-003`, `VBC-019`, `VBC-034` and `VBC-901` now skip test paths, which
  is where a rule about hazardous literals stops being able to tell a hazard from
  a fixture. `VBC-001` deliberately still runs there: a real credential committed
  in a test is still committed.
- **`VBC-901` reported loopback.** On a local LLM app, `http://127.0.0.1:8000` is
  the correct address, not a pinned environment. Loopback and `0.0.0.0` name this
  machine rather than a host, and are no longer reported. Private and public
  addresses still are.
- **`VBC-051` reported wire-format field names**, 55 times. A TypeScript frontend
  calling a Python API writes `max_tokens: Math.min(maxTokens, 1024)`, and the
  snake_case half is dictated by the protocol. An object key is no longer treated
  as a naming choice; a variable still is.

# 1.1.6 - 2026-09-01

- **The Action could publish a truncated report.** Redirecting straight at the
  output file created it before the run started, so a crash left a partial file
  that looked finished to anything consuming it, and `hashFiles` still saw
  content. The report is now built aside, parsed when the format is JSON or
  SARIF, and only moved into place when it is complete. A failed run leaves no
  file at all, so a downstream step skips instead of uploading a broken one.

  Note that gating on the step outcome would not have worked here: slopless exits
  1 when it finds errors, which is a successful analysis with a valid report, so
  outcome-based gating would skip the upload in exactly the case that matters.

# 1.1.5 - 2026-09-01

Two rules that produced nothing but noise on a desktop app, at a rate that made
the cause obvious: every single finding was wrong.

- **`VBC-504` flagged `res` 72 times out of 73.** `req` and `res` were on the
  shadowed-module list for Express, but they are the ordinary words for a request
  and a result everywhere else, and the check cannot tell which codebase it is
  reading. The list is module names only now.
- **`VBC-201` flagged 67 test mocks and no real declarations.** `vi.fn(async
  (name) => undefined)` has to be async to stand in for an async function and has
  nothing to await: its signature belongs to the callee. A function passed
  straight to a call is no longer reported, so the rule only covers declarations
  the author actually chose to mark async.

# 1.1.4 - 2026-09-01

A monorepo with 169 source files produced 1794 findings and, more usefully, four
defects that only a project of that size could expose.

- **JSON and SARIF were truncated at 64KB.** `process.exit()` ran before Node
  drained stdout, so any report large enough to fill the pipe buffer was cut off
  mid-string and would not parse. Every project small enough to stay under the
  limit looked fine, which is why this survived until a repository produced 169KB
  of output. The exit code is set instead of forced, and `verify:bundle` now
  generates a report past the buffer and parses it back.
- **`VBC-077` treated a local array as a mutation.** `getAll() { const out = [];
  ... out.push(x); return out; }` is how a getter assembles its return value.
  Only mutations of `this` count now.
- **`VBC-913` fired on the fix it recommends.** `*:focus { outline: none }`
  followed by `*:focus-visible { outline: 3px solid }` is the correct modern
  pattern, and the rule reported it while its own message suggested it. It now
  looks for a replacement ring before reporting.
- The default `.sloplessignore` covers `coverage/`, `out/`, `.next/` and
  `*.min.js`. Generated output is not source, and an Istanbul report alone
  accounted for 170 findings.

# 1.1.3 - 2026-09-01

Three false positives, all found by pointing the tool at a TypeScript repository
it had never seen. Errors on that repository went from 8 to 2, and the two that
remain are real.

- **`VBC-007` matched any word containing a money word.** Widening it in 1.1.2 to
  catch `unitPrice` also caught `feedback`, `coffee`, `costume` and `taxonomy`, at
  error severity. A money word now has to be a whole identifier word or a
  camelCase component, and the rule is case-sensitive because the capital is what
  marks the boundary.
- **`VBC-005` flagged `declare var`.** In an ambient `.d.ts` that is how a global
  is declared and there is no alternative spelling, so `declare var sampleRate:
  number` was an error with nothing to fix.
- **`VBC-013` treated a commented catch as empty.** `catch (e) { /* already
  started */ }` is a decision rather than an oversight, which is how `no-empty`
  has always read a comment. A genuinely empty `catch (e) {}` still reports.

The type checker tier ran against a real project for the first time and found a
floating promise: an `async` method called with neither `await` nor `.catch()`,
where a rejection would go unhandled.

# 1.1.2 - 2026-08-31

- **Absolute paths crashed the CLI.** `slopless /abs/path/file.ts` exited 1 with a
  `RangeError` from the ignore matcher before reading a single file, because that
  library only accepts paths relative to the working directory. Paths are now
  relativised before matching, and a path outside the project is kept rather than
  rejected, since no ignore rule could apply to it anyway.
- While fixing the above I broke `.sloplessignore` and the tests caught it:
  `ignore` splits a bare multi-line string into patterns, but treats an array
  entry as one literal pattern, so passing the file's contents inside an array
  silently matched nothing. Six regression tests now cover both.
- **New rule VBC-948 `em-dash-prose`.** Em dashes cluster in generated text, so
  they are the first seam a reader looks for. A warning, in the docs category,
  for Markdown and plain text.
- Em dashes removed from the documentation, the rule messages and the changelog:
  157 of them, each replaced with the punctuation its sentence actually wanted
  rather than a blanket substitution. The one that remains is inside VBC-921's
  pattern, where it matches copyright ranges.
- The site's changelog is now generated by `docs:gen` from this file, so it
  cannot drift.
- **The Action was analysing fewer files than it was given.** `patterns` was
  interpolated into the command line, so bash expanded it first, and with globstar
  off, which is the default, `src/**/*.ts` becomes `src/*/*.ts` and everything at
  the top level disappears. This repository's own dogfood job ran that way: 8 files
  and 14 findings instead of 9 and 33, silently skipping `src/index.ts`. The step
  now disables pathname expansion and lets the CLI glob, which is what the pattern
  was written for.
- Action inputs reach the step through the environment instead of being
  interpolated into the command text, so a value cannot become shell source.
- New `output` input on the Action writes the report to a file. SARIF was
  supported but only ever reached stdout, which made it impossible to upload to
  code scanning.
- `scripts/run-action-locally.sh` runs the composite step in a container the way a
  runner does, reading the script out of `action.yml` so it cannot drift. The glob
  bug was invisible in the file and obvious the moment it ran.
- `VBC-102` reported the line where the block opened rather than the line holding
  several statements, sending the reader to the condition above.
- `VBC-215` is a warning, not an error. On the first repository it was pointed at,
  the only thing that would have failed CI was a debug global behind a localhost
  check, while its peers at error severity are hardcoded secrets, eval and XSS.

# 1.1.1 - 2026-08-31

Supply chain hardening. No rule or engine behaviour changed.

- **The package now installs nothing.** `commander`, `glob`, `ignore` and `minimatch`
  were declared as runtime dependencies while the bundle already inlined all four, so
  every install pulled code it would never execute: install surface with no benefit.
  They moved to `devDependencies` and tsup bundles everything (`noExternal: [/.*/]`).
  `npm install @fabriziosalmi/slopless` now resolves to exactly one package.
- **Releases publish over OIDC with signed provenance.** `release.yml` publishes on a
  `v*` tag using npm trusted publishing, so no npm token needs to exist at all, and
  every tarball carries an attestation binding it to the commit and workflow run
  (`npm audit signatures`). The job re-runs the tests, the build, the bundle check and
  a tag-matches-version check before publishing, behind an `npm` environment that can
  require a reviewer.
- **Every third-party action is pinned to a commit SHA** rather than a moving tag,
  which is the vector that compromised `tj-actions/changed-files`. Dependabot keeps the
  pins and the dev dependencies current so they do not rot.
- `verify:bundle` now also asserts that no runtime dependency has reappeared and that
  `dist/engine/api.js`, the entry point the VS Code extension imports, loads
  standalone too.
- The README documents how to pin `fabriziosalmi/slopless` to a SHA instead of the
  moving `@v1` tag, since asking users to trust a mutable ref deserved saying out loud.
- Corrected two claims that were not true: the site advertised "zero network" and
  "0 network calls" while `VBC-401` fetches every link it finds in Markdown. Replaced
  with zero telemetry, which is verifiable.

# 1.1.0 - 2026-08-31

The regex tier was silently disabled on most modern TypeScript. This release fixes
the scanner bug behind it, then reworks the rules the bug had been masking.

## Fixed: engine

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

- **`match.scan`**: every rule declares the lexical scope its matches must live in:
  `code` (default), `strings`, `comments` or `all`. This is what stops `VBC-005 use-var`
  from firing inside a commented-out line, and what lets `VBC-901 hardcoded-ip-v4` see
  the IPs in string literals it used to skip entirely.
- **`match.multiline`**: evaluates a regex against the whole file. Twelve rules were
  written with patterns that could only match across lines while the engine fed them
  one line at a time, so they could never fire: `VBC-035` (icon-only button),
  `VBC-101` (img without alt), `VBC-054`, `VBC-104`, `VBC-042`, `VBC-123`, `VBC-131`,
  `VBC-161`, `VBC-172`, `VBC-946` and others.
- **`supersedes`**: a specific rule silences the general ones on the same line.
  `// TODO: implement this` used to raise four findings; it now raises one.
- **`tests`**: every rule carries at least one snippet it must flag and one it must
  leave alone, executed by `rule-fixtures.test.ts`. The suite fails if a rule ships
  without them. Rules driven by git, the network or the type graph declare
  `tests.external` naming the test file that covers them, and that pointer is verified.
- `async-without-await` AST check, replacing `VBC-201`'s unfixable regex (which
  contained a `(?!!await)` typo and could only ever match a one-line function).
- Test suite grew from 67 to 560 tests across 8 files; all 147 rules are now covered.

## Changed: rules

- `VBC-004 sql-injection-concatenation` missed `query("SELECT ... " + id)`, the
  canonical injection, because it required the quote *after* the `+`, while firing on
  `'Update ' + count + ' items'` at error severity. Rewritten around SQL statement shape.
- `VBC-096` used `[^/\\n]`, a class excluding the letter **n**, so any regex literal
  containing an `n` was skipped. Now flags long regex literals regardless of content.
- `VBC-015 magic-numbers` flagged `const ONE_SECOND_MS = 1000`, the named constant it
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

## Packaging

- **Published as `@fabriziosalmi/slopless`.** The unscoped `slopless` on npm belongs to
  an unrelated prose linter by another author, so every `npm install -g slopless` and
  `npx slopless` in the README, USO.md and the docs was pointing readers at someone
  else's package. All install and usage commands updated. The installed binary is still
  called `slopless`, and the GitHub Action (`uses: fabriziosalmi/slopless@v1`) is unchanged.

## Docs

- Rule pages now show the scope, file types, exclusions, precedence and the executable
  examples, so the documentation cannot drift from the tested behaviour.
- The landing page terminal was showing invented output that cited `VBC-028`
  (function-params-limit) as a floating promise. Replaced with a real run, and the
  stat line corrected (67 tests -> 560, "0 issues on itself" -> "0 errors on itself").

# 1.0.1 - 2026-08-31

- GitHub Action (`uses: fabriziosalmi/slopless@v1`): composite, runs the bundled `dist/index.js` with no npm install; `patterns`, `config`, `format` (SARIF included), `type-check`, `args` inputs.
- `dist/index.js` now bundles the runtime deps (tsup `noExternal`) and is committed for the Action; the rest of `dist/` stays untracked, and CI fails if the committed bundle drifts from the source.
- slopless is clean on itself (the one VBC-084 long line wrapped); CI dogfoods the Action on every push.
- Dependencies: `npm audit fix` + vitepress/vitest/tsup bumped: 0 production vulnerabilities; 3 dev-only esbuild dev-server advisories remain upstream (no fix available; no dev server runs in CI). VS Code extension package: 0.
- Docs on GitHub Pages via Actions (VitePress, base /slopless/).

Older entries are in [CHANGELOG.md](https://github.com/fabriziosalmi/slopless/blob/main/CHANGELOG.md).
