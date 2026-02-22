export default {
    title: "Slopless Docs",
    description: "Static Analysis Documentation",
    themeConfig: {
        nav: [
            { text: "Home", link: "/" },
            { text: "Rules Reference", link: "/rules/" }
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
