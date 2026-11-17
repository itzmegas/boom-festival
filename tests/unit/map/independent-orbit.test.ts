import { describe, expect, it } from "vitest";
import { PerspectiveCamera, Plane, Raycaster, Vector2, Vector3 } from "three";
import * as current from "../../../src/scripts/map/camera-controls";

describe("independent orbit contracts", () => {
  it("preserves caller state on rejection and bounds ordinary rotation", () => {
    const state = { targetX: 1, targetZ: -2, distance: 15, yawDegrees: 359, pitchDegrees: 30 };
    const bytes = JSON.stringify(state);
    for (const delta of [[NaN,0],[0,NaN],[Infinity,0],[0,-Infinity]]) {
      expect(current.rotateCamera(state,...delta as [number,number])).toBe(state);
      expect(JSON.stringify(state)).toBe(bytes);
    }
    expect(current.rotateCamera(state, 2, 100)).toEqual({...state,yawDegrees:1,pitchDegrees:89.9});
    expect(current.rotateCamera(state,-360,-100)).toEqual({...state,yawDegrees:359,pitchDegrees:15});
    expect(JSON.stringify(state)).toBe(bytes);
  });
  it("matches independent Three.js plane intersections and anchored movement across the supported orbit", () => {
    let checked = 0;
    for (const yawDegrees of [0,45,90,180,270,359]) for (const pitchDegrees of [15,30,60,89.9]) {
      const state = { targetX: 1, targetZ: -1, distance: 15, yawDegrees, pitchDegrees };
      const bounds = {minTargetX:-100,maxTargetX:100,minTargetZ:-100,maxTargetZ:100,minDistance:2,maxDistance:40};
      const camera = new PerspectiveCamera(42,1.5,0.1,1000);
      const p = current.positionForCamera(state);
      camera.position.set(p.x,p.y,p.z); camera.lookAt(1,0,-1); camera.updateMatrixWorld();
      for (const screen of [{x:-0.3,y:-0.4},{x:0.25,y:0.1}]) {
        const ray = new Raycaster(); ray.setFromCamera(new Vector2(screen.x,screen.y),camera);
        const point = ray.ray.intersectPlane(new Plane(new Vector3(0,1,0),0), new Vector3())!;
        const actual = current.planPointAtScreen(state,screen,1.5)!;
        expect(actual.x).toBeCloseTo(point.x,9); expect(actual.z).toBeCloseTo(point.z,9);
        const target = {x:screen.x+0.05,y:screen.y-0.05};
        const moved = current.pinchCamera(state,100,125,actual,target,1.5,bounds);
        const anchored = current.planPointAtScreen(moved,target,1.5)!;
        expect(anchored.x).toBeCloseTo(point.x,9); expect(anchored.z).toBeCloseTo(point.z,9);
        expect(moved.yawDegrees).toBe(yawDegrees); expect(moved.pitchDegrees).toBe(pitchDegrees);
        checked++;
      }
    }
    console.log(`INDEPENDENT_PROJECTION ${checked} Three.js ray/anchor checks`);
  });
});
