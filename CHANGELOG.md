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
