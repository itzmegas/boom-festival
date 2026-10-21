import { expect, test } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { markerPoint } from "./map-helpers";

async function disableWebGl(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      contextId: string,
      ...args: unknown[]
    ) {
      if (contextId === "webgl" || contextId === "webgl2") {
        return null;
      }
      return Reflect.apply(original, this, [contextId, ...args]);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
}

test("WebGL-disabled visitors retain the complete semantic experience", async ({ page }) => {
  const requestedScripts: string[] = [];
  page.on("request", (request) => requestedScripts.push(request.url()));
  await disableWebGl(page);
  await page.goto("/");

  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "unavailable");
  await expect(page.locator("canvas[aria-hidden='true']")).toBeHidden();
  await expect(page.locator("a[data-poi-slug]")).toHaveCount(36);
  await expect(page.locator("[data-poi-slug='kosmicare']")).toBeVisible();
  expect(requestedScripts.some((url) => /scene\.ts|three\.js/.test(url))).toBe(false);
});

test("keyboard-only discovery opens a detail and Escape returns focus", async ({ page }) => {
  await disableWebGl(page);
  await page.goto("/");
  await page.keyboard.press("Tab");
  await page.keyboard.press("Enter");
  await expect(page.locator("#main-content")).toBeFocused();

  const poiLink = page.locator("a[data-poi-slug]").first();
  await poiLink.focus();
  const slug = await poiLink.getAttribute("data-poi-slug");
  await page.keyboard.press("Enter");
  await expect(page).toHaveURL(new RegExp(`/poi/boom-2025/${slug}/$`));
  await expect(page.locator("main h1")).not.toHaveText("Independent Boom 2025 map");
  await page.waitForLoadState("load");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/#${slug}$`));
  await expect(page.locator(`[data-poi-slug='${slug}']`)).toBeFocused();
});

test("filtered-list navigation returns focus to its originating POI link", async ({ page }) => {
  await disableWebGl(page);
  await page.goto("/categories/healing/");

  const poiLink = page.locator("[data-poi-slug='yoga-dome']");
  await poiLink.focus();
  const slug = await poiLink.getAttribute("data-poi-slug");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Yoga Dome" })).toBeVisible();
  await page.waitForLoadState("load");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/#${slug}$`));
  await expect(page.locator(`[data-poi-slug='${slug}']`)).toBeFocused();
});

test("POI navigation remains usable when session storage is unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(window, "sessionStorage", {
      get() {
        throw new Error("Storage unavailable");
      },
    });
  });
  await page.goto("/categories/healing/");
  await page.locator("[data-poi-slug='yoga-dome']").click();
  await expect(page.getByRole("heading", { name: "Yoga Dome" })).toBeVisible();
});

test("reduced motion uses direct updates without a continuous animation loop", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-motion", "reduce");
  await expect(host).toHaveAttribute("data-webgl", /ready|unavailable/);

  if ((await host.getAttribute("data-webgl")) === "ready") {
    await page.waitForTimeout(300);
    const firstCount = Number(await host.getAttribute("data-render-count"));
    await page.waitForTimeout(250);
    expect(Number(await host.getAttribute("data-render-count"))).toBe(firstCount);
  }
});

test("semantic focus and canvas selection share the typed selection state", async ({ page }) => {
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  await expect(page.locator("canvas[aria-hidden='true']")).toBeVisible();

  const kosmicare = page.locator("a[data-poi-slug='kosmicare']");
  await kosmicare.focus();
  await expect(host).toHaveAttribute("data-selected-poi", "kosmicare");

  await page.evaluate(() => {
    window.dispatchEvent(new CustomEvent("poi:select", { detail: { slug: "assembly-north" } }));
  });
  await expect(page.locator("a[data-poi-slug='assembly-north']")).toHaveAttribute(
    "aria-current",
    "true",
  );
});

