import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { languages, translator, guidePath } from "../src/i18n";
import { GUIDES, FAQ, ROOT_DESCRIPTION } from "../src/seo/content";
for (const language of languages)
  test(`${language.code}: localized UI and verified download preserve metadata values and filename`, async ({
    page,
  }) => {
    const t = translator(language.code);
    await page.goto(`/?lang=${language.code}`);
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
    await expect(page.locator("html")).toHaveAttribute(
      "dir",
      language.direction,
    );
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(
      t("Metadata viewer & cleaner"),
    );
    await expect(page.locator('meta[name="description"]')).toHaveAttribute(
      "content",
      t(ROOT_DESCRIPTION),
    );
    const schemas = await page
      .locator('script[type="application/ld+json"]')
      .allTextContents();
    expect(
      schemas
        .map((s) => JSON.parse(s))
        .find((s) => s["@type"] === "WebApplication").inLanguage,
    ).toBe(language.code);
    expect(
      schemas.map((s) => JSON.parse(s)).find((s) => s["@type"] === "FAQPage")
        .mainEntity[0].name,
    ).toBe(t(FAQ[0].q));
    const buffer = await readFile(resolve("tests/fixtures/orientation-6.jpg")),
      name = "original-東京-مرحبا.jpg";
    await page
      .locator("input[type=file]")
      .setInputFiles({ name, mimeType: "image/jpeg", buffer });
    await expect(page.getByRole("status")).toContainText(
      t("Inspection complete. {count} file processed locally.", { count: 1 }),
    );
    await page
      .getByRole("button", { name: t("Raw view"), exact: true })
      .click();
    await page
      .getByRole("searchbox", { name: t("Filter metadata") })
      .fill("Fixture Camera");
    await expect(page.getByLabel(t("Raw metadata"))).toContainText(
      "Fixture Camera",
    );
    await page
      .getByRole("button", { name: t("Clean file"), exact: true })
      .click();
    await expect(
      page.getByText(t("Cleaned copy verified"), { exact: true }),
    ).toBeVisible();
    const downloading = page.waitForEvent("download");
    await page.getByRole("button", { name: t("Download copy") }).click();
    expect((await downloading).suggestedFilename()).toBe(
      "original-東京-مرحبا-clean.jpg",
    );
    await page
      .locator(".language-select")
      .selectOption(language.code === "en" ? "tr" : "en");
    await expect(
      page.getByText(
        translator(language.code === "en" ? "tr" : "en")(
          "Cleaned copy verified",
        ),
        { exact: true },
      ),
    ).toBeVisible();
    await expect(
      page.getByRole("heading", { name, exact: true }),
    ).toBeVisible();
  });
