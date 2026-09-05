# Slopless as an MCP server

The CLI and the GitHub Action read files that already exist, so they answer after
the code is written and usually after it is committed. This answers about a
**buffer**: text that is about to be written, with the path it is going to have.

Same engine, same 152 rules. There is no second implementation to keep in step.

## Tools

| tool | for |
| --- | --- |
| `lint_text` | code that is not on disk yet. Give it the text and the path it will have — the extension picks the rules, and the path decides whether it counts as test code |
| `lint_files` | files that are on disk. Says which ones it could not read rather than reporting "nothing found" for a file nothing looked at |
| `describe_rule` | what a rule is about, by id (`VBC-005`) or name (`use-var`). Without an argument, lists every rule |

`describe_rule` reads the same set the linter would run — config overrides and
opt-in rules included — rather than a second list that can drift away from it.

## Using it from Claude Code

```bash
npm install && npm run build
claude mcp add slopless -- node packages/mcp-slopless/out/server.js
```

The repository ships a `.mcp.json` with exactly that, so a clone needs only the
build.

## Building

```bash
npm install
npm run build
```

`npm install` links the engine from the repository root, so build the root first
(`npm run build` there) or the link points at a `dist/` that is not there yet.

CI builds this and then speaks to it over stdio — `scripts/probe-mcp.js` does the
handshake, lists the tools, and asks for a finding on `var x = 1`. Compiling
proves it builds; the probe proves it answers, and those are not the same thing.
