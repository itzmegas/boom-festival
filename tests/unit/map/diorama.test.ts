import { describe, expect, it, vi } from "vitest";
import { Box3, InstancedMesh, Mesh, Vector3 } from "three";
import { createMapDiorama } from "../../../src/scripts/map/diorama";
import { createDisposalRegistry } from "../../../src/scripts/map/lifecycle";

const PLAN = { width: 10, depth: 20 / 3 };

describe("schematic diorama", () => {
  it("keeps the slab below the texture and all decoration within the plan footprint", () => {
    const resources = createDisposalRegistry();
    const group = createMapDiorama(PLAN, resources);
    const slab = group.getObjectByName("terrain-edge");
    expect(slab).toBeDefined();
    const slabBounds = new Box3().setFromObject(slab!);
    expect(slabBounds.max.y).toBeLessThan(-0.01);
    expect(slabBounds.getSize(new Vector3()).x).toBeCloseTo(PLAN.width);
    expect(slabBounds.getSize(new Vector3()).z).toBeCloseTo(PLAN.depth);

    const bounds = new Box3().setFromObject(group);
    expect(bounds.min.x).toBeGreaterThanOrEqual(-PLAN.width / 2);
    expect(bounds.max.x).toBeLessThanOrEqual(PLAN.width / 2);
    expect(bounds.min.z).toBeGreaterThanOrEqual(-PLAN.depth / 2);
    expect(bounds.max.z).toBeLessThanOrEqual(PLAN.depth / 2);
    expect(bounds.max.y).toBeGreaterThan(0.5);
    expect(bounds.max.y).toBeLessThan(0.65);
    resources.dispose();
  });

  it("batches trees and tents and registers every GPU resource for teardown", () => {
    const resources = createDisposalRegistry();
    const track = vi.spyOn(resources, "track");
    const group = createMapDiorama(PLAN, resources);
    const tracked = new Set(track.mock.calls.map(([resource]) => resource));
    group.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      expect(tracked.has(object.geometry)).toBe(true);
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const surface of materials) expect(tracked.has(surface)).toBe(true);
      if (object instanceof InstancedMesh) expect(tracked.has(object)).toBe(true);
    });
    for (const [name, count] of [["tree-crowns", 18], ["camping-tents", 24]] as const) {
      const mesh = group.getObjectByName(name) as InstancedMesh;
      expect(mesh).toBeInstanceOf(InstancedMesh);
      expect(mesh.count).toBe(count);
      expect([...mesh.instanceMatrix.array].every(Number.isFinite)).toBe(true);
    }
    const disposals = [...tracked].map((resource) => vi.spyOn(resource, "dispose"));
    resources.dispose();
    resources.dispose();
    for (const dispose of disposals) expect(dispose).toHaveBeenCalledTimes(1);
  });
});
