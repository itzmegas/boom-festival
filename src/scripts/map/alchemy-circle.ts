import * as THREE from "three";
import type { DisposalRegistry } from "./lifecycle";
import { projectToPlanPlane, type PlanDimensions } from "./projection";

// Original ribbed pavilion, not a reconstruction of the 2025 venue.
export function createAlchemyCircle(plan: PlanDimensions, resources: DisposalRegistry): THREE.Group {
  const group = new THREE.Group();
  group.name = "alchemy-circle";
  const point = projectToPlanPlane({ x: 0.42, y: 0.38 }, plan);
  group.position.set(point.x, 0, point.z);
  const wood = resources.track(new THREE.MeshLambertMaterial({ color: 0xa66f40, flatShading: true }));
  const fabric = resources.track(new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide, flatShading: true,
  }));
  const archPoints = Array.from({ length: 17 }, (_, index) => {
    const angle = index / 16 * Math.PI;
    return new THREE.Vector3(Math.cos(angle) * 0.5, 0.08 + Math.sin(angle) * 0.46, 0);
  });
  const arch = resources.track(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(archPoints), 16, 0.018, 5, false));
  const ribs = resources.track(new THREE.InstancedMesh(arch, wood, 9));
  ribs.name = "alchemy-circle-ribs";
  const transform = new THREE.Object3D();
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const palette = [0x5a9490, 0xe4c28a, 0xb96b48, 0xe4c28a].map((color) => new THREE.Color(color));
  for (let rib = 0; rib < ribs.count; rib++) {
    const z = (rib - 4) * 0.135;
    const width = 1 - Math.abs(rib - 4) * 0.075;
    transform.position.set(0, 0, z);
    transform.scale.set(width, 1 - Math.abs(rib - 4) * 0.04, 1);
    transform.updateMatrix();
    ribs.setMatrixAt(rib, transform.matrix);
    // Narrow fabric strips leave daylight between the wooden ribs.
    for (let segment = 2; segment < 14; segment++) {
      const start = positions.length / 3;
      for (const edge of [segment, segment + 1]) {
        const angle = edge / 16 * Math.PI;
        for (const offset of [-0.04, 0.04]) {
          positions.push(Math.cos(angle) * 0.5 * width,
            (0.08 + Math.sin(angle) * 0.46) * transform.scale.y + 0.008, z + offset);
          colors.push(...palette[rib % palette.length]!.toArray());
        }
      }
      indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3);
    }
  }
  ribs.instanceMatrix.needsUpdate = true;
  const geometry = resources.track(new THREE.BufferGeometry());
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  const canopy = new THREE.Mesh(geometry, fabric);
  canopy.name = "alchemy-circle-fabric";
  group.add(ribs, canopy);
  return group;
}
