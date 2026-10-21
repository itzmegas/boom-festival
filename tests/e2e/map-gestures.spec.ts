import { expect, test } from "@playwright/test";
import { cameraState, markerPoint, planAtPoint, projectPoints } from "./map-helpers";

test.use({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 } });

test("two real touch pointers zoom about their moving midpoint without selecting or navigating", async ({ page, context }) => {
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  await page.locator("[data-poi-slug='kosmicare']").focus();
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const rect = (await page.locator("canvas").boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const anchor = await planAtPoint(page, x, y);
  const start = await cameraState(page);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: x - 30, y }, { id: 2, x: x + 30, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x - 50, y: y + 5 }, { id: 2, x: x + 70, y: y + 5 }] });
  await expect.poll(async () => (await cameraState(page)).distance).toBeCloseTo(start.distance / 2);
  const projected = (await projectPoints(page, [anchor]))[0]!;
  expect(Math.hypot(projected.x - (x + 10), projected.y - (y + 5))).toBeLessThan(4);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(host).toHaveAttribute("data-selected-poi", "kosmicare");
  await expect(page).toHaveURL(/\/$/);
  expect(await page.evaluate(() => window.visualViewport?.scale)).toBe(1);
});

test("pinch, buttons and wheel share the same finite zoom limits", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const start = await cameraState(page);
  const rect = (await page.locator("canvas").boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: x - 20, y }, { id: 2, x: x + 20, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x - 100, y }, { id: 2, x: x + 100, y }] });
  await expect.poll(async () => (await cameraState(page)).distance).toBeCloseTo(start.distance * 0.35);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("button", { name: "Zoom in", exact: true }).click();
  expect((await cameraState(page)).distance).toBeCloseTo(start.distance * 0.35);
  await page.getByRole("button", { name: "Reset view", exact: true }).click();
  await expect.poll(() => cameraState(page)).toEqual(start);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: x - 50, y }, { id: 2, x: x + 50, y }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: x - 1, y }, { id: 2, x: x + 1, y }] });
  await expect.poll(async () => (await cameraState(page)).distance).toBeCloseTo(start.distance * 1.5);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await page.getByRole("button", { name: "Zoom out", exact: true }).click();
  await page.mouse.move(x, y);
  await page.mouse.wheel(0, 100000);
  await expect.poll(async () => (await cameraState(page)).distance).toBeCloseTo(start.distance * 1.5);
  expect(Object.values(await cameraState(page)).every(Number.isFinite)).toBe(true);
});

test("native scrolling and page zoom remain available outside the canvas", async ({ page, context }) => {
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  await page.locator("[data-poi-slug='boom-medical']").scrollIntoViewIfNeeded();
  const before = await page.evaluate(() => window.scrollY);
  const cdp = await context.newCDPSession(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 5, y: 700 }] });
  for (const y of [600, 500, 400, 300]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: 5, y }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(before);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: 160, y: 200 }, { id: 2, x: 230, y: 200 }] });
  for (const delta of [10, 20, 40, 60]) {
    await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ id: 1, x: 160 - delta, y: 200 }, { id: 2, x: 230 + delta, y: 200 }] });
  }
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect.poll(() => page.evaluate(() => window.visualViewport?.scale ?? 1)).toBeGreaterThan(1);
});

test("two-to-one transition rebases pan, ignores extra fingers and suppresses taps until release", async ({ page, context }) => {
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  await page.locator("canvas").scrollIntoViewIfNeeded();
  const rect = (await page.locator("canvas").boundingBox())!;
  const x = rect.x + rect.width / 2;
  const y = rect.y + rect.height / 2;
  const cdp = await context.newCDPSession(page);
  const first = { id: 1, x: x - 30, y };
  const second = { id: 2, x: x + 30, y };
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second] });
  const before = await cameraState(page);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [first, second, { id: 3, x, y: y + 40 }] });
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [first, second, { id: 3, x: x + 40, y: y + 40 }] });
  expect(await cameraState(page)).toEqual(before);
  // CDP touchEnd lists the released points, not the remaining contacts.
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [second, { id: 3, x: x + 40, y: y + 40 }] });
  expect(await cameraState(page)).toEqual(before);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchMove", touchPoints: [{ ...first, x: first.x + 2 }] });
  await expect.poll(() => cameraState(page)).not.toEqual(before);
  const after = await cameraState(page);
  expect(after.distance).toBe(before.distance);
  expect(Math.hypot(after.targetX - before.targetX, after.targetZ - before.targetZ)).toBeLessThan(0.5);
  await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  await expect(page.getByRole("region", { name: "Map place preview" })).toBeHidden();
  const marker = await markerPoint(page, "kosmicare");
  await page.touchscreen.tap(marker.x, marker.y);
  await expect(host).toHaveAttribute("data-selected-poi", "kosmicare");
});

test("cancelled or lost pointer capture does not poison the next touch gesture", async ({ page, context }) => {
  await page.goto("/");
  const host = page.locator("[data-map-enhancement]");
  await expect(host).toHaveAttribute("data-webgl", "ready");
  const cdp = await context.newCDPSession(page);
  await page.locator("canvas").scrollIntoViewIfNeeded();
  for (const cancel of [true, false]) {
    const marker = await markerPoint(page, "kosmicare");
    await cdp.send("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [{ id: 1, x: marker.x, y: marker.y }, { id: 2, x: marker.x + 20, y: marker.y }] });
    if (cancel) {
      await cdp.send("Input.dispatchTouchEvent", { type: "touchCancel", touchPoints: [] });
    } else {
      await page.locator("canvas").evaluate((canvas) => {
        for (let pointerId = 1; pointerId < 20; pointerId++) {
          if (canvas.hasPointerCapture(pointerId)) canvas.releasePointerCapture(pointerId);
        }
      });
      await cdp.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
    }
    await expect(page.getByRole("region", { name: "Map place preview" })).toBeHidden();
    await page.touchscreen.tap(marker.x, marker.y);
    await expect(host).toHaveAttribute("data-selected-poi", "kosmicare");
    await page.getByRole("button", { name: "Dismiss place preview" }).click();
    await page.locator("canvas").scrollIntoViewIfNeeded();
  }
});
