import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));

// The count is derived, not typed. Written by hand it went stale twice in one day.
const RULE_COUNT = readdirSync(join(HERE, '../../rules'))
    .filter(f => f.endsWith('.yaml') || f.endsWith('.yml')).length;

// Same reasoning as the rule count: the version is read, not retyped. The stats
// block on the landing page said v1.1.1 for sixteen releases.
const { version: VERSION } = JSON.parse(readFileSync(join(HERE, '../../package.json'), 'utf8'));

const SITE = 'https://fabriziosalmi.github.io/slopless/';

/**
 * The absolute URL a page is published at, for `rel="canonical"`.
 *
 * Built from the source path rather than written per page, and shaped to match
 * what VitePress emits and what the sitemap already lists: `.md` becomes
 * `.html`, and an `index` is the directory it sits in.
 */
function canonicalFor(relativePath) {
    const page = relativePath
        .replace(/\.md$/, '.html')
        .replace(/(^|\/)index\.html$/, '$1');
    return SITE + page;
}

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
        // Apple ignores an SVG icon, so this one is the same mark rasterised.
        ['link', { rel: 'apple-touch-icon', sizes: '180x180', href: '/slopless/apple-touch-icon.png' }],
        // Large previews in Google Discover. The equivalent X-Robots-Tag header
        // is not available on GitHub Pages, which serves no headers we control.
        ['meta', { name: 'robots', content: 'index, follow, max-image-preview:large' }],
    ],

    /**
     * Per-page `<head>`: a canonical URL everywhere, and the Schema.org entity
     * on the landing page, where a crawler looks for what the project *is*.
     */
    transformHead({ pageData }) {
        const tags = [
            ['link', { rel: 'canonical', href: canonicalFor(pageData.relativePath) }],
        ];

        if (pageData.relativePath !== 'index.md') return tags;

        tags.push(['script', { type: 'application/ld+json' }, JSON.stringify({
            '@context': 'https://schema.org',
            '@type': 'SoftwareApplication',
            name: 'slopless',
            description: `Static analysis for AI-slop patterns: ${RULE_COUNT} deterministic rules `
                + 'with regex, AST, semantic and type checks, auto-fix and SARIF output.',
            url: SITE,
            applicationCategory: 'DeveloperApplication',
            operatingSystem: 'Linux, macOS, Windows',
            softwareVersion: VERSION,
            codeRepository: 'https://github.com/fabriziosalmi/slopless',
            license: 'https://opensource.org/licenses/MIT',
            author: { '@type': 'Person', name: 'Fabrizio Salmi' },
            // Free, and Schema.org wants that said rather than assumed.
            offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
        })]);

        return tags;
    },
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
