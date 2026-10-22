import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { cameraState } from "./map-helpers";

const OSM_URL = "https://www.openstreetmap.org/#map=14/39.96258/-7.19201";

test.beforeEach(async ({ page }) => {
  // Keep integration checks deterministic and do not download public map tiles in CI.
  await page.route("https://www.openstreetmap.org/**", (route) => route.fulfill({
    contentType: "text/html",
    body: '<!doctype html><html lang="en"><head><title>External map fixture</title></head><body><main>OpenStreetMap fixture</main></body></html>',
  }));
});

test("geographic context loads only on request and preserves the illustrated view", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname.endsWith("openstreetmap.org")) requests.push(request.url());
  });
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  const initial = await cameraState(page);
  const frame = page.locator("iframe");
  await expect(frame).not.toHaveAttribute("src");
  expect(requests).toEqual([]);
  await page.locator("[data-poi-slug='kosmicare']").focus();
  const geographic = page.getByRole("button", { name: "Geographic map", exact: true });
  await geographic.focus();
  await page.keyboard.press("Enter");
  await expect(geographic).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas")).toBeHidden();
  await expect(frame).toBeVisible();
  await expect.poll(() => requests.length).toBe(1);
  const source = new URL((await frame.getAttribute("src"))!);
  expect(source.pathname).toBe("/export/embed.html");
  expect(source.searchParams.get("bbox")).toBe("-7.23201,39.93758,-7.15201,39.98758");
  expect(source.searchParams.has("marker")).toBe(false);
  await expect(page.getByRole("link", { name: "OpenStreetMap contributors" })).toHaveAttribute("href", "https://www.openstreetmap.org/copyright");
  await expect(page.getByRole("link", { name: "open the area in OpenStreetMap" })).toHaveAttribute("href", OSM_URL);
  await expect(page.getByText(/Curated stages and services are only on the illustrated map/)).toBeVisible();
  const illustrated = page.getByRole("button", { name: "Illustrated map", exact: true });
  await illustrated.focus();
  await page.keyboard.press("Space");
  await expect(illustrated).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator("canvas")).toBeVisible();
  await expect(host).toHaveAttribute("data-selected-poi", "kosmicare");
  expect(await cameraState(page)).toEqual(initial);
  await geographic.click();
  expect(requests).toHaveLength(1);
});

test("View on map returns from geographic context to the correct filtered illustration", async ({ page }) => {
  await page.goto("/categories/healing/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  await page.getByRole("button", { name: "Geographic map", exact: true }).click();
  await page.getByRole("link", { name: "View on map: Yoga Dome", exact: true }).click();
  await expect(page.getByRole("button", { name: "Illustrated map", exact: true })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeFocused();
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page).toHaveURL(/\/categories\/healing\/\?poi=yoga-dome#poi-yoga-dome$/);
});

test("a queued location request reveals the illustration before its texture finishes loading", async ({ page }) => {
  let release: () => void = () => {};
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/plan-base.svg", async (route) => {
    await gate;
    await route.continue();
  });
  try {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "loading");
    await page.getByRole("button", { name: "Geographic map", exact: true }).click();
    await page.getByRole("link", { name: "View on map: Kosmicare", exact: true }).click();
    await expect(page.getByRole("button", { name: "Illustrated map", exact: true })).toHaveAttribute("aria-pressed", "true");
    release();
    await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
    await expect(page.getByRole("region", { name: "Map place preview" })).toBeFocused();
  } finally {
    release();
  }
});

test("a blocked external map retains its direct link and the independent illustrated map", async ({ page }) => {
  await page.route("https://www.openstreetmap.org/**", (route) => route.abort());
  await page.goto("/");
  await page.getByRole("button", { name: "Geographic map", exact: true }).click();
  await expect(page.getByRole("link", { name: "open the area in OpenStreetMap" })).toBeVisible();
  await page.getByRole("button", { name: "Illustrated map", exact: true }).click();
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  await expect(page.locator("canvas")).toBeVisible();
});

test("geographic context is available without WebGL", async ({ page }) => {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement, contextId: string, ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") return null;
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "unavailable");
  await page.getByRole("button", { name: "Geographic map", exact: true }).click();
  await expect(page.locator("iframe")).toBeVisible();
  await expect(page.locator("iframe")).toHaveAttribute("src", /openstreetmap\.org\/export\/embed\.html/);
  await page.getByRole("button", { name: "Illustrated map", exact: true }).click();
  await expect(page.locator(".map-placeholder")).toBeVisible();
  await expect(page.locator("a[data-poi-slug]")).toHaveCount(36);
});

test("geographic view fits small screens and enlarged text with accessible controls", async ({ page }, testInfo) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Geographic map", exact: true }).click();
  for (const width of [320, 390, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    for (const button of await page.getByRole("group", { name: "Map type", exact: true }).getByRole("button").all()) {
      const box = (await button.boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
      expect(box.width).toBeGreaterThanOrEqual(44);
    }
    expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(width);
    await page.screenshot({ path: testInfo.outputPath(`geographic-map-${width}.png`) });
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations).toEqual([]);
});

test("without JavaScript the geographic destination is a normal link", async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new Error("Geographic map test requires the configured base URL");
  const context = await browser.newContext({ baseURL, javaScriptEnabled: false });
  try {
    const page = await context.newPage();
    await page.goto("/");
    await expect(page.getByRole("link", { name: "View the festival grounds and surroundings on OpenStreetMap" })).toHaveAttribute("href", OSM_URL);
    await expect(page.getByRole("link", { name: "View the festival grounds and surroundings on OpenStreetMap" })).toBeVisible();
    await expect(page.locator(".map-view-switch")).toBeHidden();
    await expect(page.locator("iframe")).not.toHaveAttribute("src");
    await expect(page.locator(".map-placeholder")).toBeVisible();
  } finally {
    await context.close();
  }
});
