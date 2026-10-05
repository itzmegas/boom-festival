import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test("landing frames the unofficial map and lists curated places", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText(/Independent, unofficial, fan-curated/i)).toBeVisible();
  await expect(page.getByRole("link", { name: /Kosmicare/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /ticket/i })).toHaveCount(0);
});

test("filter emphasizes one category and inspect keeps context", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Healing", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Healing" })).toBeVisible();
  await expect(page.getByRole("link", { name: /Yoga Dome/ })).toBeVisible();
  await expect(page.getByRole("link", { name: /Dance Temple/ })).toHaveCount(0);
  await page.getByRole("link", { name: /Yoga Dome/ }).click();
  await expect(page.getByRole("heading", { name: "Yoga Dome" })).toBeVisible();
  await expect(page.getByText("Category: Healing")).toBeVisible();
});

test("stable POI link opens detail without using the map first", async ({ page }) => {
  await page.goto("/poi/boom-2025/sacred-fire/");
  await expect(page.getByRole("heading", { name: "Sacred Fire" })).toBeVisible();
  await expect(page.getByText(/plan-local/i)).toBeVisible();
});

test("unknown deep link shows not-found with a path back", async ({ page }) => {
  const response = await page.goto("/poi/unknown/missing/");
  expect(response?.status()).toBe(404);
  await expect(page.getByRole("heading", { name: "Place not found" })).toBeVisible();
  await expect(page.getByRole("link", { name: /available map content/i })).toBeVisible();
});

test("empty edition explains incomplete curation", async ({ page }) => {
  await page.goto("/editions/boom-empty/");
  await expect(page.getByText(/Curation for this edition is incomplete/)).toBeVisible();
});

test("incomplete fields are marked instead of invented", async ({ page }) => {
  await page.goto("/poi/boom-2025/library/");
  await expect(page.getByText("Not yet curated")).toHaveCount(2);
});

test("keyboard can reach filters, places, and details", async ({ page }) => {
  await page.goto("/");
  await page.locator("body").press("Tab");
  await expect(page.getByRole("link", { name: "Skip to main content" })).toBeFocused();
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();
});

test("key map routes have no WCAG 2.1 A or AA axe violations", async ({ page }) => {
  for (const route of [
    "/",
    "/categories/healing/",
    "/poi/boom-2025/yoga-dome/",
    "/editions/boom-empty/",
    "/poi/unknown/missing/",
  ]) {
    await page.goto(route);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
      .analyze();
    expect(violations, `${route}: ${JSON.stringify(violations)}`).toEqual([]);
  }
});

test("category chips retain map context, active state, and matching place counts", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const panel = page.getByRole("complementary", { name: "Place explorer" });
  const filters = panel.getByRole("navigation", { name: "Filter places by category" });
  await expect(filters.getByRole("link", { name: "All places", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(panel.getByText("36 places", { exact: true })).toBeVisible();
  const places = panel.getByRole("list", { name: "Curated places" });
  await expect(places.getByRole("link")).toHaveCount(36);
  await expect(places.getByRole("link").first()).toContainText("Boom Medical");
  await expect(places.getByRole("link").first()).toContainText("Highlighted care landmark");
  const listBox = await places.boundingBox();
  expect(listBox!.height).toBeLessThan(500);
  expect(await places.evaluate((list) => list.scrollHeight > list.clientHeight)).toBe(true);
  await page.screenshot({ path: testInfo.outputPath("place-panel-desktop.png") });

  // Keyboard focus must bring even the last row into the bounded list viewport.
  await places.getByRole("link").last().focus();
  await expect(places.getByRole("link").last()).toBeFocused();
  await expect(places.getByRole("link").last()).toHaveAttribute("aria-current", "true");
  expect(await places.evaluate((list) => list.scrollTop)).toBeGreaterThan(0);
  const lastRowBox = await places.getByRole("link").last().boundingBox();
  const scrolledListBox = await places.boundingBox();
  expect(lastRowBox!.y).toBeGreaterThanOrEqual(scrolledListBox!.y);
  expect(lastRowBox!.y + lastRowBox!.height).toBeLessThanOrEqual(scrolledListBox!.y + scrolledListBox!.height + 1);

  await filters.getByRole("link", { name: "Healing", exact: true }).click();
  await expect(page).toHaveURL(/\/categories\/healing\/$/);
  await expect(page.getByRole("heading", { name: "Healing", exact: true })).toBeVisible();
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  await expect(filters.getByRole("link", { name: "Healing", exact: true })).toHaveAttribute("aria-current", "page");
  await expect(filters.locator("[aria-current='page']")).toHaveCount(1);
  await expect(places.getByRole("link")).toHaveCount(3);
  await expect(panel.getByText("3 places", { exact: true })).toBeVisible();
  await expect(places.getByRole("link", { name: /Dance Temple/ })).toHaveCount(0);
  const mapSlugs = await page.locator("[data-map-enhancement]").evaluate((host) => {
    const pois = JSON.parse(host.getAttribute("data-pois") ?? "[]") as Array<{ slug: string }>;
    return pois.map((poi) => poi.slug).sort();
  });
  expect(mapSlugs).toEqual(["healing-area", "tantra-temple", "yoga-dome"]);
  await page.screenshot({ path: testInfo.outputPath("place-panel-filtered.png") });

  await filters.getByRole("link", { name: "All places", exact: true }).click();
  await expect(page).toHaveURL(/\/$/);
  await expect(places.getByRole("link")).toHaveCount(36);
  await expect(filters.getByRole("link", { name: "All places", exact: true })).toHaveAttribute("aria-current", "page");
});

test("mobile place rows and chips fit without nested list scrolling", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto("/");
  const panel = page.getByRole("complementary", { name: "Place explorer" });
  await panel.scrollIntoViewIfNeeded();
  const places = panel.getByRole("list", { name: "Curated places" });
  await expect(places).toHaveCSS("overflow-y", "visible");
  const filters = panel.getByRole("navigation", { name: "Filter places by category" });
  for (const chip of await filters.getByRole("link").all()) {
    const box = await chip.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.width).toBeGreaterThanOrEqual(44);
  }
  const panelBox = await panel.boundingBox();
  for (const row of await places.getByRole("link").all()) {
    const box = await row.boundingBox();
    expect(box!.height).toBeGreaterThanOrEqual(44);
    expect(box!.x + box!.width).toBeLessThanOrEqual(panelBox!.x + panelBox!.width);
  }
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(360);
  await filters.screenshot({ path: testInfo.outputPath("place-panel-mobile-chips.png") });
  await places.getByRole("link").first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: testInfo.outputPath("place-panel-mobile-rows.png") });
  await filters.getByRole("link", { name: "Healing", exact: true }).click();
  await expect(panel.getByText("3 places", { exact: true })).toBeVisible();
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations).toEqual([]);
});
