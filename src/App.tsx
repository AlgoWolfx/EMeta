import { LanguageSelector, useLanguage } from "./i18n/react";
import type { Message } from "./i18n";
import { Diagnostic } from "./components/Diagnostic";
import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine,
  Check,
  ChevronRight,
  CircleAlert,
  FileImage,
  FolderArchive,
  Github,
  LoaderCircle,
  Moon,
  ShieldCheck,
  Sun,
  Trash2,
  X,
} from "lucide-react";
import { Dropzone } from "./components/Dropzone";
import { MetadataView } from "./components/MetadataView";
import { FilePreview } from "./components/FilePreview";
import { verifyFile } from "./verification";
import { SeoContent } from "./components/SeoContent";
import { cancelProcessing, processFile } from "./metadata/client";
import {
  FAMILY_DESCRIPTIONS,
  FAMILY_LABELS,
  type CleanResult,
  type Family,
  type Inspection,
} from "./metadata/types";
import {
  cleanName,
  download,
  downloadZip,
  MAX_BATCH_BYTES,
  MAX_FILE_BYTES,
  MAX_FILES,
} from "./files";

interface Entry {
  id: string;
  file: File;
  status: "queued" | "inspecting" | "ready" | "cleaning" | "cleaned" | "error";
  inspection?: Inspection;
  result?: CleanResult;
  output?: Blob;
  error?: string;
}
type Theme = "system" | "light" | "dark";
function initialTheme(): Theme {
  try {
    const t = localStorage.getItem("emeta-theme");
    return t === "light" || t === "dark" ? t : "system";
  } catch {
    return "system";
  }
}
const TYPES = {
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  tiff: "image/tiff",
  heic: "image/heic",
  pdf: "application/pdf",
  mp4: "video/mp4",
  mov: "video/quicktime",
  webm: "video/webm",
  mkv: "video/x-matroska",
};

