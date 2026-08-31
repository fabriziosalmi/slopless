# Slopless

[![ci](https://github.com/fabriziosalmi/slopless/actions/workflows/ci.yml/badge.svg)](https://github.com/fabriziosalmi/slopless/actions/workflows/ci.yml) [![docs](https://github.com/fabriziosalmi/slopless/actions/workflows/docs.yml/badge.svg)](https://fabriziosalmi.github.io/slopless/)

Slopless is a static analysis tool designed to identify and mitigate unstructured coding patterns, undocumented assumptions, and heuristic-driven development practices (colloquially termed "vibecoding"). It employs a multi-tiered analysis engine combining deterministic regular expressions, Abstract Syntax Tree (AST) inspection, and structural semantic heuristics.

## Architecture and Capabilities

- **Rule Engine**: 147 rigorous rules spanning security, maintainability, accessibility, and documentation integrity. Every rule ships executable examples — a snippet it must flag and one it must leave alone — run on every commit.
- **AST Inspection**: Deep structural validation to identify excessive cyclomatic complexity, parameter limits, and empty control flow blocks.
- **Deep Semantic Validation**: Opt-in TypeScript TypeChecker (`--type-check`) for resolving inherited types, identifying floating promises, and validating structural intent beyond AST boundaries.
- **Heuristic Auto-Fixes**: Autonomous modification of known anti-patterns (e.g., `var` to `let`) using `--fix`.
- **Concurrency Pooling**: Fault-tolerant AST parsing distributed across CPU-bound boundaries to guarantee stability on massive monorepos without OOM crashes.
- **Lexical Scoping**: AST-aware token scanning maps every string and comment in JS/TS, and each rule declares the scope it applies to (`code`, `strings`, `comments`, `all`). A rule about `eval()` stays quiet inside a comment; a rule about hardcoded IPs looks only inside string literals.
- **Rule Precedence**: A specific rule declares the general ones it `supersedes`, so a single `// TODO: implement this` produces one finding, not four.
- **LSP IDE Integration**: Ships with `vscode-slopless` for real-time Squiggly-Line diagnostics inside VS Code and Cursor.

## GitHub Action

```yaml
- uses: fabriziosalmi/slopless@v1
  with:
    patterns: "src/**/*.ts"      # optional; add format: sarif, type-check: "true", args: ...
```

Runs the bundled CLI directly — no npm install in your job. Exit code 1 on errors (warnings pass).

## Installation

```bash
npm install -D @fabriziosalmi/slopless
# or run it without installing
npx @fabriziosalmi/slopless
```

> The unscoped `slopless` on npm is an unrelated prose linter by another author.
> This project publishes as **`@fabriziosalmi/slopless`**; the binary it installs
> is still called `slopless`.

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

## Rule Taxonomy

- **Core/Security**: Detection of exposed credentials, `eval()` usage, `innerHTML` assignments, SQL built by concatenation, command injection, prototype pollution, insecure file permissions (`chmod 777`), and hardcoded paths.
- **Clean Code**: Identification of magic numbers, unannotated complex regular expressions, excessive nesting, `async` functions that never await, and non-descriptive variable names.
- **UX/DX**: Enforcement of accessibility standards (alt attributes, focus visibility, accessible names on icon-only buttons) and prevention of user experience dark patterns.
- **Documentation**: Detection of generated filler content, non-inclusive language, and broken external references.

Browse the full reference at [fabriziosalmi.github.io/slopless](https://fabriziosalmi.github.io/slopless/rules/).

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
