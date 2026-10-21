import type { NormalizedPoint, PlanDimensions, PlanPoint } from "./projection";

export const CAMERA_PRESET = {
  pitchDegrees: 30,
  yawDegrees: 45,
  fieldOfViewDegrees: 42,
} as const;

const pitch = CAMERA_PRESET.pitchDegrees * Math.PI / 180;
const yaw = CAMERA_PRESET.yawDegrees * Math.PI / 180;
const tangent = Math.tan(CAMERA_PRESET.fieldOfViewDegrees * Math.PI / 360);

export function fitPlanCamera(
  plan: PlanDimensions,
  width: number,
  height: number,
  bottomInset: number,
): IsometricCameraState {
  const top = 38;
  const bottom = bottomInset + 22;
  width = Math.max(100, width);
  height = Math.max(top + bottom + 16, height);
  const maxX = (1 - 76 / width) * tangent * width / height;
  const minY = (2 * bottom / height - 1) * tangent;
  const maxY = (1 - 2 * top / height) * tangent;
  const centerY = (bottom - top) / height * tangent;
  // Shift the overview above the controls without wasting the same space at the top.
  const offset = centerY / (Math.sin(pitch) - centerY * Math.cos(pitch));
  const depthFactor = 1 + Math.cos(pitch) * offset;
  let distance = 1;
  for (const x of [-plan.width / 2, plan.width / 2]) {
    for (const z of [-plan.depth / 2, plan.depth / 2]) {
      for (const y of [0, 0.15]) {
        const along = Math.sin(yaw) * x + Math.cos(yaw) * z;
        const across = Math.cos(yaw) * x - Math.sin(yaw) * z;
        const up = -Math.sin(pitch) * along + Math.cos(pitch) * y;
        const depth = -Math.cos(pitch) * along - Math.sin(pitch) * y;
        distance = Math.max(distance,
          (Math.abs(across) / maxX - depth) / depthFactor,
          (up - maxY * depth) / (maxY * depthFactor - Math.sin(pitch) * offset),
          (minY * depth - up) / (Math.sin(pitch) * offset - minY * depthFactor),
        );
      }
    }
  }
  return {
    targetX: Math.sin(yaw) * offset * distance,
    targetZ: Math.cos(yaw) * offset * distance,
    distance,
  };
}

export function boundsForOverview(plan: PlanDimensions, overview: IsometricCameraState): IsometricCameraBounds {
  const reach = overview.distance * 2;
  return {
    minTargetX: -plan.width / 2 - reach,
    maxTargetX: plan.width / 2 + reach,
    minTargetZ: -plan.depth / 2 - reach,
    maxTargetZ: plan.depth / 2 + reach,
    minDistance: overview.distance * 0.35,
    maxDistance: overview.distance * 1.5,
  };
}

export function planPointAtScreen(
  state: IsometricCameraState,
  screen: NormalizedPoint,
  aspect: number,
  elevation = 0,
): PlanPoint | null {
  const sx = screen.x * tangent * aspect;
  const sy = screen.y * tangent;
  const denominator = Math.sin(pitch) - sy * Math.cos(pitch);
  if (denominator <= 0.001) return null;
  const along = (Math.cos(pitch) * elevation - sy * (state.distance - Math.sin(pitch) * elevation)) / denominator;
  const across = sx * (state.distance - Math.cos(pitch) * along - Math.sin(pitch) * elevation);
  return {
    x: state.targetX + Math.sin(yaw) * along + Math.cos(yaw) * across,
    z: state.targetZ + Math.cos(yaw) * along - Math.sin(yaw) * across,
  };
}

export function anchorCamera(
  state: IsometricCameraState,
  anchor: PlanPoint,
  screen: NormalizedPoint,
  aspect: number,
  bounds: IsometricCameraBounds,
  elevation = 0,
): IsometricCameraState {
  const point = planPointAtScreen(state, screen, aspect, elevation);
  return point ? panCamera(state, anchor.x - point.x, anchor.z - point.z, bounds) : state;
}

export function pinchCamera(
  start: IsometricCameraState,
  startingSeparation: number,
  separation: number,
  anchor: PlanPoint | null,
  screen: NormalizedPoint,
  aspect: number,
  bounds: IsometricCameraBounds,
): IsometricCameraState {
  if (!Number.isFinite(startingSeparation) || !Number.isFinite(separation)) return start;
  const state = clampCameraState({
    ...start,
    distance: start.distance * Math.max(1, startingSeparation) / Math.max(1, separation),
  }, bounds);
  return anchor ? anchorCamera(state, anchor, screen, aspect, bounds) : state;
}

export interface IsometricCameraBounds {
  minTargetX: number;
  maxTargetX: number;
  minTargetZ: number;
  maxTargetZ: number;
  minDistance: number;
  maxDistance: number;
}

export interface IsometricCameraState {
  targetX: number;
  targetZ: number;
  distance: number;
}

export interface CameraPosition {
  x: number;
  y: number;
  z: number;
}

export interface PerspectiveProjection {
  aspect: number;
  updateProjectionMatrix(): void;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function capDevicePixelRatio(devicePixelRatio: number): number {
  return Number.isFinite(devicePixelRatio) && devicePixelRatio > 0
    ? Math.min(devicePixelRatio, 2)
    : 1;
}

export function clampCameraState(
  state: IsometricCameraState,
  bounds: IsometricCameraBounds,
): IsometricCameraState {
  return {
    targetX: clamp(state.targetX, bounds.minTargetX, bounds.maxTargetX),
    targetZ: clamp(state.targetZ, bounds.minTargetZ, bounds.maxTargetZ),
    distance: clamp(state.distance, bounds.minDistance, bounds.maxDistance),
  };
}

export function panCamera(
  state: IsometricCameraState,
  deltaX: number,
  deltaZ: number,
  bounds: IsometricCameraBounds,
): IsometricCameraState {
  return clampCameraState(
    {
      ...state,
      targetX: state.targetX + deltaX,
      targetZ: state.targetZ + deltaZ,
    },
    bounds,
  );
}

export function zoomCamera(
  state: IsometricCameraState,
  deltaDistance: number,
  bounds: IsometricCameraBounds,
): IsometricCameraState {
  return clampCameraState({ ...state, distance: state.distance + deltaDistance }, bounds);
}

export function positionForCamera(state: IsometricCameraState): CameraPosition {
  const pitch = (CAMERA_PRESET.pitchDegrees * Math.PI) / 180;
  const yaw = (CAMERA_PRESET.yawDegrees * Math.PI) / 180;
  const horizontalDistance = Math.cos(pitch) * state.distance;
  return {
    x: state.targetX + Math.sin(yaw) * horizontalDistance,
    y: Math.sin(pitch) * state.distance,
    z: state.targetZ + Math.cos(yaw) * horizontalDistance,
  };
}

export function resizeCameraProjection(
  camera: PerspectiveProjection,
  width: number,
  height: number,
): void {
  camera.aspect = width / Math.max(1, height);
  camera.updateProjectionMatrix();
}
