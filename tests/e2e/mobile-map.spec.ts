import { expect, test } from "@playwright/test";
import { cameraState, markerPoint, projectPoints } from "./map-helpers";

test("responsive overview clears edges and controls across mobile and desktop widths", async ({ page }) => {
  for (const width of [320, 360, 390, 430, 760, 761, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto("/");
    await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
    const rect = (await page.locator("canvas").boundingBox())!;
    const controls = (await page.getByRole("group", { name: "Map view controls" }).boundingBox())!;
    const points = await projectPoints(page, [-5, 5].flatMap((x) => [-10 / 3, 10 / 3].map((z) => [x, 0, z])));
    for (const point of points) {
      expect(point.x).toBeGreaterThanOrEqual(rect.x + 16);
      expect(point.x).toBeLessThanOrEqual(rect.x + rect.width - 16);
      expect(point.y).toBeGreaterThanOrEqual(rect.y + 16);
      expect(point.y).toBeLessThanOrEqual(controls.y - 16);
    }
    expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(width);
    for (const button of await page.locator("[data-map-action]").all()) {
      const box = (await button.boundingBox())!;
      expect(box.width).toBeGreaterThanOrEqual(44);
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  }
});

test("View on map is explicit, preserves category and moves focus to the preview", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/categories/healing/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  const initial = await cameraState(page);
  await page.locator("[data-poi-slug='yoga-dome']").focus();
  expect(await cameraState(page)).toEqual(initial);
  const action = page.getByRole("link", { name: "View on map: Yoga Dome", exact: true });
  await action.focus();
  await page.keyboard.press("Enter");
  const preview = page.getByRole("region", { name: "Map place preview" });
  await expect(preview).toBeFocused();
  await expect(host).toHaveAttribute("data-selected-poi", "yoga-dome");
  await expect(page).toHaveURL(/\/categories\/healing\/\?poi=yoga-dome#poi-yoga-dome$/);
  await expect.poll(() => cameraState(page)).not.toEqual(initial);
  expect((await cameraState(page)).distance).toBe(initial.distance);
  const point = await markerPoint(page, "yoga-dome");
  const rect = (await page.locator("canvas").boundingBox())!;
  const controls = (await page.locator(".map-controls").boundingBox())!;
  expect(point.x).toBeCloseTo(rect.x + rect.width / 2, 0);
  expect(point.y).toBeGreaterThan(rect.y + 16);
  expect(point.y).toBeLessThan(controls.y - 16);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  const focused = await cameraState(page);
  await page.getByRole("button", { name: "Dismiss place preview" }).click();
  expect(await cameraState(page)).toEqual(focused);
  await expect(preview).toBeHidden();
});

test("detail action and direct reload locate without storage; invalid or filtered places are harmless", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", { get() { throw new Error("Storage denied"); } });
  });
  await page.goto("/poi/boom-2025/kosmicare/");
  await page.getByRole("link", { name: "View on map: Kosmicare", exact: true }).click();
  const preview = page.getByRole("region", { name: "Map place preview" });
  await expect(preview).toBeFocused();
  await expect(preview.getByText("Kosmicare", { exact: true })).toBeVisible();
  await page.reload();
  await expect(preview).toBeFocused();
  for (const url of ["/?poi=missing", "/categories/healing/?poi=kosmicare"]) {
    await page.goto(url);
    await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
    await expect(preview).toBeHidden();
  }
  await page.goto("/editions/boom-2025/");
  await expect(page.locator("[data-map-locate]")).toHaveCount(0);
});

test("View on map retains semantic destinations without JavaScript or WebGL", async ({ browser, page }) => {
  const context = await browser.newContext({ javaScriptEnabled: false, baseURL: "http://127.0.0.1:4321" });
  try {
    const staticPage = await context.newPage();
    await staticPage.goto("/poi/boom-2025/kosmicare/");
    await staticPage.getByRole("link", { name: "View on map: Kosmicare", exact: true }).click();
    await expect(staticPage).toHaveURL(/\?poi=kosmicare#poi-kosmicare$/);
    await expect(staticPage.locator("#poi-kosmicare")).toBeInViewport();
    await expect(staticPage.locator(".map-placeholder")).toBeVisible();
  } finally {
    await context.close();
  }
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (this: HTMLCanvasElement, id: string, ...args: unknown[]) {
      return id.startsWith("webgl") ? null : Reflect.apply(getContext, this, [id, ...args]);
    } as typeof getContext;
  });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "unavailable");
  await page.getByRole("link", { name: "View on map: Kosmicare", exact: true }).click();
  await expect(page.locator("#poi-kosmicare")).toBeFocused();
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeHidden();
});