export default function App() {
  const { t, message: translateMessage, bytes: formatBytes } = useLanguage();
  const [entries, setEntries] = useState<Entry[]>([]),
    [activeId, setActiveId] = useState("");
  const [theme, setTheme] = useState<Theme>(initialTheme),
    [busy, setBusy] = useState(false),
    [zipping, setZipping] = useState(false);
  const [message, setMessage] = useState<Message | string>(""),
    [alert, setAlert] = useState<Message | string>(""),
    [view, setView] = useState<"original" | "cleaned">("original");
  const [selected, setSelected] = useState<Family[]>([
    "exif",
    "iptc",
    "xmp",
    "text",
    "time",
    "other",
    "pdf-info",
    "video-tags",
  ]);
  const runToken = useRef(0),
    entriesRef = useRef(entries);
  entriesRef.current = entries;
  useEffect(() => {
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () => {
      document.documentElement.dataset.theme =
        theme === "system" ? (media.matches ? "dark" : "light") : theme;
    };
    apply();
    media.addEventListener("change", apply);
    try {
      localStorage.setItem("emeta-theme", theme);
    } catch {
      /* Preferences are optional. */
    }
    return () => media.removeEventListener("change", apply);
  }, [theme]);
  useEffect(
    () => () => {
      runToken.current++;
      cancelProcessing();
    },
    [],
  );
  const update = (id: string, changes: Partial<Entry>) =>
    setEntries((items) =>
      items.map((item) => (item.id === id ? { ...item, ...changes } : item)),
    );
  const active = entries.find((e) => e.id === activeId) ?? entries[0];
  const inspection =
    view === "cleaned" && active?.result
      ? active.result.after
      : active?.inspection;
  const eligible = entries.filter(
    (e) =>
      e.inspection?.cleanable &&
      e.inspection.families.some((f) => selected.includes(f)),
  );
  const outputs = entries.filter((e) => e.output);
  const families = [
    ...new Set(entries.flatMap((e) => e.inspection?.families ?? [])),
  ];
  const totalBytes = entries.reduce((n, e) => n + e.file.size, 0);

  async function addFiles(files: File[]) {
    if (busy || !files.length) return;
    const existing = entriesRef.current;
    if (existing.length + files.length > MAX_FILES) {
      setAlert({
        key: "Choose up to {count} files per batch. Remove some files and try again.",
        params: { count: MAX_FILES },
      });
      return;
    }
    if (
      existing.reduce((n, e) => n + e.file.size, 0) +
        files.reduce((n, f) => n + f.size, 0) >
      MAX_BATCH_BYTES
    ) {
      setAlert("This batch exceeds 200 MB. Choose fewer or smaller files.");
      return;
    }
    setAlert("");
    setBusy(true);
    const token = ++runToken.current;
    const added: Entry[] = files.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: "queued",
    }));
    setEntries([...existing, ...added]);
    if (!existing.length) setActiveId(added[0].id);
    setView("original");
    for (const [index, entry] of added.entries()) {
      if (token !== runToken.current) return;
      setMessage({
        key: "Inspecting {index} of {count}: {name}",
        params: {
          index: index + 1,
          count: added.length,
          name: entry.file.name,
        },
      });
      update(entry.id, { status: "inspecting" });
      try {
        if (!entry.file.size)
          throw new Error("This file is empty. Choose another file.");
        if (entry.file.size > MAX_FILE_BYTES)
          throw new Error("This file exceeds 50 MB. Choose a smaller file.");
        const result = await processFile(entry.file, "inspect");
        if (
          result.width &&
          result.height &&
          result.width * result.height > 40_000_000
        )
          throw new Error(
            "This image exceeds 40 megapixels. Choose a smaller image to keep browser memory use manageable.",
          );
        const preview = await verifyFile(
          new Blob([entry.file], { type: TYPES[result.format] }),
          result.format,
        );
        if (preview) result.preview = preview;
        if (token !== runToken.current) return;
        update(entry.id, { inspection: result, status: "ready" });
      } catch (error) {
        if (token !== runToken.current) return;
        update(entry.id, {
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "The file could not be read. Choose another file.",
        });
      }
    }
    setBusy(false);
    setMessage({
      key:
        added.length === 1
          ? "Inspection complete. {count} file processed locally."
          : "Inspection complete. {count} files processed locally.",
      params: { count: added.length },
    });
  }

  async function cleanFiles(targets: Entry[]) {
    if (busy || !targets.length) return;
    setBusy(true);
    setAlert("");
    const token = ++runToken.current;
    let success = 0;
    for (const [index, entry] of targets.entries()) {
      if (token !== runToken.current) return;
      setMessage({
        key: "Cleaning {index} of {count}: {name}",
        params: {
          index: index + 1,
          count: targets.length,
          name: entry.file.name,
        },
      });
      update(entry.id, { status: "cleaning", error: undefined });
      try {
        const result = await processFile(entry.file, "clean", selected);
        const output = new Blob([result.bytes.slice().buffer], {
          type: TYPES[result.after.format],
        });
        const preview = await verifyFile(
          output,
          result.after.format,
          entry.file,
        );
        if (preview) result.after.preview = preview;
        if (result.after.format === "pdf")
          result.verification =
            "Selected metadata removed; every PDF page rendered identically at verification resolution.";
        if (token !== runToken.current) return;
        update(entry.id, { result, output, status: "cleaned" });
        success++;
      } catch (error) {
        if (token !== runToken.current) return;
        update(entry.id, {
          status: "ready",
          output: undefined,
          result: undefined,
          error:
            error instanceof Error
              ? error.message
              : "Cleaning failed. No output was created.",
        });
      }
    }
    setBusy(false);
    setMessage({
      key:
        targets.length === 1
          ? "{success} of {count} file cleaned and verified. Originals are unchanged."
          : "{success} of {count} files cleaned and verified. Originals are unchanged.",
      params: { success, count: targets.length },
    });
    if (success && targets.some((e) => e.id === active?.id)) setView("cleaned");
  }

  function cancel() {
    runToken.current++;
    cancelProcessing();
    setBusy(false);
    setMessage("Processing cancelled. Completed files are still available.");
    setEntries((items) =>
      items.map((e) =>
        e.status === "cleaning"
          ? { ...e, status: e.output ? "cleaned" : "ready" }
          : ["queued", "inspecting"].includes(e.status)
            ? {
                ...e,
                status: "error",
                error:
                  "Inspection cancelled. Remove this file and add it again to retry.",
              }
            : e,
      ),
    );
  }
  function clear() {
    runToken.current++;
    cancelProcessing();
    setEntries([]);
    setActiveId("");
    setView("original");
    setAlert("");
    setMessage("Files and metadata cleared from this session.");
  }
  async function zip() {
    setZipping(true);
    setAlert("");
    try {
      await downloadZip(
        outputs.map((e) => ({ name: cleanName(e.file.name), blob: e.output! })),
      );
      setMessage({
        key: "{count} verified files downloaded as a ZIP.",
        params: { count: outputs.length },
      });
    } catch {
      setAlert(
        "The ZIP could not be created. Download individual files or try a smaller batch.",
      );
    } finally {
      setZipping(false);
    }
  }

  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        {t("Skip to workspace")}
      </a>
      <header className="site-header">
        <a
          className="brand"
          href={import.meta.env.BASE_URL}
          aria-label={t("EMeta home")}
        >
          <span className="brand-mark" aria-hidden="true">
            E
          </span>
          EMeta
          <span className="brand-description">
            {t("Metadata viewer & cleaner")}
          </span>
        </a>
        <div className="header-actions">
          <LanguageSelector />
          <a
            className="icon-button"
            href="https://github.com/AlgoWolfx/EMeta"
            target="_blank"
            rel="noreferrer"
            aria-label={t("EMeta on GitHub")}
          >
            <Github size={18} aria-hidden="true" />
          </a>
          <label className="theme-control">
            {theme === "dark" ? (
              <Moon size={16} aria-hidden="true" />
            ) : (
              <Sun size={16} aria-hidden="true" />
            )}
            <span className="sr-only">{t("Theme")}</span>
            <select
              value={theme}
              onChange={(e) => setTheme(e.target.value as Theme)}
            >
              <option value="system">{t("System")}</option>
              <option value="light">{t("Light")}</option>
              <option value="dark">{t("Dark")}</option>
            </select>
          </label>
        </div>
      </header>
      <main id="main">
        <div className="page-heading">
          <div>
            <h1>{t("Metadata viewer & cleaner")}</h1>
            <p>
              {t(
                "Inspect hidden information in your files before you share them.",
              )}
            </p>
          </div>
          <span className="local-label">
            <ShieldCheck size={16} aria-hidden="true" />
            {t("Files stay on your device")}
          </span>
        </div>
        {alert && (
          <div className="notice error" role="alert">
            <CircleAlert size={18} aria-hidden="true" />
            <p>{translateMessage(alert)}</p>
            <button
              className="icon-button"
              onClick={() => setAlert("")}
              aria-label={t("Dismiss message")}
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>
        )}
        <Dropzone
          onFiles={addFiles}
          compact={!!entries.length}
          disabled={busy || zipping}
        />
        {!entries.length && (
          <div className="empty-info">
            <section>
              <h2>{t("A small check before you share")}</h2>
              <p>
                {t(
                  "Files can include location, device details, author names and editing dates. EMeta shows those details and creates a cleaned copy.",
                )}
              </p>
            </section>
            <section>
              <h2>{t("Your content stays intact")}</h2>
              <p>
                {t(
                  "Supported cleaning preserves image and media data, PDF page content, required rotation and color profiles. You choose which metadata families to remove.",
                )}
              </p>
            </section>
          </div>
        )}
        {!!entries.length && (
          <>
            <div className="batch-toolbar">
              <p>
                <strong>
                  {t(entries.length === 1 ? "{count} file" : "{count} files", {
                    count: entries.length,
                  })}
                </strong>
                <span>{formatBytes(totalBytes)}</span>
              </p>
              <div>
                {busy ? (
                  <button className="button secondary small" onClick={cancel}>
                    <X size={15} aria-hidden="true" />
                    {t("Cancel")}
                  </button>
                ) : (
                  <button
                    className="button secondary small"
                    disabled={zipping}
                    onClick={clear}
                  >
                    <Trash2 size={15} aria-hidden="true" />
                    {t("Clear files")}
                  </button>
                )}
                {outputs.length > 1 && (
                  <button
                    className="button secondary small"
                    disabled={busy || zipping}
                    onClick={zip}
                  >
                    <FolderArchive size={15} aria-hidden="true" />
                    {zipping
                      ? t("Creating ZIP…")
                      : t("Download ZIP ({count})", { count: outputs.length })}
                  </button>
                )}
              </div>
            </div>
            <div className="workspace" aria-busy={busy}>
              <aside
                className="file-rail"
                aria-label={t("Files in this session")}
              >
                <ul>
                  {entries.map((e) => (
                    <li key={e.id}>
                      <button
                        className={`file-row ${active?.id === e.id ? "selected" : ""}`}
                        aria-current={active?.id === e.id ? "true" : undefined}
                        onClick={() => {
                          setActiveId(e.id);
                          setView("original");
                        }}
                      >
                        <FileImage size={18} aria-hidden="true" />
                        <span className="file-row-text">
                          <strong dir="auto">{e.file.name}</strong>
                          <small>
                            {e.status === "cleaned"
                              ? t("Cleaned & verified")
                              : e.status === "error" || e.error
                                ? t("Needs attention")
                                : e.status === "ready"
                                  ? e.inspection?.cleanable
                                    ? t("Ready to inspect")
                                    : t("Inspection only")
                                  : e.status === "cleaning"
                                    ? t("Cleaning…")
                                    : t("Inspecting…")}
                          </small>
                        </span>
                        {e.status === "cleaned" ? (
                          <Check
                            className="success-text"
                            size={15}
                            aria-hidden="true"
                          />
                        ) : (
                          <ChevronRight size={15} aria-hidden="true" />
                        )}
                      </button>
                      {!busy && (
                        <button
                          className="remove-file"
                          aria-label={t("Remove {name}", { name: e.file.name })}
                          onClick={() => {
                            setEntries((items) =>
                              items.filter((item) => item.id !== e.id),
                            );
                            setView("original");
                          }}
                        >
                          <X size={14} aria-hidden="true" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
                <p className="rail-note">
                  {t("Files are held only in this tab.")}
                  <br />
                  {t("Clear the session when you’re done.")}
                </p>
              </aside>
              <div className="inspection-pane">
                {active && (
                  <>
                    <div className="file-heading">
                      <div>
                        <h2 dir="auto">{active.file.name}</h2>
                        <p>
                          {inspection?.format.toUpperCase() ?? t("File")}·{" "}
                          {formatBytes(active.file.size)}
                          {inspection?.width &&
                            ` · ${inspection.width} × ${inspection.height} px`}
                        </p>
                      </div>
                      {active.result && (
                        <div
                          className="version-switch"
                          role="group"
                          aria-label={t("Compare metadata")}
                        >
                          <button
                            aria-pressed={view === "original"}
                            onClick={() => setView("original")}
                          >
                            {t("Original")}
                          </button>
                          <button
                            aria-pressed={view === "cleaned"}
                            onClick={() => setView("cleaned")}
                          >
                            {t("Cleaned")}
                          </button>
                        </div>
                      )}
                    </div>
                    {active.error && (
                      <div className="notice error" role="alert">
                        <CircleAlert size={18} aria-hidden="true" />
                        <Diagnostic text={active.error} />
                      </div>
                    )}
                    {!inspection && !active.error && (
                      <div className="loading-state">
                        <LoaderCircle size={20} aria-hidden="true" />
                        <p>{t("Reading this file locally…")}</p>
                        <div className="skeleton" />
                        <div className="skeleton short" />
                      </div>
                    )}
                    {inspection && (
                      <>
                        <div className="file-overview">
                          <FilePreview
                            blob={
                              inspection.preview
                                ? inspection.preview
                                : view === "cleaned" && active.output
                                  ? active.output
                                  : active.file
                            }
                            name={active.file.name}
                            unsupported={
                              !inspection.preview &&
                              !["jpeg", "png", "webp"].includes(
                                inspection.format,
                              )
                            }
                          />
                          <div className="privacy-summary">
                            <h3>
                              {inspection.fields.some((f) => f.sensitive)
                                ? t("Sensitive metadata found")
                                : inspection.containers.length
                                  ? t("Embedded metadata found")
                                  : t("No removable metadata found")}
                            </h3>
                            <p>
                              {inspection.fields.some(
                                (f) => f.group === "Location",
                              )
                                ? t(
                                    "Location information is attached to this file. Review it before sharing.",
                                  )
                                : t(
                                    "Review the fields below and choose what to remove.",
                                  )}
                            </p>
                            <div className="container-tags">
                              {inspection.families.map((f) => (
                                <span key={f}>{t(FAMILY_LABELS[f])}</span>
                              ))}
                            </div>
                            <small>
                              {t(
                                "Color profiles and required rotation are retained. Metadata cleaning does not hide anything visible in the file.",
                              )}
                            </small>
                            {families.length > 0 &&
                              active.inspection?.cleanable && (
                                <a className="clean-jump" href="#clean-heading">
                                  {t("Choose what to remove")}
                                </a>
                              )}
                          </div>
                        </div>
                        {inspection.warnings.map((w) => (
                          <div key={w} className="notice warning">
                            <CircleAlert size={16} aria-hidden="true" />
                            <Diagnostic text={w} warning />
                          </div>
                        ))}
                        {active.result && (
                          <div className="verification">
                            <ShieldCheck size={18} aria-hidden="true" />
                            <div>
                              <strong>{t("Cleaned copy verified")}</strong>
                              <p>
                                {t(
                                  active.result.removedContainers === 1
                                    ? "{count} selected container removed · {size} removed"
                                    : "{count} selected containers removed · {size} removed",
                                  {
                                    count: active.result.removedContainers,
                                    size: formatBytes(
                                      Math.max(0, active.result.removedBytes),
                                    ),
                                  },
                                )}
                                {active.result.preservedOrientation &&
                                  t(" · Required rotation retained")}
                              </p>
                              {active.result.verification && (
                                <Diagnostic text={active.result.verification} />
                              )}
                              <p className="comparison">
                                {t(
                                  "Metadata containers: {before} before → {after} after.",
                                  {
                                    before:
                                      active.result.before.containers.length,
                                    after:
                                      active.result.after.containers.length,
                                  },
                                )}{" "}
                                {active.result.after.containers.length
                                  ? t(
                                      "Some metadata is retained; inspect the cleaned view.",
                                    )
                                  : t("No removable containers remain.")}
                              </p>
                            </div>
                            <button
                              className="button secondary small"
                              disabled={busy}
                              onClick={() =>
                                download(
                                  active.output!,
                                  cleanName(active.file.name),
                                )
                              }
                            >
                              <ArrowDownToLine size={15} aria-hidden="true" />
                              {t("Download copy")}
                            </button>
                          </div>
                        )}
                        <MetadataView key={active.id} inspection={inspection} />
                      </>
                    )}
                  </>
                )}
              </div>
            </div>
            {families.length > 0 && (
              <section className="clean-panel" aria-labelledby="clean-heading">
                <div className="clean-description">
                  <h2 id="clean-heading" tabIndex={-1}>
                    {t("Choose what to remove")}
                  </h2>
                  <p>
                    {t(
                      "Rules apply to the original files. EXIF includes location, camera details and dates; selecting it removes that entire family.",
                    )}
                  </p>
                  <button
                    className="text-button"
                    disabled={busy}
                    onClick={() => setSelected(families)}
                  >
                    {t("Select all safe metadata")}
                  </button>
                </div>
                <div className="clean-options">
                  {families.map((f) => (
                    <label key={f}>
                      <input
                        type="checkbox"
                        checked={selected.includes(f)}
                        disabled={busy}
                        onChange={(e) =>
                          setSelected((s) =>
                            e.target.checked
                              ? [...s, f]
                              : s.filter((v) => v !== f),
                          )
                        }
                      />
                      <span>
                        <strong>{t(FAMILY_LABELS[f])}</strong>
                        <small>{t(FAMILY_DESCRIPTIONS[f])}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <div className="clean-actions">
                  <p>
                    {t(
                      "Your originals are unchanged. Cleaned copies preserve content and required display properties. Only verified output can be downloaded.",
                    )}
                  </p>
                  <div>
                    {entries.length > 1 && (
                      <button
                        className="button secondary"
                        disabled={
                          busy ||
                          !active?.inspection?.cleanable ||
                          !active.inspection.families.some((f) =>
                            selected.includes(f),
                          )
                        }
                        onClick={() => cleanFiles([active!])}
                      >
                        {t("Clean selected file")}
                      </button>
                    )}
                    <button
                      className="button primary"
                      disabled={busy || !eligible.length || zipping}
                      onClick={() => cleanFiles(eligible)}
                    >
                      <ShieldCheck size={17} aria-hidden="true" />
                      {busy
                        ? t("Processing…")
                        : entries.length > 1
                          ? t(
                              eligible.length === 1
                                ? "Clean {count} file"
                                : "Clean {count} files",
                              { count: eligible.length },
                            )
                          : t("Clean file")}
                    </button>
                  </div>
                  {entries.length > eligible.length && (
                    <small>
                      {t(
                        entries.length - eligible.length === 1
                          ? "{count} file has no selected metadata or cannot be cleaned safely."
                          : "{count} files have no selected metadata or cannot be cleaned safely.",
                        { count: entries.length - eligible.length },
                      )}
                    </small>
                  )}
                </div>
              </section>
            )}
          </>
        )}
        <p className="session-status" role="status" aria-live="polite">
          {message
            ? translateMessage(message)
            : t("Everything runs in your browser. No account. No uploads.")}
        </p>
        <details className="support-info">
          <summary>{t("Supported formats & privacy limits")}</summary>
          <div>
            <p>
              <strong>
                {t("JPEG, PNG, WebP, classic TIFF and HEIC/HEIF:")}
              </strong>{" "}
              {t(
                "local metadata cleaning with original image data preserved. HEIC pixels are independently decoded and compared; TIFF strips/tiles are preserved.",
              )}
            </p>
            <p>
              <strong>{t("PDF:")}</strong>
              {t(
                "document properties and XMP removal with a fresh rewrite and every-page render comparison. Signed, encrypted, XFA and PDFs over 50 pages are not cleaned.",
              )}
            </p>
            <p>
              <strong>{t("MP4, MOV, WebM and MKV:")}</strong>
              {t(
                "container tags and timestamps are erased without re-encoding video/audio. Timed metadata tracks and encrypted tracks require a dedicated remuxer and are refused.",
              )}
            </p>
            <p>
              <strong>{t("What stays:")}</strong>
              {t(
                "visible content, image color/rotation, video/audio, subtitles, annotations, attachments and unknown private chunks/tags. This is selected supported metadata removal, not redaction or a forensic guarantee. Fixed-size containers can stay the same size after their metadata bytes have been erased.",
              )}
            </p>
            <p>
              <strong>{t("Limits:")}</strong>{" "}
              {t(
                "{count} files per batch, 50 MB per file, 200 MB total, 40 megapixels per image, 50 PDF pages. Malformed structures and unsafe offset overlap are refused.",
                { count: MAX_FILES },
              )}
            </p>
            <p>
              <strong>{t("Privacy:")}</strong>
              {t(
                "files and parsed values stay in this tab. Only your theme and language preferences are saved locally. No analytics, remote fonts, uploads or file history. Download filenames retain the original name plus “-clean”; rename a copy if the name contains private information. Filesystem timestamps are separate from embedded metadata.",
              )}
            </p>
          </div>
        </details>
        <SeoContent />
      </main>
      <footer>
        <span>
          {t("Built by")}{" "}
          <a
            href="https://github.com/AlgoWolfx"
            target="_blank"
            rel="noreferrer"
          >
            Yiğit Bayrak
          </a>{" "}
          · EGORA Digital
        </span>
        <a
          href="https://github.com/AlgoWolfx/EMeta/blob/main/LICENSE"
          target="_blank"
          rel="noreferrer"
        >
          {t("Free & open source")}
        </a>
      </footer>
    </div>
  );
}
