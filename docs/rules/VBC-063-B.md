---
title: VBC-063-B - empty-block
editLink: false
---

# VBC-063-B: empty-block

<badge type="warning" text="warning" />

**Category:** clean-code  
**Analysis:** `AST`  
**Tags:** `clean-code`

## What it reports

Empty block detected at line {line}. This code does nothing.

## Flagged

```ts
function noop() {}
```

## Not flagged

```ts
function run() { start(); }
```

## AST check

- **Type:** `empty-block`
