# Rules

All 150 rules. **41** are errors and fail the run; the remaining 109 are warnings and only report.

Every rule ships a snippet it must flag and one it must ignore, executed on every commit. Open any rule to see both.

Use the search box above to find a rule by what it catches.

## Clean-code

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-077](./VBC-077.md)<br>`deceptive-function-name` | Lying function name detected: implies a non-mutating action but contains side-effect… | **error** | AST |
| [VBC-079](./VBC-079.md)<br>`debugger-statements` | debugger; statement found | **error** | Regex |
| [VBC-080](./VBC-080.md)<br>`browser-alert` | Avoid using alert() | **error** | Regex |
| [VBC-008](./VBC-008.md)<br>`sleep-race-condition` | Using setTimeout as a sleep to paper over a race condition | warning | Regex |
| [VBC-009](./VBC-009.md)<br>`jquery-modern-project` | jQuery dependency detected | warning | Regex |
| [VBC-012](./VBC-012.md)<br>`redundant-promise-constructor` | Redundant Promise constructor wrapping | warning | Regex |
| [VBC-015](./VBC-015.md)<br>`magic-numbers` | Magic number detected | warning | Regex |
| [VBC-016](./VBC-016.md)<br>`commented-out-code` | Potential commented-out code detected | warning | Regex |
| [VBC-018](./VBC-018.md)<br>`console-logs-detected` | Production code with console usage found | warning | Regex |
| [VBC-026](./VBC-026.md)<br>`empty-file` | Empty code file detected | warning | AST |
| [VBC-042](./VBC-042.md)<br>`too-many-comments` | Too many consecutive comment lines | warning | Regex |
| [VBC-048](./VBC-048.md)<br>`meaningless-variable-names` | Meaningless variable name detected | warning | Regex |
| [VBC-049](./VBC-049.md)<br>`magic-boolean` | Magic boolean passed as first argument | warning | Regex |
| [VBC-051](./VBC-051.md)<br>`mixed-casing` | snake_case and camelCase mixed | warning | Regex |
| [VBC-052](./VBC-052.md)<br>`single-letter-variables` | Single-letter variable name detected | warning | Regex |
| [VBC-053](./VBC-053.md)<br>`redundant-interpolation` | Redundant string interpolation detected | warning | Regex |
| [VBC-054](./VBC-054.md)<br>`unnecessary-else` | Unnecessary 'else' after 'return' | warning | Regex |
| [VBC-056](./VBC-056.md)<br>`stale-todo` | Debt marker that admits it is temporary | warning | Regex |
| [VBC-058](./VBC-058.md)<br>`overly-long-variable-name` | Overly long variable name (&gt;35 chars) detected | warning | Regex |
| [VBC-063](./VBC-063.md)<br>`empty-else` | Empty else block detected | warning | Regex |
| [VBC-063-B](./VBC-063-B.md)<br>`empty-block` | Empty block detected | warning | AST |
| [VBC-065](./VBC-065.md)<br>`hadouken-nested-logic` | Nested logic is levels deep, over the limit of | warning | AST |
| [VBC-066](./VBC-066.md)<br>`redundant-if-true` | Redundant 'if(true)' detected | warning | AST |
| [VBC-068](./VBC-068.md)<br>`overuse-ternary` | Chained or nested ternary | warning | Regex |
| [VBC-084](./VBC-084.md)<br>`long-line-limit` | Line is too long ( characters) | warning | Regex |
| [VBC-096](./VBC-096.md)<br>`complex-regex-no-comment` | Long regular expression literal with no explanation | warning | Regex |
| [VBC-098](./VBC-098.md)<br>`z-index-war` | Extremely high z-index value detected (z-index wars) | warning | Regex |
| [VBC-102](./VBC-102.md)<br>`multi-statement-one-liner` | Multiple statements on a single line detected | warning | AST |
| [VBC-104](./VBC-104.md)<br>`inconsistent-import` | Mixing 'require' and 'import' in the same file | warning | Regex |
| [VBC-201](./VBC-201.md)<br>`redundant-async` | async function with no await | warning | AST |
| [VBC-215](./VBC-215.md)<br>`global-pollutant` | Assignment to a window property | warning | Regex |
| [VBC-501](./VBC-501.md)<br>`boolean-naming-vibes` | Boolean variable has no standard prefix | warning | Semantic |
| [VBC-502](./VBC-502.md)<br>`redundant-boolean-logic` | Redundant boolean return detected | warning | Semantic |
| [VBC-503](./VBC-503.md)<br>`collection-naming-vibes` | Array named is missing a plural 's' or a collection suffix (List, Array) | warning | Semantic |
| [VBC-504](./VBC-504.md)<br>`semantic-shadowing` | Variable shadows a common library or system keyword | warning | Semantic |
| [VBC-904](./VBC-904.md)<br>`magic-string` | Magic string literal passed to function | warning | Regex |
| [VBC-905](./VBC-905.md)<br>`debug-console-usage` | Debug console method left in code | warning | Regex |
| [VBC-906](./VBC-906.md)<br>`fixme-technical-debt` | FIXME describing a live defect | warning | Regex |
| [VBC-907](./VBC-907.md)<br>`anonymous-todo` | Unattributed debt marker | warning | Regex |
| [VBC-908](./VBC-908.md)<br>`long-inline-style` | Overly long inline style attribute | warning | Regex |
| [VBC-909](./VBC-909.md)<br>`empty-interface-ts` | Empty interface detected | warning | AST |
| [VBC-910](./VBC-910.md)<br>`console-table-leaks` | console.table() left in code | warning | Regex |
| [VBC-911](./VBC-911.md)<br>`meaningless-helper-names` | Generic class name detected | warning | Regex |
| [VBC-943](./VBC-943.md)<br>`ignored-catch-variable` | Catch clause with ignored error variable | warning | Regex |
| [VBC-945](./VBC-945.md)<br>`ai-generated-placeholder-comment` | AI-generated placeholder comment | warning | Regex |

