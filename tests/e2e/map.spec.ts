import { expect, test } from "@playwright/test";

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
  await expect(page.getByRole("link", { name: /Kosmicare/ })).toBeVisible();
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
  await expect(page.locator("h1")).not.toHaveText("Independent Boom 2025 map");
  await page.waitForLoadState("load");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(new RegExp(`/#${slug}$`));
  await expect(page.locator(`[data-poi-slug='${slug}']`)).toBeFocused();
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
