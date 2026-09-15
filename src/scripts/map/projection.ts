export interface NormalizedPoint {
  x: number;
  y: number;
}

export interface PlanDimensions {
  width: number;
  depth: number;
}

export interface PlanPoint {
  x: number;
  z: number;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function clampNormalizedPoint(point: NormalizedPoint): NormalizedPoint {
  return {
    x: clamp(point.x, 0, 1),
    y: clamp(point.y, 0, 1),
  };
}

export function projectToPlanPlane(
  point: NormalizedPoint,
  dimensions: PlanDimensions,
): PlanPoint {
  const normalized = clampNormalizedPoint(point);
  return {
    x: (normalized.x - 0.5) * dimensions.width,
    z: (normalized.y - 0.5) * dimensions.depth,
  };
}
