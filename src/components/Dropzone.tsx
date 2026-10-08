import { useLanguage } from "../i18n/react";
import { FilePlus2, Upload } from "lucide-react";
import { useRef, useState } from "react";
export function Dropzone({
  onFiles,
  compact,
  disabled,
}: {
  onFiles: (files: File[]) => void;
  compact: boolean;
  disabled: boolean;
}) {
  const { t } = useLanguage();
  const input = useRef<HTMLInputElement>(null),
    [dragging, setDragging] = useState(false);
  return (
    <div
      className={`dropzone ${compact ? "compact" : ""} ${dragging ? "dragging" : ""}`}
      onDragOver={(e) => {
        e.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={(e) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node))
          setDragging(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        if (!disabled) onFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <input
        ref={input}
        type="file"
        multiple
        accept="image/jpeg,image/png,image/webp,image/tiff,image/heic,image/heif,application/pdf,video/mp4,video/quicktime,video/webm,video/x-matroska,.tif,.tiff,.heic,.heif,.pdf,.mp4,.mov,.m4v,.webm,.mkv"
        aria-label={t("Select files")}
        disabled={disabled}
        onChange={(e) => {
          onFiles(Array.from(e.target.files ?? []));
          e.target.value = "";
        }}
      />
      {!compact && <Upload size={28} strokeWidth={1.5} aria-hidden="true" />}
      <div>
        <h2>
          {compact ? t("Add more files") : t("See what your files reveal")}
        </h2>
        <p>
          {compact
            ? t("Drop files here or choose from your device.")
            : t(
                "Drop your files here to inspect location, camera details, document properties and other embedded information.",
              )}
        </p>
      </div>
      <button
        className={compact ? "button secondary" : "button primary"}
        disabled={disabled}
        onClick={() => input.current?.click()}
      >
        <FilePlus2 size={16} aria-hidden="true" />
        {t("Choose files")}
      </button>
      {!compact && (
        <p className="formats">
          {t("Images · HEIC/HEIF · PDF · MP4/MOV · WebM/MKV")}
        </p>
      )}
    </div>
  );
}
