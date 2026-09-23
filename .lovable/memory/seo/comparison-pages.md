---
name: Comparison pages
description: SEO comparison pages at /compare hub + /compare/agevers-vs-g2a, /compare/agevers-vs-cdkeys with FAQ + Breadcrumb JSON-LD, shared ComparePageLayout component, included in sitemap and footer
type: feature
---
**Pages**: /compare (hub), /compare/agevers-vs-g2a, /compare/agevers-vs-cdkeys.
**Shared layout**: src/pages/compare/ComparePageLayout.tsx — props: competitor, rows, pros lists, when-to-choose copy, verdict, FAQs. Emits FAQPage + BreadcrumbList JSON-LD, OG/canonical meta.
**Tone**: biased toward Agever's but credible — lists genuine competitor advantages.
**Wired**: App.tsx routes, Footer "Compare Stores" link, sitemap-xml STATIC_PAGES entries.
**Add new**: create file in src/pages/compare/, register route, add to comparisons array in Compare.tsx, add to sitemap.
