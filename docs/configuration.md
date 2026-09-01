---
title: Configuration
description: How to silence a rule, change its severity, ignore paths, and add your own rules to slopless.
---

# Configuration

Running `slopless --init` writes two files into the project root. Neither is
required; without them every rule runs at its declared severity.

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

Maps a rule id to `error`, `warning`, or `off`.

Naming a rule here also **turns on** the ones that ship disabled. Ten rules encode
a preference about how you write English prose rather than a defect in the code,
and across twenty repositories they were two thirds of everything slopless said.
A preference nobody agreed to should not drown the findings someone installed the
tool for, so those rules wait to be asked for:

```json
{ "rules": { "VBC-948": "warning", "VBC-347": "warning" } }
```

The opt-in set is `VBC-948` em dashes, `VBC-347` passive voice, `VBC-421` filler
words, `VBC-324` condescending language, `VBC-917` shouting, `VBC-398`
punctuation, `VBC-929` jargon, `VBC-934` personal opinion, `VBC-935`
colloquialism, `VBC-918` tone. Every rule page says whether it is one of them.

Rules that mark content as unfinished or generated stay on: lorem ipsum, "coming
soon", the phrasings of machine-written prose. Those are what this tool is for. This is how you disable a rule
you disagree with, or promote one you care about.

`error` fails the run with exit code 1. `warning` reports and exits 0. `off`
removes the rule entirely: it is never loaded, so it costs nothing.

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
`--type-check`. It builds a real `ts.Program`, so it is slower. Leave it off for
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

## Choosing what to run

Across ten repositories running this in CI, slopless reported 4754 findings. Nine
of them were security. The rest was style, and it buried them.

Two flags narrow the run before anything executes, so they cost nothing:

```bash
slopless --only security,core "src/**/*.ts"   # hazards only
slopless --min-severity error "src/**/*.ts"   # only what fails a build
slopless --only docs "**/*.md"                # prose and documentation
```

`--only` takes any of `security`, `core`, `clean-code`, `ux-dx`, `docs`, `git`.
Measured on one repository: 993 findings, 51 with `--only security,core`, 4 with
`--min-severity error`.

Neither replaces turning individual rules off in the config. They are for asking
a different question of the same codebase: a pre-commit hook that only blocks on
hazards, and a weekly run that reads everything.

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

If a rule fires on something it should not, that is a bug worth reporting: every
rule ships an example of what it must ignore, and a missing one is the fix.

## Silencing one line

A rule can be right about the shape and wrong about the line. Turning it off in
`slopless.config.json` costs every other file's coverage to buy one exception, so
name the exception instead:

```js
// slopless-disable-next-line VBC-001 -- a fake PAT; this test asserts it is redacted
const TOKEN = 'ghp_A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8';

el.setAttribute('href', url); // slopless-disable-line VBC-070
```

The directive is looked for in the raw line, not in a parsed comment, so it works
in `//`, `#`, `/* */` and `<!-- -->` without knowing which language it is in. It
applies to every tier: a finding from the AST and a finding from a regex are the
same annoyance on the same line.

List as many rule ids as you need, separated by anything. Everything after ` -- `
is for the next person to read, and rule ids mentioned there do not count, so you
can write "unlike VBC-070, this one is real" without silencing VBC-070.

A directive with no rule id silences every rule on that line. Prefer naming one:
a suppression that names its rule stops applying the moment the line changes
character, which is the point.

## Words your project has claimed

A word can be slop in general and the domain everywhere in one repository.
`blacklist` appears 617 times in a firewall, where it names the data structure
and half the JSON contract. `master` appears 486 times in an audio project, where
it is the output bus. Switching the rule off loses every other use of it, and
renaming the domain to satisfy a linter is worse.

```json
{ "vocabulary": ["blacklist", "whitelist", "master"] }
```

It applies to every rule, because the word means the same thing wherever it
appears in the repository that declared it. Whole words only, so claiming
`master` does not excuse `mastermind`. The run says how many findings it excused
and which words did it: a silence nobody can see is the thing this tool exists to
argue against.

## What a rule reads

`scan:` says which part of a file a rule looks at.

| value | reads |
| --- | --- |
| `code` (default) | everything that is not a comment, a string or a pattern |
| `strings` | string literals |
| `comments` | comments, documentation included |
| `regex` | regular expression literals |
| `all` | the file as text |

A regular expression literal is not a string literal: `/^https?:\/\//` is a
pattern that recognises a URL, not a URL. A rule about the values a program
carries does not read one, and the rule about patterns reads nothing else.

Two more fields decide what a rule skips.

`exclude_test_code: true` skips test code that lives inside the file it tests.
Rust puts it in `#[cfg(test)] mod tests`, and `exclude_files` cannot see it
because there is no separate file to exclude. A magic boolean inside an assertion
is how you write an assertion.

`exclude_doc_comments: true` skips documentation. Go requires a comment on every
exported symbol and on the package, Rust writes them with `///` and `//!`, and
the comments above the first line of code are a header whatever the language. A
rule about commentary that counts those is asking a language to stop following
its own convention.