## Core

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-001](./VBC-001.md)<br>`hardcoded-secret` | Hardcoded credential | **error** | Regex |
| [VBC-002](./VBC-002.md)<br>`committed-env` | Environment file (.env) detected in staged files | **error** | Git |
| [VBC-003](./VBC-003.md)<br>`chmod-777` | Insecure chmod 777 detected | **error** | Regex |
| [VBC-005](./VBC-005.md)<br>`use-var` | Use of 'var' detected | **error** | Regex |
| [VBC-013](./VBC-013.md)<br>`empty-catch` | Empty catch block detected | **error** | AST |
| [VBC-017](./VBC-017.md)<br>`fake-test-assertion` | Trivially true test assertion | **error** | Regex |
| [VBC-019](./VBC-019.md)<br>`absolute-paths` | Hardcoded absolute path detected | **error** | Regex |
| [VBC-039](./VBC-039.md)<br>`use-eval` | Use of 'eval()' detected | **error** | Regex |
| [VBC-070](./VBC-070.md)<br>`use-innerhtml` | Use of 'innerHTML' detected | **error** | Regex |
| [VBC-086](./VBC-086.md)<br>`target-blank-rel` | target='_blank' without rel='noopener' detected | **error** | Regex |
| [VBC-800](./VBC-800.md)<br>`floating-promise` | Unawaited Promise detected | **error** | Type checker |
| [VBC-028](./VBC-028.md)<br>`function-params-limit` | Function takes parameters, over the limit of | warning | AST |
| [VBC-032](./VBC-032.md)<br>`css-important` | Global '!important' detected in CSS | warning | Regex |
| [VBC-057](./VBC-057.md)<br>`use-any` | Avoid using 'any' type | warning | Regex |
| [VBC-059](./VBC-059.md)<br>`file-length-limit` | File is too long ( lines) | warning | AST |
| [VBC-090](./VBC-090.md)<br>`passive-aggressive-comments` | Passive-aggressive or helpless comment detected | warning | Regex |
| [VBC-150](./VBC-150.md)<br>`production-todo` | Tracked debt marker still in the code | warning | Regex |

