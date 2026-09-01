---
title: Writing a rule
description: "The YAML schema for a slopless rule: scan scopes, multiline matching, precedence, and the executable examples every rule must carry."
---

# Writing a rule

A rule is one YAML file named after its id. Drop it in a directory listed under
`customRulesPaths` and it loads alongside the built-in ones.

```yaml
id: VBC-999
name: my-rule
severity: warning
category: clean-code
tags: [clean-code]
match:
  regex: console\.log\(
  file_types: [js, ts]
  scan: code
message: Left a console.log at line {line}.
tests:
  fire:
    - 'console.log("x");'
  quiet:
    - 'logger.info("x");'
```

## severity

`error` fails the run; `warning` reports and exits 0. The line between them is
not how much the finding matters, it is what kind of claim the rule is making:

- **`error` is for a hazard.** A hardcoded credential, `eval` on untrusted input,
  SQL built by concatenation, an image with no alt text. The rule is asserting
  something is wrong, not that it could be nicer.
- **`warning` is for a judgement.** Every numeric threshold lives here, because
  the number is a preference: five parameters, four levels of nesting, five
  hundred lines. So does anything about naming, style or tone.

A rule that fails someone's build over a threshold they did not choose gets
switched off, and takes the hazards in the same run with it.

## match

Exactly one detection mechanism per rule.

| Field | What it does |
| --- | --- |
| `regex` | a pattern, run against the source |
| `ast_check` | a structural check over the TypeScript AST |
| `semantic_check` | a naming or shape heuristic over declarations |
| `git_check` | a check over the repository or the staged file list |
| `type_check` | a check needing resolved types (`--type-check` only) |

### scan

Which lexical scope a regex match must live in. This is the field that keeps a
rule about `eval(` quiet inside a comment, and a rule about hardcoded IPs looking
only where they actually appear.

| Value | Match must start |
| --- | --- |
| `code` | outside every string and comment (**the default**) |
| `strings` | inside a string or template literal |
| `comments` | inside a comment |
| `all` | anywhere; no filtering |

Scopes are resolved with the TypeScript scanner, so they apply to `.ts`, `.tsx`,
`.js`, `.jsx` and their variants. Other languages are always scanned whole.

### multiline

By default a regex is evaluated line by line, which is fast and keeps `^`/`$`
anchored to a line. Set `multiline: true` to run it against the whole file, the
only way to match something that spans lines, like a JSX element with its
attributes on separate rows.

### file_types, exclude_files, exclude_selectors

`file_types` is a list of extensions without the dot. `exclude_files` takes glob
patterns and skips whole files. `exclude_selectors` applies to stylesheets and
skips a match whose enclosing CSS selector is in the list.

## message

Shown when the rule fires. Available placeholders: `{line}`, `{match}`, `{count}`,
and for AST checks `{threshold}`.

Say what is wrong and what to do instead. A message that only names the pattern
makes the reader go looking for the reason.

## supersedes

A list of rule ids this rule is a more specific case of. When both fire on the
same line, only this one is reported, which is how a single `// TODO: implement
this` produces one finding rather than four.

## tests

**Required.** Every rule carries at least one snippet it must flag and one it must
leave alone. The suite fails if a rule arrives without them.

```yaml
tests:
  fire:
    - 'const password = "hunter2abc";'
    - file: fixture.tsx
      code: |
        <button onClick={close}>
          <svg viewBox="0 0 24 24" />
        </button>
  quiet:
    - 'const password = process.env.PASSWORD;'
```

A bare string uses the first entry in `file_types` as its extension. The object
form sets the filename explicitly, which matters when a rule behaves differently
per extension. `repeat` multiplies the snippet, for thresholds counted in lines.

Rules driven by git, the network or the type graph cannot be exercised from a
snippet. They declare where they are covered instead, and the suite checks that
the file exists and mentions the rule:

```yaml
tests:
  external: git-checker.test.ts: needs a staged file list
```

## Running your rule

```bash
npx vitest run src/__tests__/rule-fixtures.test.ts
```

The fixture suite runs every example of every rule, so a new rule is verified the
moment it is added.
