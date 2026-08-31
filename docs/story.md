---
title: The template literal that switched off 116 rules
description: How a missing reScanTemplateToken call made a TypeScript static analyser report zero findings on its own source, and what it took to notice.
head:
  - ["meta", { property: "og:title", content: "The template literal that switched off 116 rules" }]
  - ["meta", { property: "og:description", content: "A missing reScanTemplateToken call made every regex rule go quiet after the first ${} in a file. The linter reported zero issues on its own source." }]
---

# The template literal that switched off 116 rules

slopless has 147 rules. One day it ran on its own source and said this:

```text
$ slopless "src/**/*.ts"

✅ No static analysis issues detected. Clean architecture!
```

Two thousand lines of TypeScript. Nobody writes that clean. The output was not a
pass, it was a symptom.

## What the engine was supposed to do

Regex rules produce false positives when they match inside strings and comments.
A rule about `eval(` should not fire on a line that only mentions it in prose. So
before any pattern runs, the engine scans the file with the TypeScript scanner and
records the character ranges of every string and comment.

That map is the whole basis of the regex tier. If it is wrong, nothing downstream
can be right.

## What it actually produced

Dumping the ranges for a three-line file made it obvious:

```text
PROTECTED TemplateHead        [17..23)  "`hi ${"
PROTECTED TemplateToken       [28..84)  "`;\nObject.assign({}, req.body);\nel.innerHTML = ..."
                                         ↑ the entire rest of the file
```

The second range runs from character 28 to the end of the file. Everything after
that point was marked *inside a string*, so every regex match in it was discarded.

## The cause

`ts.createScanner` does not track template spans on its own. When it reaches the
`}` that closes a `${…}` substitution, the caller has to ask it to re-read that
token as part of the template:

```ts
// Wrong: the scanner reads the closing backtick as a NEW literal,
// which is never terminated, so it swallows the rest of the file.
let token = scanner.scan();
while (token !== ts.SyntaxKind.EndOfFileToken) {
  record(token);
  token = scanner.scan();
}
```

The fix is to track how deep the braces are when each template span opens, and
re-scan the matching close brace as a template token:

```ts
const templateBraceDepths: number[] = [];
let braceDepth = 0;

let token = scanner.scan();
while (token !== ts.SyntaxKind.EndOfFileToken) {
  if (token === ts.SyntaxKind.OpenBraceToken) {
    braceDepth++;
  } else if (token === ts.SyntaxKind.CloseBraceToken) {
    if (templateBraceDepths[templateBraceDepths.length - 1] === braceDepth) {
      token = scanner.reScanTemplateToken(false);
      if (token === ts.SyntaxKind.TemplateTail) templateBraceDepths.pop();
    } else {
      braceDepth--;
    }
  }
  if (token === ts.SyntaxKind.TemplateHead) {
    templateBraceDepths.push(braceDepth);
  }
  record(token);
  token = scanner.scan();
}
```

`reScanTemplateToken` is the piece that was missing. Without it, one interpolated
string silently disabled 116 of the 147 rules for the rest of the file, and
template literals are everywhere in modern TypeScript.

## Why it was hard to see

The tier did not crash. It did not log. It agreed with everything. A linter that
reports nothing looks exactly like a clean codebase, and the failure mode of a
static analyser is silence.

Two releases shipped this way.

## What the bug was hiding

With the scanner fixed, the rules underneath turned out to be inverted. Fixtures
made it measurable:

| what the tool reported | buggy | fixed |
| --- | --- | --- |
| a file whose 4 violations all sit inside strings | 0 | 4 |
| a file containing nothing but commented-out code | 5 | 2 |

`http://` in a licence comment: reported. A hardcoded IP in a config string:
invisible. The security rules had the same shape: SQL injection built as
`query("SELECT ... " + id)` was missed, while `'Update ' + count + ' items'` was
reported as an injection, at error severity.

## The fix that mattered

Not patching 116 regexes. Giving every rule a lexical scope, so it declares where
it is allowed to match:

```yaml
match:
  regex: \beval\(
  scan: code        # never inside a comment or a string

match:
  regex: (\d{1,3}\.){3}\d{1,3}
  scan: strings     # a hardcoded IP only ever lives in a literal
```

Four scopes (`code`, `strings`, `comments`, `all`) turned a class of bug into a
declaration each rule makes about itself.

## The guardrail

Every one of the 147 rules now ships a snippet it **must flag** and one it **must
ignore**, run on every commit. A rule cannot enter the repository without them.

The test suite went from 67 to 560. Writing the examples found two further real
bugs on their own, including a floating-promise check that looked for `.catch()`
on the parent chain when it lives on the callee chain.

## The measurements

| | before | after |
| --- | --- | --- |
| findings on its own source | 0 | 33 |
| findings across 400 real npm library files | 6,378 | 5,494 |
| tests | 67 | 560 |

The 400-file drop is not less detection: 388 of the removed hits were `console.log`
inside JSDoc examples in `@types/node`, which is documentation, not production
logging.

## What to take from it

A passing check is a claim, not evidence. If your tool cannot demonstrate that it
still fails on a known-bad input, a green result tells you nothing about the code,
only that the tool ran.

---

There is a slide version of this story, made for LinkedIn, 11 slides at 1080×1080:
[download the PDF](https://github.com/fabriziosalmi/slopless/releases/download/v1.1.1/slopless-linkedin.pdf).

The fix is in [ast-utils.ts](https://github.com/fabriziosalmi/slopless/blob/main/src/engine/ast-utils.ts),
and the scope model in [regex-checker.ts](https://github.com/fabriziosalmi/slopless/blob/main/src/checkers/regex-checker.ts).