test("only the latest locate request runs after delayed texture readiness", async ({ page }) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  await page.route("**/plan-base.svg", async (route) => {
    await gate;
    await route.continue();
  });
  await page.goto("/?poi=kosmicare#poi-kosmicare", { waitUntil: "domcontentloaded" });
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "loading");
  await page.getByRole("link", { name: "View on map: Yoga Dome", exact: true }).click();
  release();
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeFocused();
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-selected-poi", "yoga-dome");
  await expect(page).toHaveURL(/\?poi=yoga-dome#poi-yoga-dome$/);
});

test("a queued locate request falls back to its semantic row if texture loading fails", async ({ page }) => {
  await page.addInitScript(() => {
    const create = document.createElementNS.bind(document);
    document.createElementNS = ((namespace: string, name: string) => {
      const element = create(namespace, name);
      if (name === "img") {
        Object.defineProperty(element, "src", { set() {} });
        Object.defineProperty(window, "failMapTexture", { value: () => element.dispatchEvent(new Event("error")) });
      }
      return element;
    }) as typeof document.createElementNS;
  });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "loading");
  await expect.poll(() => page.evaluate(() => typeof (window as Window & { failMapTexture?: () => void }).failMapTexture)).toBe("function");
  await page.getByRole("link", { name: "View on map: Yoga Dome", exact: true }).click();
  await page.evaluate(() => {
    const fail = (window as Window & { failMapTexture?: () => void }).failMapTexture;
    if (!fail) throw new Error("Texture failure hook is missing");
    fail();
  });
  await expect(page.locator("[data-poi-slug='yoga-dome']")).toBeFocused();
  await expect(page.locator(".map-placeholder")).toBeVisible();
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeHidden();
});

test("hidden canvas recovery and 200 percent text retain usable layout and controls", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 800 });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const beforeHide = await cameraState(page);
  await page.locator(".map-display").evaluate((map) => { (map as HTMLElement).style.display = "none"; });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.locator(".map-display").evaluate((map) => { (map as HTMLElement).style.removeProperty("display"); });
  await expect.poll(() => cameraState(page)).not.toEqual(beforeHide);
  await expect.poll(async () => Object.values(await cameraState(page)).every(Number.isFinite)).toBe(true);
  await page.evaluate(() => { document.documentElement.style.fontSize = "200%"; });
  await page.getByRole("link", { name: "View on map: Kosmicare", exact: true }).click();
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeFocused();
  expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
  for (const button of await page.locator("[data-map-action]").all()) {
    await button.scrollIntoViewIfNeeded();
    await expect(button).toBeInViewport();
  }
});

test("focused edge places remain unobscured across orientation changes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/?poi=assembly-north#poi-assembly-north");
  const preview = page.getByRole("region", { name: "Map place preview" });
  await expect(preview).toBeFocused();
  for (const size of [{ width: 390, height: 844 }, { width: 844, height: 390 }, { width: 1440, height: 1000 }]) {
    await page.setViewportSize(size);
    await expect.poll(async () => {
      const point = await markerPoint(page, "assembly-north");
      const canvas = (await page.locator("canvas").boundingBox())!;
      const card = (await preview.boundingBox())!;
      const controls = (await page.locator(".map-controls").boundingBox())!;
      return point.x > canvas.x + 16 && point.x < canvas.x + canvas.width - 16
        && point.y > canvas.y + 16 && point.y < controls.y - 16
        && (point.x > card.x + card.width + 16 || point.y > card.y + card.height + 16 || point.y < card.y - 16);
    }).toBe(true);
  }
});

test("resize preserves explored zoom and reset restores the new overview without clearing selection", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const initial = await cameraState(page);
  await page.locator("[data-poi-slug='kosmicare']").focus();
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  await expect.poll(async () => (await cameraState(page)).distance).toBeLessThan(initial.distance);
  const zoomed = await cameraState(page);
  await page.setViewportSize({ width: 844, height: 390 });
  await expect.poll(async () => (await cameraState(page)).distance).not.toBe(zoomed.distance);
  const resized = await cameraState(page);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(async () => (await cameraState(page)).distance).toBeGreaterThan(resized.distance);
  const overview = await cameraState(page);
  expect(resized.distance / overview.distance).toBeCloseTo(zoomed.distance / initial.distance);
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-selected-poi", "kosmicare");
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(() => cameraState(page)).toEqual(overview);
});
