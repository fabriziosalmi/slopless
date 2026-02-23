# Security Policy

## Supported Versions

Only the latest published version of slopless receives security fixes.

## Reporting a Vulnerability

Do not open a public GitHub issue for security vulnerabilities.

Report vulnerabilities privately by emailing the maintainers or by using GitHub's
[private vulnerability reporting](https://docs.github.com/en/code-security/security-advisories/guidance-on-reporting-and-writing/privately-reporting-a-security-vulnerability) feature.

Include in your report:

- A description of the vulnerability and its potential impact
- Steps to reproduce, including a minimal code sample if applicable
- The version of slopless affected

We aim to acknowledge reports within 48 hours and provide a fix or mitigation within 14 days for
confirmed critical issues.

## Scope

slopless is a static analysis CLI tool that reads source files from the local filesystem.
It does not make outbound network connections except for the optional `link-checker` heuristic
(VBC-401), which performs HTTP HEAD requests against URLs found in Markdown files.

If you discover that slopless can be made to execute arbitrary code, exfiltrate data, or
escalate privileges when run against a malicious repository, that is in scope.
