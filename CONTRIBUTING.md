# Contributing to Slopless

## Setup

```bash
git clone https://github.com/your-org/slopless
cd slopless
npm install
npm run build
```

## Running Tests

```bash
npm test
npm run test:coverage
```

## Adding a New Rule

1. Create `rules/VBC-NNN.yaml` using an available ID number.
2. Follow the existing schema — see [src/engine/schema.ts](./src/engine/schema.ts) for all valid fields.
3. If your rule requires a new `git_check`, `ast_check`, or `semantic_check` type, add the handler to the corresponding checker file and update the Zod enum in `src/engine/schema.ts`.
4. Write at least one positive test (rule fires) and one negative test (rule does not fire on a false positive) in `src/__tests__/`.
5. Run `npm run build && npm test` before submitting.
6. If you changed a dependency, commit the rebuilt `dist/index.js` with it. The
   bundle inlines every dependency so the GitHub Action can run with no install
   step, which means a version bump changes the bundle. CI compares the committed
   bundle against a fresh build and fails if they differ — including on Dependabot
   pull requests, which cannot rebuild it themselves.

## Rule Naming Conventions

- **ID**: `VBC-NNN` where NNN is the next available three-digit number.
- **name**: kebab-case, descriptive (e.g., `float-for-currency`).
- **category**: one of `core`, `security`, `clean-code`, `ux-dx`, `docs`, `git`, `heuristics`, `semantic`.
- **severity**: `error` for issues that can cause bugs/security problems; `warning` for style and maintainability.

## Pull Request Checklist

- [ ] New rule YAML added with correct schema
- [ ] Handler implemented if new check type introduced
- [ ] At least one true-positive and one false-positive test added
- [ ] `npm run build` passes without TypeScript errors
- [ ] `npm test` passes
- [ ] Rule count updated in README if significant

## Reporting Bugs

Open an issue describing:
- The rule ID that triggered (or failed to trigger)
- The code snippet that caused the unexpected behaviour
- Expected outcome vs actual outcome
