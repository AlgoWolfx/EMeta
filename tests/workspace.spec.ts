import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
const path = (name: string) => resolve("tests/fixtures", name);
async function upload(page: Page, names: string[]) {
  await page.locator("input[type=file]").setInputFiles(names.map(path));
  await expect(page.getByRole("status")).toContainText("Inspection complete");
}
async function pixels(page: Page, bytes: Uint8Array) {
  return page.evaluate(async (numbers) => {
    const image = await createImageBitmap(new Blob([new Uint8Array(numbers)]));
    const canvas = document.createElement("canvas");
    canvas.width = image.width;
    canvas.height = image.height;
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(image, 0, 0);
    image.close();
    return {
      width: canvas.width,
      height: canvas.height,
      rgba: Array.from(
        ctx.getImageData(0, 0, canvas.width, canvas.height).data,
      ),
    };
  }, Array.from(bytes));
}
test("empty workspace is usable by keyboard and explains actual limits", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveTitle(/EMeta/);
  await page.keyboard.press("Tab");
  await expect(
    page.getByRole("link", { name: "Skip to workspace" }),
  ).toBeFocused();
  await page.getByText("Supported formats & privacy limits").click();
  await expect(
    page.getByText(/JPEG, PNG, WebP, classic TIFF and HEIC\/HEIF:/),
  ).toBeVisible();
  await expect(
    page.getByText(/No analytics, remote fonts, uploads or file history/),
  ).toBeVisible();
});
for (const name of [
  "orientation-1.jpg",
  "orientation-2.jpg",
  "orientation-3.jpg",
  "orientation-4.jpg",
  "orientation-5.jpg",
  "orientation-6.jpg",
  "orientation-7.jpg",
  "orientation-8.jpg",
  "metadata.png",
  "metadata.webp",
  "rotated.webp",
]) {
  test(`${name}: actual downloaded copy preserves decoded pixels and removes GPS`, async ({
    page,
  }) => {
    await page.goto("/");
    await upload(page, [name]);
    await expect(
      page.getByRole("heading", { name: "Sensitive metadata found" }),
    ).toBeVisible();
    await page.getByRole("button", { name: "Clean file", exact: true }).click();
    await expect(
      page.getByText("Cleaned copy verified", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name: "Location", exact: false }),
    ).toHaveCount(0);
    const downloadPromise = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download copy" }).click();
    const downloaded = await downloadPromise;
    const bytes = await readFile((await downloaded.path())!);
    expect(await pixels(page, bytes)).toEqual(
      await pixels(page, await readFile(path(name))),
    );
    expect(downloaded.suggestedFilename()).toContain("-clean");
    await page.getByRole("button", { name: "Original", exact: true }).click();
    await expect(
      page.getByRole("heading", { name: "Location", exact: false }),
    ).toBeVisible();
  });
}
test("selected families leave EXIF present and raw search works", async ({
  page,
}) => {
  await page.goto("/");
  await upload(page, ["orientation-1.jpg"]);
  await page.getByRole("link", { name: "Choose what to remove" }).click();
  await expect(
    page.getByRole("heading", { name: "Choose what to remove", exact: true }),
  ).toBeFocused();
  for (const label of ["EXIF", "IPTC", "XMP"])
    await page
      .getByRole("checkbox", { name: new RegExp(`^${label}`) })
      .uncheck();
  await page.getByRole("button", { name: "Clean file", exact: true }).click();
  await expect(
    page.getByText("Cleaned copy verified", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Location", exact: false }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Raw view" }).click();
  await page
    .getByRole("searchbox", { name: "Filter metadata" })
    .fill("Fixture Camera");
  await expect(page.getByLabel("Raw metadata")).toContainText("Fixture Camera");
  await expect(page.getByLabel("Raw metadata")).not.toContainText(
    "Fixture Editor",
  );
});
test("batch ZIP contains verified outputs with unique names and failures remain isolated", async ({
  page,
}) => {
  await page.goto("/");
  await upload(page, ["metadata.png", "metadata.webp", "broken.jpg"]);
  await page
    .getByRole("button", { name: "Clean 2 files", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("2 of 2 files cleaned");
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP (2)" }).click();
  const download = await downloadPromise,
    zip = await JSZip.loadAsync(await readFile((await download.path())!));
  expect(Object.keys(zip.files).sort()).toEqual([
    "metadata-clean.png",
    "metadata-clean.webp",
  ]);
  await page.getByRole("button", { name: /^broken.jpg/ }).click();
  await expect(page.getByRole("alert")).toContainText("truncated");
});
test("duplicate names are retained with distinct ZIP entry names", async ({
  page,
}) => {
  await page.goto("/");
  const buffer = await readFile(path("metadata.png"));
  await page.locator("input[type=file]").setInputFiles([
    { name: "same.png", mimeType: "image/png", buffer },
    { name: "same.png", mimeType: "image/png", buffer },
  ]);
  await expect(page.getByRole("status")).toContainText("Inspection complete");
  await page
    .getByRole("button", { name: "Clean 2 files", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("2 of 2");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP (2)" }).click();
  const zip = await JSZip.loadAsync(
    await readFile((await (await downloading).path())!),
  );
  expect(Object.keys(zip.files).sort()).toEqual([
    "same-clean-2.png",
    "same-clean.png",
  ]);
});
test("TIFF cleaning and malformed PDF errors are handled; session clear drops all file views", async ({
  page,
}) => {
  await page.goto("/");
  await upload(page, ["metadata.tiff", "private.pdf"]);
  await page.getByRole("button", { name: "Clean 1 file", exact: true }).click();
  await expect(
    page.getByText("Cleaned copy verified", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /^private.pdf/ }).click();
  await expect(page.getByRole("alert")).toContainText(
    "PDF is encrypted, damaged or unsupported",
  );
  await page.getByRole("button", { name: "Clear files" }).click();
  await expect(
    page.getByRole("heading", { name: "See what your files reveal" }),
  ).toBeVisible();
  await expect(page.getByText("private.pdf", { exact: true })).toHaveCount(0);
});
test("files and metadata do not cause uploads or local persistence", async ({
  page,
}) => {
  await page.goto("/");
  const requests: { url: string; method: string; body: string | null }[] = [];
  page.on("request", (r) =>
    requests.push({ url: r.url(), method: r.method(), body: r.postData() }),
  );
  await upload(page, ["orientation-1.jpg"]);
  await page.getByRole("button", { name: "Clean file", exact: true }).click();
  await expect(
    page.getByText("Cleaned copy verified", { exact: true }),
  ).toBeVisible();
  expect(
    requests.every(
      (r) =>
        r.method === "GET" &&
        !r.body &&
        (r.url.startsWith("http://127.0.0.1:4174/") ||
          r.url.startsWith("blob:http://127.0.0.1:4174/")),
    ),
  ).toBe(true);
  expect(
    requests.every(
      (r) => !r.url.includes("orientation-1") && !r.url.includes("Fixture"),
    ),
  ).toBe(true);
  expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual([
    "emeta-language",
    "emeta-theme",
  ]);
  expect(await page.evaluate(() => sessionStorage.length)).toBe(0);
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "See what your files reveal" }),
  ).toBeVisible();
});
for (const theme of ["light", "dark"]) {
  test(`${theme}: loaded workspace meets accessibility rules and fits 320px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 850 });
    await page.goto("/");
    await page.getByRole("combobox", { name: "Theme" }).selectOption(theme);
    await upload(page, ["orientation-6.jpg"]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const results = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
      .analyze();
    expect(results.violations).toEqual([]);
    expect(
      await page.locator(".image-preview").evaluate((el) => {
        const frame = el.getBoundingClientRect(),
          image = el.querySelector("img")!.getBoundingClientRect();
        return (
          image.bottom <= frame.bottom + 1 && image.right <= frame.right + 1
        );
      }),
    ).toBe(true);
  });
}
test("drag and drop uses the same verified local pipeline", async ({
  page,
}) => {
  await page.goto("/");
  const file = await readFile(path("metadata.png"));
  const data = await page.evaluateHandle((bytes) => {
    const transfer = new DataTransfer();
    transfer.items.add(
      new File([new Uint8Array(bytes)], "dropped.png", { type: "image/png" }),
    );
    return transfer;
  }, Array.from(file));
  await page.locator(".dropzone").dispatchEvent("drop", { dataTransfer: data });
  await expect(page.getByRole("status")).toContainText("Inspection complete");
  await expect(
    page.getByRole("heading", { name: "dropped.png", exact: true }),
  ).toBeVisible();
});
test("batch limits fail clearly without reading or retaining selected files", async ({
  page,
}) => {
  await page.goto("/");
  const buffer = await readFile(path("metadata.png"));
  await page.locator("input[type=file]").setInputFiles(
    Array.from({ length: 31 }, (_, i) => ({
      name: `image-${i}.png`,
      mimeType: "image/png",
      buffer,
    })),
  );
  await expect(page.getByRole("alert")).toContainText("up to 30 files");
  await expect(
    page.getByRole("heading", { name: "See what your files reveal" }),
  ).toBeVisible();
});
test("cancellation terminates queued inspection and allows a fresh session", async ({
  page,
}) => {
  await page.goto("/");
  const buffer = await readFile(path("orientation-6.jpg"));
  await page.locator("input[type=file]").setInputFiles(
    Array.from({ length: 30 }, (_, i) => ({
      name: `image-${i}.jpg`,
      mimeType: "image/jpeg",
      buffer,
    })),
  );
  await page.getByRole("button", { name: "Cancel", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Processing cancelled");
  await expect(
    page.getByRole("button", { name: "Cancel", exact: true }),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Clear files" }).click();
  await upload(page, ["metadata.png"]);
  await expect(
    page.getByRole("heading", { name: "Sensitive metadata found" }),
  ).toBeVisible();
});
