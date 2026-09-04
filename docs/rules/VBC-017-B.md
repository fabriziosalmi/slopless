---
title: VBC-017-B - focused-test-committed
editLink: false
---

# VBC-017-B: focused-test-committed

<badge type="danger" text="error" />

**Category:** correctness  
**Analysis:** `Regex` (line by line)  
**File types:** `.js`, `.jsx`, `.ts`, `.tsx`, `.astro`  
**Scope:** source code only, ignoring anything inside strings and comments  
**Tags:** `correctness` `testing`

## What it reports

Focused test at line {line}. Committed, it runs this test and silently skips every other one in the file, and the suite still reports green.

## Flagged

```js
describe.only("the parser", () => {});
```

```js
it.only("returns the cached value", async () => {});
```

```js
  fdescribe("suite", () => {});
```

## Not flagged

```js
describe("the parser", () => {});
```

```js
const only = items.only;
```

```js
expect(list.only).toBe(true);
```

## Pattern

```regex
\b(?:describe|it|test|context|suite)\.only\s*\(|^\s*(?:fdescribe|fit)\s*\(
```