test("homepage map is framed with nearby categories, a marker legend, and working view controls", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");

  const map = page.locator("[data-map-enhancement]");
  await expect(map).toHaveAttribute("data-webgl", "ready");
  await expect(page.getByRole("heading", { name: "Curated places" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Filter places by category" })).toBeVisible();
  const legend = page.getByRole("list", { name: "Map marker legend" });
  await expect(legend.getByText("Dance floors", { exact: true })).toBeVisible();
  await expect(legend.getByText("Care and assembly points", { exact: true })).toBeVisible();
  await expect(page.getByText(/Drag to explore\. Use the controls to zoom\./)).toBeVisible();
  await expect(page.getByText(/schematic|placeholder/i)).toBeVisible();
  await expect(page.getByText(/Not affiliated with Boom Festival/i)).toBeVisible();
  await expect(page.getByText(/orientation only/i)).toBeVisible();

  const mapBox = await map.boundingBox();
  const categoryBox = await page.getByRole("navigation", { name: "Filter places by category" }).boundingBox();
  expect(mapBox).not.toBeNull();
  expect(categoryBox).not.toBeNull();
  expect(mapBox!.width).toBeGreaterThan(850);
  expect(categoryBox!.x).toBeGreaterThan(mapBox!.x + mapBox!.width);
  expect(Math.abs(mapBox!.y - categoryBox!.y)).toBeLessThan(180);

  const zoomIn = page.getByRole("button", { name: "Zoom in" });
  const zoomOut = page.getByRole("button", { name: "Zoom out" });
  const reset = page.getByRole("button", { name: "Reset view" });
  await expect(zoomIn).toBeEnabled();
  await expect(zoomOut).toBeEnabled();
  await expect(reset).toBeEnabled();
  for (const control of [zoomIn, zoomOut, reset]) {
    const box = await control.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(44);
    expect(box?.height).toBeGreaterThanOrEqual(44);
  }

  await page.screenshot({ path: testInfo.outputPath("map-first-screen-desktop-initial.png") });
  const baseline = await page.locator("canvas").screenshot();
  await zoomIn.focus();
  await page.keyboard.press("Enter");
  const zoomed = await page.locator("canvas").screenshot();
  expect(zoomed.equals(baseline)).toBe(false);
  await reset.focus();
  await page.keyboard.press("Space");
  const restored = await page.locator("canvas").screenshot();
  expect(restored.equals(zoomed)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("map-first-screen-desktop.png") });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.reload();
  const mobileCategories = page.getByRole("navigation", { name: "Filter places by category" });
  await expect(mobileCategories).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeEnabled();
  const mobileMapBox = await map.boundingBox();
  const mobileCategoryBox = await mobileCategories.boundingBox();
  expect(mobileMapBox).not.toBeNull();
  expect(mobileCategoryBox).not.toBeNull();
  expect(mobileCategoryBox!.y).toBeGreaterThan(mobileMapBox!.y + mobileMapBox!.height);
  expect(mobileMapBox!.y + mobileMapBox!.height).toBeLessThan(800);
  const pageWidth = await page.locator("body").evaluate((body) => body.scrollWidth);
  const viewportWidth = await page.evaluate(() => window.innerWidth);
  expect(pageWidth).toBeLessThanOrEqual(viewportWidth);
  await page.screenshot({ path: testInfo.outputPath("map-first-screen-mobile.png") });
});

test("WebGL canvas renders the original plan texture instead of a black plane", async ({ page }) => {
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  await expect(host).toHaveAttribute("data-render-count", /[2-9]/);
  await page.locator(".map-placeholder").evaluate((image) => { (image as HTMLImageElement).style.visibility = "hidden"; });
  const canvasScreenshot = await page.locator("canvas").screenshot();
  const texturedPixels = await page.evaluate((encoded) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas2D unavailable");
    canvas.width = 1;
    canvas.height = 1;
    return new Promise<number>((resolve, reject) => {
      image.onload = () => {
        canvas.width = image.width;
        canvas.height = image.height;
        context.drawImage(image, 0, 0);
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let count = 0;
        for (let index = 0; index < pixels.length; index += 4) {
          const beige = Math.abs(pixels[index]! - 232) < 4
            && Math.abs(pixels[index + 1]! - 217) < 4
            && Math.abs(pixels[index + 2]! - 184) < 4;
          if (beige) count += 1;
        }
        resolve(count);
      };
      image.onerror = () => reject(new Error("Canvas screenshot could not be decoded"));
    });
  }, canvasScreenshot.toString("base64"));
  expect(texturedPixels).toBeGreaterThan(1000);
});

