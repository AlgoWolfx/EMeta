import {
  createContext,
  useContext,
  useEffect,
  useState,
  useMemo,
  type ReactNode,
} from "react";
import {
  languages,
  isLanguage,
  preferredLanguage,
  translator,
  type Language,
  type Translate,
  type Message,
} from ".";
import { FAQ, GUIDES, ROOT_TITLE, ROOT_DESCRIPTION } from "../seo/content";
function initialLanguage() {
  let saved: string | null = null;
  try {
    saved = localStorage.getItem("emeta-language");
  } catch {
    /* Optional preference. */
  }
  return preferredLanguage(location.search, saved, navigator.language);
}
const Context = createContext<{
  language: Language;
  setLanguage: (language: Language) => void;
  t: Translate;
  message: (value: Message | string) => string;
  bytes: (n: number) => string;
} | null>(null);
export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState(initialLanguage),
    t = useMemo(() => translator(language), [language]);
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = languages.find(
      (l) => l.code === language,
    )!.direction;
    document.title =
      language === "en"
        ? ROOT_TITLE
        : `${t("Metadata viewer & cleaner")} — EMeta`;
    for (const selector of [
      'meta[property="og:title"]',
      'meta[name="twitter:title"]',
    ])
      document.querySelector(selector)?.setAttribute("content", document.title);
    for (const selector of [
      'meta[name="description"]',
      'meta[property="og:description"]',
      'meta[name="twitter:description"]',
    ])
      document
        .querySelector(selector)
        ?.setAttribute("content", t(ROOT_DESCRIPTION));
    for (const script of document.querySelectorAll(
      'script[type="application/ld+json"]',
    )) {
      try {
        const schema = JSON.parse(script.textContent ?? "{}");
        if (schema["@type"] === "WebApplication") {
          schema.inLanguage = language;
          schema.featureList = [
            t("Metadata viewer & cleaner"),
            ...GUIDES.map((g) => t(g.title)),
          ];
          script.textContent = JSON.stringify(schema).replace(/</g, "\\u003c");
        } else if (schema["@type"] === "FAQPage") {
          schema.mainEntity = FAQ.map((f) => ({
            "@type": "Question",
            name: t(f.q),
            acceptedAnswer: { "@type": "Answer", text: t(f.a) },
          }));
          script.textContent = JSON.stringify(schema).replace(/</g, "\\u003c");
        }
      } catch {
        /* Preserve unrelated schema. */
      }
    }
    try {
      localStorage.setItem("emeta-language", language);
    } catch {
      /* Optional preference. */
    }
    const url = new URL(location.href);
    if (language === "en") url.searchParams.delete("lang");
    else url.searchParams.set("lang", language);
    if (url.href !== location.href) history.replaceState(null, "", url);
  }, [language, t]);
  const value = useMemo(
    () => ({
      language,
      setLanguage,
      t,
      message: (value: Message | string) =>
        typeof value === "string" ? t(value) : t(value.key, value.params),
      bytes: (n: number) => {
        const divisor = n < 1024 ? 1 : n < 1024 * 1024 ? 1024 : 1024 * 1024;
        return `${new Intl.NumberFormat(language, { minimumFractionDigits: divisor === 1 ? 0 : 1, maximumFractionDigits: divisor === 1 ? 0 : 1 }).format(n / divisor)} ${divisor === 1 ? "B" : divisor === 1024 ? "KB" : "MB"}`;
      },
    }),
    [language, t],
  );
  return <Context.Provider value={value}>{children}</Context.Provider>;
}
export function useLanguage() {
  const context = useContext(Context);
  if (!context) throw new Error("LanguageProvider required");
  return context;
}
export function LanguageSelector() {
  const { language, setLanguage, t } = useLanguage();
  return (
    <select
      className="language-select"
      aria-label={t("Language")}
      value={language}
      onChange={(e) => {
        if (isLanguage(e.target.value)) setLanguage(e.target.value);
      }}
    >
      {languages.map((l) => (
        <option key={l.code} value={l.code} lang={l.code} dir={l.direction}>
          {l.name}
        </option>
      ))}
    </select>
  );
}
