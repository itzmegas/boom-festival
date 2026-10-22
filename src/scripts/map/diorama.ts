import * as THREE from "three";
import type { DisposalRegistry } from "./lifecycle";
import { projectToPlanPlane, type PlanDimensions } from "./projection";

// Authored against the original 960 × 640 schematic, not surveyed geography.
const TREES = [
  [140, 123], [170, 146], [229, 129], [293, 160], [338, 169],
  [89, 217], [107, 262], [81, 307], [103, 351], [170, 354],
  [143, 410], [177, 487], [222, 503], [311, 512],
  [872, 204], [906, 241], [915, 440], [875, 532],
] as const;

export function createMapDiorama(plan: PlanDimensions, resources: DisposalRegistry): THREE.Group {
  const group = new THREE.Group();
  group.name = "schematic-diorama";
  group.add(new THREE.HemisphereLight(0xfff4d9, 0x667353, 2));
  const sunlight = new THREE.DirectionalLight(0xfff1d3, 2.5);
  sunlight.position.set(-3, 8, 4);
  group.add(sunlight);

  const material = (color: number) => resources.track(new THREE.MeshLambertMaterial({ color, flatShading: true }));
  const earth = material(0xb59b73);
  const wood = material(0x826046);
  const leaves = material(0x73945c);
  const canvas = material(0xe9d6a4);
  const terracotta = material(0xb97457);
  const sage = material(0x9ca879);
  const box = resources.track(new THREE.BoxGeometry(1, 1, 1));
  const crown = resources.track(new THREE.IcosahedronGeometry(1, 0));
  const roof = resources.track(new THREE.ConeGeometry(1, 1, 8));
  const tent = resources.track(new THREE.ConeGeometry(1, 1, 4));
  tent.rotateY(Math.PI / 4);
  const platform = resources.track(new THREE.CylinderGeometry(1, 1, 1, 12));
  const shadow = resources.track(new THREE.CircleGeometry(1, 16));
  shadow.rotateX(-Math.PI / 2);
  const shade = resources.track(new THREE.MeshBasicMaterial({
    color: 0x4a503b, transparent: true, opacity: 0.16, depthWrite: false,
  }));

  const add = (name: string, geometry: THREE.BufferGeometry, surface: THREE.Material,
    x: number, y: number, elevation: number, width: number, height: number, depth: number) => {
    const mesh = new THREE.Mesh(geometry, surface);
    const point = projectToPlanPlane({ x: x / 960, y: y / 640 }, plan);
    mesh.name = name;
    mesh.position.set(point.x, elevation, point.z);
    mesh.scale.set(width, height, depth);
    group.add(mesh);
    return mesh;
  };

  // Keep the slab below the texture plane to avoid coplanar depth fighting.
  add("terrain-edge", box, earth, 480, 320, -0.135, plan.width, 0.24, plan.depth);

  const trunks = resources.track(new THREE.InstancedMesh(box, wood, TREES.length));
  const crowns = resources.track(new THREE.InstancedMesh(crown, leaves, TREES.length));
  const shadows = resources.track(new THREE.InstancedMesh(shadow, shade, TREES.length));
  trunks.name = "tree-trunks";
  crowns.name = "tree-crowns";
  shadows.name = "tree-shadows";
  shadows.renderOrder = -1;
  const transform = new THREE.Object3D();
  for (const [index, [x, y]] of TREES.entries()) {
    const point = projectToPlanPlane({ x: x / 960, y: y / 640 }, plan);
    const size = 0.85 + index % 4 * 0.1;
    transform.rotation.set(0, index * 0.7, 0);
    transform.position.set(point.x, 0.12, point.z);
    transform.scale.set(0.045, 0.24, 0.045);
    transform.updateMatrix();
    trunks.setMatrixAt(index, transform.matrix);
    transform.position.y = 0.29 * size;
    transform.scale.set(0.17 * size, 0.22 * size, 0.17 * size);
    transform.updateMatrix();
    crowns.setMatrixAt(index, transform.matrix);
    transform.rotation.set(0, 0, 0);
    transform.position.set(point.x + 0.06, 0.006, point.z + 0.04);
    transform.scale.set(0.24 * size, 1, 0.17 * size);
    transform.updateMatrix();
    shadows.setMatrixAt(index, transform.matrix);
  }
  for (const mesh of [trunks, crowns, shadows]) mesh.instanceMatrix.needsUpdate = true;
  group.add(trunks, crowns, shadows);

  for (const [index, [x, y, radius]] of ([
    [557, 262, 0.56], [403, 243, 0.4], [461, 141, 0.36],
    [154, 230, 0.32], [605, 179, 0.32], [211, 282, 0.34],
  ] as const).entries()) {
    add(`stage-platform-${index}`, platform, wood, x, y, 0.04, radius, 0.08, radius);
    add(`stage-canopy-${index}`, roof, index % 2 ? terracotta : canvas,
      x, y, 0.4, radius, 0.24, radius);
    for (const [dx, dy] of [[-1, -1], [-1, 1], [1, -1], [1, 1]] as const) {
      add("canopy-post", box, wood, x + dx * radius * 55, y + dy * radius * 55,
        0.19, 0.025, 0.3, 0.025);
    }
  }

  add("healing-dome", crown, canvas, 317, 467, 0.02, 0.32, 0.32, 0.32);
  add("culture-pavilion", box, terracotta, 326, 250, 0.12, 0.38, 0.24, 0.28);
  add("culture-roof", roof, canvas, 326, 250, 0.3, 0.32, 0.16, 0.32);

  const tents = resources.track(new THREE.InstancedMesh(tent, sage, 24));
  tents.name = "camping-tents";
  for (let index = 0; index < tents.count; index++) {
    const column = index % 8;
    const row = Math.floor(index / 8);
    const point = projectToPlanPlane({ x: (440 + column * 36 + row * 8) / 960, y: (510 + row * 25) / 640 }, plan);
    transform.position.set(point.x, 0.07, point.z);
    transform.rotation.set(0, row * 0.15, 0);
    transform.scale.set(0.11, 0.14, 0.16);
    transform.updateMatrix();
    tents.setMatrixAt(index, transform.matrix);
  }
  tents.instanceMatrix.needsUpdate = true;
  group.add(tents);
  return group;
}
