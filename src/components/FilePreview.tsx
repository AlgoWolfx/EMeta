import { useLanguage } from "../i18n/react";
import { ImageOff } from "lucide-react";
import { useEffect, useState } from "react";
export function FilePreview({
  blob,
  name,
  unsupported,
}: {
  blob: Blob;
  name: string;
  unsupported: boolean;
}) {
  const { t } = useLanguage();
  const [url, setUrl] = useState(""),
    [failed, setFailed] = useState(false);
  useEffect(() => {
    if (unsupported) return;
    const objectUrl = URL.createObjectURL(blob);
    setUrl(objectUrl);
    setFailed(false);
    return () => URL.revokeObjectURL(objectUrl);
  }, [blob, unsupported]);
  return (
    <div className="image-preview">
      {unsupported || failed ? (
        <div className="preview-fallback">
          <ImageOff size={24} aria-hidden="true" />
          <span>{t("Preview unavailable")}</span>
          <small>{t("You can still inspect the metadata.")}</small>
        </div>
      ) : (
        url && (
          <img
            src={url}
            alt={t("Preview of {name}", { name })}
            onError={() => setFailed(true)}
          />
        )
      )}
    </div>
  );
}
