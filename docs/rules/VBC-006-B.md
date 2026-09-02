---
title: VBC-006-B - merge-conflict-markers
editLink: false
---

# VBC-006-B: merge-conflict-markers

<badge type="danger" text="error" />

**Category:** correctness  
**Analysis:** `Regex` (line by line)  
**Scope:** the whole file, with no scope filtering  
**Excluded paths:** `**/*.md`, `**/*.txt`, `**/*.mdx`  
**Tags:** `correctness` `git`

## What it reports

Merge conflict marker at line {line}. Git wrote this and nobody finished the merge, so the file holds both sides of a change and compiles as neither.

## Flagged

```ts
const a = 1;
<<<<<<< HEAD
const b = 2;
=======
const b = 3;
>>>>>>> feature/x
```

## Not flagged

```ts
const arrow = a >>> b;
```

```ts
// ======= section =======
```

```ts
const shifted = value >>> 2;
```

## Pattern

```regex
^(?:<{7}|={7}|>{7})(?: |$)
```
