import { describe, expect, it } from "vitest";
import { clampNormalizedPoint, projectToPlanPlane } from "../../../src/scripts/map/projection";

describe("normalized plan projection", () => {
  it("maps top-left normalized coordinates onto a centered plan plane", () => {
    expect(projectToPlanPlane({ x: 0, y: 0 }, { width: 10, depth: 8 })).toEqual({
      x: -5,
      z: -4,
    });
    expect(projectToPlanPlane({ x: 1, y: 1 }, { width: 10, depth: 8 })).toEqual({
      x: 5,
      z: 4,
    });
  });

  it("clamps coordinates to the normalized plan bounds", () => {
    expect(clampNormalizedPoint({ x: -0.2, y: 1.4 })).toEqual({ x: 0, y: 1 });
  });
});
