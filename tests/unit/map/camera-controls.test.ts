import { describe, expect, it } from "vitest";
import {
  CAMERA_PRESET,
  capDevicePixelRatio,
  clampCameraState,
  panCamera,
  positionForCamera,
  resizeCameraProjection,
  zoomCamera,
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
