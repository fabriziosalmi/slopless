# Slopless

Slopless is a static analysis tool designed to identify and mitigate unstructured coding patterns, undocumented assumptions, and heuristic-driven development practices (colloquially termed "vibecoding"). It employs a multi-tiered analysis engine combining deterministic regular expressions, Abstract Syntax Tree (AST) inspection, and structural semantic heuristics.

## Architecture and Capabilities

- **Rule Engine**: 111+ rigorous rules spanning security, maintainability, accessibility, and documentation integrity.
- **AST Inspection**: Deep structural validation to identify excessive cyclomatic complexity, parameter limits, and empty control flow blocks.
- **Semantic Heuristics**: Detection of misleading identifiers, inconsistent boolean nomenclature, and variable shadowing.
- **Network Validation**: Asynchronous validation of documentation links to ensure reference integrity.
- **Tone Analysis**: Identification of subjective, non-inclusive, or unprofessional terminology within code comments and documentation.

## Installation

```bash
git clone https://github.com/fabriziosalmi/slopless.git
cd slopless
npm install
```

## Usage

### Lint Staged Files
```bash
npx ts-node src/index.ts
```

### Lint Specific Files
```bash
npx ts-node src/index.ts path/to/file.ts path/to/docs.md
```

## Rule Taxonomy

- **Core/Security**: Detection of exposed credentials, `eval()` usage, `innerHTML` assignments, insecure file permissions (`chmod 777`), and hardcoded paths.
- **Clean Code**: Identification of magic numbers, unannotated complex regular expressions, excessive nesting, and non-descriptive variable names.
- **UX/DX**: Enforcement of accessibility standards (alt attributes, focus visibility) and prevention of user experience dark patterns.
- **Documentation**: Detection of generated filler content, non-inclusive language, and broken external references.

## License

MIT
