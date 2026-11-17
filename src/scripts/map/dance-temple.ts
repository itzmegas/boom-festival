import * as THREE from "three";
import type { DisposalRegistry } from "./lifecycle";
import { projectToPlanPlane, type PlanDimensions } from "./projection";

// Original interpretation of the radial fabric and branching supports, not a venue replica.
export function createDanceTemple(plan: PlanDimensions, resources: DisposalRegistry): THREE.Group {
  const group = new THREE.Group();
  group.name = "dance-temple";
  const point = projectToPlanPlane({ x: 0.58, y: 0.41 }, plan);
  group.position.set(point.x, 0, point.z);
  const wood = resources.track(new THREE.MeshLambertMaterial({ color: 0x996438, flatShading: true }));
  const fabric = resources.track(new THREE.MeshLambertMaterial({
    vertexColors: true, side: THREE.DoubleSide, flatShading: true,
  }));
  const palette = [0xefb848, 0xffedbc, 0xcc6c43, 0xffedbc, 0xad497d, 0x72507d].map((color) => new THREE.Color(color));
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const segments = 24;
  for (let sector = 0; sector < segments; sector++) {
    const start = positions.length / 3;
    for (const ring of [0, 1, 2]) {
      for (const edge of [sector, sector + 1]) {
        const angle = edge / segments * Math.PI * 2;
        const radius = ring === 0 ? 0.13 : ring === 1 ? 0.48 : edge % 2 === 0 ? 0.8 : 0.72;
        const height = ring === 0 ? 0.62 : ring === 1 ? 0.47 : edge % 2 === 0 ? 0.48 : 0.32;
        positions.push(Math.cos(angle) * radius, height, Math.sin(angle) * radius * 0.8);
        colors.push(...palette[sector % palette.length]!.toArray());
      }
    }
    indices.push(start, start + 2, start + 1, start + 1, start + 2, start + 3,
      start + 2, start + 4, start + 3, start + 3, start + 4, start + 5);
  }
  const canopyGeometry = resources.track(new THREE.BufferGeometry());
  canopyGeometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  canopyGeometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  canopyGeometry.setIndex(indices);
  canopyGeometry.computeVertexNormals();
  const canopy = new THREE.Mesh(canopyGeometry, fabric);
  canopy.name = "dance-temple-fabric";
  group.add(canopy);

  const beam = resources.track(new THREE.CylinderGeometry(1, 1, 1, 5));
  const supports = resources.track(new THREE.InstancedMesh(beam, wood, 12));
  const branches = resources.track(new THREE.InstancedMesh(beam, wood, 24));
  supports.name = "dance-temple-supports";
  branches.name = "dance-temple-branches";
  const transform = new THREE.Object3D();
  const up = new THREE.Vector3(0, 1, 0);
  for (let index = 0; index < supports.count; index++) {
    const angle = index / supports.count * Math.PI * 2;
    const foot = new THREE.Vector3(Math.cos(angle) * 0.6, 0, Math.sin(angle) * 0.48);
    transform.position.set(foot.x, 0.16, foot.z);
    transform.quaternion.identity();
    transform.scale.set(0.022, 0.32, 0.022);
    transform.updateMatrix();
    supports.setMatrixAt(index, transform.matrix);
    for (const [branch, offset] of [-0.09, 0.09].entries()) {
      const tip = new THREE.Vector3(Math.cos(angle + offset) * 0.8, 0.48, Math.sin(angle + offset) * 0.64);
      const root = new THREE.Vector3(foot.x, 0.26, foot.z);
      const direction = tip.clone().sub(root);
      transform.position.copy(root).add(tip).multiplyScalar(0.5);
      transform.quaternion.setFromUnitVectors(up, direction.clone().normalize());
      transform.scale.set(0.012, direction.length(), 0.012);
      transform.updateMatrix();
      branches.setMatrixAt(index * 2 + branch, transform.matrix);
    }
  }
  supports.instanceMatrix.needsUpdate = true;
  branches.instanceMatrix.needsUpdate = true;
  group.add(supports, branches);

  const oculusGeometry = resources.track(new THREE.TorusGeometry(0.13, 0.016, 4, 24));
  const oculus = new THREE.Mesh(oculusGeometry, wood);
  oculus.name = "dance-temple-oculus";
  oculus.rotation.x = -Math.PI / 2;
  oculus.scale.y = 0.8;
  oculus.position.y = 0.62;
  group.add(oculus);
  return group;
}
