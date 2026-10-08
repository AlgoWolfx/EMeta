import { guidePath } from "../i18n";
import { useLanguage } from "../i18n/react";
import { FAQ, GUIDES } from "../seo/content";
export function SeoContent() {
  const { t, language } = useLanguage();
  return (
    <section className="seo-content" aria-labelledby="guides-heading">
      <h2 id="guides-heading">{t("Metadata removal by file type")}</h2>
      <p>
        {t(
          "Different files store private information in different places. These guides explain what EMeta removes, what it verifies and what stays.",
        )}
      </p>
      <nav aria-label={t("Format guides")}>
        <ul>
          {GUIDES.map((g) => (
            <li key={g.slug}>
              <a href={guidePath(g.slug, language, import.meta.env.BASE_URL)}>
                {t(g.title)}
              </a>
              <span dir="ltr">{g.formats}</span>
            </li>
          ))}
        </ul>
      </nav>
      <h2>{t("Common questions")}</h2>
      {FAQ.map((f) => (
        <details key={f.q}>
          <summary>{t(f.q)}</summary>
          <p>{t(f.a)}</p>
        </details>
      ))}
    </section>
  );
}
