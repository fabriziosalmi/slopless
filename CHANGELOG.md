# 1.15.0 - 2026-09-05

**The README said the VS Code extension shipped. It could not be installed at
all.** Three separate reasons, and each one alone was enough:

- `package.json` pointed `main` at `./client/out/extension.js`, and the declared
  build never produced a `client/out/` — the package's root tsconfig had no
  references, so `tsc -b` emitted `.js` next to the `.ts` in `src/` instead.
- It was not on the Marketplace: `slopless.vscode-slopless` answered 404.
- It was not in the npm package either — `files` is `["dist", "rules"]`.

The source was real and the language server code was sound. There was simply no
way for anyone to get it.

Now it builds, packages, and installs, and it does more than draw squiggles:

- **A Slopless panel** in the activity bar. Files ordered by how much is wrong,
  errors first, each finding naming its rule; clicking one goes to the line. It
  scans on open and on save, and says when it stopped at its 2,000-file limit
  rather than quietly reporting on a subset.
- **Diagnostics in every language the rules reach** — the client used to list
  four, and there are twenty-six.
- Bundled with esbuild and the rules copied to the extension root, so the path
  the engine already looks in keeps working inside a `.vsix`.

**`packages/mcp-slopless` is new**: slopless as an MCP server, so a coding agent
can check a buffer *before* it writes the file. `lint_text` takes the text and
the path it is going to have, `lint_files` reads from disk and says which files
it could not read, and `describe_rule` explains one. The MCP SDK is a dependency
of that package alone — the engine still has none.

**`resolveRules` is exported** from `dist/engine/api`. Anything that lists rules
has to list the ones the linter actually runs, config overrides and opt-in rules
included, and rebuilding that set elsewhere is how two lists drift apart.

**CI now builds both packages**, checks that the file `main` names exists, and
speaks to the MCP server over stdio — handshake, tool list, and a finding on
`var x = 1`. Compiling proves it builds; the probe proves it answers. That
distinction is the whole reason the extension was broken in the first place.

# 1.14.0 - 2026-09-04

Two rules brought over from `vibe-check`, which is being retired. Its 115 rules
were compared against these 150 one by one; almost all of it was already here,
and of what was not, these two survived measurement.

**`VBC-949` — a committed private key.** Found one on the first run: `proximity`
has `backend/key.pem` and `frontend/key.pem`, both `-----BEGIN PRIVATE KEY-----`,
in a public repository.

The obvious rule is the wrong one. Matching that header in any file was measured
across 24,876 files: it fired 85 times, and 83 were test fixtures, code that
writes the header, documentation about keys, and three YARA rules whose job is
to find private keys. **The signal is the file, not the string.** A `.p12`,
`.pfx`, `.jks` or `.keystore` holds nothing else, so the extension settles it. A
`.pem` or `.key` does not — half of them are certificates, which are public —
so those are read, and only the ones carrying the header are reported. Across 84
repositories that is four key-shaped files, two keys, two certificates, and no
noise.

It is also asked differently. Every other git check reads the *staged* files,
which is the pre-commit path and the only place they run — `gitMode` is on when
no patterns were given. That is right for "you are adding a .env" and useless
for a key committed two years ago, so this one is asked on every run, over what
git is tracking.

**`VBC-950` — `window.open` without `noopener`.** An anchor with
`target="_blank"` has had implied `noopener` in every browser since 2021.
`window.open` never has: the page it opens gets `window.opener` and can navigate
this one somewhere else while the user is looking away.

Two shapes are not that, and both are excluded. `window.open('', '_blank')`
returns a handle the code is about to use — one repository opens a blank window
and writes a print preview into it — and `noopener` makes that handle null. So an
empty first argument, an explicit `about:blank`, and no argument at all are left
alone. Six findings across the corpus, no false ones.

The version `vibe-check` shipped was `window\.open\([^)]+\)(?!.*noopener)`,
which cannot see past the first `)`: on
`window.open(\`…${q.toString()}\`, "_blank", "noopener,noreferrer")` it never
reaches the `noopener` that is right there.

# 1.13.1 - 2026-09-04

Two things the tool could do to the person running it.

**The link checker made requests on someone else's behalf.** `VBC-401` fetches
the URLs written in Markdown, and the workflow that runs it triggers on
`pull_request`, which includes pull requests from forks. The URL was therefore
an attacker-supplied string and the CI runner was the thing making the request:
a link to `http://169.254.169.254/` or `http://127.0.0.1:6379/` was a request
the runner made, and `fetch` followed redirects, so a public host could forward
one inward.

Requests now go through a guard that refuses private and reserved addresses, and
it validates the address the connection actually uses rather than one a
preliminary lookup returned — a name that answers publicly and then answers
`127.0.0.1` cannot slip through the gap between the two. Redirects are no longer
followed at all: a 3xx means the server knows the URL, which is all this rule
needs. An address that is refused is reported as nothing, never as broken.

Writing the address check was where it earned its keep: `new URL()` normalises
`::ffff:127.0.0.1` to `::ffff:7f00:1`, so the first version matched the dotted
form as text and let the hex form straight through to a live socket.

**`--fix` could write a file that no longer runs.** A fix is a regex applied to
one line, and a regex does not know what it is standing in. Turning both `var a`
in a scope into `let a` leaves a file `node --check` refuses. The file is now
parsed before it is written and the fixes are dropped if it would not survive:

```
Left alone: work.js. Applying 2 fixes would have left it unparseable —
Identifier 'count' has already been declared
```

Redeclaration is not a *syntax* error — `parseDiagnostics` is empty for it — so
checking syntax alone would have missed the very case this is about. The guard
also hands the file to V8, which reports early errors, and refuses only when the
file was fine before the fix.

# 1.13.0 - 2026-09-04

**`.tsx` goes from 39 rules to 97.** A `.tsx` file is TypeScript with JSX in it,
and 58 rules declared `ts` without ever mentioning `tsx`. No commit ever decided
that: the rules were written in 1.0.0 with `ts`, `astro` was added to many of
them in 1.12.0, and `tsx` was never revisited. Meanwhile six instrumented
repositories point their patterns straight at `.tsx`.

Measured across 525 `.tsx` files, deduplicated by content:

| | |
| --- | ---: |
| findings before | 989 |
| findings after | 1,902 |
| new | 913 |
| of those, errors | 19 |

**`long-line-limit` is deliberately not among them.** Over 525 `.tsx` and 716
`.ts` files from the same repositories, lines past 120 characters run **8.0 per
`.tsx` file against 0.7 per `.ts` file**. That is JSX — a className string and
three props on one tag — not a difference in how the code was written. Turning it
on would have filed 4,274 warnings, 82% of the whole delta, over everything else
the rules have to say about those files. The number and the reason are written in
the rule.

Also here, and it applies everywhere, not only to `.tsx`:

- **`VBC-901` reported the addresses reserved for documentation.** `192.0.2.0/24`,
  `198.51.100.0/24` and `203.0.113.0/24` exist so that documentation has
  addresses to use, and the rule was reporting an example for being an example.