## Correctness

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-006-B](./VBC-006-B.md)<br>`merge-conflict-markers` | Merge conflict marker | **error** | Regex |
| [VBC-017-B](./VBC-017-B.md)<br>`focused-test-committed` | Focused test | **error** | Regex |
| [VBC-946](./VBC-946.md)<br>`no-verification-after-operation` | Destructive async operation with no verification of success | warning | Regex |

## Docs

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-928](./VBC-928.md)<br>`lorem-ipsum-docs` | Placeholder text 'Lorem ipsum' detected | **error** | Regex |
| [VBC-103](./VBC-103.md)<br>`ascii-art-block` | Block of decoration: three or more comment lines that are shape and nothing else | warning | Regex |
| [VBC-324](./VBC-324.md)<br>`condescending-language` | Condescending or vague language detected | warning | Regex |
| [VBC-334](./VBC-334.md)<br>`ai-generated-fluff` | Potential AI-generated fluff or overused cliché detected | warning | Regex |
| [VBC-338](./VBC-338.md)<br>`non-inclusive-terminology` | Non-inclusive terminology | warning | Regex |
| [VBC-340](./VBC-340.md)<br>`gendered-address` | Gendered language detected | warning | Regex |
| [VBC-344](./VBC-344.md)<br>`non-iso-date` | Non-ISO 8601 date found | warning | Regex |
| [VBC-347](./VBC-347.md)<br>`passive-voice` | Potential passive voice | warning | Regex |
| [VBC-348](./VBC-348.md)<br>`click-here-links` | Vague link text found | warning | Regex |
| [VBC-385](./VBC-385.md)<br>`success-message-grammar` | Improper success message grammar | warning | Regex |
| [VBC-398](./VBC-398.md)<br>`panic-punctuation` | Excessive punctuation | warning | Regex |
| [VBC-401](./VBC-401.md)<br>`broken-links` | Broken link detected | warning | Heuristic |
| [VBC-414](./VBC-414.md)<br>`please-in-cli` | Avoid using 'Please' in technical instructions | warning | Regex |
| [VBC-421](./VBC-421.md)<br>`filler-words` | Filler word detected | warning | Regex |
| [VBC-917](./VBC-917.md)<br>`shouting-documentation` | Sustained all-caps text | warning | Regex |
| [VBC-918](./VBC-918.md)<br>`we-detected-tone` | Avoid first-person collective ('We') in system messages | warning | Regex |
| [VBC-920](./VBC-920.md)<br>`relative-link-format` | Relative local link missing './' prefix | warning | Regex |
| [VBC-921](./VBC-921.md)<br>`hardcoded-outdated-year` | Copyright notice ends at a year that has passed: | warning | Heuristic |
| [VBC-927](./VBC-927.md)<br>`vague-button-label` | Vague button label detected | warning | Regex |
| [VBC-929](./VBC-929.md)<br>`technical-jargon-slop` | Avoid buzzword-heavy jargon | warning | Regex |
| [VBC-933](./VBC-933.md)<br>`coming-soon-docs` | Placeholder documentation content | warning | Regex |
| [VBC-934](./VBC-934.md)<br>`personal-opinion-docs` | Personal opinion language in documentation | warning | Regex |
| [VBC-935](./VBC-935.md)<br>`colloquial-language` | Corporate colloquialism or buzzword in documentation | warning | Regex |
| [VBC-936](./VBC-936.md)<br>`outdated-experimental-tag` | Experimental or alpha status tag | warning | Regex |
| [VBC-948](./VBC-948.md)<br>`em-dash-prose` | Em dash | warning | Regex |

