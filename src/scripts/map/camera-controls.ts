export const CAMERA_PRESET = {
  pitchDegrees: 30,
  yawDegrees: 45,
  fieldOfViewDegrees: 42,
} as const;

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
