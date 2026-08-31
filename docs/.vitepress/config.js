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
        nav: [
            { text: "Home", link: "/" },
            { text: "Rules", link: "/rules/" },
            { text: "Story", link: "/story" },
            { text: "Action", link: "https://github.com/marketplace/actions/slopless-static-analysis" }
        ],
        sidebar: [
            {
                text: "Project Guide",
                items: [
                    { text: "Introduction", link: "/" },
                    { text: "The bug that hid every bug", link: "/story" },
                    { text: "Contribution Guide", link: "https://github.com/fabriziosalmi/slopless" }
                ]
            },
            {
                text: "Rules",
                items: [
                    { text: "Rules Directory", link: "/rules/" }
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
