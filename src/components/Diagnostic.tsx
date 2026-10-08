import { useLanguage } from "../i18n/react";
export function Diagnostic({
  text,
  warning = false,
}: {
  text: string;
  warning?: boolean;
}) {
  const { language, t } = useLanguage();
  const translated = t(text);
  if (language === "en" || translated !== text) return <p>{translated}</p>;
  const key = warning
    ? "Some metadata needs review. See the format and preservation details."
    : /verification|changed|remains|payload/i.test(text)
      ? "Verification failed. No download was created."
      : /safely|unsupported|not supported|cannot|disabled|encrypted/i.test(text)
        ? "This file cannot be cleaned safely. Review its format limits."
        : "The file structure is damaged or unsupported. Try another file.";
  return (
    <div className="diagnostic">
      <p>{t(key)}</p>
      <details>
        <summary>{t("Technical details (English)")}</summary>
        <p lang="en" dir="ltr">
          {text}
        </p>
      </details>
    </div>
  );
}