test("browser locale, stored preference, explicit query, reload and blocked storage", async ({
  browser,
}) => {
  const context = await browser.newContext({ locale: "pt-BR" }),
    page = await context.newPage();
  await page.goto("/");
  await expect(page.locator(".language-select")).toHaveValue("pt");
  await page.locator(".language-select").selectOption("tr");
  await page
    .getByRole("combobox", { name: "Tema", exact: true })
    .selectOption("dark");
  await page.reload();
  await expect(page.locator(".language-select")).toHaveValue("tr");
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.goto("/?lang=ja");
  await expect(page.locator(".language-select")).toHaveValue("ja");
  expect(await page.evaluate(() => ({ ...localStorage }))).toEqual({
    "emeta-theme": "dark",
    "emeta-language": "ja",
  });
  await page.goto("/");
  await expect(page.locator(".language-select")).toHaveValue("ja");
  await context.close();
  const unsupported = await browser.newContext({ locale: "zh-CN" }),
    fallback = await unsupported.newPage();
  await fallback.goto("/");
  await expect(fallback.locator(".language-select")).toHaveValue("en");
  await unsupported.close();
  const blocked = await browser.newContext();
  await blocked.addInitScript(() => {
    Object.defineProperty(Storage.prototype, "getItem", {
      value() {
        throw new Error("disabled");
      },
    });
    Object.defineProperty(Storage.prototype, "setItem", {
      value() {
        throw new Error("disabled");
      },
    });
  });
  const safe = await blocked.newPage();
  await safe.goto("/?lang=ar");
  await safe.locator(".language-select").selectOption("tr");
  await expect(safe.getByRole("heading", { level: 1 })).toHaveText(
    translator("tr")("Metadata viewer & cleaner"),
  );
  await blocked.close();
});
test("switching language preserves live metadata search, family choices and localized error recovery", async ({
  page,
}) => {
  await page.goto("/?lang=tr");
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve("tests/fixtures/orientation-6.jpg"));
  await expect(page.getByRole("status")).toContainText("İnceleme tamamlandı");
  await page.getByRole("checkbox", { name: /^EXIF/ }).uncheck();
  await page.getByRole("button", { name: "Ham görünüm" }).click();
  await page
    .getByRole("searchbox", { name: "Metadatayı filtrele" })
    .fill("Fixture Camera");
  await page.locator(".language-select").selectOption("ar");
  await expect(page.getByRole("checkbox", { name: /^EXIF/ })).not.toBeChecked();
  await expect(
    page.getByRole("searchbox", { name: translator("ar")("Filter metadata") }),
  ).toHaveValue("Fixture Camera");
  await expect(page.getByLabel(translator("ar")("Raw metadata"))).toContainText(
    "Fixture Camera",
  );
  await page
    .getByRole("button", { name: translator("ar")("Clear files"), exact: true })
    .click();
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve("tests/fixtures/private.pdf"));
  await expect(page.getByRole("status")).toContainText(
    translator("ar")("Inspection complete. {count} file processed locally.", {
      count: 1,
    }),
  );
  await expect(page.getByRole("alert")).toContainText(
    translator("ar")(
      "This PDF is encrypted, damaged or unsupported. Use an unencrypted valid PDF.",
    ),
  );
  await page.locator(".language-select").selectOption("pt");
  await expect(page.getByRole("alert")).toContainText(
    translator("pt")(
      "This PDF is encrypted, damaged or unsupported. Use an unencrypted valid PDF.",
    ),
  );
});
test("all languages fit 320px through desktop; Arabic both themes are accessible", async ({
  page,
}) => {
  await page.goto("/");
  await page
    .locator("input[type=file]")
    .setInputFiles(resolve("tests/fixtures/metadata.pdf"));
  await expect(page.getByRole("status")).toContainText("Inspection complete");
  for (const language of languages) {
    await page.locator(".language-select").selectOption(language.code);
    await expect(page.locator("html")).toHaveAttribute("lang", language.code);
    await expect(
      page.getByRole("checkbox", {
        name: new RegExp(
          "^" + translator(language.code)("PDF document properties"),
        ),
      }),
    ).toBeChecked();
    for (const width of [320, 390, 768, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      expect(
        await page.evaluate(
          () => document.documentElement.scrollWidth <= innerWidth,
        ),
        `${language.code} at ${width}`,
      ).toBe(true);
    }
  }
  await page.locator(".language-select").selectOption("ar");
  await page.setViewportSize({ width: 320, height: 900 });
  for (const theme of ["light", "dark"]) {
    await page
      .getByRole("combobox", { name: translator("ar")("Theme"), exact: true })
      .selectOption(theme);
    expect(
      (
        await new AxeBuilder({ page })
          .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
          .analyze()
      ).violations,
    ).toEqual([]);
  }
});
test("every translated guide works without JavaScript and links back to its language", async ({
  browser,
}) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  for (const language of languages)
    for (const guide of GUIDES) {
      const response = await page.goto(
        "http://127.0.0.1:4174" + guidePath(guide.slug, language.code),
      );
      expect(response?.status()).toBe(200);
      await expect(page.locator("html")).toHaveAttribute("lang", language.code);
      await expect(page.locator("html")).toHaveAttribute(
        "dir",
        language.direction,
      );
      await expect(page.getByRole("heading", { level: 1 })).toHaveText(
        translator(language.code)(guide.title),
      );
      await expect(
        page.getByRole("link", {
          name: translator(language.code)("Inspect your files locally"),
        }),
      ).toHaveAttribute("href", `/?lang=${language.code}`);
      await expect(
        page.getByText(translator(language.code)(FAQ[0].q), { exact: true }),
      ).toBeVisible();
    }
  await context.close();
});