## Git

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-006](./VBC-006.md)<br>`committed-node-modules` | node_modules directory detected in staged files | **error** | Git |
| [VBC-025](./VBC-025.md)<br>`missing-gitignore` | Missing.gitignore file | **error** | Git |
| [VBC-106](./VBC-106.md)<br>`spaces-in-filenames` | Filename contains spaces | **error** | Git |
| [VBC-924](./VBC-924.md)<br>`missing-readme-root` | No README file found in project root | **error** | Git |
| [VBC-014](./VBC-014.md)<br>`committed-ide-settings` | IDE settings file detected in staged files | warning | Git |
| [VBC-045](./VBC-045.md)<br>`missing-license` | Missing LICENSE file | warning | Git |
| [VBC-046](./VBC-046.md)<br>`binary-files-in-git` | Binary file committed to Git | warning | Git |
| [VBC-922](./VBC-922.md)<br>`too-many-staged-files` | Staging files (limit:) | warning | Git |
| [VBC-923](./VBC-923.md)<br>`filename-too-long-hazard` | Filename length exceeds characters | warning | Git |
| [VBC-925](./VBC-925.md)<br>`large-file-staged` | File is over 1MB ( bytes) | warning | Git |
| [VBC-926](./VBC-926.md)<br>`short-commit-message-check` | Commit message is likely too short | warning | Git |
| [VBC-930](./VBC-930.md)<br>`missing-contributing` | Missing CONTRIBUTING.md file | warning | Git |
| [VBC-931](./VBC-931.md)<br>`missing-security-policy` | Missing SECURITY.md file | warning | Git |
| [VBC-932](./VBC-932.md)<br>`missing-changelog` | Missing CHANGELOG.md (or HISTORY.md) file | warning | Git |

## Security

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-004](./VBC-004.md)<br>`sql-injection-concatenation` | SQL built by string concatenation | **error** | Regex |
| [VBC-007](./VBC-007.md)<br>`float-for-currency` | Monetary value declared as a floating point literal | **error** | Regex |
| [VBC-034](./VBC-034.md)<br>`http-not-https` | Insecure http:// link detected | **error** | Regex |
| [VBC-902](./VBC-902.md)<br>`document-write-slop` | document.write() is prohibited | **error** | Regex |
| [VBC-903](./VBC-903.md)<br>`eval-like-timers` | Passing strings to timers is eval-like and insecure | **error** | Regex |
| [VBC-937](./VBC-937.md)<br>`client-side-auth-check` | Authentication token or role stored/read from browser storage | **error** | Regex |
| [VBC-938](./VBC-938.md)<br>`command-injection-risk` | Potential command injection | **error** | Regex |
| [VBC-939](./VBC-939.md)<br>`unrestricted-file-upload` | File upload handler may lack type/size restrictions | **error** | Regex |
| [VBC-940](./VBC-940.md)<br>`float-currency-arithmetic` | Floating-point arithmetic on monetary value | **error** | Regex |
| [VBC-944](./VBC-944.md)<br>`xss-href-injection` | Dynamic href constructed with string interpolation | **error** | Regex |
| [VBC-947](./VBC-947.md)<br>`prototype-pollution-risk` | Merging untrusted request body directly | **error** | Regex |
| [VBC-011](./VBC-011.md)<br>`document-cookie-direct` | Direct document.cookie write | warning | Regex |
| [VBC-901](./VBC-901.md)<br>`hardcoded-ip-v4` | Hardcoded IP address | warning | Regex |
| [VBC-941](./VBC-941.md)<br>`missing-input-sanitization` | Unsanitized HTML sink | warning | Regex |
| [VBC-942](./VBC-942.md)<br>`missing-access-control` | Route handler may be missing authentication middleware | warning | Regex |

## Ux-dx

