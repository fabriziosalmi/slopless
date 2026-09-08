# Contributing to Slopless

## Setup

```bash
git clone https://github.com/fabriziosalmi/slopless
cd slopless
npm install
npm run build
```

Node 22.12 or newer: the bundle inlines dependencies that require it.

## Running Tests

```bash
npm test              # 893 tests, under ten seconds
npm run test:coverage # the same, with a coverage table
```

Two further checks run in CI and are worth running before you push:

```bash
npm run verify:rules  # no rule pattern may backtrack catastrophically
npm run verify:bundle # dist/ runs with no node_modules and does not truncate
```

`verify:rules` times every pattern against hostile input at one size and at four
times that size, and fails anything growing faster than linearly. It is a script
rather than a test because vitest runs its files in parallel, and the same match
measured 12ms alone and 259ms under load. Five rules reached users growing with
the square of their input before this existed.

## Adding a New Rule

1. Create `rules/VBC-NNN.yaml` using an available ID number.
2. Follow the existing schema — see [src/engine/schema.ts](./src/engine/schema.ts) for all valid fields.
3. If your rule requires a new `git_check`, `ast_check`, or `semantic_check` type, add the handler to the corresponding checker file and update the Zod enum in `src/engine/schema.ts`.
4. Write at least one positive test (rule fires) and one negative test (rule does not fire on a false positive) in `src/__tests__/`.
5. Run `npm run build && npm test` before submitting.
6. If you touched `action.yml`, run `npm run verify:action`. It executes the
   composite step in a container the way a runner would, using the script read
   out of `action.yml`. Reading the file is not enough: the Action once expanded
   its own glob in bash and analysed half the files it claimed to, while staying
   green.
7. Releasing: run `npm run release:prep` after bumping the version and writing the
   CHANGELOG entry. It regenerates the docs, rebuilds the bundle and runs every
   check CI runs. Doing those by hand is how v1.1.6 shipped with a stale
   `docs/changelog.md` and a red build.
8. If you changed a dependency, commit the rebuilt `dist/index.js` with it. The
   bundle inlines every dependency so the GitHub Action can run with no install
   step, which means a version bump changes the bundle. CI compares the committed
   bundle against a fresh build and fails if they differ — including on Dependabot
   pull requests, which cannot rebuild it themselves.

## Rule Naming Conventions

- **ID**: `VBC-NNN` where NNN is the next available three-digit number.
- **name**: kebab-case, descriptive (e.g., `float-for-currency`).
- **category**: one of `core`, `security`, `clean-code`, `ux-dx`, `docs`, `git`, `correctness`.
  These are the values `--only` accepts; the run derives that list from the rules it loaded.
- **severity**: `error` for issues that can cause bugs/security problems; `warning` for style and maintainability.

## Pull Request Checklist

- [ ] New rule YAML added with correct schema
- [ ] Handler implemented if new check type introduced
- [ ] At least one true-positive and one false-positive test added
- [ ] `npm run build` passes without TypeScript errors
- [ ] `npm test` passes
- [ ] `npm run verify:rules` passes
- [ ] `npm run docs:gen` run and the regenerated files committed

Do not edit the rule count, the language coverage table or the rule pages by
hand: they are generated from the rules themselves and CI fails if what is
committed differs from a fresh generation.

## Where to start

Issues labelled [`good first issue`](https://github.com/fabriziosalmi/slopless/labels/good%20first%20issue)
are scoped to one file and have a test that will tell you when you are done. A
false positive is usually the best first change: there is a real snippet that
should not have been reported, the fix is a narrower pattern, and the snippet
becomes the test that keeps it narrow.

## Reporting Bugs

Open an issue describing:
- The rule ID that triggered (or failed to trigger)
- The code snippet that caused the unexpected behaviour
- Expected outcome vs actual outcome