test("failed map texture keeps the original plan visible and enhancement unavailable", async ({ page }) => {
  await page.addInitScript(() => {
    const createElementNS = document.createElementNS.bind(document);
    document.createElementNS = ((namespace: string, name: string) => {
      const element = createElementNS(namespace, name);
      if (name === "img") {
        Object.defineProperty(element, "src", {
          set() { queueMicrotask(() => element.dispatchEvent(new Event("error"))); },
        });
      }
      return element;
    }) as typeof document.createElementNS;
  });
  await page.goto("/");

  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "unavailable");
  await expect(page.locator(".map-placeholder")).toBeVisible();
  await expect(page.locator("a[data-poi-slug]")).toHaveCount(36);
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Zoom out" })).toBeDisabled();
  await expect(page.getByRole("button", { name: "Reset view" })).toBeDisabled();
});

test("map stays in loading fallback state until texture success and ignores late disposal callbacks", async ({ page }) => {
  await page.addInitScript(() => {
    const createElementNS = document.createElementNS.bind(document);
    document.createElementNS = ((namespace: string, name: string) => {
      const element = createElementNS(namespace, name);
      if (name === "img") {
        let source = "";
        Object.defineProperty(element, "src", {
          configurable: true,
          set(value: string) { source = value; },
        });
        Object.defineProperty(window, "releaseMapTexture", {
          configurable: true,
          value: () => new Promise<void>((resolve) => {
            element.addEventListener("load", () => resolve(), { once: true });
            Reflect.deleteProperty(element, "src");
            (element as HTMLImageElement).src = source;
          }),
        });
      }
      return element;
    }) as typeof document.createElementNS;
  });
  await page.goto("/");

  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "loading");
  await expect(page.locator(".map-placeholder")).toBeVisible();
  await expect(page.getByRole("button", { name: "Zoom in" })).toBeDisabled();
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  const renderCount = await host.getAttribute("data-render-count");
  await page.evaluate(async () => {
    const release = (window as Window & { releaseMapTexture?: () => Promise<void> }).releaseMapTexture;
    await release?.();
  });
  await expect(host).toHaveAttribute("data-webgl", "loading");
  await expect(host).toHaveAttribute("data-render-count", renderCount ?? "0");
});

test("a real marker pointer opens its existing POI detail; drag and empty clicks do not", async ({ page }) => {
  await page.goto("/");
  const canvas = page.locator("canvas");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");

  const marker = await markerPoint(page, "kosmicare");
  const detailHref = await page.locator(`[data-poi-slug='${marker.slug}']`).getAttribute("href");
  await page.mouse.click(marker.x, marker.y);
  await expect(page).toHaveURL(new RegExp(`${detailHref?.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`));
  await expect(page.getByRole("heading", { name: "Kosmicare" })).toBeVisible();
  await page.waitForLoadState("load");
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/\/#kosmicare$/);
  await expect(page.locator("[data-poi-slug='kosmicare']")).toBeFocused();
  const returnUrl = page.url();

  await expect(host).toHaveAttribute("data-webgl", "ready");
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Map canvas is missing");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 18, box.y + box.height / 2 + 12);
  await page.mouse.up();
  await expect(page).toHaveURL(returnUrl);
  await page.mouse.click(box.x + 2, box.y + 2);
  await expect(page).toHaveURL(returnUrl);
});

