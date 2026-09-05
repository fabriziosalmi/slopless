# Slopless for VS Code

Static analysis for AI-slop patterns, in the editor: squiggles as you type, and a
panel listing what the rules found across the workspace.

It is the same engine and the same 152 rules as the CLI and the GitHub Action, so
the editor and the build agree by construction rather than by being kept in step.

## What you get

- **Diagnostics while typing**, through a language server, in every language the
  rules reach — TypeScript and JSX, JavaScript, Astro, Python, Go, Rust, Java,
  Ruby, C#, C and C++, Kotlin, Swift, PHP, shell, HTML, CSS, Sass, Markdown.
- **A Slopless panel** in the activity bar: files ordered by how much is wrong,
  errors first, each finding naming its rule. Clicking one goes to the line.
- **A workspace scan** on open and on every save, and on demand from the panel's
  refresh button or `Slopless: Scan the workspace`.

## What it does not do

It does not fix anything from the editor — `slopless --fix` is a terminal command,
and it declines to write a file the fix would break.

The scan stops at 2000 files and says so in the panel rather than quietly
reporting on a subset.

## Installing

Not on the Marketplace. Every release carries the `.vsix` as an asset, with a
`.sha256` beside it:

```bash
gh release download v1.15.2 --repo fabriziosalmi/slopless --pattern '*.vsix*'
shasum -a 256 -c slopless-1.15.2.vsix.sha256
code --install-extension slopless-1.15.2.vsix
```

Or build it from the repository:

```bash
cd packages/vscode-slopless
npm install
npm run package
code --install-extension slopless.vsix
```

## Configuration

`slopless.config.json` in the workspace root is read, and the panel refreshes
when it changes. It is the same file the CLI reads.
