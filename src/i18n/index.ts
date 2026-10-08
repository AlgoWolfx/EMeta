import { translationRows } from "./messages";
export const languages = [
  { code: "en", name: "English", direction: "ltr" },
  { code: "de", name: "Deutsch", direction: "ltr" },
  { code: "tr", name: "Türkçe", direction: "ltr" },
  { code: "ar", name: "العربية", direction: "rtl" },
  { code: "ja", name: "日本語", direction: "ltr" },
  { code: "es", name: "Español", direction: "ltr" },
  { code: "pt", name: "Português", direction: "ltr" },
] as const;
export type Language = (typeof languages)[number]["code"];
export type Params = Record<string, string | number>;
export interface Message {
  key: string;
  params?: Params;
}
export type Translate = (key: string, params?: Params) => string;
const catalogs = languages.map(
  (_, i) =>
    new Map<string, string>(translationRows.map((row) => [row[0], row[i]])),
);
export function isLanguage(
  value: string | null | undefined,
): value is Language {
  return languages.some((l) => l.code === value);
}
export function preferredLanguage(
  search: string,
  saved?: string | null,
  browser = "en",
): Language {
  const query = new URLSearchParams(search).get("lang");
  if (isLanguage(query)) return query;
  if (isLanguage(saved)) return saved;
  const code = browser.toLowerCase().split(/[-_]/)[0];
  return isLanguage(code) ? code : "en";
}
export function translator(language: Language): Translate {
  const catalog = catalogs[languages.findIndex((l) => l.code === language)];
  return (key, params = {}) =>
    (catalog.get(key) ?? key).replace(/\{(\w+)\}/g, (token, name: string) =>
      params[name] === undefined ? token : String(params[name]),
    );
}
export function guidePath(slug: string, language: Language, base = "/") {
  return `${base}formats/${slug}/${language === "en" ? "" : `${language}/`}`;
}
