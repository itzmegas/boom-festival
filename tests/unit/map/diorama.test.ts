import { describe, expect, it, vi } from "vitest";
import { Box3, DoubleSide, InstancedMesh, Mesh, MeshLambertMaterial, Vector3 } from "three";
import { createMapDiorama } from "../../../src/scripts/map/diorama";
import { createDisposalRegistry } from "../../../src/scripts/map/lifecycle";
import danceTemple from "../../../src/content/pois/dance-temple.json";
import alchemyCircle from "../../../src/content/pois/alchemy-circle.json";

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
    for (const [name, count] of [["tree-crowns", 28], ["camping-tents", 24], ["alchemy-circle-ribs", 9],
      ["dance-temple-supports", 12], ["dance-temple-branches", 24]] as const) {
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

  it("anchors Alchemy Circle to its POI with an open-ended ribbed canopy", () => {
    const resources = createDisposalRegistry();
    const group = createMapDiorama(PLAN, resources);
    const pavilion = group.getObjectByName("alchemy-circle")!;
    expect(pavilion.position.x).toBeCloseTo((alchemyCircle.plan.x - 0.5) * PLAN.width);
    expect(pavilion.position.z).toBeCloseTo((alchemyCircle.plan.y - 0.5) * PLAN.depth);
    expect(group.getObjectByName("stage-canopy-1")).toBeUndefined();
    for (const id of [2, 3, 4, 5]) expect(group.getObjectByName(`stage-canopy-${id}`)).toBeDefined();
    const fabric = pavilion.getObjectByName("alchemy-circle-fabric") as Mesh;
    const positions = fabric.geometry.getAttribute("position");
    expect(positions.count).toBe(9 * 12 * 4);
    expect(fabric.geometry.index!.count).toBe(9 * 12 * 6);
    for (let index = 0; index < positions.count; index++) {
      expect(positions.getY(index)).toBeGreaterThan(0.2);
      expect([positions.getX(index), positions.getY(index), positions.getZ(index)].every(Number.isFinite)).toBe(true);
    }
    expect((fabric.material as MeshLambertMaterial).side).toBe(DoubleSide);
    resources.dispose();
  });

  it("anchors the radial landmark to its existing POI and keeps a real opening in the canopy", () => {
    const resources = createDisposalRegistry();
    const group = createMapDiorama(PLAN, resources);
    const temple = group.getObjectByName("dance-temple")!;
    expect(temple.position.x).toBeCloseTo((danceTemple.plan.x - 0.5) * PLAN.width);
    expect(temple.position.z).toBeCloseTo((danceTemple.plan.y - 0.5) * PLAN.depth);
    const canopy = temple.getObjectByName("dance-temple-fabric") as Mesh;
    const geometry = canopy.geometry;
    const positions = geometry.getAttribute("position");
    const normals = geometry.getAttribute("normal");
    const colors = geometry.getAttribute("color");
    expect(positions.count).toBe(24 * 6);
    expect(geometry.index!.count).toBe(24 * 12);
    const palette = new Set<string>();
    for (let index = 0; index < positions.count; index++) {
      const x = positions.getX(index);
      const z = positions.getZ(index) / 0.8;
      expect(Math.hypot(x, z)).toBeGreaterThan(0.12);
      expect(Math.hypot(x, z)).toBeLessThanOrEqual(0.801);
      expect(positions.getY(index)).toBeGreaterThanOrEqual(0.31);
      expect(positions.getY(index)).toBeLessThanOrEqual(0.63);
      expect(new Vector3().fromBufferAttribute(normals, index).length()).toBeCloseTo(1);
      palette.add([colors.getX(index), colors.getY(index), colors.getZ(index)].join(","));
    }
    expect(palette.size).toBe(5);
    expect((canopy.material as MeshLambertMaterial).side).toBe(DoubleSide);
    expect(temple.getObjectByName("dance-temple-oculus")).toBeDefined();
    resources.dispose();
  });
});
