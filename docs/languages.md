---
title: What reaches which language
editLink: false
---

# What reaches which language

Every run ends by saying how many rules applied to each language it read:

```
Checked 65 files of 138 rules: .swift 11 rules, .md 15 rules.
```

A file that nothing checked looks exactly like a file that came back clean, so
the run says which it was. This table is the same count, generated from the rules
rather than written by hand.

<!-- coverage:start -->
| language | rules |
| --- | --- |
| TypeScript (`.ts`) | 93 of 148 |
| JavaScript (`.js`) | 92 of 148 |
| TypeScript (JSX) (`.tsx`) | 37 of 148 |
| Python (`.py`) | 31 of 148 |
| Markdown (`.md`) | 25 of 148 |
| CSS (`.css`) | 22 of 148 |
| Go (`.go`) | 18 of 148 |
| Shell (`.sh`) | 15 of 148 |
| Java (`.java`) | 14 of 148 |
| Rust (`.rs`) | 14 of 148 |
| Ruby (`.rb`) | 13 of 148 |
| C# (`.cs`) | 12 of 148 |
| C and C++ (`.c`) | 11 of 148 |
| Kotlin (`.kt`) | 11 of 148 |
| Swift (`.swift`) | 11 of 148 |
<!-- coverage:end -->

Counts are of every rule, including the ten that ship disabled and wait to be
asked for. A run reports against the ones actually enabled, which is why its
number is lower.

## Why the difference

The AST, semantic-naming and type tiers parse with the TypeScript compiler, so
they read TypeScript and JavaScript and nothing else. Sixteen rules live there:
empty catch blocks, deceptive function names, nesting depth, floating promises.

Everywhere else a declarative tokeniser finds the comments and string literals —
Python, Go, Rust, shell, Java, C, C++, C#, Kotlin, Swift and Ruby. That is enough
to answer the only question `scan:` asks, and it is what carries the rules that
matter outside the browser: unattributed TODOs, FIXMEs describing live defects,
placeholder text, generated prose, hardcoded secrets, insecure URLs.

Two rules need no parser at all. An empty file and a file that has grown too long
are counted, so they reach every language, including ones this tool has never
heard of.

## Why it stops there

`clippy` finds an unhandled `unwrap` better than a regex ever will, and it has the
type information to prove it. `staticcheck`, `go vet` and `pylint` are the same
for their languages. Re-implementing them worse is not a reason to run another
tool.

What none of them does is notice that a section says "coming soon", that a TODO
has no owner, or that a paragraph reads as though nobody chose the words. That is
the part this tool carries everywhere it can read a comment.
