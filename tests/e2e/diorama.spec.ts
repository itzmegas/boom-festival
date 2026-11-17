import { expect, test } from "@playwright/test";
import { cameraState, markerPoint, projectPoints } from "./map-helpers";

test("raised tree crowns render above the intact plan texture", async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/");
  await expect(page.locator("[data-map-enhancement]")).toHaveAttribute("data-webgl", "ready");
  const canvas = page.locator("canvas");
  // This crown is well away from every marker and above its flat SVG counterpart.
  const points = await projectPoints(page, [
    [(906 / 960 - 0.5) * 10, 0.4, (241 / 640 - 0.5) * 20 / 3],
    [(850 / 960 - 0.5) * 10, 0, (345 / 640 - 0.5) * 20 / 3],
  ]);
  const box = await canvas.boundingBox();
  if (!box) throw new Error("Expected diorama canvas");
  const screenshot = await canvas.screenshot();
  const pixels = await page.evaluate(async ({ encoded, samples }) => {
    const image = new Image();
    image.src = `data:image/png;base64,${encoded}`;
    await image.decode();
    const copy = document.createElement("canvas");
    copy.width = image.width;
    copy.height = image.height;
    const context = copy.getContext("2d");
    if (!context) throw new Error("Canvas2D unavailable");
    context.drawImage(image, 0, 0);
    return samples.map(({ x, y }) => [...context.getImageData(Math.floor(x), Math.floor(y), 1, 1).data]);
  }, { encoded: screenshot.toString("base64"), samples: points.map(({ x, y }) => ({ x: x - box.x, y: y - box.y })) });
  const [foliage, lake] = pixels;
  expect(foliage![1]).toBeGreaterThan(foliage![0]!);
  expect(foliage![1]).toBeGreaterThan(foliage![2]!);
  expect(lake![2]).toBeGreaterThan(lake![0]! + 20);
  expect(lake![1]).toBeGreaterThan(lake![0]! + 20);
  await page.screenshot({ path: testInfo.outputPath("isometric-diorama-desktop.png") });
});

for (const width of [1440, 390]) {
  for (const [slug, name] of [["dance-temple", "Dance Temple"], ["alchemy-circle", "Alchemy Circle"]] as const) {
  test.describe(`${name} at ${width}px`, () => {
    test.use({ hasTouch: width === 390 });
    test("remains selectable above its canopy", async ({ page }, testInfo) => {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 1000 });
      await page.goto(`/?poi=${slug}#poi-${slug}`);
      const host = page.locator("[data-map-enhancement]");
      await expect(host).toHaveAttribute("data-webgl", "ready");
      const preview = page.getByRole("region", { name: "Map place preview" });
      await expect(preview).toBeFocused();
      await page.getByRole("button", { name: "Dismiss place preview" }).click();
      const initial = await cameraState(page);
      await page.locator("canvas").hover({ position: { x: 10, y: 10 } });
      await page.mouse.wheel(0, -100000);
      await expect.poll(async () => (await cameraState(page)).distance).toBeCloseTo(initial.distance * 0.35);
      await page.screenshot({ path: testInfo.outputPath(`${slug}-${width}-zoomed.png`) });
      const marker = await markerPoint(page, slug);
      if (width === 390) {
        await page.touchscreen.tap(marker.x, marker.y);
        await expect(host).toHaveAttribute("data-selected-poi", slug);
        await expect(page).toHaveURL(`/?poi=${slug}#poi-${slug}`);
        await preview.getByRole("link", { name: /View place/ }).click();
      } else {
        await page.mouse.click(marker.x, marker.y);
      }
      await expect(page).toHaveURL(`/poi/boom-2025/${slug}/`);
      await expect(page.getByRole("heading", { name, exact: true })).toBeVisible();
    });
  });
  }
}