- **`VBC-901` reported netmasks.** Nothing starting with `255` is a host —
  `240.0.0.0/4` is reserved — so `isInNet(host, "172.16.0.0", "255.240.0.0")`
  names a mask, not a machine. It still reports the `172.16.0.0`, which is an
  address.

Of the six instrumented repositories that read `.tsx`, three gain errors: five in
total, and none of them is a false positive — two `http://` RSS feeds that answer
over `https`, a `document.write`, an `http://` endpoint with an interpolated
host, and an absolute path in placeholder text.

# 1.12.6 - 2026-09-04

Three defects found by measuring a change that was then not made. Widening the
rules to `.tsx` was measured across 525 files and rejected; half of the 28 new
errors it produced were false, and the shapes were not about `.tsx` at all.

- **`VBC-001` had no test exclusion.** Every other rule that reports on the
  content of a value carries one; this one carried none, and ten of the eleven
  findings it produced across 2,892 files were fixtures — `NewPw-987654`,
  `Str0ng&Pass!`, `admin123`. Excluding tests from a secrets rule is a real
  trade, and what carries the other side is GitHub secret scanning: it reads
  every file including tests, and matches on issuer format rather than on a
  variable's name. A genuine `ghp_...` in a test is its find.
- **`VBC-001` read a public address as a secret.** `token` matches inside
  `TAM_TOKEN_ADDRESS` and `[\w]*` swallowed the `_ADDRESS` that says what the
  value is. A contract address is 42 characters of hex with no spaces, so it
  passed every other test the rule applies. The camelCase spelling was never
  affected: `tokenAddress` fails the letter boundary after the keyword.
- **`VBC-080` reported a method declaration.** `alert(text: string): void {` is
  the signature of a method that happens to be called alert. A parameter with a
  type annotation cannot be an argument, so that is what the rule now excludes —
  and a ternary argument, `alert(ok ? "saved" : "failed")`, still reports,
  because the colon there does not follow the name.

**Measured: 11 findings removed across 2,892 files, 0 added. All 11 were false.**
The `VBC-080` fix removes nothing today — no `.ts` file in the corpus declares a
method called alert — it removes a false positive that only appears once the
rules reach `.tsx`.

# 1.12.5 - 2026-09-04

**The coverage table listed 15 languages. The tool reaches 26.**

`syncLanguageCoverage` generates the counts from the rules, and its own comment
says the claim "drifts the moment a rule declares a new file type". The counts
never drifted; the *list of languages* did, because it was still written by hand.
Astro was added in 1.12.0 and never appeared in the table it belongs at the top
of, at 83 rules of 150.

The list is now read off the rules. Eleven languages arrive with it:

| | rules |
| --- | ---: |
| Astro (`.astro`) | 83 |
| JavaScript (JSX) (`.jsx`) | 31 |
| HTML (`.html`) | 21 |
| Plain text (`.txt`) | 18 |
| Sass (SCSS) (`.scss`) | 15 |
| C++ (`.cpp`) | 12 |
| Less (`.less`) | 9 |
| JSON (`.json`) | 5 |
| PHP (`.php`) | 5 |
| Dotenv (`.env`) | 4 |
| YAML (`.yaml`) | 3 |

A file type with no display name now stops the generator with a message naming
it, rather than being dropped — which is how eleven of them went missing.

`.c` was labelled "C and C++". The row counts the rules that apply to `.c` and
says nothing about `.cpp`, so they are two rows now.

CI checks that the generated docs in git match the rules, and `docs/languages.md`
was not in the list of files it checked. It is now.

# 1.12.4 - 2026-09-04

**Framework build caches are code nobody here wrote.** 1.11.0 stopped reading
`node_modules/` and the other places dependencies land. It missed the caches
that sit *inside* the source tree, so a pattern written for the source reaches
them: `.vitepress/cache/` holds rewritten copies of every dependency, and
`.astro/`, `.svelte-kit/`, `.nuxt/`, `.docusaurus/`, `.parcel-cache/`,
`.turbo/`, `.angular/` and `__pycache__/` are the same idea. One VitePress cache
in this fleet answered with hundreds of `var` errors from a bundled copy of
minisearch.

Found while measuring seven proposed rules against 84 repositories: the caches
kept showing up in the samples, which is how the hole surfaced. None of the
seven rules made it in — the measurement is in the pull request.

# 1.12.3 - 2026-09-04

**`VBC-035` is named icon-only and was matching icon-first.** A button carrying
an icon *and* a visible label already has an accessible name, and that is how
most toolbars are written:

```html
<button id="btn-download-zip">
  <svg width="18" height="18" ...></svg>
  Download Project ZIP
</button>
```

The regex was `<button ...>\s*<svg`, which is true of that button. It now
requires the svg to be the only thing between the tags, which is what both the
rule name and its message claim. A button holding only an icon is still an
error, and so is one whose label is an `sr-only` span — that one is now quiet,
correctly: the span is an accessible name.

Three reports in one repository, all wrong, all of them buttons with a label
printed next to the icon.

# 1.12.2 - 2026-09-04

Two rules stopped reporting the fix they ask for.

- **`import.meta.env.X` is replaced by the bundler before a request exists.**
  `VBC-944` reported ``href={`${import.meta.env.BASE_URL}favicon.svg`}``, which
  is how Vite and Astro spell every base path. The value is a literal by the time
  the page runs, so the interpolation cannot decide the scheme.
- **A copyright range whose end is computed cannot go stale.** `VBC-921` told a
  page to "generate the year at build time" and then reported
  `© 2025-{new Date().getFullYear()}`. A range ending in `{`, `${` or `<%` is
  now read the same way as one ending in `present`.

Both were found by pointing the check at Astro files that nothing had been
reading, in four repositories where the language went from 1 rule to 82.

# 1.12.1 - 2026-09-04

- **Appending a literal concatenates nothing.** `VBC-004` reported
  `q += " ORDER BY acquired DESC;"` as SQL built by concatenation. Nothing is
  concatenated there: the clause was decided by the code that wrote it. The rule
  now asks that a value actually arrive, which is the thing it is about.

Found while writing down why twelve other concatenated queries in one repository
are safe — the thirteenth turned out not to need an explanation, only a better
rule.

# 1.12.0 - 2026-09-04

**Astro goes from 1 rule to 82.** An `.astro` file is TypeScript frontmatter
between `---` fences and then HTML, so both halves were being read as neither.
The tokeniser now knows the language and the HTML and TypeScript rules reach it.

Extending them turned up two false positives that were never about Astro:

- **`var(--x)` is CSS asking for a custom property**, not a JavaScript
  declaration. `VBC-005` reported 23 of them inside one inline `<style>` block.
  `var (x)` is not valid JavaScript, so excluding `var(` costs nothing and fixes
  every file that carries a stylesheet inside it.
