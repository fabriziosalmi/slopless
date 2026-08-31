---
layout: home

hero:
  name: slopless
  text: AI-written code has a smell. This catches it.
  tagline: "147 deterministic rules · AST checkers · auto-fix · SARIF · zero network"
  actions:
    - theme: brand
      text: npx slopless
      link: "#in-ten-seconds"
    - theme: alt
      text: The 147 rules
      link: /rules/
    - theme: alt
      text: GitHub
      link: https://github.com/fabriziosalmi/slopless

features:
  - title: "[ 147 rules ]"
    details: Security, correctness, readability, documentation honesty. Every rule is a YAML file you can read, disable, or extend.
  - title: "[ --fix ]"
    details: Known anti-patterns are rewritten in place. What cannot be fixed safely is only reported.
  - title: "[ --type-check ]"
    details: Opt-in deep semantics through the TypeScript compiler — inherited types, real signatures, not just tokens.
  - title: "[ zero false noise ]"
    details: Strings and comments are mapped out before any pattern runs. The engine only judges live code.
---

<div class="sl-term">
  <div class="sl-term-bar"><i></i><i></i><i></i><span>slopless on slopless — real output, run in CI on every push</span></div>
  <pre><span class="p">$</span> npx slopless "src/**/*.ts"
&nbsp;
🚫 Static Analysis found 2 issues:
&nbsp;
<span class="err">❌ [VBC-028]</span> src/api.ts:41 - Floating promise: attach .catch() or await it
<span class="warn">⚠️ [VBC-084]</span> src/cli.ts:52 - Line is too long (124 characters) <span class="dim">🔧 (fixable)</span>
&nbsp;
Summary: 1 error, 1 warning.
&nbsp;
<span class="p">$</span> npx slopless "src/**/*.ts" --fix
✅ No static analysis issues detected. Clean architecture!</pre>
</div>

<div class="sl-stats">
  <span><b>147</b> rules</span>
  <span><b>67</b> tests</span>
  <span><b>0</b> issues on itself</span>
  <span><b>0</b> network calls</span>
  <span>v1.0.1</span>
</div>

## In ten seconds {#in-ten-seconds}

```bash
npx slopless --init          # writes slopless.config.json + .sloplessignore
npx slopless "src/**/*.ts"   # exit 1 on errors — wire it to your pre-commit
```

In CI, as a GitHub Action — no install step, the bundled CLI runs directly:

```yaml
- uses: fabriziosalmi/slopless@v1
  with:
    patterns: "src/**/*.ts"   # optional: format: sarif · type-check: "true"
```

## Why it exists

Generated code ships with a signature: swallowed promises, apologetic comments, dead
branches nobody asked for, `var` in 2026. Slopless is the reviewer that never gets tired
of pointing it out — deterministic rules, readable output, and an exit code your CI can act on.

It runs on itself, on every push. That is the standard it holds you to.
