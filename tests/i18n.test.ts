import { test, expect } from "vitest";
import {
  languages,
  preferredLanguage,
  translator,
  guidePath,
} from "../src/i18n";
import { translationRows } from "../src/i18n/messages";
import { FAQ, GUIDES, ROOT_DESCRIPTION } from "../src/seo/content";
import { seoPlugin } from "../src/seo/build";
test("same seven language codes as EQR; Chinese falls back to English", () => {
  expect(languages.map((l) => l.code)).toEqual([
    "en",
    "de",
    "tr",
    "ar",
    "ja",
    "es",
    "pt",
  ]);
  expect(preferredLanguage("", null, "zh-CN")).toBe("en");
  expect(preferredLanguage("", null, "pt-BR")).toBe("pt");
  expect(preferredLanguage("?lang=ar", "de", "tr-TR")).toBe("ar");
  expect(preferredLanguage("?lang=unknown", "ja", "es-MX")).toBe("ja");
});
test("every catalogue preserves parameter names, including file names and sizes", () => {
  expect(new Set(translationRows.map((r) => r[0])).size).toBe(
    translationRows.length,
  );
  const tokens = (v: string) =>
    [...v.matchAll(/\{(\w+)\}/g)].map((x) => x[1]).sort();
  for (const row of translationRows)
    for (const value of row) {
      expect(value.length).toBeGreaterThan(0);
      expect(tokens(value), row[0]).toEqual(tokens(row[0]));
    }
  for (const l of languages) {
    const name = "metadata-${count}-秘密-مرحبا.jpg";
    expect(translator(l.code)("Remove {name}", { name })).toContain(name);
  }
});
test("all visible FAQ and guide content has full localized entries", () => {
  const keys = new Set<string>(translationRows.map((r) => r[0]));
  for (const text of [
    ROOT_DESCRIPTION,
    ...FAQ.flatMap((f) => [f.q, f.a]),
    ...GUIDES.flatMap((g) => [g.title, g.description, g.body, g.limits]),
  ])
    expect(keys.has(text), text).toBe(true);
});
test("locale guides have self canonical, all hreflang alternates and translated navigation", () => {
  const files: Record<string, string> = {};
  (
    seoPlugin("https://example.com/tools/emeta/").generateBundle as Function
  ).call({
    emitFile: (a: { fileName: string; source: string }) =>
      (files[a.fileName] = a.source),
  });
  for (const language of languages)
    for (const guide of GUIDES) {
      const path = guidePath(guide.slug, language.code, ""),
        html = files[path + "index.html"];
      expect(html).toContain(
        `<html lang="${language.code}" dir="${language.direction}">`,
      );
      expect(html).toContain(`href="https://example.com/tools/emeta/${path}"`);
      expect(html).toContain(translator(language.code)(guide.body));
      for (const alternate of languages)
        expect(html).toContain(`hreflang="${alternate.code}"`);
    }
  expect([...files["sitemap.xml"].matchAll(/<loc>/g)]).toHaveLength(29);
});
