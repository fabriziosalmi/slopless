# Slopless

Slopless is a static analysis tool designed to identify and mitigate unstructured coding patterns, undocumented assumptions, and heuristic-driven development practices (colloquially termed "vibecoding"). It employs a multi-tiered analysis engine combining deterministic regular expressions, Abstract Syntax Tree (AST) inspection, and structural semantic heuristics.

## Architecture and Capabilities

- **Rule Engine**: 111+ rigorous rules spanning security, maintainability, accessibility, and documentation integrity.
- **AST Inspection**: Deep structural validation to identify excessive cyclomatic complexity, parameter limits, and empty control flow blocks.
- **Deep Semantic Validation**: Opt-in TypeScript TypeChecker (`--type-check`) for resolving inherited types, identifying floating promises, and validating structural intent beyond AST boundaries.
- **Heuristic Auto-Fixes**: Autonomous modification of known anti-patterns (e.g., `var` to `let`) using `--fix`.
- **Concurrency Pooling**: Fault-tolerant AST parsing distributed across CPU-bound boundaries to guarantee stability on massive monorepos without OOM crashes.
- **Protected Regex Engine**: AST-aware token scanning maps all strings and comments in RAM to guarantee *zero* false positives on regex evaluations.
- **LSP IDE Integration**: Ships with `vscode-slopless` for real-time Squiggly-Line diagnostics inside VS Code and Cursor.

## Installation

```bash
npm install -g slopless
# OR
npm install slopless --save-dev
```

## Usage

### Instant Initialization
```bash
npx slopless --init
```
*Creates `slopless.config.json` and `.sloplessignore` in your workspace.*

### Lint the Project
```bash
npx slopless
```

### Auto-Fix and Deep Semantic Check
```bash
npx slopless --fix --type-check
```

### CI/CD Integration (SARIF)
```bash
npx slopless --format sarif > gl-sast-report.json
```

### Lint Specific Directories
```bash
npx slopless "src/**/*.ts" "docs/**/*.md"
```

## Rule Taxonomy

- **Core/Security**: Detection of exposed credentials, `eval()` usage, `innerHTML` assignments, insecure file permissions (`chmod 777`), and hardcoded paths.
- **Clean Code**: Identification of magic numbers, unannotated complex regular expressions, excessive nesting, and non-descriptive variable names.
- **UX/DX**: Enforcement of accessibility standards (alt attributes, focus visibility) and prevention of user experience dark patterns.
- **Documentation**: Detection of generated filler content, non-inclusive language, and broken external references.

## License

MIT
