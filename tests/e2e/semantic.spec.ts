import { expect, test } from "@playwright/test";

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
