export default {
    appearance: 'dark',   // terminal noir: dark is the default, the toggle stays
    head: [
        ['link', { rel: 'icon', type: 'image/svg+xml', href: '/slopless/favicon.svg' }],
        ['meta', { property: 'og:type', content: 'website' }],
        ['meta', { property: 'og:title', content: 'slopless — AI-written code has a smell. This catches it.' }],
        ['meta', { property: 'og:description', content: '147 deterministic rules, AST checkers, auto-fix, SARIF. Clean on itself, in CI, on every push.' }],
        ['meta', { property: 'og:image', content: 'https://fabriziosalmi.github.io/slopless/social.png' }],
        ['meta', { name: 'twitter:card', content: 'summary_large_image' }],
        ['meta', { name: 'twitter:image', content: 'https://fabriziosalmi.github.io/slopless/social.png' }],
    ],
    sitemap: { hostname: "https://fabriziosalmi.github.io/slopless/" },
    base: "/slopless/",   // project Pages: assets live under /slopless/, not /
    title: "slopless",
    description: "Static analysis against AI-slop code — 147 rules, AST checkers, auto-fix, SARIF. Every rule ships executable examples.",
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
            { text: "Configuration", link: "/configuration" },
            { text: "Story", link: "/story" },
            { text: "Changelog", link: "/changelog" },
            { text: "Action", link: "https://github.com/marketplace/actions/slopless-static-analysis" }
        ],
        sidebar: [
            {
                text: "Getting started",
                items: [
                    { text: "What slopless is", link: "/" },
                    { text: "Configuration", link: "/configuration" },
                    { text: "Writing a rule", link: "/writing-a-rule" }
                ]
            },
            {
                text: "Reference",
                items: [
                    { text: "All 147 rules", link: "/rules/" }
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
