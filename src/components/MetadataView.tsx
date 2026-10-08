import { useLanguage } from "../i18n/react";
import { useState } from "react";
import { MapPin, Code2, List, Search } from "lucide-react";
import type { Group, Inspection } from "../metadata/types";
const ORDER: Group[] = [
  "Document",
  "Container",
  "Location",
  "Camera & device",
  "Date & time",
  "Creator & copyright",
  "Software",
  "Image",
  "EXIF",
  "IPTC",
  "XMP",
  "Text",
];
const fieldLabel = (key: string) =>
  key.replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_:]/g, " ");
export function MetadataView({ inspection }: { inspection: Inspection }) {
  const { t } = useLanguage();
  const [raw, setRaw] = useState(false),
    [query, setQuery] = useState("");
  const fields = inspection.fields.filter((f) =>
    `${f.key} ${f.value}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <section className="metadata-section" aria-label={t("Metadata details")}>
      <div className="section-heading">
        <h2>{t("Metadata")}</h2>
        <button
          className="button small secondary"
          onClick={() => setRaw(!raw)}
          aria-pressed={raw}
        >
          {raw ? (
            <List size={15} aria-hidden="true" />
          ) : (
            <Code2 size={15} aria-hidden="true" />
          )}
          {raw ? t("Grouped view") : t("Raw view")}
        </button>
      </div>
      <label className="search">
        <Search size={16} aria-hidden="true" />
        <span className="sr-only">{t("Filter metadata")}</span>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("Find a field or value…")}
        />
      </label>
      {raw ? (
        <pre
          className="raw-view"
          tabIndex={0}
          dir="ltr"
          lang="en"
          aria-label={t("Raw metadata")}
        >
          {JSON.stringify(
            fields.map((f) => ({ key: f.key, value: f.value, group: f.group })),
            null,
            2,
          )}
        </pre>
      ) : (
        <div className="metadata-groups">
          {ORDER.map((group) => {
            const values = fields.filter((f) => f.group === group);
            if (!values.length) return null;
            return (
              <div className="metadata-group" key={group}>
                <h3>
                  {group === "Location" && (
                    <MapPin size={14} aria-hidden="true" />
                  )}
                  {t(group)}
                  <span>{values.length}</span>
                </h3>
                <dl>
                  {values.map((f, i) => (
                    <div
                      key={`${f.key}-${i}`}
                      className={f.sensitive ? "sensitive-field" : ""}
                    >
                      <dt>{t(fieldLabel(f.key))}</dt>
                      <dd>
                        <bdi dir="auto">{f.value}</bdi>
                        {f.sensitive && (
                          <span className="sensitive-label">
                            {t("Sensitive")}
                          </span>
                        )}
                      </dd>
                    </div>
                  ))}
                </dl>
              </div>
            );
          })}
          {!fields.length && (
            <p className="muted">
              {t("No fields match “{query}”. Try another search.", { query })}
            </p>
          )}
        </div>
      )}
    </section>
  );
}