- **A literal prefix settles the scheme before the value arrives.**
  `href={`+"`mailto:${addr}`}"+` and `href={`+"`/blog/${slug}`}"+` cannot become
  `javascript:` whatever the value is, and that is how a template builds every
  ordinary link. `VBC-944` now fires only when the interpolation is what decides
  the scheme.

Two of three Astro repositories go to zero errors; the third keeps three, where
the interpolation genuinely is first.

Nine repositories measured before and after: unchanged.

# 1.11.0 - 2026-09-04

Two things the tool was doing that it should not, both found by pointing it at
five more repositories.

- **Code nobody here wrote is skipped by default.** A Django project reported
  **2,436 errors**, of which 2,419 were `var` inside `vendor/xregexp.js`,
  `vendor/select2`, `vendor/jquery` and Django's collected `staticfiles`. Real
  matches, in libraries nobody in that repository wrote. `--init` has written
  these paths into `.sloplessignore` all along; applying them without being asked
  is the difference between a tool that is right by default and one that is right
  once you have read the manual. The same project now reports 5, and the run says
  how many files it set aside.
- **A link is broken only when the server says it is not there.** `VBC-401` was
  non-deterministic: three identical runs over one repository gave 1, 4 and 4
  findings. A slow server, a rate limit and a bot block were all reported as
  broken links, and every one of those findings claimed something the check had
  not established. Now only 404 and 410 count, plus a DNS answer of "no such
  host", which is definite. Four identical runs now give the same number.

The second one also means some of the small before-and-after numbers in the
previous few entries carried a few findings of network noise. The direction was
right; the last digit was not always earned.

# 1.10.0 - 2026-09-03

**`VBC-001` was missing the commonest real case and finding only test fixtures.**
Both halves were measured before either was changed.

- **An underscore is a word character**, so `\bsecret\b` never matched
  `AWS_SECRET_ACCESS_KEY = "..."`. The rule now treats an underscore as a
  boundary, which is what every environment-style name is written with.
- **A value with a space is not a credential**, and one with no digit at all is
  indistinguishable from a placeholder. Across 7,179 files the rule fired six
  times and every one was a test fixture: an xkcd passphrase, a fake PAT, a test
  password. In one repository it found twenty, all of them `api_key="lm-studio"`
  and `api_key="llamacpp"` — the literal strings a local model server asks for.

After the change the same corpus reports five, and one of them is new: a
forty-character random token behind a `GOOD_TOKEN` name the old boundary could
not see.

The remaining reports are test fixtures whose values look like real credentials,
which is the right default. A rule about secrets cannot tell an invented key from
a live one, and the cost of being wrong in the other direction is a leaked key.

# 1.9.0 - 2026-09-02

Two rules that cannot be wrong, and a test that would have noticed a third.

- **`VBC-006-B` merge conflict markers.** A committed `<<<<<<< HEAD` means nobody
  finished the merge: the file holds both sides and compiles as neither. Read as
  text rather than through the scanner, because a conflicted file does not parse.
- **`VBC-017-B` focused tests.** A committed `describe.only` runs one test, skips
  every other one in the file, and reports green — which is worse than a failure,
  because nothing looks wrong.

Both were chosen by measurement rather than intuition. Across **7,179 files** from
every instrumented repository they produce **zero findings**, and a control file
per language proves they fire when they should.

Four other candidates were measured and rejected, all for the same reason: an
"obviously bad" marker fires hardest on the tools and documents that describe it.
A private key header appears 58 times — in documentation, in fixtures, and in the
patterns of a secret scanner. Disabled TLS verification appears six times — in a
`doctor` command that diagnoses TLS, in a scanner that has to inspect a broken
certificate, and in tests. `pdb.set_trace` appears five times, all of them in
`docs/testing.md` teaching people to use the debugger.

- **A rule file that does not parse is no longer silent.** `VBC-006-B` arrived
  with a regex containing `: `, which YAML reads as a mapping. The loader logged
  and moved on, the rule was absent, and every fixture test passed — because they
  iterate the rules that loaded. The suite now asserts one rule per file in
  `rules/`, and that each carries the id its filename promises.

# 1.8.0 - 2026-09-02

Four false positives, each found by pointing slopless at one more repository it
did not write, and each fixed in the rule rather than in the repository.

- **`VBC-034` wants a host, not a scheme.** `http://` with nothing after it is
  prose about the scheme: a security standard writing "a single http://
  subresource downgrades the page", an error message saying "must use http:// or
  https://", `startswith('http://')`, `session.mount('http://', adapter)`. Twelve
  of the corpus's nineteen reports were that, and every one of them was the
  scheme used as a prefix to compare against rather than an endpoint to reach.
- **`VBC-004` knows a placeholder from a value.** `q += " AND project = ?"` beside
  `args = append(args, f.Project)` injects nothing; it is how every Go and Python
  query builder assembles a dynamic WHERE clause safely.
- **`VBC-070` reads a run of literals as one literal.** A tip string split over
  three lines for readability is still a constant, and has no injection point. The
  rule also stops reading test files, where asserting on markup is the test.
- **`VBC-928` stops reading the corpus that tests for placeholders.** It found
<!-- slopless-disable-next-line VBC-928 -- quoting the finding, which is the point of the entry -->
  `Lorem ipsum dolor sit amet.` inside a Go test table for a gate that detects
  exactly that.

None of this changes the fleet: five repositories measured before and after,
identical.

# 1.7.1 - 2026-09-02

- **Two checks never needed a parser.** An empty file and a long file are counted,
  not parsed, and both sat behind the TypeScript-only gate saying nothing about
  any other language. They now run everywhere, including languages slopless has
  never heard of: nothing is read by no rule at all any more.
- **A file's length is its code, not its tests.** Rust keeps `#[cfg(test)] mod
  tests` in the file it tests, and counting those flagged a third of the Rust
  corpus. Measured across 927 files, the median Rust file is 300 lines and the
  75th percentile is 691, against 140 and 225 for Go: the convention, not sprawl.
- **Length is about code.** The rule now names the file types it means. Telling a
  README to split itself into smaller modules is nonsense, and it was doing that
  26 times in one repository.
- **An 830-line file is 830 lines.** A trailing newline ends the last line rather
  than starting another, and the count was one too many.

# 1.7.0 - 2026-09-01

**The part no native linter covers, in every language.** clippy finds an
unhandled `unwrap` better than a regex ever will, and it has the type information
to do it. Neither clippy nor staticcheck has an opinion about a TODO nobody owns,
a section that says "coming soon", or a comment that opens with "Let's dive
into". That is what this release carries across.

Eight rules now read comments in Go, Rust, Java, C, C++, C#, Kotlin, Swift and
Ruby: stale and unattributed TODOs, FIXMEs describing live defects,
passive-aggressive comments, decorative banners, AI fluff, placeholder text and
"coming soon". Prose in a source file lives in comments, so the rules that
declared no scope now say `scan: comments`, which 1.6.0's tokeniser made possible.

Coverage: Go 7 to 15, Rust 3 to 11, Java 4 to 12, Ruby 2 to 10, and Kotlin, Swift
and C from nothing to 8.

On 927 real files and 350k lines of Python, Go and Rust the corpus is
**unchanged**: not one new finding, so none of this is noise. Checked in the
other direction with a control file per language, because a rule that finds
nothing has not been shown to work.

- **`VBC-907` is tighter, in every language.** The marker has to open the comment.
  Matching it mid-sentence read `// a TODO. Sites that DO build a header` as an
  unattributed TODO.
- **Per-language variants.** One concept, one id, one documentation page, spelled
  the way each language spells it. A rule writing `console.log`, `print(`,
  `println!` and `fmt.Println` as one alternation would be unreadable.
- **The Rust test attribute, as it is actually written.** The detector matched
  `#[cfg(test)]` literally; real code writes `#[cfg(all(test, unix))]` just as
  often and marks single functions with `#[test]`. 96 `.unwrap()` calls in test
  setup were being read as production code, one of them in a helper writing
  `<h1>home</h1>` into a temporary directory.

Two bugs this work surfaced:

- A pattern anchored to the line start begins on the indentation, which sits
  outside the comment it is about, so the whole match was read as code. The scope
  is now taken from the first character that is not whitespace.
- A match spanning a run of comment lines covers several ranges with newlines
  between them, and 1.6.0's containment check rejected it. Whitespace may now
  fall outside.

# 1.6.0 - 2026-09-01

The three things porting rules to other languages was waiting on. Each was found
the same way: by extending twenty rules to Go and Rust, measuring the result on
927 real files, and throwing the branch away because eight groups out of eight
were dominated by false positives.

- **Test code, not just test files.** Rust keeps its tests in `#[cfg(test)] mod
  tests`, inside the file they test, and `exclude_files` cannot see them because
  there is no separate file to exclude. Seven rules that already excluded test
  paths now exclude test regions too. Rust findings on the corpus drop from 46 to
  5; all 41 sit inside a test module, and nothing new appeared.
- **A project can claim its own vocabulary.** `blacklist` appears 617 times in one
  firewall, where it names the data structure and half the JSON contract;
  `master` appears 486 times in an audio project, where it is the output bus.
  `"vocabulary": ["blacklist"]` in the config excuses the word everywhere, whole
  words only, and the run reports how many findings it excused and which words
  did it.
- **Documentation is not commentary.** Go requires a comment on every exported
  symbol and on the package, Rust writes them with `///`, and everything above
  the first line of code is a header whatever the language. `VBC-042` went from
  81 findings to 2 in one project, and the two that remain are ten-line blocks in
  the middle of code, which is what the rule is for.

Two bugs fell out of measuring rather than testing:

- **A regular expression literal is not code.** The scanner reads a slash as
  division unless asked to reconsider, so regex bodies reached the rules as
  source: `/(?:package|func|var)/` reported a `var` this project does not
  contain. They now have their own `scan: regex` scope, so a rule about values
  does not read them and `VBC-096` reads nothing else.
- **A match that leaves the literal it started in is not inside it.** A pattern
  that began at a regex and ended in the template beside it was reported as a
  complex regular expression.

Known limit, stated rather than hidden: a slash after a closing paren is read as
division, so `if (x) /re/.test(s)` has its body scanned as code. Telling that
from `(a + b) / 2` needs to know whether the paren closed a condition. The other
guess swallows real code up to the next slash, which is how a division hid the
rest of a file during this work.

# 1.5.0 - 2026-09-01

**Comments and strings exist in other languages too.** Scope detection was written
on the TypeScript scanner, so on `.py`, `.go`, `.rs` and the rest the `scan:` field
was ignored entirely and every rule read comments and string literals as if they
were code. That is why a security repository's attack corpus came back as a list
of hazards, and why a docstring explaining an SSRF defence was reported as an
insecure URL.

- **A declarative tokeniser** now covers Python, Go, Rust, shell, Java, C/C++, C#,
  Kotlin, Swift and Ruby. It is a table of comment markers and string forms rather
  than a parser per language, because "is this offset inside a comment" is the only
  question `scan:` asks. It handles the parts that bite: Rust block comments nest,
  `&'a str` is a lifetime and not a char literal, `r#"..."#` carries its own
  delimiter, Go's backtick strings span lines, `${#items}` in shell is a length and
  not a comment, and an unterminated string ends at the newline instead of
  swallowing the file.
- **A Python docstring is documentation, not a string value.** A triple-quoted
  string alone on its line is classified as a comment, so a rule about strings no
  longer fires on prose.

Measured over 927 real files and 350k lines of Python, Go and Rust: **37 findings
removed, 0 added**. Every one was documentation — RFC references, CGNAT ranges,
a SQL injection payload in a benchmark, a log-sanitiser test asserting redaction.

**Four rules ported**, each reworked rather than merely widened:

- `VBC-039` eval now guards its left edge, so `model.eval()` is not a security
  finding. Reaches Python, Ruby and PHP.
- `VBC-049` magic boolean learns `True`/`False`, and stops reporting
  `flag.store(false, Ordering::Relaxed)`, which is the atomic API taking a value,
  and `typer.Option(False, "--dry-run")`, which is a default followed by the name
  that documents it.
- `VBC-928` lorem ipsum and `VBC-917` shouting reach the languages that have
  comments to shout in.

Coverage, counting the rules enabled by default: Python 23 to 27, Go 4 to 7,
Rust 1 to 3, Java 3 to 4, Ruby 1 to 2.

**What was not ported, and why.** The rules about colours, font sizes, inline
styles and missing `alt` do fire on the HTML that Python files generate — but that
HTML lives in string literals, and reaching it means telling those rules to read
strings, which is exactly where a WAF keeps its XSS payloads. Widening them would
reproduce the false positives this release removes.

- **A rule file with a repeated key is now refused.** Two `quiet:` blocks meant the
  second won and the first was dropped: half a rule's examples gone, every test
  still green. Found by writing that exact mistake.
- **The schema no longer accepts a check nobody implements.** `circular-dependency`
  sat in the `heuristic_check` enum with no branch behind it, so a rule naming it
  would load, validate and check nothing. A test now holds every enum value to an
  implementation.

# 1.4.6 - 2026-09-01

- **A run now says what it checked.** Pointed at a Rust file holding a hardcoded
  password, an `http://` URL, a TODO and an empty error branch, slopless reported
  "No static analysis issues detected. Clean architecture!" — having evaluated
  zero rules. Nothing applies to `.rs`, and silence was indistinguishable from a
  pass. Every run now prints what was read and by how many rules, names any
  language no rule covers, and refuses the word "clean" when nothing could be
  checked at all. For `--format json` and `sarif` the line goes to stderr, so the
  report on stdout stays parseable.
- **One gate, shared.** Which languages the parsing tiers can read was a hardcoded
  list inside two checkers; the coverage count now comes from the same place they
  do, so a rule cannot be counted as covering a file it will be skipped for.

Measured across 148 rules: TypeScript 90, JavaScript 89, Markdown 24, Python 23,
CSS 19, shell 11, Go 4, Java 3, Ruby 1, PHP 1, **Rust 0, Kotlin 0, Swift 0**.

# 1.4.5 - 2026-09-01

- **A single line can now be excused, by name.** `// slopless-disable-next-line
  VBC-001 -- a fake PAT; this test asserts it is redacted`, or
  `slopless-disable-line` at the end of the line itself. Until now the only way to
  accept one justified exception was to switch the rule off for the whole
  repository, which pays with every other file's coverage. The directive is read
  from the raw line rather than a parsed comment, so `//`, `#`, `/* */` and
  `<!-- -->` all work, and it is applied after every tier: a finding from the AST
  and a finding from a regex are the same annoyance on the same line. Text after
  ` -- ` is for the next reader, and rule ids named there do not count.
- **VBC-913 only speaks where focus can land.** An outline appears on focus and
  nowhere else, so `.card { outline: none }` on a div nobody can tab to removes
  nothing. The rule now requires a selector that is focus-related or natively
  focusable, which is what `require_selectors` is for: the mirror of
  `exclude_selectors`, available to any CSS rule.
- **VBC-034 knows a parse base from an endpoint.** `new URL(req.url, `+"`http://${host}`"+`)`
  is the standard way to parse a request URL in Node; nothing is ever fetched over
  that base.

# 1.4.4 - 2026-09-01

Five false positives, all found by running slopless over repositories it did not
write. Each has the same shape: the code was correct, and the rule could not see
why.

- **VBC-070 (innerHTML)** no longer fires on a string literal with no
  interpolation. `el.innerHTML = '<i class="fa-check"></i>'` has no injection
  point, and calling it an XSS risk teaches people to ignore the rule.
- **VBC-034 (http://)** treats link-local as an address, not an endpoint.
  `http://169.254.169.254` turns up in code that *refuses* to fetch it, and there
  is no https:// cloud metadata service to switch to.
- **VBC-010 (clickable div)** ignores `onClick={e => e.stopPropagation()}`. That
  is a click being stopped, not a control being offered: there is nothing there
  for a keyboard user to reach.
- **VBC-077 (deceptive name)** understands memoization. A getter that fills a
  cache it also tests is idempotent, which is what the guard is for. `fetch` also
  left the list of prefixes that promise not to mutate, because `fetchFromRemote`
  promises the opposite.
- **`--only` with an unknown category is now an error.** It used to select zero
  rules and print "No static analysis issues detected", so a typo produced a
  confident green run that had checked nothing. Exit code 2, and it names the
  categories that do exist.

# 1.4.3 - 2026-09-01

- **The release workflow creates the GitHub release too.** A tag, an npm version
  and a GitHub release are three records of the same event, and the third was
  being made by hand. It drifted immediately: 1.4.2 reached npm while the
  Marketplace still read 1.4.1, because the Marketplace takes its version from
  the last release anyone remembered to create.

  Notes come from `CHANGELOG.md` through `scripts/changelog-notes.js`, which is
  tested rather than trusted, and falls back to a plain line instead of failing a
  release when an entry is missing.

# 1.4.2 - 2026-09-01

- **`package.json` declares its repository.** The first release published from CI
  was rejected: provenance attests which repository built the tarball, npm checks
  that the package agrees, and there was nothing to compare against. The
  attestation had already been signed and written to the Sigstore transparency
  log by then, so the failure is visible there and not in the registry.
- Published to npm as
  [`@fabriziosalmi/slopless`](https://www.npmjs.com/package/@fabriziosalmi/slopless).
  Zero dependencies, verified by installing from the registry into a clean
  container.
- The package now refuses tokens: publishing requires the OIDC trusted publisher,
  so no credential capable of releasing it exists anywhere. `1.4.2` is the first
  version published from CI, and the first carrying a provenance attestation.

# 1.4.1 - 2026-09-01

- **The Marketplace About line no longer carries a rule count.** It said "146
  rules" while every current ref of `action.yml` said 148, because the listing
  stores that text when it is published and does not re-read it. The version
  shown was already current; only the one line was frozen, and the README on the
  same page said 148 beside it.

  Rather than republish to correct the number, the number is gone. It was the one
  copy that no generator could reach, and this is the fourth time today a hardcoded
  count went stale.

- The repository description was empty and now matches.

# 1.4.0 - 2026-09-01

Measured against ten Rust, Go and Python repositories, the ones with the most
stars in the fleet. 7590 findings became 2418, and errors 83 became 38.

## Added

- **Ten rules ship disabled and wait to be asked for.** They encode a preference
  about how you write English prose rather than a defect in the code, and across
  twenty repositories they were **two thirds of everything slopless said**:
  66% on Rust, Go and Python, where there are few code rules to balance them.
  `VBC-948`, the em dash rule added this morning, was 4464 findings on its own.

  Naming a rule in `slopless.config.json` turns it on, using the mechanism that
  already existed. Rules that mark content as unfinished or generated stay on:
  lorem ipsum, "coming soon", the phrasings of machine-written prose. Those are
  what this tool is for. A preference nobody agreed to is not.

## Fixed

- **A security tool's attack corpus was read as the tool being vulnerable.**
  `zion` and `caddy-waf` keep SQL injection strings, XSS payloads, reverse shells
  and the AWS metadata address as data, because that is what a WAF is made of.
  The exclusion list now covers the conventions the other languages use, which it
  did not: Go's `*_test.go`, a bare `test.py`, `benchmark*`, `testdata/`, and
  anything named for a corpus or a payload.
- **`VBC-001` reported fixtures that spell out what they are.**
  `secret="REAL-HMAC-SECRET"`, `PASSWORD="SuperSecretPassw0rd!"` and
  `api_key="your-api-key-here"` are describing a field, not holding a key. A
  value containing the credential vocabulary, or `example`, `changeme`, `dummy`
  and their kind, is no longer reported. AWS's documented `AKIAIOSFODNN7EXAMPLE`
  is one of these, and had been in this project's own test fixtures.

# 1.3.0 - 2026-09-01

Eleven repositories are now running slopless in CI, which is enough production
data to see what it actually reports.

**4754 findings. Nine of them were security.**

| | | |
| --- | --- | --- |
| warnings | 4653 | 97.9% |
| errors | 101 | 2.1% |
| clean-code | 2671 | 56.2% |
| docs | 979 | 20.6% |
| security | **9** | **0.2%** |

The five loudest rules produce 55% of everything, and all five are style. Someone
installing this to find hardcoded credentials gets a ratio of one to five hundred.

## Added

- **`--only <categories>`** and **`--min-severity error`**. Both narrow the rule
  set before anything runs, so they cost nothing rather than filtering output
  after the fact. On one repository: 993 findings, 51 with `--only security,core`,
  4 with `--min-severity error`.

  These do not replace switching individual rules off. They are for asking a
  different question of the same codebase, so a pre-commit hook can block on
  hazards while a weekly run reads everything.

- `--version` reports the real version. It had been hardcoded to 1.0.0 since that
  release.

# 1.2.2 - 2026-09-01

- **`VBC-028` and `VBC-065` are warnings.** Seven rules in the set are built on a
  numeric threshold, and five of them were already warnings: file length, staged
  file count, filename length, file size, commit message length. Two were errors,
  and there is no principle that makes "more than five parameters" fail a build
  while "more than five hundred lines" does not. Both numbers are a preference.

  The line drawn, and now written down in the docs: **an error is a hazard, a
  warning is a judgement, and every numeric threshold is a judgement.** A rule
  that fails someone's build over a number they did not choose gets switched off,
  and takes the hazards in the same run with it.

  Measured on eight repositories: errors fell from 18 to 3, 18 to 5, 76 to 43.
  Nothing was silenced; the findings are all still reported.

# 1.2.1 - 2026-09-01

- **Generated files are skipped, by shape rather than by name.** A repository
  vendoring Bootstrap produced 362 findings, 263 of them inside
  `bootstrap.bundle.min.js` and `bootstrap.min.css`. Every rule fires on minified
  output and none of it is actionable, and a filename rule does not help: a
  bundle called `bundle.js` reads the same as one called `bundle.min.js`.

  Measured across real files, hand-written source runs 25 to 50 bytes per line
  and minified output runs into the thousands, so the two do not overlap. A file
  averaging more than 500 bytes per line, or holding a single line over 2000, is
  treated as machine output. The count is reported rather than hidden, because a
  linter that quietly skips files is the failure mode this whole project is about.

- `vendor/` joins the default `.sloplessignore`.

# 1.2.0 - 2026-09-01

An audio workstation, where the vocabulary of the domain collides head-on with
rules written for web applications. Errors fell from 29 to 13 and total findings
from 1881 to 1300.

- **`VBC-338` reported "master" 486 times**, every one of them a master bus,
  master EQ or master section. That is audio engineering, from master recording,
  and not what inclusive-language guidance is about. The rule now looks for the
  contexts that guidance actually names: master/slave pairs, `master branch` and
  the like, allowlist and blocklist wording, and "sanity check".
- **`VBC-940` and `VBC-007` read an effect's wet/dry `amount` as money**, because
  `amount`, `balance`, `total` and `rate` were on the currency word list and mean
  something in every domain. Only unambiguous words remain: price, cost, fee,
  tax, subtotal, payment, invoice, salary, refund, charge.
- **`VBC-921` flagged 135 correct copyright notices** carrying the current year.
  Rewriting it in 1.1.2 to avoid a hardcoded year range traded an annual staleness
  for firing on every current notice. A rule about time needs to know the time, so
  it is a heuristic check now and compares against the year the run happens in. A
  notice ending in the current year, in a range, or in "present" is correct.

## Fixed

- **`exclude_files` only worked in the regex tier.** A rule could declare an
  exclusion and still fire from the AST, semantic, heuristic or type checker,
  which is what happened the moment `VBC-921` moved tiers. It is a shared check
  now and every checker honours it.

# 1.1.9 - 2026-09-01

The first Python repository, and it answered a question about the whole rollout
rather than about itself.

- **`VBC-103` reported 68 well-written comment headers and no ASCII art.** Every
  hit was a `# ---` rule wrapping an explanatory paragraph, which is a Python
  documentation convention, and the opposite of the decoration the rule was
  written for. It now looks for three or more consecutive comment lines made of
  shape with no words between them: a banner is furniture, a rule around a
  heading is punctuation.
- **`VBC-015` counted test data as magic numbers.** A parametrised table of
  scores is data, not a constant waiting to be named. It skips test paths now,
  matching what `VBC-003`, `VBC-019`, `VBC-034` and `VBC-901` already did.

# 1.1.8 - 2026-09-01

A regression I shipped in 1.1.6, and the reason my own harness missed it.

- **The Action stopped writing its report whenever errors were found.** Composite
  steps run under `bash -e`. Building the report in a temp file meant the failing
  `node` call now killed the script before the file could be moved into place, so
  the output never appeared and any upload gated on it was skipped. Exit 1 means
  errors were found, which is precisely the case people install this for, so the
  report went missing exactly when it mattered. Errexit is now disabled
  explicitly, since the script captures the exit code and re-raises it itself.
- **`run-action-locally.sh` was not running the step the way a runner does.** It
  invoked plain `bash` rather than `bash --noprofile --norc -e -o pipefail`, so
  the harness built to prove the Action works in production diverged from
  production in the one flag that mattered. It uses the runner's flags now, and
  reproduces the regression above when the fix is reverted.

# 1.1.7 - 2026-09-01

A repository with a Python backend and a TypeScript frontend, where 35% of the
errors came from its own test suite.

- **Tests contain the patterns security rules look for, on purpose.**
  `_is_blocked("chmod 777 /usr/bin/python")` is a test asserting that the app
  blocks that command; a path sanitiser's fixtures contain absolute paths; an
  httpx ASGI client uses `base_url="http://test"`, which reaches no network at
  all. `VBC-003`, `VBC-019`, `VBC-034` and `VBC-901` now skip test paths, which
  is where a rule about hazardous literals stops being able to tell a hazard from
  a fixture. `VBC-001` deliberately still runs there: a real credential committed
  in a test is still committed.
- **`VBC-901` reported loopback.** On a local LLM app, `http://127.0.0.1:8000` is
  the correct address, not a pinned environment. Loopback and `0.0.0.0` name this
  machine rather than a host, and are no longer reported. Private and public
  addresses still are.
- **`VBC-051` reported wire-format field names**, 55 times. A TypeScript frontend
  calling a Python API writes `max_tokens: Math.min(maxTokens, 1024)`, and the
  snake_case half is dictated by the protocol. An object key is no longer treated
  as a naming choice; a variable still is.

# 1.1.6 - 2026-09-01

- **The Action could publish a truncated report.** Redirecting straight at the
  output file created it before the run started, so a crash left a partial file
  that looked finished to anything consuming it, and `hashFiles` still saw
  content. The report is now built aside, parsed when the format is JSON or
  SARIF, and only moved into place when it is complete. A failed run leaves no
  file at all, so a downstream step skips instead of uploading a broken one.

  Note that gating on the step outcome would not have worked here: slopless exits
  1 when it finds errors, which is a successful analysis with a valid report, so
  outcome-based gating would skip the upload in exactly the case that matters.

# 1.1.5 - 2026-09-01

Two rules that produced nothing but noise on a desktop app, at a rate that made
the cause obvious: every single finding was wrong.

- **`VBC-504` flagged `res` 72 times out of 73.** `req` and `res` were on the
  shadowed-module list for Express, but they are the ordinary words for a request
  and a result everywhere else, and the check cannot tell which codebase it is
  reading. The list is module names only now.
- **`VBC-201` flagged 67 test mocks and no real declarations.** `vi.fn(async
  (name) => undefined)` has to be async to stand in for an async function and has
  nothing to await: its signature belongs to the callee. A function passed
  straight to a call is no longer reported, so the rule only covers declarations
  the author actually chose to mark async.

# 1.1.4 - 2026-09-01

A monorepo with 169 source files produced 1794 findings and, more usefully, four
defects that only a project of that size could expose.

- **JSON and SARIF were truncated at 64KB.** `process.exit()` ran before Node
  drained stdout, so any report large enough to fill the pipe buffer was cut off
  mid-string and would not parse. Every project small enough to stay under the
  limit looked fine, which is why this survived until a repository produced 169KB
  of output. The exit code is set instead of forced, and `verify:bundle` now
  generates a report past the buffer and parses it back.
- **`VBC-077` treated a local array as a mutation.** `getAll() { const out = [];
  ... out.push(x); return out; }` is how a getter assembles its return value.
  Only mutations of `this` count now.
- **`VBC-913` fired on the fix it recommends.** `*:focus { outline: none }`
  followed by `*:focus-visible { outline: 3px solid }` is the correct modern
  pattern, and the rule reported it while its own message suggested it. It now
  looks for a replacement ring before reporting.
- The default `.sloplessignore` covers `coverage/`, `out/`, `.next/` and
  `*.min.js`. Generated output is not source, and an Istanbul report alone
  accounted for 170 findings.

# 1.1.3 - 2026-09-01

Three false positives, all found by pointing the tool at a TypeScript repository
it had never seen. Errors on that repository went from 8 to 2, and the two that
remain are real.

- **`VBC-007` matched any word containing a money word.** Widening it in 1.1.2 to
  catch `unitPrice` also caught `feedback`, `coffee`, `costume` and `taxonomy`, at
  error severity. A money word now has to be a whole identifier word or a
  camelCase component, and the rule is case-sensitive because the capital is what
  marks the boundary.
- **`VBC-005` flagged `declare var`.** In an ambient `.d.ts` that is how a global
  is declared and there is no alternative spelling, so `declare var sampleRate:
  number` was an error with nothing to fix.
- **`VBC-013` treated a commented catch as empty.** `catch (e) { /* already
  started */ }` is a decision rather than an oversight, which is how `no-empty`
  has always read a comment. A genuinely empty `catch (e) {}` still reports.

The type checker tier ran against a real project for the first time and found a
floating promise: an `async` method called with neither `await` nor `.catch()`,
where a rejection would go unhandled.

# 1.1.2 - 2026-08-31

- **Absolute paths crashed the CLI.** `slopless /abs/path/file.ts` exited 1 with a
  `RangeError` from the ignore matcher before reading a single file, because that
  library only accepts paths relative to the working directory. Paths are now
  relativised before matching, and a path outside the project is kept rather than
  rejected, since no ignore rule could apply to it anyway.
- While fixing the above I broke `.sloplessignore` and the tests caught it:
  `ignore` splits a bare multi-line string into patterns, but treats an array
  entry as one literal pattern, so passing the file's contents inside an array
  silently matched nothing. Six regression tests now cover both.
- **New rule VBC-948 `em-dash-prose`.** Em dashes cluster in generated text, so
  they are the first seam a reader looks for. A warning, in the docs category,
  for Markdown and plain text.
- Em dashes removed from the documentation, the rule messages and the changelog:
  157 of them, each replaced with the punctuation its sentence actually wanted
  rather than a blanket substitution. The one that remains is inside VBC-921's
  pattern, where it matches copyright ranges.
- The site's changelog is now generated by `docs:gen` from this file, so it
  cannot drift.
- **The Action was analysing fewer files than it was given.** `patterns` was
  interpolated into the command line, so bash expanded it first, and with globstar
  off, which is the default, `src/**/*.ts` becomes `src/*/*.ts` and everything at
  the top level disappears. This repository's own dogfood job ran that way: 8 files
  and 14 findings instead of 9 and 33, silently skipping `src/index.ts`. The step
  now disables pathname expansion and lets the CLI glob, which is what the pattern
  was written for.
- Action inputs reach the step through the environment instead of being
  interpolated into the command text, so a value cannot become shell source.
- New `output` input on the Action writes the report to a file. SARIF was
  supported but only ever reached stdout, which made it impossible to upload to
  code scanning.
- `scripts/run-action-locally.sh` runs the composite step in a container the way a
  runner does, reading the script out of `action.yml` so it cannot drift. The glob
  bug was invisible in the file and obvious the moment it ran.
- `VBC-102` reported the line where the block opened rather than the line holding
  several statements, sending the reader to the condition above.
- `VBC-215` is a warning, not an error. On the first repository it was pointed at,
  the only thing that would have failed CI was a debug global behind a localhost
  check, while its peers at error severity are hardcoded secrets, eval and XSS.

# 1.1.1 - 2026-08-31

Supply chain hardening. No rule or engine behaviour changed.

- **The package now installs nothing.** `commander`, `glob`, `ignore` and `minimatch`
  were declared as runtime dependencies while the bundle already inlined all four, so
  every install pulled code it would never execute: install surface with no benefit.
  They moved to `devDependencies` and tsup bundles everything (`noExternal: [/.*/]`).
  `npm install @fabriziosalmi/slopless` now resolves to exactly one package.
- **Releases publish over OIDC with signed provenance.** `release.yml` publishes on a
  `v*` tag using npm trusted publishing, so no npm token needs to exist at all, and
  every tarball carries an attestation binding it to the commit and workflow run
  (`npm audit signatures`). The job re-runs the tests, the build, the bundle check and
  a tag-matches-version check before publishing, behind an `npm` environment that can
  require a reviewer.
- **Every third-party action is pinned to a commit SHA** rather than a moving tag,
  which is the vector that compromised `tj-actions/changed-files`. Dependabot keeps the
  pins and the dev dependencies current so they do not rot.
- `verify:bundle` now also asserts that no runtime dependency has reappeared and that
  `dist/engine/api.js`, the entry point the VS Code extension imports, loads
  standalone too.
- The README documents how to pin `fabriziosalmi/slopless` to a SHA instead of the
  moving `@v1` tag, since asking users to trust a mutable ref deserved saying out loud.
- Corrected two claims that were not true: the site advertised "zero network" and
  "0 network calls" while `VBC-401` fetches every link it finds in Markdown. Replaced
  with zero telemetry, which is verifiable.

# 1.1.0 - 2026-08-31

The regex tier was silently disabled on most modern TypeScript. This release fixes
the scanner bug behind it, then reworks the rules the bug had been masking.

## Fixed: engine

- **A single template literal disabled every regex rule for the rest of the file.**
  `extractProtectedRanges` never called `reScanTemplateToken`, so the scanner read the
  closing backtick of `` `hi ${name}` `` as the start of a new, unterminated literal
  and marked everything after it as "inside a string". On this repository's own source
  that meant slopless reported **0 findings**; it now reports 33. Across 400 real-world
  library files it was swallowing ~10% of all findings, and far more on template-heavy code.
- `VBC-800 floating-promise` walked the *parent* chain looking for `.catch()`, which
  lives on the *callee* chain. `save().catch(() => {})` was reported as unhandled.
- The same rule could report the same line twice when its regex had several matching
  alternatives; findings are now deduplicated per rule and line.
- `match.exclude` was parsed and never used, so `VBC-208`, `VBC-913` and `VBC-914`
  silently ignored their own exclusion lists. Replaced by `exclude_files` (path globs)
  and `exclude_selectors` (the enclosing CSS selector), both implemented.
- AST checks: `else if` chains counted as nesting depth (`VBC-065` called a flat
  five-branch chain five levels deep), arrow functions were invisible to the depth and
  async checks, `VBC-909` flagged the standard `interface A extends B {}` idiom, and
  `VBC-077` treated the substring `set` inside `offset`, `dataset` and `asset` as a mutation.

## Added

- **`match.scan`**: every rule declares the lexical scope its matches must live in:
  `code` (default), `strings`, `comments` or `all`. This is what stops `VBC-005 use-var`
  from firing inside a commented-out line, and what lets `VBC-901 hardcoded-ip-v4` see
  the IPs in string literals it used to skip entirely.
- **`match.multiline`**: evaluates a regex against the whole file. Twelve rules were
  written with patterns that could only match across lines while the engine fed them
  one line at a time, so they could never fire: `VBC-035` (icon-only button),
  `VBC-101` (img without alt), `VBC-054`, `VBC-104`, `VBC-042`, `VBC-123`, `VBC-131`,
  `VBC-161`, `VBC-172`, `VBC-946` and others.
- **`supersedes`**: a specific rule silences the general ones on the same line.
  `// TODO: implement this` used to raise four findings; it now raises one.
- **`tests`**: every rule carries at least one snippet it must flag and one it must
  leave alone, executed by `rule-fixtures.test.ts`. The suite fails if a rule ships
  without them. Rules driven by git, the network or the type graph declare
  `tests.external` naming the test file that covers them, and that pointer is verified.
- `async-without-await` AST check, replacing `VBC-201`'s unfixable regex (which
  contained a `(?!!await)` typo and could only ever match a one-line function).
- Test suite grew from 67 to 560 tests across 8 files; all 147 rules are now covered.

## Changed: rules

- `VBC-004 sql-injection-concatenation` missed `query("SELECT ... " + id)`, the
  canonical injection, because it required the quote *after* the `+`, while firing on
  `'Update ' + count + ' items'` at error severity. Rewritten around SQL statement shape.
- `VBC-096` used `[^/\\n]`, a class excluding the letter **n**, so any regex literal
  containing an `n` was skipped. Now flags long regex literals regardless of content.
- `VBC-015 magic-numbers` flagged `const ONE_SECOND_MS = 1000`, the named constant it
  asks you to write. `VBC-904 magic-string` flagged `throw new Error('...')` and
  `console.log('...')`. `VBC-347 passive-voice` flagged "is advanced" and "was tired".
  `VBC-936` matched "alpha" inside "alphabetical". `VBC-113` matched `maximum-scale=10`
  as if it were `=1`. `VBC-215` flagged `window.location =` and every `window.x ===`
  comparison. `VBC-086` fired when `rel="noopener"` preceded `target="_blank"`.
  All narrowed.
- `VBC-921` no longer hardcodes 2020–2023 as "outdated"; it flags a copyright pinned to
  a single year, which never goes stale.
- Overlapping rules separated so exactly one fires: `VBC-150`/`VBC-907` (tracked vs
  unattributed debt markers), `VBC-398`/`VBC-917` (punctuation vs shouting),
  `VBC-007`/`VBC-940` (money as a float literal vs float arithmetic on money),
  `VBC-070`/`VBC-941` (innerHTML vs the sinks innerHTML cannot see).
- `VBC-800` moved from `rules/type_checks.yaml` to `rules/VBC-800.yaml` and renamed
  from `Floating Promise` to `floating-promise`, matching every other rule.
- Categories consolidated to six: `core`, `security`, `clean-code`, `ux-dx`, `docs`, `git`.

## Packaging

- **Published as `@fabriziosalmi/slopless`.** The unscoped `slopless` on npm belongs to
  an unrelated prose linter by another author, so every `npm install -g slopless` and
  `npx slopless` in the README, USO.md and the docs was pointing readers at someone
  else's package. All install and usage commands updated. The installed binary is still
  called `slopless`, and the GitHub Action (`uses: fabriziosalmi/slopless@v1`) is unchanged.

## Docs

- Rule pages now show the scope, file types, exclusions, precedence and the executable
  examples, so the documentation cannot drift from the tested behaviour.
- The landing page terminal was showing invented output that cited `VBC-028`
  (function-params-limit) as a floating promise. Replaced with a real run, and the
  stat line corrected (67 tests -> 560, "0 issues on itself" -> "0 errors on itself").

# 1.0.1 - 2026-08-31

- GitHub Action (`uses: fabriziosalmi/slopless@v1`): composite, runs the bundled `dist/index.js` with no npm install; `patterns`, `config`, `format` (SARIF included), `type-check`, `args` inputs.
- `dist/index.js` now bundles the runtime deps (tsup `noExternal`) and is committed for the Action; the rest of `dist/` stays untracked, and CI fails if the committed bundle drifts from the source.
- slopless is clean on itself (the one VBC-084 long line wrapped); CI dogfoods the Action on every push.
- Dependencies: `npm audit fix` + vitepress/vitest/tsup bumped: 0 production vulnerabilities; 3 dev-only esbuild dev-server advisories remain upstream (no fix available; no dev server runs in CI). VS Code extension package: 0.
- Docs on GitHub Pages via Actions (VitePress, base /slopless/).

# Changelog

This file documents all notable changes to this project.

This file follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) format.

---

## [Unreleased]

### Added
- 26 new rules covering currency float math, jQuery reliance, committed IDE settings,
  fake test assertions, glassmorphism overuse, missing project health files, and more
- `--format score` output mode with a 0–100 Slop Score and letter grade
- `git_check` handlers for `missing_contributing`, `missing_security`, `missing_changelog`,
  `committed_ide_settings`, and `missing_readme`
- Real test suite using Vitest with fixture-based regression tests
- CONTRIBUTING.md, SECURITY.md, LICENSE, and CHANGELOG.md (this file)

### Fixed
- Removed dead `import()` Promise in `regex-checker.ts` that was never awaited
- Narrowed VBC-090 regex to remove false positives on "magic", "hack", minimizers, and filler words
- Implemented `commit_message_too_short` handler (VBC-926 was previously a no-op)
- Updated rule count in README from 111+ to 136+
- Removed "guarantee zero false positives" claim from README; replaced with accurate description
- Updated USO.md command examples from `npx ts-node src/index.ts` to `npx slopless`

---

## [1.0.0] - 2025-01-01

### Added
- Initial release with 110 rules across security, clean-code, UX/DX, and documentation categories
- Multi-tiered analysis engine: regex, AST, semantic, heuristic, and TypeScript type checks
- Protected regex engine (AST-aware string/comment range exclusion for JS/TS files)
- `--fix` auto-correction for select rules (e.g., `var` → `let`)
- `--format json` and `--format sarif` output modes
- `--type-check` flag for floating Promise detection via `ts.createProgram`
- `--init` command generating `slopless.config.json` and `.sloplessignore`
- Concurrency pooling to prevent OOM on large monorepos
- SHA-256 file hash caching (`.sloplesscache`)
- LSP server for VS Code / Cursor IDE integration
