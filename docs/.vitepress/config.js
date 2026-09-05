import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// The count is derived, not typed. Written by hand it went stale twice in one day.
const RULE_COUNT = readdirSync(join(dirname(fileURLToPath(import.meta.url)), '../../rules'))
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;

export default {
    appearance: 'dark',   // terminal noir: dark is the default, the toggle stays
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/slopless/favicon.svg' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'slopless: AI-written code has a smell. This catches it.' }],
        ['meta', { property: 'og:description', content: `${RULE_COUNT} deterministic rules, AST checkers, auto-fix, SARIF. Clean on itself, in CI, on every push.` }],
        ['meta', { property: 'og:image', content: 'https://fabriziosalmi.github.io/slopless/social.png' }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:image', content: 'https://fabriziosalmi.github.io/slopless/social.png' }],
    ],
    sitemap: { hostname: "https://fabriziosalmi.github.io/slopless/" },
    base: "/slopless/",   // project Pages: assets live under /slopless/, not /
    title: "slopless",
    description: `Static analysis against AI-slop code: ${RULE_COUNT} rules, AST checkers, auto-fix, SARIF. Every rule ships executable examples.`,
    themeConfig: {
        search: { provider: 'local' },
        outline: { level: [2, 3], label: 'On this page' },
        editLink: {
            pattern: 'https://github.com/fabriziosalmi/slopless/edit/main/docs/:path',
            text: 'Edit this page on GitHub'
        },
        lastUpdated: { text: 'Updated' },
        nav: [
            { text: "Rules", link: "/rules/" },
            { text: "Languages", link: "/languages" },
            { text: "Configuration", link: "/configuration" },
            { text: "Editor", link: "/editor" },
            { text: "Story", link: "/story" },
            { text: "Changelog", link: "/changelog" },
            { text: "Action", link: "https://github.com/marketplace/actions/slopless-static-analysis" }
        ],
        sidebar: [
            {
                text: "Getting started",
                items: [
                    { text: "What slopless is", link: "/" },
                    { text: "What reaches which language", link: "/languages" },
                            { text: "Configuration", link: "/configuration" },
                    { text: "In the editor, and while writing", link: "/editor" },
                    { text: "Writing a rule", link: "/writing-a-rule" }
                ]
            },
            {
                text: "Reference",
                items: [
                    { text: `All ${RULE_COUNT} rules`, link: "/rules/" }
                ]
            },
            {
                text: "Background",
                items: [
                    { text: "The bug that hid every bug", link: "/story" },
                    { text: "Changelog", link: "/changelog" }
                ]
            }
        ],
        socialLinks: [
            { icon: "github", link: "https://github.com/fabriziosalmi/slopless" }
        ],
        footer: {
            message: 'Released under the MIT License.',
            copyright: 'Copyright © 2026-present Slopless Contributors'
        }
    }
}
