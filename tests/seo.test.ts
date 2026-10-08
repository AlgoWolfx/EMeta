import { describe, test, expect } from "vitest";
import { seoPlugin, siteConfig } from "../src/seo/build";
import { GUIDES, FAQ } from "../src/seo/content";
const template =
  '<html><head><title>old</title><meta name="description" content="old" /></head><body><div id="root"></div></body></html>';
function transform(site: string) {
  return (seoPlugin(site).transformIndexHtml as Function)(template);
}
function emit(site: string) {
  const files: Record<string, string> = {};
  (seoPlugin(site).generateBundle as Function).call({
    emitFile: (a: { fileName: string; source: string }) =>
      (files[a.fileName] = a.source),
  });
  return files;
}
test("crawler sees real headings, format links and FAQ without JavaScript", () => {
  const html = transform("");
  expect(html).toContain("<h1>Metadata viewer");
  for (const g of GUIDES) expect(html).toContain(`/formats/${g.slug}/`);
  for (const f of FAQ) expect(html).toContain(f.q);
  const scripts = [
    ...html.matchAll(/type="application\/ld\+json">(.*?)<\/script>/g),
  ];
  expect(scripts).toHaveLength(2);
  for (const s of scripts) expect(() => JSON.parse(s[1])).not.toThrow();
});
test("unknown deployment omits canonical and blocks premature indexing", () => {
  const html = transform(""),
    files = emit("");
  expect(html).toContain("noindex,nofollow");
  expect(html).not.toContain('rel="canonical"');
  expect(files["robots.txt"]).toContain("Disallow: /");
  expect(files["sitemap.xml"]).not.toContain("<loc>");
});
test("configured subpath gets correct canonical, sitemap and real guide pages", () => {
  const site = "https://example.com/tools/emeta";
  expect(siteConfig(site).base).toBe("/tools/emeta/");
  const html = transform(site),
    files = emit(site);
  expect(html).toContain('href="https://example.com/tools/emeta/"');
  expect(html).toContain("index,follow");
  for (const g of GUIDES) {
    expect(files[`formats/${g.slug}/index.html`]).toContain(
      `<h1>${g.title}</h1>`,
    );
    expect(files["sitemap.xml"]).toContain(
      `https://example.com/tools/emeta/formats/${g.slug}/`,
    );
  }
  expect(files["robots.txt"]).toContain(
    "https://example.com/tools/emeta/sitemap.xml",
  );
});
test.each([
  "http://example.com",
  "https://user:password@example.com",
  "https://example.com/?secret=x",
  "https://example.com/#private",
])("unsafe/ambiguous deployment URL rejected: %s", (site) =>
  expect(() => siteConfig(site)).toThrow(),
);
