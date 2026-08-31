---
title: Configuration
description: How to silence a rule, change its severity, ignore paths, and add your own rules to slopless.
---

# Configuration

Running `slopless --init` writes two files into the project root. Neither is
required — without them every rule runs at its declared severity.

```bash
npx @fabriziosalmi/slopless --init
```

## slopless.config.json

```json
{
  "rules": {
    "VBC-018": "off",
    "VBC-084": "warning",
    "VBC-338": "error"
  },
  "ignore": ["vendor/**"],
  "customRulesPaths": ["./my-rules"],
  "typeCheck": false
}
```

### rules

Maps a rule id to `error`, `warning`, or `off`. This is how you disable a rule
you disagree with, or promote one you care about.

`error` fails the run with exit code 1. `warning` reports and exits 0. `off`
removes the rule entirely — it is never loaded, so it costs nothing.

```json
{
  "rules": {
    "VBC-018": "off",        // console.log is the output of this CLI
    "VBC-338": "error"       // inclusive language is not negotiable here
  }
}
```

Every rule id is listed in the [rules reference](/rules/), and appears in the
output of any finding, so you can copy it straight from a failing run.

### ignore

Glob patterns for paths the linter should not read at all. These are merged with
`.sloplessignore`.

### customRulesPaths

Directories of your own rule YAML files, loaded alongside the built-in 147. See
[writing a rule](/writing-a-rule).

### typeCheck

Turns on the TypeScript type checker tier by default, equivalent to passing
`--type-check`. It builds a real `ts.Program`, so it is slower — leave it off for
pre-commit and turn it on in CI.

## .sloplessignore

Same syntax as `.gitignore`. The generated file starts with the directories that
are never worth linting:

```gitignore
node_modules/
dist/
build/
.git/
*.min.js
```

## Command line

```bash
slopless                          # lints staged files
slopless "src/**/*.ts"            # lints a glob
slopless --fix                    # rewrites what can be fixed safely
slopless --type-check             # adds the type checker tier
slopless --format sarif > out.sarif
slopless --no-cache               # skips the content-hash cache
slopless -c path/to/config.json
```

Exit code is 1 when any **error** was reported, 0 otherwise. Warnings never fail
a run, which is what makes them safe to leave on.

## In CI

The GitHub Action runs the bundled CLI with no install step:

```yaml
- uses: fabriziosalmi/slopless@v1
  with:
    patterns: "src/**/*.ts"
    format: sarif           # optional
    type-check: "true"      # optional
```

`@v1` follows every 1.x release. Pin to a commit SHA instead if you would rather
the Action not change under you.

## Turning a noisy rule down instead of off

Before disabling a rule, check whether it is firing on a shape the rule did not
intend to catch. Three rules take exclusions rather than an on/off switch:

| Rule | Field | What it takes |
| --- | --- | --- |
| [VBC-208](/rules/VBC-208) | `exclude_files` | glob patterns, for the files that legitimately hold raw colours |
| [VBC-914](/rules/VBC-914) | `exclude_selectors` | CSS selectors where `cursor: pointer` is correct |

If a rule fires on something it should not, that is a bug worth reporting — every
rule ships an example of what it must ignore, and a missing one is the fix.