| Rule | Catches | Severity | Analysis |
|---|---|---|---|
| [VBC-010](./VBC-010.md)<br>`div-onclick-non-semantic` | Clickable &lt;div&gt; with onclick handler | **error** | Regex |
| [VBC-023](./VBC-023.md)<br>`notification-permission-eager` | Notification.requestPermission() detected | **error** | Regex |
| [VBC-024](./VBC-024.md)<br>`autoplay-video-unmuted` | Autoplay video without the muted attribute | **error** | Regex |
| [VBC-033](./VBC-033.md)<br>`placeholder-image-src` | Placeholder image service URL detected | **error** | Regex |
| [VBC-035](./VBC-035.md)<br>`aria-label-icon-button` | Icon-only button without aria-label | **error** | Regex |
| [VBC-101](./VBC-101.md)<br>`img-missing-alt` | Image missing 'alt' attribute | **error** | Regex |
| [VBC-113](./VBC-113.md)<br>`disable-zoom` | Disabling pinch-to-zoom is an accessibility violation | **error** | Regex |
| [VBC-117](./VBC-117.md)<br>`block-paste` | Blocking paste in input fields harms both UX and security (password managers) | **error** | Regex |
| [VBC-913](./VBC-913.md)<br>`outline-none-hazard` | Focus outline removed with nothing replacing it | **error** | Regex |
| [VBC-020](./VBC-020.md)<br>`justify-text-web` | text-align:justify detected | warning | Regex |
| [VBC-021](./VBC-021.md)<br>`thin-font-weight` | Thin font weight (100-199) detected | warning | Regex |
| [VBC-022](./VBC-022.md)<br>`custom-cursor-css` | Custom cursor via CSS url() | warning | Regex |
| [VBC-027](./VBC-027.md)<br>`parallax-overuse` | Parallax scrolling effect detected | warning | Regex |
| [VBC-029](./VBC-029.md)<br>`glassmorphism-overuse` | backdrop-filter:blur() (glassmorphism) | warning | Regex |
| [VBC-030](./VBC-030.md)<br>`confetti-overuse` | Confetti or particle animation library detected | warning | Regex |
| [VBC-097](./VBC-097.md)<br>`br-tags-for-layout` | Multiple &lt;br&gt; tags used for layout | warning | Regex |
| [VBC-112](./VBC-112.md)<br>`scroll-hijacking` | Potential scroll hijacking or forced smooth scrolling detected | warning | Regex |
| [VBC-123](./VBC-123.md)<br>`placeholder-as-label` | Using placeholder as the only label is bad for accessibility | warning | Regex |
| [VBC-131](./VBC-131.md)<br>`video-background` | Autoplay video backgrounds can be distracting and impact performance | warning | Regex |
| [VBC-153](./VBC-153.md)<br>`sudo-setup` | Setup instructions requiring sudo detected | warning | Regex |
| [VBC-158](./VBC-158.md)<br>`fouc-prevention` | Use of @import in CSS can cause Flash of Unstyled Content (FOUC) | warning | Regex |
| [VBC-161](./VBC-161.md)<br>`oversized-sticky-header` | Oversized sticky header (&gt;30vh) detected | warning | Regex |
| [VBC-172](./VBC-172.md)<br>`hamburger-on-desktop` | Hamburger menu detected on desktop resolutions | warning | Regex |
| [VBC-197](./VBC-197.md)<br>`hardcoded-node-version` | Hardcoded system version check detected | warning | Regex |
| [VBC-206](./VBC-206.md)<br>`pure-black-background` | Pure black backgrounds (#000000) can cause eye strain | warning | Regex |
| [VBC-208](./VBC-208.md)<br>`hardcoded-colors` | Hardcoded color value detected | warning | Regex |
| [VBC-212](./VBC-212.md)<br>`keyboard-focus-awareness` | Suppressing focus outline without providing an alternative | warning | Regex |
| [VBC-305](./VBC-305.md)<br>`hardcoded-font-size` | Hardcoded font size detected | warning | Regex |
| [VBC-914](./VBC-914.md)<br>`cursor-pointer-on-text` | cursor: pointer applied to potentially non-interactive element | warning | Regex |
| [VBC-915](./VBC-915.md)<br>`user-select-none-slop` | user-select: none detected | warning | Regex |
| [VBC-916](./VBC-916.md)<br>`vague-link-text-ux` | Vague link text detected | warning | Regex |

