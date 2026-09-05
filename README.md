# Slopless

[![npm](https://img.shields.io/npm/v/%40fabriziosalmi%2Fslopless)](https://www.npmjs.com/package/@fabriziosalmi/slopless) [![ci](https://github.com/fabriziosalmi/slopless/actions/workflows/ci.yml/badge.svg)](https://github.com/fabriziosalmi/slopless/actions/workflows/ci.yml) [![docs](https://github.com/fabriziosalmi/slopless/actions/workflows/docs.yml/badge.svg)](https://fabriziosalmi.github.io/slopless/)

Slopless is a static analysis tool designed to identify and mitigate unstructured coding patterns, undocumented assumptions, and heuristic-driven development practices (colloquially termed "vibecoding"). It employs a multi-tiered analysis engine combining deterministic regular expressions, Abstract Syntax Tree (AST) inspection, and structural semantic heuristics.

## Architecture and Capabilities

- **Rule Engine**: 152 rigorous rules spanning security, maintainability, accessibility, and documentation integrity. Every rule ships executable examples — a snippet it must flag and one it must leave alone — run on every commit.
- **AST Inspection**: Deep structural validation to identify excessive cyclomatic complexity, parameter limits, and empty control flow blocks.
- **Deep Semantic Validation**: Opt-in TypeScript TypeChecker (`--type-check`) for resolving inherited types, identifying floating promises, and validating structural intent beyond AST boundaries.
- **Heuristic Auto-Fixes**: Autonomous modification of known anti-patterns (e.g., `var` to `let`) using `--fix`.
- **Concurrency Pooling**: Fault-tolerant AST parsing distributed across CPU-bound boundaries to guarantee stability on massive monorepos without OOM crashes.
- **Lexical Scoping**: Every string, comment and regular expression literal is mapped before a rule reads a byte — with the TypeScript scanner where it can, and a declarative tokeniser for Python, Go, Rust, shell, Java, C, C++, C#, Kotlin, Swift and Ruby. Each rule declares what it looks at (`code`, `strings`, `comments`, `regex`, `all`). A rule about `eval()` stays quiet inside a comment; a rule about insecure URLs does not read the pattern that validates them; a Python docstring is documentation rather than a string value.
- **Exceptions That Say Why**: A rule can skip test code that lives inside the file it tests (`#[cfg(test)] mod tests`), skip documentation comments in languages that mandate them, and be excused by name on one line with `// slopless-disable-next-line VBC-001 -- reason`. A project can claim its own vocabulary, so `blacklist` in a firewall is the domain rather than a finding — and the run reports how many findings that excused.
- **Rule Precedence**: A specific rule declares the general ones it `supersedes`, so a single `// TODO: implement this` produces one finding, not four.
- **In the editor, and while writing**: [`packages/vscode-slopless`](packages/vscode-slopless) is a language server and a Slopless panel — diagnostics as you type, and a list of what the rules found across the workspace, ordered errors first. Build the `.vsix` and install it; it is not on the Marketplace. [`packages/mcp-slopless`](packages/mcp-slopless) is an MCP server, so a coding agent can check a buffer *before* it writes the file rather than after the commit. Both run the same engine and the same rules as the CLI.

## GitHub Action

```yaml
- uses: fabriziosalmi/slopless@v1
  with:
    patterns: "src/**/*.ts"      # optional; add format: sarif, type-check: "true", args: ...
```

Runs the bundled CLI directly — no npm install in your job. Exit code 1 on errors (warnings pass).

`@v1` is a moving tag: it follows every 1.x release, which is convenient and means
you are trusting this repository not to change under you. To remove that trust,
pin to the commit instead — Dependabot will keep it current:

```yaml
- uses: fabriziosalmi/slopless@<commit-sha>   # pin to the release you audited
```

## Installation

```bash
npm install -D @fabriziosalmi/slopless
# or run it without installing
npx @fabriziosalmi/slopless
```

> The unscoped `slopless` on npm is an unrelated prose linter by another author.
> This project publishes as **`@fabriziosalmi/slopless`**; the binary it installs
> is still called `slopless`.

## Supply Chain

- **No dependencies.** `npm install @fabriziosalmi/slopless` pulls exactly one
  package. Everything the linter needs is compiled into the bundle, so there is no
  transitive install surface to compromise. CI fails if a runtime dependency
  reappears, or if the bundle stops running without `node_modules`.
- **Signed provenance.** Releases publish from GitHub Actions over OIDC. No npm
  token exists, and the package is configured to refuse one: publishing requires
  the trusted publisher. Every tarball carries an attestation binding it to the
  commit and the workflow run that produced it. Verify it yourself:

  ```bash
  npm audit signatures
  ```

  `1.4.1` is the exception and always will be. A trusted publisher can only be
  configured on a package that already exists, so the first version was published
  by hand, and `--provenance` needs a CI provider to attest with.

- **Reproducible bundle.** `dist/index.js` is committed so the Action can run with
  no install step. CI rebuilds it from source and fails if the committed bundle
  differs by a byte, so it cannot be tampered with independently of the source.
- **Pinned actions.** Every third-party action is pinned to a commit SHA, not a
  moving tag, with Dependabot keeping the pins current.
- **No telemetry.** Nothing is reported anywhere. The only rule that touches the
  network is `VBC-401` (broken links), which fetches the URLs it finds in the
  Markdown you point it at, and nothing else.

## Usage

### Instant Initialization
```bash
npx @fabriziosalmi/slopless --init
```
*Creates `slopless.config.json` and `.sloplessignore` in your workspace.*

### Lint the Project
```bash
npx @fabriziosalmi/slopless
```

### Auto-Fix and Deep Semantic Check
```bash
npx @fabriziosalmi/slopless --fix --type-check
```

### CI/CD Integration (SARIF)
```bash
npx @fabriziosalmi/slopless --format sarif > gl-sast-report.json
```

### Lint Specific Directories
```bash
npx @fabriziosalmi/slopless "src/**/*.ts" "docs/**/*.md"
```

## Silencing one line

```js
// slopless-disable-next-line VBC-001 -- a fake PAT; this test asserts it is redacted
const TOKEN = 'ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';
```

Also `// slopless-disable-line VBC-001` at the end of the line it applies to. The
directive is read from the raw line, so `#`, `/* */` and `<!-- -->` work too, and
it covers every checker tier. Full rules in
[docs/configuration.md](docs/configuration.md).

## What reaches which language

Every run ends by saying how many rules applied to each language it read, because
a file nothing checked looks exactly like a file that came back clean. The same
count, written from the rules rather than from memory:

<!-- coverage:start -->
| language | rules |
| --- | --- |
| TypeScript (JSX) (`.tsx`) | 98 of 152 |
| TypeScript (`.ts`) | 96 of 152 |
| JavaScript (`.js`) | 95 of 152 |
| Astro (`.astro`) | 84 of 152 |
| JavaScript (JSX) (`.jsx`) | 32 of 152 |
| Python (`.py`) | 32 of 152 |
| Markdown (`.md`) | 26 of 152 |
| CSS (`.css`) | 23 of 152 |
| HTML (`.html`) | 21 of 152 |
| Go (`.go`) | 19 of 152 |
| Plain text (`.txt`) | 18 of 152 |
| Shell (`.sh`) | 16 of 152 |
| Java (`.java`) | 15 of 152 |
| Rust (`.rs`) | 15 of 152 |
| Sass (SCSS) (`.scss`) | 15 of 152 |
| Ruby (`.rb`) | 14 of 152 |
| C# (`.cs`) | 13 of 152 |
| C (`.c`) | 12 of 152 |
| C++ (`.cpp`) | 12 of 152 |
| Kotlin (`.kt`) | 12 of 152 |
| Swift (`.swift`) | 12 of 152 |
| Less (`.less`) | 9 of 152 |
| JSON (`.json`) | 5 of 152 |
| PHP (`.php`) | 5 of 152 |
| Dotenv (`.env`) | 4 of 152 |
| YAML (`.yaml`) | 3 of 152 |
<!-- coverage:end -->

The parsing tiers use the TypeScript compiler, so the AST, semantic-naming and
type checks are TypeScript and JavaScript only. Everywhere else a declarative
tokeniser finds the comments and strings, which is enough for `scan:` and for the
rules that matter there: unattributed TODOs, FIXMEs describing live defects,
placeholder text, generated prose, hardcoded secrets, insecure URLs.

That split is deliberate. `clippy` finds an unhandled `unwrap` better than a regex
ever will and has the types to prove it; `staticcheck` and `pylint` are the same.
None of them has an opinion about a section that says "coming soon".

## Rule Taxonomy

- **Core/Security**: Detection of exposed credentials, `eval()` usage, `innerHTML` assignments, SQL built by concatenation, command injection, prototype pollution, insecure file permissions (`chmod 777`), and hardcoded paths.
- **Clean Code**: Identification of magic numbers, unannotated complex regular expressions, excessive nesting, `async` functions that never await, and non-descriptive variable names.
- **UX/DX**: Enforcement of accessibility standards (alt attributes, focus visibility, accessible names on icon-only buttons) and prevention of user experience dark patterns.
- **Documentation**: Detection of generated filler content, non-inclusive language, and broken external references.

Full documentation at [fabriziosalmi.github.io/slopless](https://fabriziosalmi.github.io/slopless/):
[all 152 rules](https://fabriziosalmi.github.io/slopless/rules/) ·
[configuration](https://fabriziosalmi.github.io/slopless/configuration) ·
[writing a rule](https://fabriziosalmi.github.io/slopless/writing-a-rule) ·
[the scanner bug story](https://fabriziosalmi.github.io/slopless/story)

## Writing a Rule

A rule is one YAML file in `rules/`, named after its id.

```yaml
id: VBC-999
name: my-rule
severity: warning          # error blocks the run, warning does not
category: clean-code
match:
  regex: console\.log\(
  file_types: [js, ts]
  scan: code               # code (default) | strings | comments | all
  multiline: false         # true evaluates the regex against the whole file
message: Left a console.log at line {line}.
tests:                     # required — the suite fails if a rule ships without them
  fire:
    - 'console.log("x");'
  quiet:
    - 'logger.info("x");'
```

`scan` decides which lexical scope a match must live in, which is what keeps a
code rule quiet inside a comment and a string rule quiet inside code. `supersedes`
lets a specific rule silence a general one on the same line. Rules can also use
`ast_check`, `semantic_check`, `git_check` or `type_check` instead of `regex`;
those declare `tests.external` naming the test file that covers them.

## License

MIT
