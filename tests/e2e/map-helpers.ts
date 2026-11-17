import type { Page } from "@playwright/test";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";

export async function cameraState(page: Page) {
  const state = await page.locator("canvas").getAttribute("data-camera");
  if (!state) throw new Error("Rendered camera state is missing");
  return JSON.parse(state) as { targetX: number; targetZ: number; distance: number; yawDegrees?: number; pitchDegrees?: number };
}

async function projection(page: Page) {
  const state = await cameraState(page);
  const rect = await page.locator("canvas").boundingBox();
  if (!rect) throw new Error("Map canvas is missing");
  const camera = new PerspectiveCamera(42, rect.width / rect.height, 0.1, 10000);
  const pitch = (state.pitchDegrees ?? 30) * Math.PI / 180;
  const yaw = (state.yawDegrees ?? 45) * Math.PI / 180;
  const horizontal = Math.cos(pitch) * state.distance;
  camera.position.set(state.targetX + Math.sin(yaw) * horizontal, Math.sin(pitch) * state.distance,
    state.targetZ + Math.cos(yaw) * horizontal);
  camera.lookAt(state.targetX, 0, state.targetZ);
  camera.updateMatrixWorld();
  return { camera, rect };
}

export async function planAtPoint(page: Page, x: number, y: number) {
  const { camera, rect } = await projection(page);
  const ray = new Raycaster();
  ray.setFromCamera(new Vector2(2 * (x - rect.x) / rect.width - 1, 1 - 2 * (y - rect.y) / rect.height), camera);
  const point = ray.ray.intersectPlane(new Plane(new Vector3(0, 1, 0), 0), new Vector3());
  if (!point) throw new Error("Expected plan plane under gesture");
  return point.toArray();
}

export async function projectPoints(page: Page, points: number[][]) {
  const { camera, rect } = await projection(page);
  return points.map(([x, y, z]) => {
    const point = new Vector3(x, y, z).project(camera);
    return { x: rect.x + (point.x + 1) * rect.width / 2, y: rect.y + (1 - point.y) * rect.height / 2 };
  });
}

export async function markerPoint(page: Page, slug: string) {
  const point = await page.locator("[data-map-enhancement]").evaluate((host, slug) => {
    const pois = JSON.parse(host.getAttribute("data-pois") ?? "[]") as Array<{ slug: string; x: number; y: number }>;
    const poi = pois.find((poi) => poi.slug === slug);
    if (!poi) throw new Error(`Expected marker ${slug}`);
    return [(poi.x - 0.5) * 10, 0.15, (poi.y - 0.5) * 20 / 3];
  }, slug);
  return { slug, ...(await projectPoints(page, [point]))[0]! };
}
