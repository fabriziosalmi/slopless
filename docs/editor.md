# In the editor, and while writing

The CLI and the GitHub Action read files that already exist, so they answer after
the code is written and usually after it is committed. Two packages in the
repository move that earlier, and both run the same engine and the same rules —
there is no second implementation to keep in step.

## The VS Code extension

`packages/vscode-slopless` is a language server and a panel.

**Diagnostics while you type**, in every language the rules reach — the same list
[the coverage table](/languages) generates from the rules themselves.

**A Slopless panel** in the activity bar:

- files ordered by how much is wrong, errors first, then by count;
- each finding naming its rule, with the message and the line;
- clicking one opens the file at that line;
- a full scan on open and from the panel's refresh button, and a re-read of just
  the file you saved when you save it.

It stops at 2,000 files, and when it does it says so — *"What is below is
complete; what is beyond it was not read"* — rather than reporting on a subset as
though it were the whole thing.

### Installing

It is not on the Marketplace. Every release carries the `.vsix` as an asset,
built by the release workflow out of the commit the tag points at, with a
`.sha256` beside it:

```bash
gh release download v1.15.2 --repo fabriziosalmi/slopless --pattern '*.vsix*'
shasum -a 256 -c slopless-1.15.2.vsix.sha256
code --install-extension slopless-1.15.2.vsix
```

Or build it from the repository:

```bash
npm install && npm run build          # the engine, at the repository root
cd packages/vscode-slopless
npm install
npm run package
code --install-extension slopless.vsix
```

The extension is bundled rather than shipped with `node_modules`, because a
`.vsix` cannot carry the `file:` link to the engine. The rules are copied into
the extension at build time, so the path the engine already looks in —
`__dirname/../../rules` — keeps working inside the package.

### Configuration

`slopless.config.json` in the workspace root is read, and the panel refreshes
when it changes. It is the same file the CLI reads, documented in
[Configuration](/configuration).

## The MCP server

`packages/mcp-slopless` answers about a **buffer**: text that is about to be
written, with the path it is going to have. A coding agent can ask before it
writes the file rather than after the commit.

| tool | for |
| --- | --- |
| `lint_text` | code that is not on disk yet. The extension picks the rules; the path decides whether it counts as test code |
| `lint_files` | files on disk. Says which ones it could not read, rather than reporting "nothing found" for a file nothing looked at |
| `describe_rule` | what a rule is about, by id (`VBC-005`) or name (`use-var`). Without an argument, lists every rule |

The path is not decoration. The same two lines answer differently depending on
where they are going to live:

```
src/auth/session.ts       error VBC-001 hardcoded-secret line 1
src/auth/session.test.ts  nothing found
```

`describe_rule` reads the set the linter would actually run — config overrides
applied, opt-in rules filtered — rather than a second list that can drift away
from it.

### Installing

```bash
cd packages/mcp-slopless
npm install && npm run build
claude mcp add slopless -- node packages/mcp-slopless/out/server.js
```

The repository ships a `.mcp.json` with exactly that, so a clone needs only the
build.

The MCP SDK is a dependency of that package alone. The engine still has none.

## How these are kept honest

The README used to say the extension shipped. It could not be installed at all:
`package.json` pointed `main` at a file its own build never produced, it was not
on the Marketplace, and it was not in the npm package either. The source was real
and the language server was sound, and none of that mattered.

So CI builds both packages, checks that the file `main` names exists, that the
server the client spawns exists, that the rules were copied — and then **talks
to** the MCP server over stdio: handshake, tool list, and a finding on
`var x = 1`. Every pull request carries the built `.vsix` as an artifact, so a
change can be installed and tried rather than only read.

A release checks one more thing: that the version inside the packaged extension
is the version being released. Both packages said `1.14.0` while the root had
moved on twice, which is what that check is for.

Compiling proves it builds. The probe proves it answers. Confusing those two is
how the extension came to be broken, and nothing noticed for as long as it was.