test("category icons render in the map and hover previews are dismissible without navigation", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  const legend = page.getByRole("list", { name: "Map marker legend" });
  await expect(legend.locator("li")).toHaveCount(10);
  const canvas = page.locator(".map-canvas");
  const baseline = await canvas.screenshot();
  const marker = await markerPoint(page, "kosmicare");
  await page.mouse.move(marker.x, marker.y);
  const preview = page.getByRole("region", { name: "Map place preview" });
  await expect(preview.getByText("Kosmicare", { exact: true })).toBeVisible();
  await expect(preview.getByText("Care and assembly points", { exact: true })).toBeVisible();
  await expect(canvas).toHaveCSS("cursor", "pointer");
  const highlighted = await canvas.screenshot();
  expect(highlighted.equals(baseline)).toBe(false);
  await page.screenshot({ path: testInfo.outputPath("category-markers-desktop.png") });
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze();
  expect(violations).toEqual([]);

  // The preview can be hovered and focused without disappearing beneath the pointer.
  await preview.getByRole("link", { name: "View place" }).hover();
  await expect(preview).toBeVisible();
  await preview.getByRole("link", { name: "View place" }).focus();
  await page.keyboard.press("Escape");
  await expect(preview).toBeHidden();
  await expect(page.locator("[data-poi-slug='kosmicare']")).toBeFocused();
  await expect(page).toHaveURL(/\/$/);
});

test("keyboard list focus previews the corresponding named marker and retains category identity", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const preview = page.getByRole("region", { name: "Map place preview" });
  const yoga = page.locator("[data-poi-slug='yoga-dome']");
  await yoga.focus();
  await expect(preview.getByText("Yoga Dome", { exact: true })).toBeVisible();
  await expect(preview.getByText("Healing", { exact: true })).toBeVisible();
  await expect(yoga).toHaveAttribute("aria-current", "true");
  await page.locator("[data-poi-slug='dance-temple']").focus();
  await expect(preview.getByText("Dance Temple", { exact: true })).toBeVisible();
  await expect(preview.getByText("Dance floors", { exact: true })).toBeVisible();
  await expect(yoga).not.toHaveAttribute("aria-current", "true");
  await page.keyboard.press("Enter");
  await expect(page.getByRole("heading", { name: "Dance Temple" })).toBeVisible();
});

test("touch marker selection previews a place before explicit detail navigation", async ({ browser }, testInfo) => {
  const baseURL = testInfo.project.use.baseURL;
  if (!baseURL) throw new Error("Touch map test requires the configured base URL");
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, hasTouch: true });
  const page = await context.newPage();
  try {
    await page.goto("/");
    await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
    const marker = await markerPoint(page, "kosmicare");
    await page.touchscreen.tap(marker.x, marker.y);
    const preview = page.getByRole("region", { name: "Map place preview" });
    await expect(preview.getByText("Kosmicare", { exact: true })).toBeVisible();
    await expect(page).toHaveURL(/\/$/);
    const mapBox = await page.locator("[data-map-enhancement]").boundingBox();
    const previewBox = await preview.boundingBox();
    expect(previewBox!.y).toBeGreaterThan(mapBox!.y + mapBox!.height);
    const action = preview.getByRole("link", { name: "View place" });
    const actionBox = await action.boundingBox();
    expect(actionBox?.height).toBeGreaterThanOrEqual(44);
    expect(await page.locator("body").evaluate((body) => body.scrollWidth)).toBeLessThanOrEqual(390);
    await page.screenshot({ path: testInfo.outputPath("category-markers-touch.png") });
    await action.tap();
    await expect(page.getByRole("heading", { name: "Kosmicare" })).toBeVisible();
    await page.waitForLoadState("load");
    await page.keyboard.press("Escape");
    await expect(page).toHaveURL(/\/#kosmicare$/);
    await expect(page.locator("[data-poi-slug='kosmicare']")).toBeFocused();
    await expect(preview.getByText("Kosmicare", { exact: true })).toBeVisible();
  } finally {
    await context.close();
  }
});

test("slow marker drags pan without accidentally opening a place", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const marker = await markerPoint(page, "kosmicare");
  await page.mouse.move(marker.x, marker.y);
  await page.mouse.down();
  await page.mouse.move(marker.x + 20, marker.y + 10, { steps: 20 });
  await page.mouse.up();
  await expect(page).toHaveURL(/\/$/);
});
