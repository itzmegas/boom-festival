import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Vector3 } from "three";
import {
  CAMERA_PRESET,
  capDevicePixelRatio,
  clampCameraState,
  panCamera,
  positionForCamera,
  resizeCameraProjection,
  zoomCamera,
  fitPlanCamera,
  boundsForOverview,
  anchorCamera,
  planPointAtScreen,
  pinchCamera,
  type IsometricCameraBounds,
} from "../../../src/scripts/map/camera-controls";

const bounds: IsometricCameraBounds = {
  minTargetX: -3,
  maxTargetX: 3,
  minTargetZ: -2,
  maxTargetZ: 2,
  minDistance: 7,
  maxDistance: 18,
};

describe("bounded isometric camera", () => {
  it("uses the fixed 30 degree pitch and 45 degree yaw preset", () => {
    expect(CAMERA_PRESET.pitchDegrees).toBe(30);
    expect(CAMERA_PRESET.yawDegrees).toBe(45);

    const position = positionForCamera({ targetX: 0, targetZ: 0, distance: 10 });
    expect(position.x).toBeCloseTo(6.124, 3);
    expect(position.y).toBeCloseTo(5, 3);
    expect(position.z).toBeCloseTo(6.124, 3);
  });

  it("clamps plan-plane pan and distance without changing camera angles", () => {
    const initial = { targetX: 0, targetZ: 0, distance: 10 };

    expect(panCamera(initial, 20, -20, bounds)).toEqual({
      targetX: 3,
      targetZ: -2,
      distance: 10,
    });
    expect(zoomCamera(initial, -100, bounds).distance).toBe(7);
    expect(zoomCamera(initial, 100, bounds).distance).toBe(18);
    expect(clampCameraState({ targetX: -8, targetZ: 9, distance: 0 }, bounds)).toEqual({
      targetX: -3,
      targetZ: 2,
      distance: 7,
    });
  });

  it("updates perspective projection dimensions on resize", () => {
    let updates = 0;
    const camera = {
      aspect: 1,
      updateProjectionMatrix: () => {
        updates += 1;
      },
    };

    resizeCameraProjection(camera, 960, 640);

    expect(camera.aspect).toBe(1.5);
    expect(updates).toBe(1);
  });

  it("caps renderer pixel density at two", () => {
    expect(capDevicePixelRatio(0.75)).toBe(0.75);
    expect(capDevicePixelRatio(1)).toBe(1);
    expect(capDevicePixelRatio(3.5)).toBe(2);
    expect(capDevicePixelRatio(Number.NaN)).toBe(1);
  });
});

describe("anchored pinch zoom", () => {
  const state = { targetX: 0, targetZ: 0, distance: 12 };
  const anchor = { x: 1, z: -1 };

  it("uses starting separation rather than accumulated event deltas", () => {
    const zoomed = pinchCamera(state, 40, 80, anchor, { x: 0.1, y: -0.2 }, 1.5, bounds);
    expect(zoomed.distance).toBe(bounds.minDistance);
    const point = planPointAtScreen(zoomed, { x: 0.1, y: -0.2 }, 1.5)!;
    expect(point.x).toBeCloseTo(anchor.x);
    expect(point.z).toBeCloseTo(anchor.z);
    expect(pinchCamera(state, 40, 60, anchor, { x: 0, y: 0 }, 1.5, bounds).distance).toBe(8);
    expect(pinchCamera(state, 40, 20, anchor, { x: 0, y: 0 }, 1.5, bounds).distance).toBe(bounds.maxDistance);
  });

  it.each([0, 0.001, 1e9, Number.NaN, Infinity])("keeps zoom finite for separation %s", (separation) => {
    const next = pinchCamera(state, 0, separation, anchor, { x: 0, y: 0 }, 1.5, bounds);
    expect(Object.values(next).every(Number.isFinite)).toBe(true);
    expect(next.distance).toBeGreaterThanOrEqual(bounds.minDistance);
    expect(next.distance).toBeLessThanOrEqual(bounds.maxDistance);
  });
});

describe("responsive overview", () => {
  const plan = { width: 10, depth: 20 / 3 };

  it.each([[300, 200], [340, 227], [410, 273], [470, 313], [900, 563]])(
    "fits the plan and marker clearance in %ix%i without covering controls",
    (width, height) => {
      const state = fitPlanCamera(plan, width, height, 70);
      const position = positionForCamera(state);
      const camera = new PerspectiveCamera(42, width / height, 0.1, 1000);
      camera.position.set(position.x, position.y, position.z);
      camera.lookAt(state.targetX, 0, state.targetZ);
      camera.updateMatrixWorld();
      for (const x of [-5, 5]) for (const z of [-10 / 3, 10 / 3]) for (const y of [0, 0.15]) {
        const projected = new Vector3(x, y, z).project(camera);
        const px = (projected.x + 1) * width / 2;
        const py = (1 - projected.y) * height / 2;
        expect(px).toBeGreaterThanOrEqual(38 - 0.01);
        expect(px).toBeLessThanOrEqual(width - 38 + 0.01);
        expect(py).toBeGreaterThanOrEqual(38 - 0.01);
        expect(py).toBeLessThanOrEqual(height - 70 - 22 + 0.01);
      }
      expect(clampCameraState(state, boundsForOverview(plan, state))).toEqual(state);
    },
  );

  it("keeps geometry finite even for a temporarily zero-sized viewport", () => {
    const state = fitPlanCamera(plan, 0, 0, 70);
    expect(Object.values(state).every(Number.isFinite)).toBe(true);
  });

  it("anchors edge places and arbitrary screen points without changing zoom", () => {
    const state = fitPlanCamera(plan, 340, 227, 70);
    const bounds = boundsForOverview(plan, state);
    const anchor = { x: 5, z: -10 / 3 };
    const screen = { x: 0, y: 0.2 };
    const focused = anchorCamera(state, anchor, screen, 340 / 227, bounds, 0.15);
    expect(focused.distance).toBe(state.distance);
    const point = planPointAtScreen(focused, screen, 340 / 227, 0.15)!;
    expect(point.x).toBeCloseTo(anchor.x);
    expect(point.z).toBeCloseTo(anchor.z);
  });
});
