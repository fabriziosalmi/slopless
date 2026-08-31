export default {
    appearance: 'dark',   // terminal noir: dark is the default, the toggle stays
    head: [['link', { rel: 'icon', type: 'image/svg+xml', href: '/slopless/favicon.svg' }]],
    base: "/slopless/",   // project Pages: assets live under /slopless/, not /
    title: "slopless",
    description: "Static analysis against AI-slop code — 146 rules, AST checkers, auto-fix, SARIF.",
    themeConfig: {
        nav: [
            { text: "Home", link: "/" },
            { text: "Rules", link: "/rules/" },
            { text: "Action", link: "https://github.com/marketplace/actions/slopless-static-analysis" }
        ],
        sidebar: [
            {
                text: "Project Guide",
                items: [
                    { text: "Introduction", link: "/" },
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
            message: 'Released under the ISC License.',
            copyright: 'Copyright © 2026-present Slopless Contributors'
        }
    }
}
