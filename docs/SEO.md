# Static SEO and deployment address

The build outputs crawlable English root HTML and 28 standalone guide pages: four format guides (`formats/heic/`, `formats/pdf/`, `formats/video/`, `formats/images/`) in seven languages. English keeps those paths; translated guides use a language suffix such as `formats/pdf/tr/`. Each guide includes translated titles/descriptions, Open Graph/Twitter fields, WebApplication structured data, navigation and FAQs. Deployment builds include self-canonical URLs, seven `hreflang` alternates plus English `x-default`, guide breadcrumbs, robots.txt and sitemap.xml. All guides work without JavaScript; file processing requires JavaScript.

The app language selector updates its visible copy, page title, description/social metadata and WebApplication/FAQ schema together. App query parameters select a language but canonicalize to the app root; translated format guides are the separately crawlable language URLs. Guide links back to the app explicitly select the current language, including English.

The public address is configurable, as requested. Copy `.env.example` to `.env.local` and set **VITE_SITE_URL** to the exact HTTPS deployment root, with an optional hosting subpath, then rebuild:

```sh
VITE_SITE_URL=https://your-domain.example/tools/emeta/ npm run build
```

This example is not a deployed address. The setting controls Vite asset base, home/guide links, canonical/og:url, breadcrumb URLs and sitemap locations together. Credentials, queries, fragments and non-HTTPS URLs are refused. No secrets are needed.

Until a real address is set, builds use `noindex,nofollow`, omit canonical/alternate URLs, disallow crawling and emit an empty sitemap. Setting the address produces indexable metadata and a 29-page sitemap (root plus 28 guides). A subpath site should serve the emitted robots policy at the origin's `/robots.txt` (merging existing rules) and point to the subpath sitemap; crawlers do not discover robots.txt under a subpath by default.

Deploy `dist/` with directory index resolution so every guide URL serves its own HTML. Verify the final canonical address, assets, guide responses, root robots rules and sitemap after deployment. Submit the sitemap to the search engine's webmaster console when the site is live. These are technical SEO improvements, not a ranking guarantee or evidence of public indexing.
