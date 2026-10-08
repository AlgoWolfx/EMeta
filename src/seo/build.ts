import type { Plugin } from "vite";
import { FAQ, GUIDES, ROOT_TITLE, ROOT_DESCRIPTION } from "./content";
import { languages, translator, guidePath, type Language } from "../i18n";
export const escapeHtml = (s: string) =>
  s.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
export function siteConfig(input = "") {
  if (!input) return { site: "", base: "/" };
  const url = new URL(input);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    url.search ||
    url.hash
  )
    throw new Error(
      "VITE_SITE_URL must be a full HTTPS deployment URL without credentials, query or fragment.",
    );
  const base = url.pathname.replace(/\/$/, "") + "/";
  return { site: url.origin + base, base };
}
const json = (value: unknown) => JSON.stringify(value).replace(/</g, "\\u003c");
const faqHtml = (language: Language = "en") => {
  const t = translator(language);
  return `<h2>${escapeHtml(t("Common questions"))}</h2>${FAQ.map((f) => `<details><summary>${escapeHtml(t(f.q))}</summary><p>${escapeHtml(t(f.a))}</p></details>`).join("")}`;
};
function guidesHtml(base: string, language: Language = "en") {
  const t = translator(language);
  return `<section class="seo-content"><h2>${escapeHtml(t("Metadata removal by file type"))}</h2><p>${escapeHtml(t("Review what EMeta removes, what it verifies and what stays."))}</p><nav aria-label="${escapeHtml(t("Format guides"))}"><ul>${GUIDES.map((g) => `<li><a href="${escapeHtml(guidePath(g.slug, language, base))}">${escapeHtml(t(g.title))}</a><span dir="ltr">${g.formats}</span></li>`).join("")}</ul></nav>${faqHtml(language)}</section>`;
}
export function seoPlugin(siteInput: string): Plugin {
  const { site, base } = siteConfig(siteInput),
    robots = site ? "index,follow" : "noindex,nofollow";
  function schema(path = "", language: Language = "en") {
    const t = translator(language);
    return {
      "@context": "https://schema.org",
      "@type": "WebApplication",
      name: "EMeta",
      url: site ? site + path : undefined,
      inLanguage: language,
      applicationCategory: "UtilitiesApplication",
      operatingSystem: "Web browser",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      license: "https://github.com/AlgoWolfx/EMeta/blob/main/LICENSE",
      author: {
        "@type": "Person",
        name: "Yiğit Bayrak",
        url: "https://github.com/AlgoWolfx",
      },
      featureList: [
        t("Metadata viewer & cleaner"),
        ...GUIDES.map((g) => t(g.title)),
      ],
    };
  }
  function head(
    title: string,
    description: string,
    path = "",
    language: Language = "en",
  ) {
    return `<meta name="description" content="${escapeHtml(description)}"><meta name="robots" content="${robots}"><meta property="og:type" content="website"><meta property="og:site_name" content="EMeta"><meta property="og:title" content="${escapeHtml(title)}"><meta property="og:description" content="${escapeHtml(description)}"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="${escapeHtml(title)}"><meta name="twitter:description" content="${escapeHtml(description)}">${site ? `<link rel="canonical" href="${escapeHtml(site + path)}"><meta property="og:url" content="${escapeHtml(site + path)}">` : ""}<script type="application/ld+json">${json(schema(path, language))}</script>`;
  }
  return {
    name: "emeta-static-seo",
    transformIndexHtml(html) {
      return html
        .replace(
          /<title>[\s\S]*?<\/title>/,
          `<title>${escapeHtml(ROOT_TITLE)}</title>`,
        )
        .replace(/<meta\s+name="description"[\s\S]*?\/>/, "")
        .replace(
          "</head>",
          head(ROOT_TITLE, ROOT_DESCRIPTION) +
            `<script type="application/ld+json">${json({ "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQ.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) })}</script></head>`,
        )
        .replace(
          '<div id="root"></div>',
          `<div id="root"><div class="app-shell"><header class="site-header"><a class="brand" href="${base}">EMeta</a></header><main><div class="page-heading"><div><h1>Metadata viewer &amp; cleaner</h1><p>Inspect hidden information in your files before you share them.</p></div></div><p>Local image, HEIC/HEIF, PDF and video metadata cleaning. Free and open source; files stay on your device.</p><noscript><p>File processing needs JavaScript. You can still read the supported format guides and privacy limits below.</p></noscript>${guidesHtml(base)}</main></div></div>`,
        );
    },
    generateBundle() {
      const paths = [""];
      for (const g of GUIDES)
        for (const language of languages) {
          const t = translator(language.code),
            path = guidePath(g.slug, language.code, ""),
            app = base + `?lang=${language.code}`;
          paths.push(path);
          const breadcrumbs = site
            ? `<script type="application/ld+json">${json({
                "@context": "https://schema.org",
                "@type": "BreadcrumbList",
                itemListElement: [
                  {
                    "@type": "ListItem",
                    position: 1,
                    name: "EMeta",
                    item: site,
                  },
                  {
                    "@type": "ListItem",
                    position: 2,
                    name: t(g.title),
                    item: site + path,
                  },
                ],
              })}</script>`
            : "";
          const alternates = site
            ? [
                ...languages.map(
                  (l) =>
                    `<link rel="alternate" hreflang="${l.code}" href="${escapeHtml(site + guidePath(g.slug, l.code, ""))}">`,
                ),
                `<link rel="alternate" hreflang="x-default" href="${escapeHtml(site + guidePath(g.slug, "en", ""))}">`,
              ].join("")
            : "";
          const switcher = `<nav class="guide-languages" aria-label="${escapeHtml(t("Choose language"))}">${languages.map((l) => `<a href="${escapeHtml(guidePath(g.slug, l.code, base))}" lang="${l.code}" dir="${l.direction}"${l.code === language.code ? ' aria-current="page"' : ""}>${l.name}</a>`).join("")}</nav>`;
          const html = `<!doctype html><html lang="${language.code}" dir="${language.direction}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${escapeHtml(t(g.title))} — EMeta</title>${head(t(g.title) + " — EMeta", t(g.description), path, language.code)}${breadcrumbs}${alternates}<link rel="icon" href="${base}favicon.svg"><link rel="stylesheet" href="${base}guide.css"></head><body><div class="guide-shell"><header><a href="${app}" dir="ltr">EMeta</a><a href="${app}">${escapeHtml(t("Open metadata cleaner"))}</a></header>${switcher}<main><article><nav aria-label="${escapeHtml(t("Breadcrumb"))}"><a href="${app}">EMeta</a> / <bdi dir="ltr">${g.formats}</bdi></nav><h1>${escapeHtml(t(g.title))}</h1><p>${escapeHtml(t(g.description))}</p><h2>${escapeHtml(t("How cleaning works"))}</h2><p>${escapeHtml(t(g.body))}</p><h2>${escapeHtml(t("Limits to review"))}</h2><p>${escapeHtml(t(g.limits))}</p><a class="action" href="${app}">${escapeHtml(t("Inspect your files locally"))}</a>${guidesHtml(base, language.code)}</article></main><footer><span>${escapeHtml(t("Built by"))} <bdi>Yiğit Bayrak · EGORA Digital</bdi></span><a href="https://github.com/AlgoWolfx/EMeta">${escapeHtml(t("Free & open source"))}</a></footer></div></body></html>`;
          this.emitFile({
            type: "asset",
            fileName: path + "index.html",
            source: html,
          });
        }
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: site
          ? `User-agent: *\nAllow: /\nSitemap: ${site}sitemap.xml\n`
          : "User-agent: *\nDisallow: /\n",
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${site ? paths.map((path) => `<url><loc>${escapeHtml(site + path)}</loc></url>`).join("") : ""}</urlset>`,
      });
    },
  };
}
