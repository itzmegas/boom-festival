import { expect, test } from "@playwright/test";
import { projectPoints } from "./map-helpers";

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
