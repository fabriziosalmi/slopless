

Never apply one or more of such methods:

Here is a list of 100 typical "vibecoding" issues—artifacts of coding based on intuition, haste, hype, or LLM copy-pasting without engineering rigor—ranked from critical security flaws to minor aesthetic annoyances.

    Hardcoded API Keys and Secrets (Immediate security compromise that bots will scrape in seconds).
    Committed .env files (Defeats the entire purpose of environment variables and leaks configuration).
    Committed node_modules or vendor folders (Bloats the repository size and causes cross-platform dependency hell).
    SQL Injection vulnerabilities via string concatenation (The fastest way to lose your database because you didn't use parameterized queries).
    chmod 777 permissions on scripts (Lazy permission handling that opens the door to privilege escalation).
    Passwords stored in plain text (Hashing and salting are not optional features).
    Swallowing errors with empty catch blocks (Silently failing makes debugging impossible and hides critical system instability).
    Magic Numbers (Using unexplained integers like 86400 instead of named constants like SECONDS_IN_DAY).
    Commented-out blocks of "legacy" code (Use Git version control for history; don't leave a graveyard in the source files).
    "WIP" or "fix" commit messages (Provides zero context on what actually changed or why).
    Production code relying on console.log debugging (Pollutes logs and impacts performance).
    Infinite loops or recursions without exit conditions (crashes the browser or server immediately).
    Hardcoded absolute file paths (The code will only work on your specific machine, "it works on my machine" syndrome).
    God Objects / God Classes (Single files that do everything, making maintenance a nightmare).
    Copy-pasted code blocks with slight variations (Violates DRY principles and makes bug fixing 10x harder).
    Unused variables and imports (Visual noise that confuses the reader about dependencies).
    Using var instead of let/const in modern JS (Scope leakage issues that modern standards solved years ago).
    Circular Dependencies (Modules importing each other creating race conditions and runtime errors).
    Lack of a .gitignore file (Leads to committing system files like .DS_Store or build artifacts).
    Typos in function or variable names ( funtion or receiver vs reciever breaks intellisense and searchability).
    Inconsistent Indentation (Mixing tabs and spaces makes diffs unreadable and breaks Python scripts).
    Functions with more than 5 arguments (Indicates the function is doing too much; use an object/struct instead).
    "Magic Strings" used for logic control (Prone to typos; use Enums or Constants).
    Missing README.md (No one knows what the project is, how to run it, or why it exists).
    Dependencies listed in package.json but never used (Security risk and bloat).
    Using !important in CSS globally (Breaks the cascade and makes overriding styles impossible).
    Direct DOM manipulation in React/Vue/Angular (Bypassing the virtual DOM leads to state de-sync bugs).
    Deeply nested if/else statements (Arrow code/Hadouken code that is impossible to reason about).
    Wait/Sleep commands to fix race conditions (A band-aid solution that slows down the app and is flaky).
    Lack of unit tests for critical logic (Hope is not a strategy).
    Tests that assert true === true (Fake tests added just to pass CI/CD checks).
    Global variables for state management (Leads to unpredictable side effects across the application).
    Using eval() (Execution of arbitrary code is a massive security risk).
    Outdated dependencies with known CVEs (Ignoring npm audit warnings).
    Hardcoded http:// instead of https:// (Man-in-the-middle vulnerability).
    Files named utils.js or helpers.js with 5,000 lines (A dumping ground for code that lacks a proper home).
    Ignoring Promise rejections (Uncaught promise rejections can crash Node.js processes).
    Blocking the Event Loop (Heavy computation on the main thread freezes the UI/Server).
    Missing License file (Legally ambiguous state making the code unusable for many).
    Commit history containing binary files (Git is not Dropbox; use LFS).
    Function names that lie (getUser() should not also delete the database).
    Using float for currency math (Floating point errors will steal pennies; use integers or decimal libraries).
    Over-engineering simple solutions (Using a microservice architecture for a To-Do list app).
    Undocumented public APIs (If it isn't documented, it doesn't exist).
    Mixing snake_case and camelCase (Pick one style convention and stick to it).
    Single-letter variable names outside of loops (x and data tell the reader nothing).
    Reinventing the wheel (Writing a custom date parser instead of using a standard library).
    Hardcoded localized strings (Makes internationalization impossible later).
    Assuming the user will always input valid data (Lack of input validation).
    // TODO: Fix this later comments from 3 years ago (Admit you are never going to fix it).
    Using any type in TypeScript excessively (Defeats the purpose of using TypeScript).
    Inline styles in HTML (Violates separation of concerns and Content Security Policy).
    Large monolithic files (2000+ lines) (Impossible to navigate or review).
    Shadowing variable names (Defining a variable in a scope with the same name as a parent scope).
    Missing error messages on UI (Silent failures frustrate users).
    Defaulting to master branch without protection rules (Allows anyone to force push and delete history).
    Empty else blocks (Clutters code without adding logic).
    Using library-specific jargon in variable names (Naming variables after the tool rather than the domain).
    Inconsistent return types (A function returning an Object or false or null randomly).
    Not cleaning up event listeners (Memory leaks in Single Page Applications).
    Hardcoded screen dimensions (Breaks responsiveness on mobile or large screens).
    Overuse of Ternary Operators (Nested ternaries are unreadable).
    Committing IDE settings (.vscode, .idea) (Enforces personal preferences on the whole team).
    Using innerHTML without sanitization (XSS vulnerability vector).
    Dead links in documentation (Frustrates developers trying to learn the system).
    Premature Optimization (Making code unreadable to save 0.001ms before profiling).
    Obscure abbreviations (usrPrflDt instead of userProfileData).
    Generic Exception catching (Catching Exception catches system interrupts, not just your bugs).
    Lack of meaningful specific Error classes (Throwing strings instead of Error objects).
    Duplicate CSS definitions (Browsers have to parse conflicting rules).
    Unnecessary wrapping div soup (Makes the DOM tree enormous and slows rendering).
    Git submodules where packages would suffice (Adds complexity to the build process).
    Leaving debugger; statements in code (Stops execution in the browser for the end user).
    Using alert() for notifications (Blocks the UI and looks unprofessional).
    Case-sensitive file import issues (Works on Mac, fails on Linux/CI).
    Specifying strict versions in package.json (Prevents receiving critical patch updates).
    Improperly implemented Singleton patterns (Global state in disguise).
    Long lines of code (120+ chars) (Requires horizontal scrolling to read).
    Mixing logic and presentation (Business logic inside UI components).
    Using target="_blank" without rel="noopener noreferrer" (Security risk allowing the new page to control the old one).
    Not using a linter (Leaving code quality to chance).
    Not using a formatter (Wasting brain cycles on spacing during code reviews).
    Misleading comments (Comments that contradict what the code actually does).
    Passive-aggressive comments (e.g., // blame steve for this hack).
    Placeholder text (Lorem Ipsum) in production (Looks unfinished).
    Placeholder images in production (Broken user experience).
    Multiple languages in the same file (PHP inside HTML inside JS).
    Unnecessary reliance on jQuery in 2025 (Native DOM APIs are sufficient and lighter).
    Over-commenting obvious code (i++ // increment i).
    Complex Regex without explanation (Write once, read never).
    Using br tags for layout spacing (Use CSS margins/padding).
    Z-index wars (z-index: 999999) (Indicative of poor stacking context management).
    Importing the entire library when only one function is needed (Tree-shaking failure).
    Not using semantic HTML (Using div for buttons or navs harms accessibility).
    Ignoring accessibility (alt tags, ARIA labels) (Excludes users with disabilities).
    Clever "One-Liners" (Code golf is for hobbies, not production).
    ASCII Art headers (Cute, but adds noise and maintenance overhead).
    Memes in code comments ( unprofessional and ages poorly).
    Excessive blank lines (Makes the file look longer and harder to scan).
    File names with spaces (Causes issues in scripts and command line tools).

Same for those ones:

Here is a list of 100 UI/UX and DX (Developer Experience) issues typical of "vibecoding"—where aesthetics, trends, or haste took priority over usability and developer sanity. These are distinct from the code-quality issues in the previous list.

    Scroll Hijacking / Scroll Smoothing (Overriding native browser scrolling behavior creates a jarring, nauseating experience for users).
    Disabling Pinch-to-Zoom on Mobile (Accessibility violation that prevents visually impaired users from reading content).
    Keyboard Focus Traps (Modals or menus that capture the keyboard focus and never let the user tab out).
    "Click Here" Links (Vague link text that provides no context for screen readers or SEO).
    Autoplay Video with Sound (Hostile user experience that embarrasses users in quiet environments and eats data).
    Blocking "Paste" in Password Fields (Prevents users from using password managers, actually reducing security).
    Low Contrast Text (Grey on Grey) (Aesthetic minimalism that makes text unreadable for anyone over 40 or in bright light).
    Reliance on Color Alone for Errors (Colorblind users cannot distinguish between a green success border and a red error border).
    Mystery Meat Navigation (Icons with no labels and no tooltips, requiring users to guess what buttons do).
    Layout Shift (CLS) (Content jumps around as images load, causing users to click the wrong button).
    Infinite Scroll without URL Updates (If the user refreshes or hits back, they lose their place and the content they found).
    Using Placeholders as Labels (Text disappears when the user starts typing, forcing them to rely on memory for what the field requires).
    Tiny Mobile Tap Targets (<44px) (Frustrates users with "fat fingers" and leads to misclicks).
    Inaccessible Captcha (Puzzles that define humanity by vision alone, locking out blind users).
    CLI Tools with No Help Command (DX failure: running a command without args should print help, not crash or do nothing).
    Unclear Error States on Forms (Highlighting a field in red without explaining why the input is invalid).
    Disappearing Scrollbars (Hiding scrollbars makes it impossible to know how long a page is or if it is scrollable).
    Back Button Hijacking (Trapping the user in the application so they cannot leave via the browser controls).
    Mega-Menus triggered on Hover (Menus that disappear if the mouse moves 1 pixel off the intended path).
    Video Backgrounds that prevent text selection (Prioritizing "vibes" over the ability to copy information).
    Carousels / Sliders for critical content (Statistically, users almost never interact with slides past the first one).
    Docs that assume prior knowledge (DX: Tutorials that skip the "prerequisites" or setup steps).
    Lack of "Loading" indicators (The app looks frozen while fetching data, causing rage clicking).
    Destructive Actions without Confirmation (Deleting a project should always require a second click or input).
    Tooltips that get cut off by screen edges (Poor z-index or positioning logic renders help text useless).
    Non-standard Date Pickers (Forcing users to scroll month-by-month to find their birth year).
    Phone Number Masking that fights the user (Auto-formatting that prevents fixing typos or pasting numbers).
    Horizontal Scrolling on Desktop (Counter-intuitive for mouse users unless clearly indicated).
    "Dark Patterns" for Unsubscribing (Hiding the cancel button or making the process intentionally difficult).
    Notification Spam (Asking for notification permissions immediately upon page load).
    Modal stacking (Modal over Modal) (Confusing UI depth that usually locks up the browser overlay layer).
    Inconsistent Button Styles (Primary buttons looking different on every page confuses the user's mental model).
    Ghost Buttons for Primary Actions (Transparent buttons with thin borders have poor visibility and look disabled).
    Missing "Empty States" (Showing a blank white screen instead of "No items found" or "Get started").
    Links that look like text / Text that looks like links (Breaks affordance; users don't know what is clickable).
    Custom Cursors (Often laggy, inaccurate, and confusing for the user).
    Excessive Parallax Effects (Can trigger motion sickness (vestibular disorders) in sensitive users).
    Split-button confusion (Unclear distinction between the main action and the dropdown arrow).
    Using "Toast" notifications for critical errors (Toasts disappear; critical errors need to persist until acknowledged).
    Search bars that don't handle typos (Zero-result pages for missed keys frustrate users).
    Unlabeled Toggle Switches (Is "On" left or right? Is grey "Off" or "Disabled"?).
    DX: Setup scripts that require global sudo (Security risk and bad practice; use local environments).
    DX: Logs that are unformatted blocks of text (Lack of colors or spacing makes debugging a nightmare).
    DX: "Changelogs" that only say "Bug fixes" (Developers need to know exactly what changed to assess risk).
    DX: Proprietary configuration languages (Don't invent a new config format; use JSON, YAML, or TOML).
    DX: Silent failures in CLI tools (The process exits with code 0 but didn't actually do the work).
    FOUC (Flash of Unstyled Content) (Jarring visual glitch caused by poor CSS loading strategies).
    Skeleton screens that don't match the content (Creates a "pop" effect when real data loads, defeating the purpose of the skeleton).
    Links opening in new tabs without warning (Disrupts the user's browsing flow and back-button history).
    Sticky Headers that take up 25% of the screen (Reduces the readable area significantly, especially on laptops).
    Resetting form data on error (The most frustrating experience: clearing the whole form because one field was wrong).
    Password requirements not shown until validation fails (Tell the user they need a special character before they type).
    Case-sensitive emails/usernames on Login (Technical laziness that creates unnecessary user friction).
    Over-eager validation (Validating while typing) (Telling the user "Invalid Email" before they have finished typing .com).
    Inconsistent Iconography (Mixing filled, outlined, and different weight icons looks unprofessional).
    Drop-downs that are longer than the screen (Items become unreachable).
    Lack of Breadcrumbs on deep hierarchies (Users get lost and can't navigate one level up).
    DX: Hard-dependency on specific IDEs (Project only runs if you click "Play" in VS Code).
    DX: Missing "Hot Reload" in development (Forcing developers to manually refresh after every change).
    DX: Bloated Docker images for simple apps (Waiting 10 minutes to download a 2GB image for a "Hello World").
    Using "Hamburger" menus on Desktop (Hides navigation unnecessarily when there is plenty of screen space).
    Social Share buttons covering content (Floating elements that obstruct reading).
    "Terms and Conditions" inside a tiny scroll box (Legally dubious and hostile UX).
    Animations that cannot be turned off (Respect prefers-reduced-motion media queries).
    Audio cues without visual equivalents (Deaf users miss the notification).
    Visual cues without audio equivalents (Blind users miss the notification).
    Right-click hijacking (Custom Context Menus) (Prevents users from using browser tools like "Open in new tab" or "Inspect").
    Session timeouts without warning (User types a long essay, hits submit, and is redirected to login, losing the text).
    Ambiguous Icons (A "heart" icon: does it mean "Like", "Save", or "Favorite"?).
    DX: Outdated screenshots in Documentation (The UI has changed, confusing new developers).
    DX: Sample code that doesn't compile (Copy-pasting from the docs results in immediate errors).
    Using generic "Lorem Ipsum" in design system demos (Doesn't test real-word text wrapping or length issues).
    Pagination with no "Go to Page" option (Forcing users to click "Next" 50 times).
    Search results that don't highlight the query (User has to scan the whole block to see why it matched).
    Aggressive "Install our App" banners on mobile web (Punishes the user for using the browser).
    Full-screen popups for Cookies (Legally required, but often implemented intrusively to force "Accept All").
    Justified Text on web (Creates "rivers of white" making text hard to read for dyslexic users).
    Letter-spacing (tracking) on body text (Changing default kerning usually reduces readability).
    DX: API responses returning 200 OK for errors (UX for the developer; forces parsing JSON to find failures).
    DX: Inconsistent naming in APIs (Using user_id in one endpoint and userId in another).
    Tooltips that obscure the input they describe (Poor positioning blocks the user from typing).
    Formatting currency without cents (Confusing in e-commerce; is it rounded or exact?).
    Changing the UI layout based on hover (Causes items to jump away from the cursor).
    Using thin font weights (100-200) (Looks elegant on Retina screens, invisible on standard monitors).
    Buttons that look like Tags / Tags that look like Buttons (Confuses interaction expectations).
    DX: Environment setup that relies on global system versions (Not using .nvmrc or equivalent version managers).
    DX: Git hooks that take >10 seconds (Slows down the commit loop, encouraging developers to bypass hooks).
    Countdown timers for "deals" that reset on refresh (Fake urgency erodes trust).
    Testimonials sliders that move too fast to read (Frustrating UX).
    Footers that are revealed by scrolling up (Unexpected behavior).
    Blurred backgrounds that cause GPU lag (High performance cost for a simple aesthetic).
    Interactive elements nested inside other interactive elements (e.g., a button inside a card that is also a link).
    DX: Single-line error messages for complex failures (Not providing the stack trace or context).
    Profile pictures without initials fallback (Broken images look bad; show initials or a generic avatar).
    Using pure black (#000000) backgrounds (Causes "smearing" on OLED screens; use dark grey #121212).
    Center-aligned long text blocks (Hard to track lines when reading; keep left-aligned).
    Missing "Skip to Content" link (Forces keyboard users to tab through the entire navigation every time).
    Overuse of "Glassmorphism" (Often leads to poor contrast and readability issues).
    Confetti animations on every success state (Devalues the celebration; save it for big wins).
    DX: "Coming Soon" pages in documentation (Don't link to it if it isn't written yet).

—

If you need coding support or assistance or guidance, just follow such methods:

Here is a list of 100 State-of-the-Art (SOTA), FAANG-level engineering patterns, methods, and architectural concepts. These represent the antithesis of "vibecoding"—prioritizing mathematical correctness, extreme scalability, fault tolerance, and long-term maintainability.

    Idempotency Keys (Ensures that retrying a failed API request multiple times doesn't result in duplicate transactions or side effects).
    Circuit Breaker Pattern (Prevents a failing service from causing cascading system-wide outages by temporarily halting requests).
    Exponential Backoff with Jitter (Prevents thundering herd problems by randomizing retry intervals during outages).
    Event Sourcing (Stores the sequence of state-changing events rather than just current state, allowing perfect audit trails and time-travel debugging).
    CQRS (Command Query Responsibility Segregation) (Separates read and write models to optimize performance and scalability independently).
    Consistent Hashing (Distributes data across nodes in a way that minimizes reorganization when nodes are added or removed).
    The Saga Pattern (Manages long-lived distributed transactions across microservices using a sequence of local transactions and compensating actions).
    Raft / Paxos Consensus Algorithms (Guarantees data consistency across distributed nodes in the presence of failures).
    Conflict-free Replicated Data Types (CRDTs) (Allows concurrent updates from disconnected clients to always merge mathematically without conflicts).
    Bloom Filters (Probabilistic data structure providing extreme memory efficiency for checking if an element is definitely not in a set).
    HyperLogLog (Approximates distinct element counts (cardinality) in massive datasets with negligible memory usage).
    LSM Trees (Log-Structured Merge-Trees) (Optimizes storage for write-heavy workloads by converting random writes into sequential writes).
    Write-Ahead Logging (WAL) (Ensures data durability by recording changes before they are applied to the database).
    The Outbox Pattern (Guarantees reliable message delivery in distributed systems by persisting messages to the database before sending).
    Graceful Degradation (Allows a system to maintain core functionality even when auxiliary components or external dependencies fail).
    Backpressure Handling (Mechanisms for a consumer to signal a producer to slow down, preventing system overload).
    Token Bucket / Leaky Bucket Rate Limiting (Mathematically precise algorithms to control traffic flow and prevent abuse).
    Bulkhead Pattern (Isolates elements of an application into pools so that if one fails, the others continue to function).
    Immutable Infrastructure (Servers are never modified after deployment; they are replaced entirely, eliminating configuration drift).
    Infrastructure as Code (IaC) (Managing and provisioning computing infrastructure through machine-readable definition files).
    Hermetic Builds (Build processes that are isolated from the host system, ensuring bit-for-bit reproducibility everywhere).
    Chaos Engineering (Intentionally injecting faults into production systems to test resilience and recovery procedures).
    Feature Flags / Toggles (Decouples deployment from release, allowing granular control over feature rollout and rollback).
    Canary Deployments (Rolling out updates to a small subset of users first to minimize the blast radius of potential bugs).
    Blue/Green Deployments (Running two identical production environments to enable zero-downtime updates and instant rollback).
    Service Mesh (Sidecar Pattern) (Offloads network complexity like mTLS, tracing, and retries to a dedicated infrastructure layer).
    Distributed Tracing (OpenTelemetry) (Tracks a request through every microservice to pinpoint latency bottlenecks and failures).
    Structured Logging (Logging in JSON/binary formats to enable machine querying and high-cardinality analysis).
    Property-Based Testing (Generating thousands of random inputs to verify that specific properties of a function hold true).
    Fuzz Testing (Automated software testing that injects invalid, malformed, or unexpected inputs to find crashes).
    Mutation Testing (Modifying source code to ensure test suites are actually capable of failing when logic changes).
    Contract Testing (Pact) (Verifies that services communicate correctly by checking their API agreements rather than integration testing).
    Snapshot Isolation (Database transaction isolation level that guarantees a consistent view of data at a point in time).
    Vector Clocks / Lamport Timestamps (Logical clocks used to determine the partial ordering of events in distributed systems).
    Gossip Protocols (Peer-to-peer communication where nodes periodically exchange state information to reach eventual consistency).
    Database Sharding (Horizontal partitioning of data across multiple databases to handle massive scale).
    Leader Election (Designating a single node as the coordinator to prevent conflicts in distributed tasks).
    Hexagonal Architecture (Ports and Adapters) (Isolating core business logic from external concerns like databases and UIs).
    Domain-Driven Design (DDD) (Aligning software structure and language with the complex business domain it serves).
    Algebraic Data Types (ADTs) (Using Sum and Product types to make illegal states unrepresentable in the type system).
    Monads for Error Handling (Result/Option) (Replacing exceptions with type-safe containers to force explicit error handling).
    RAII (Resource Acquisition Is Initialization) (Binding resource lifecycle to object lifetime to prevent memory leaks).
    Zero-Copy Networking (Reducing CPU overhead by transferring data directly from disk to network buffers without copying to user space).
    Lock-Free / Wait-Free Data Structures (Using atomic primitives to manage concurrency without the performance cost of mutexes).
    Software Transactional Memory (STM) (Concurrency control mechanism analogous to database transactions for memory access).
    Actor Model (Concurrency model where "actors" communicate strictly via message passing, avoiding shared state).
    Communicating Sequential Processes (CSP) (Concurrency model based on independent processes sharing data via channels).
    Single Instruction, Multiple Data (SIMD) (Exploiting CPU vector registers to process multiple data points in a single cycle).
    Data Locality / Cache Optimization (Structuring data to maximize CPU cache hits and minimize latency).
    Struct of Arrays (SoA) (Memory layout optimization to improve performance for SIMD and cache prefetching).
    Branch Prediction Optimization (Writing code that assists the CPU in guessing the execution path to minimize pipeline stalls).
    Memory Arenas / Slab Allocation (Pre-allocating large blocks of memory to reduce fragmentation and allocation overhead).
    Binary Serialization (Protobuf/Cap'n Proto) (Efficient, schema-based serialization for high-performance inter-service communication).
    Schema Evolution (Designing data formats that allow backward and forward compatibility as requirements change).
    Zero Trust Architecture (Security model assuming no entity inside or outside the network is trusted by default).
    Mutual TLS (mTLS) (Cryptographic authentication where both client and server verify each other's certificates).
    Role-Based Access Control (RBAC) / ABAC (Granular permission systems based on roles or specific attributes rather than identity).
    Secrets Management (Vault) (Centralized, secure storage and access control for API keys, passwords, and certificates).
    Content Security Policy (CSP) (HTTP header security layer to detect and mitigate XSS and data injection attacks).
    Database Migrations as Code (Version-controlled scripts that manage database schema changes deterministically).
    Architecture Decision Records (ADRs) (Documenting the "why" behind architectural choices to preserve context for future maintainers).
    Static Analysis (SAST) (Analyzing code without executing it to find vulnerabilities and bugs early in the lifecycle).
    Formal Verification / TLA+ (Using mathematical proofs to verify the correctness of algorithms and system designs).
    Dead Code Elimination (Tree Shaking) (Removing unused code during the build process to minimize deployment size).
    Monorepo Tooling (Bazel/Buck) (Managing massive codebases in a single repository with unified versioning and dependency graphs).
    Remote Caching (Sharing build artifacts across the team to drastically reduce compilation times).
    Dependency Injection (Inversion of Control) (Decoupling components by providing their dependencies from the outside).
    Lazy Evaluation (Delaying the evaluation of an expression until its value is actually needed).
    Pure Functions (Functions that always produce the same output for the same input and have no side effects).
    Referential Transparency (The ability to replace an expression with its value without changing the program's behavior).
    Memoization (Caching the results of expensive function calls and returning the cached result when the same inputs occur).
    Tail Call Optimization (Compiler optimization that allows recursive functions to execute without growing the stack).
    Inter-Process Communication (IPC) via Shared Memory (Extremely fast communication between processes on the same machine).
    Epoll / Kqueue / IOCP (Scalable I/O event notification mechanisms for handling thousands of concurrent connections).
    Thundering Herd Protection (Mechanisms to prevent all processes from waking up simultaneously to handle a single event).
    False Sharing Prevention (Padding variables to ensure they don't sit on the same cache line and degrade multi-core performance).
    Compare-and-Swap (CAS) (Atomic instruction used to implement synchronization primitives without locks).
    Distributed Locks (Redlock/Chubby) (Ensuring mutually exclusive access to resources in a distributed environment).
    Leases (Time-limited locks that automatically expire to prevent deadlocks if the holder crashes).
    Geo-Replication (Replicating data across different geographical locations to reduce latency and improve disaster recovery).
    Edge Computing (Running logic closer to the user to minimize latency and bandwidth usage).
    Federated GraphQL (Aggregating multiple GraphQL services into a single unified API gateway).
    Backend for Frontend (BFF) (Creating separate backend services optimized for specific user interfaces like mobile or web).
    Server-Side Rendering (SSR) with Hydration (Pre-rendering pages on the server for performance/SEO, then attaching event listeners on the client).
    Incremental Static Regeneration (ISR) (Updating static content after deployment without a full site rebuild).
    WebAssembly (Wasm) (Running high-performance binary code (Rust/C++) in the browser alongside JavaScript).
    Service Workers (PWA) (Scripts running in the background to enable offline functionality and push notifications).
    Virtual DOM Diffing (Minimizing direct DOM manipulation by calculating changes in memory first).
    Accessibility Object Model (AOM) (Exposing accessibility information directly to assistive technology APIs).
    Internationalization (i18n) with CLDR (Using the Unicode Common Locale Data Repository for robust global support).
    Semantic Versioning (SemVer) (Strict versioning scheme to communicate compatibility and breaking changes).
    Convention over Configuration (Design paradigm that reduces the number of decisions developers need to make).
    Single Source of Truth (Ensuring every data element is mastered (or edited) in only one place).
    Separation of Concerns (Dividing a computer program into distinct sections, such that each section addresses a separate concern).
    High Cohesion / Low Coupling ( designing modules that are focused on a single task and independent of others).
    Polymorphism (The ability of different objects to respond in a unique way to the same message).
    Encapsulation (Bundling data with the methods that operate on that data, restricting direct access to some of an object's components).
    Liskov Substitution Principle (Objects of a superclass shall be replaceable with objects of its subclasses without breaking the application).
    Interface Segregation (Clients should not be forced to depend upon interfaces that they do not use).
    Dependency Inversion (High-level modules should not depend on low-level modules; both should depend on abstractions).

Here some documentation and text rules and methods to strictly follow:

Here is a list of 100 specific checks and fixes for documentation, text generation, and in-repo copy. This focuses on removing "vibecoded" fluff, hallucinations, and vague language to ensure the written word is as rigorous as the code itself.

    Remove "Simply" and "Just" from instructions (Condescending language that assumes the user's skill level and frustrates them when it fails).
    Fix broken hyperlinks in README.md (Link rot destroys credibility immediately; use a link checker).
    Replace "TODO" placeholders in documentation (If you aren't going to write the section, delete the header so it doesn't look abandoned).
    Standardize capitalization in headers (Mixing Title Case and sentence case looks amateurish and unplanned).
    Remove hardcoded API keys from example code blocks (Documentation is the most common place where secrets are accidentally leaked).
    Add a specific CONTRIBUTING.md file (Don't make contributors guess how to set up the dev environment or submit a PR).
    Clarify vague return descriptions like "returns data" (Specify the exact shape, type, and fields of the returned object).
    Remove "Works on my machine" tone from troubleshooting (Provide objective environmental requirements, not anecdotal evidence).
    Update CHANGELOG.md format to "Keep a Changelog" standards (Dates, version numbers, and categorized changes: Added, Changed, Deprecated, Removed).
    Add SECURITY.md with reporting policy (Tell researchers how to report vulnerabilities privately rather than opening public issues).
    Remove AI-generated "fluff" introductions (Delete paragraphs like "In today's fast-paced digital world..." that add zero technical value).
    Verify code snippets actually run (Documentation drift causes copy-paste examples to fail as the API evolves).
    Replace ASCII diagrams with Mermaid.js or SVG (Text-based diagrams break on mobile and are hard to edit/maintain).
    Document all environment variables in .env.example (Explain what the variable does, not just that it exists).
    Remove "master/slave" terminology (Replace with "main/replica" or "primary/secondary" to meet modern inclusive standards).
    Remove "sanity check" terminology (Replace with "validity check" or "integrity check" to avoid ableist language).
    Fix "Guys" to "Folks/Team/Everyone" (Inclusive language ensures you don't alienate non-male contributors).
    Add Alt Text to all documentation images (Documentation must be accessible to blind developers using screen readers).
    Explain the "Why", not just the "How" (Contextualize why a specific architecture was chosen, don't just list the files).
    Remove commented-out documentation (If the feature is gone, delete the docs; git history remembers).
    Standardize date formats (ISO 8601 YYYY-MM-DD is the only acceptable format to avoid US/EU confusion).
    Add a Table of Contents for documents >500 words (Deep linking is essential for navigability).
    Define all acronyms on first use (Don't assume the reader knows what "AST" or "JWT" means in your specific context).
    Remove passive voice (Use active voice: "The system sends an email" is clearer than "An email is sent by the system").
    Fix "Click here" links (Link text should describe the destination for accessibility and SEO).
    Document known limitations and edge cases (Honesty about what the software cannot do builds more trust than hype).
    Add prerequisite versions (Specify Node >= 18 or Python 3.10+, don't just say "Install Node").
    Remove "magic numbers" in comments (Explain where the number 86400 comes from; don't just write // 86400).
    Sync JSDoc/Docstrings with function signatures (If the params changed in code but not in docs, the docs are lying).
    Remove self-deprecating comments (Delete // This is a hack, sorry and replace with a technical explanation of the constraint).
    Translate "geek speak" in user-facing error messages (Users shouldn't see "NullReferenceException"; they should see "Something went wrong").
    Add expected output to CLI command examples (Show the user what success looks like so they know if they succeeded).
    Remove wildly optimistic setup times (Don't say "Setup in 5 minutes" if npm install takes 10; just say "Setup Instructions").
    Fix spelling errors in variable name explanations (Typos in documentation lead to typos in implementation).
    Document the license clearly (Ensure the LICENSE file matches the headers in source files).
    Remove "Lorem Ipsum" from screenshots (Use realistic data in documentation screenshots to provide context).
    Explain the project directory structure (Don't force a new developer to open every folder to map the project mental model).
    Add a "Troubleshooting" section (Document the top 5 most common errors and their solutions).
    Remove unused badges/shields (A "build passing" badge from a CI service you cancelled 2 years ago is misleading).
    Format JSON/YAML examples properly (Ensure indentation is correct so users can copy-paste without syntax errors).
    Define the support policy (Is this project maintained? LTS? Deprecated? Be explicit).
    Remove duplicate documentation (Don't document the API in the README and a Wiki; they will de-sync. Single Source of Truth).
    Add syntax highlighting to all code blocks (Specify the language javascript vs text for readability).
    Explain authentication flows (Don't just show the endpoint; explain how to get the Bearer token).
    Remove "witty" or "sarcastic" error messages (They aren't funny when the production server is down at 3 AM).
    Document the release process (How is a new version cut? Automated? Manual? Who has keys?).
    Add a "Glossary" for domain-specific terms (Essential if working in niche fields like fintech or biotech).
    Fix inconsistency in naming conventions in text (Don't switch between "User", "Client", and "Customer" if they mean the same thing).
    Remove reference to internal company URLs (External contributors cannot access your Jira or internal Wiki).
    Document CLI flags and arguments (--help output should be mirrored in the static docs).
    Add a visual architecture diagram (A high-level box-and-arrow chart saves 1,000 words of confusion).
    Clarify the distinction between Dev, Staging, and Prod (Document specific configurations for each environment).
    Remove "future tense" promises (Don't document features that are "coming soon" as if they are current APIs).
    Fix "dead" external links (If a library you link to is 404, remove the reference).
    Add attribution for copied code (If you pasted a StackOverflow solution, link the source in the comment for legal/context reasons).
    Document how to run tests (Explain npm test, what suites exist, and how to interpret results).
    Remove "beta" warnings from stable features (If it's been in prod for 3 years, remove the "Experimental" tag).
    Clarify "null" vs "undefined" behavior in API docs (Be precise about optional fields vs. nullable fields).
    Add a "Code of Conduct" (Standardize community behavior expectations).
    Remove informative comments that just repeat the code (Delete i++ // increments i).
    Explain "Why we didn't use X" (Documenting rejected alternatives prevents re-litigating decisions later).
    Fix grammar in "Success" messages ("Data saved successfully" is better than "Data save success").
    Document database schema changes (Explain what a migration does, don't just list the SQL).
    Remove hardcoded currency symbols in text (Use generic terms or specify if the system is multi-currency).
    Add contacts for maintainers (Who is the owner? Don't leave it to git blame).
    Clarify concurrency behavior (Document if a function is thread-safe or not).
    Remove "Update this later" notes (These are invisible technical debt; move them to the issue tracker).
    Document pagination implementation (Explain cursors, offsets, and limits clearly).
    Fix inconsistent tense (Don't mix "Click button" (imperative) and "The user clicks" (descriptive) in the same guide).
    Add "Time to Read" for long docs (Manage user expectations).
    Remove hallucinations in AI-generated comments (Verify that the AI didn't invent a method that doesn't exist).
    Document dependency reasoning (Why do we need lodash? prevent bloat).
    Fix broken "Back to top" links (Navigation frustration).
    Add explicit units to values (Is timeout: 500 milliseconds or seconds? Document it).
    Remove excessive exclamation marks (Professional technical writing is calm; "Error!!!!" is panic).
    Document how to mock external services (Help developers run the app without valid API keys for 3rd party tools).
    Clarify "Public" vs "Private" API surface (Explicitly state what is stable for consumers to use).
    Remove colloquialisms and slang (International speakers may not understand "the whole nine yards").
    Fix "copy-paste" errors in multiple files (If you duplicated a file, ensure you updated the header description).
    Document browser support targets (Explicitly state "Supports IE11" or "Modern Browsers Only").
    Remove blame-y language (Change "User failed to input" to "Input was missing").
    Add generic templates for Issue Reporting (Force structure on bug reports to get better data).
    Document the backup/restore strategy (Crucial for ops teams).
    Fix whitespace in Markdown tables (Misaligned columns are unreadable in raw text view).
    Remove "Old/New" comparison text after migration (Once the migration is done, just document the "New" way).
    Document caching strategies (Explain TTLs and cache invalidation logic).
    Add a "Quick Start" for the impatient (A minimal viable path to running the app).
    Remove referencing UI elements by color ("Click the red button" fails for colorblind users; use "Click 'Delete'").
    Document default values (If a param is optional, what value does it take if omitted?).
    Fix broken math formatting (Ensure LaTeX or formulas render correctly).
    Remove "Please" from CLI commands (Computers don't need manners; keep syntax clean).
    Document GDPR/Privacy compliance (Where is user data stored? How is it deleted?).
    Add search functionality to documentation site (If the docs are large, a search bar is mandatory).
    Remove personal opinions from docs ("I think React is bad" doesn't belong in the repo docs).
    Document how to clean/reset the environment (make clean or rm -rf dist instructions).
    Fix inconsistent bullet point styles (Don't mix dashes, asterisks, and numbers randomly).
    Add link to status page (If the service depends on an API, link to its uptime monitor).
    Remove "basically" and "essentially" (Filler words that weaken the definition).
    Document the "bus factor" (If only one person knows how to deploy, write that down as a risk).
    Final Spell Check (Run the entire codebase through a linter like CSpell to catch typos in variable names and comments).

