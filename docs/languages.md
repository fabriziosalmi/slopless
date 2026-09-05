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
| YAML (`.yml`) | 3 of 152 |
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
