import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { inspect } from "../src/metadata/engine";
const fixture = (name: string) => resolve("tests/fixtures", name);
for (const name of ["metadata.heic", "metadata.pdf"])
  test(`${name}: local preview, verified download and metadata removal`, async ({
    page,
  }) => {
    const requests: string[] = [];
    await page.goto("/");
    page.on("request", (r) => requests.push(r.url()));
    await page.locator("input[type=file]").setInputFiles(fixture(name));
    await expect(page.getByRole("status")).toContainText("Inspection complete");
    await expect(page.locator(".image-preview img")).toBeVisible();
    if (name.endsWith("pdf"))
      await expect(
        page.getByText("Private PDF Author", { exact: true }),
      ).toBeVisible();
    await page.getByRole("button", { name: "Clean file", exact: true }).click();
    await expect(
      page.getByText("Cleaned copy verified", { exact: true }),
    ).toBeVisible({ timeout: 30000 });
    await expect(page.locator(".image-preview img")).toBeVisible();
    await expect(page.locator(".verification")).toContainText(
      name.endsWith("pdf")
        ? "every PDF page rendered identically"
        : "all decoded image pixels match",
    );
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: "Download copy" }).click();
    const download = await downloading;
    const result = await inspect(
      new Uint8Array(await readFile((await download.path())!)),
    );
    expect(result.containers).toHaveLength(0);
    expect(download.suggestedFilename()).toBe(name.replace(".", "-clean."));
    expect(
      requests.every(
        (url) =>
          url.startsWith("http://127.0.0.1:4174/") ||
          url.startsWith("blob:http://127.0.0.1:4174/"),
      ),
    ).toBe(true);
    expect(await page.evaluate(() => Object.keys(localStorage).sort())).toEqual(
      ["emeta-language", "emeta-theme"],
    );
  });
test("mixed TIFF and four video formats produce five clean verified ZIP entries", async ({
  page,
}) => {
  await page.goto("/");
  const names = [
    "metadata.tiff",
    "metadata.mp4",
    "metadata.mov",
    "metadata.webm",
    "metadata.mkv",
  ];
  await page.locator("input[type=file]").setInputFiles(names.map(fixture));
  await expect(page.getByRole("status")).toContainText("Inspection complete");
  await page
    .getByRole("button", { name: "Clean 5 files", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("5 of 5 files cleaned");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "Download ZIP (5)" }).click();
  const zip = await JSZip.loadAsync(
    await readFile((await (await downloading).path())!),
  );
  expect(Object.keys(zip.files).sort()).toEqual(
    names.map((n) => n.replace(".", "-clean.")).sort(),
  );
  for (const file of Object.values(zip.files))
    expect(
      (await inspect(await file.async("uint8array"))).containers,
    ).toHaveLength(0);
});
test("signed PDF stays inspection only with no export", async ({ page }) => {
  await page.goto("/");
  await page.locator("input[type=file]").setInputFiles(fixture("signed.pdf"));
  await expect(page.getByRole("status")).toContainText("Inspection complete");
  await expect(
    page.getByText(/Signed PDF: cleaning is disabled/),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: "Download copy" })).toHaveCount(
    0,
  );
  await expect(page.getByRole("button", { name: /^Clean/ })).toBeDisabled();
});
test("crawler content and all four format guides work without JavaScript", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("http://127.0.0.1:4174/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    "Metadata viewer & cleaner",
  );
  await expect(
    page.getByRole("heading", { name: "Common questions" }),
  ).toBeVisible();
  for (const format of ["heic", "pdf", "video", "images"]) {
    const response = await page.goto(
      `http://127.0.0.1:4174/formats/${format}/`,
    );
    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(
      page.getByRole("link", { name: "Inspect your files locally" }),
    ).toBeVisible();
    await expect(page.locator("meta[name=robots]")).toHaveAttribute(
      "content",
      "noindex,nofollow",
    );
  }
  await context.close();
});
