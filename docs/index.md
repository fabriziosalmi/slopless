---
layout: home

hero:
  name: slopless
  text: AI-written code has a smell. This catches it.
  tagline: "147 deterministic rules · AST checkers · auto-fix · SARIF · zero telemetry"
  actions:
    - theme: brand
      text: npx @fabriziosalmi/slopless
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
    details: "Opt-in deep semantics through the TypeScript compiler: inherited types, real signatures, not just tokens."
  - title: "[ scoped matching ]"
    details: Every string and comment is mapped before any pattern runs, and each rule declares the scope it judges, so an eval() rule stays quiet inside a comment, and a hardcoded-IP rule looks only inside string literals.
---

<div class="sl-term">
  <div class="sl-term-bar"><i></i><i></i><i></i><span>slopless on its own checkers &middot; real output, run in CI on every push</span></div>
  <pre><span class="p">$</span> npx @fabriziosalmi/slopless "src/checkers/*.ts"
&nbsp;
🚫 Static Analysis found 7 issues:
&nbsp;
<span class="warn">⚠️ [VBC-084]</span> src/checkers/semantic-checker.ts:128 - Line is too long (135 characters).
<span class="warn">⚠️ [VBC-503]</span> src/checkers/regex-checker.ts:158 - Array named 'stack' is missing a plural 's'.
<span class="warn">⚠️ [VBC-096]</span> src/checkers/ast-checker.ts:226 - Long regular expression literal with no explanation.
<span class="warn">⚠️ [VBC-501]</span> src/checkers/ast-checker.ts:15 - Boolean variable 'found' has no standard prefix.
<span class="dim">  … 3 more</span>
&nbsp;
Summary: 0 errors, 7 warnings.</pre>
</div>

<div class="sl-stats">
  <span><b>147</b> rules</span>
  <span><b>0</b> dependencies</span>
  <span><b>560</b> tests</span>
  <span><b>0</b> errors on itself</span>
  <span><b>0</b> telemetry</span>
  <span>v1.1.1</span>
</div>

## In ten seconds {#in-ten-seconds}

```bash
npx @fabriziosalmi/slopless --init          # writes slopless.config.json + .sloplessignore
npx @fabriziosalmi/slopless "src/**/*.ts"   # exit 1 on errors; wire it to your pre-commit
```

In CI, as a GitHub Action. No install step, the bundled CLI runs directly:

```yaml
- uses: fabriziosalmi/slopless@v1
  with:
    patterns: "src/**/*.ts"   # optional: format: sarif · type-check: "true"
```

## Why it exists

Generated code ships with a signature: swallowed promises, apologetic comments, dead
branches nobody asked for, `var` in 2026. Slopless is the reviewer that never gets tired
of pointing it out: deterministic rules, readable output, and an exit code your CI can act on.

It runs on itself, on every push. That is the standard it holds you to.
