import * as THREE from "three";
import {
  CAMERA_PRESET,
  capDevicePixelRatio,
  panCamera,
  positionForCamera,
  resizeCameraProjection,
  zoomCamera,
  type IsometricCameraBounds,
  type IsometricCameraState,
} from "./camera-controls";
import { createDisposalRegistry, createRenderInvalidator } from "./lifecycle";
import { projectToPlanPlane, type NormalizedPoint } from "./projection";
import { dispatchPoiSelect, listenForPoiSelect } from "./selection";

const PLAN = { width: 10, depth: 20 / 3 } as const;
const MARKER_COLOR = 0x5f2879;
const PROMINENT_COLOR = 0xb63c24;
const SELECTED_COLOR = 0xf4bf3a;

export interface MapPoi extends NormalizedPoint {
  slug: string;
  prominent: boolean;
}

export interface MapSceneOptions {
  canvas: HTMLCanvasElement;
  planUrl: string;
  pois: MapPoi[];
  onRender(): void;
}

export interface MapSceneHandle {
  dispose(): void;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
}

function markerColor(poi: MapPoi): number {
  return poi.prominent ? PROMINENT_COLOR : MARKER_COLOR;
}

export function createMapScene(options: MapSceneOptions): MapSceneHandle {
  const { canvas, planUrl, pois, onRender } = options;
  const controller = new AbortController();
  const resources = createDisposalRegistry();
  const scene = new THREE.Scene();
  const renderer = resources.track(new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true }));
  const camera = new THREE.PerspectiveCamera(CAMERA_PRESET.fieldOfViewDegrees, 1, 0.1, 100);
  const bounds: IsometricCameraBounds = {
    minTargetX: -2.5,
    maxTargetX: 2.5,
    minTargetZ: -5 / 3,
    maxTargetZ: 5 / 3,
    minDistance: 9,
    maxDistance: 18,
  };
  let cameraState: IsometricCameraState = { targetX: 0, targetZ: 0, distance: 14 };
  let drag: DragState | undefined;

  renderer.setPixelRatio(capDevicePixelRatio(window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const render = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    resizeCameraProjection(camera, width, height);
    renderer.render(scene, camera);
    onRender();
  };
  const invalidator = createRenderInvalidator(render);

  const applyCamera = () => {
    const position = positionForCamera(cameraState);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(cameraState.targetX, 0, cameraState.targetZ);
    invalidator.invalidate();
  };

  const texture = resources.track(
    new THREE.TextureLoader().load(planUrl, () => invalidator.invalidate()),
  );
  texture.colorSpace = THREE.SRGBColorSpace;
  const planGeometry = resources.track(new THREE.PlaneGeometry(PLAN.width, PLAN.depth));
  const planMaterial = resources.track(new THREE.MeshBasicMaterial({ map: texture }));
  const plan = new THREE.Mesh(planGeometry, planMaterial);
  plan.rotation.x = -Math.PI / 2;
  scene.add(plan);

  const markerGeometry = resources.track(new THREE.SphereGeometry(0.13, 12, 8));
  const markers = pois.map((poi) => {
    const material = resources.track(new THREE.MeshBasicMaterial({ color: markerColor(poi) }));
    const marker = new THREE.Mesh(markerGeometry, material);
    const point = projectToPlanPlane(poi, PLAN);
    marker.position.set(point.x, 0.15, point.z);
    marker.userData.slug = poi.slug;
    marker.userData.baseColor = markerColor(poi);
    scene.add(marker);
    return marker;
  });

  listenForPoiSelect(
    window,
    (slug) => {
      for (const marker of markers) {
        const material = marker.material as THREE.MeshBasicMaterial;
        material.color.setHex(marker.userData.slug === slug ? SELECTED_COLOR : marker.userData.baseColor);
      }
      invalidator.invalidate();
    },
    controller.signal,
  );

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const selectAt = (event: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const hit = raycaster.intersectObjects(markers, false)[0];
    dispatchPoiSelect(window, hit ? String(hit.object.userData.slug) : null);
  };

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!drag || drag.pointerId !== event.pointerId) {
        return;
      }
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.moved ||= Math.abs(deltaX) + Math.abs(deltaY) > 3;
      cameraState = panCamera(cameraState, -deltaX * 0.01, -deltaY * 0.01, bounds);
      drag.x = event.clientX;
      drag.y = event.clientY;
      applyCamera();
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (drag && !drag.moved) {
        selectAt(event);
      }
      drag = undefined;
      canvas.releasePointerCapture(event.pointerId);
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      cameraState = zoomCamera(cameraState, event.deltaY * 0.01, bounds);
      applyCamera();
    },
    { passive: false, signal: controller.signal },
  );

  const resizeObserver = new ResizeObserver(() => invalidator.invalidate());
  resizeObserver.observe(canvas);
  applyCamera();

  return {
    dispose() {
      controller.abort();
      resizeObserver.disconnect();
      invalidator.dispose();
      scene.clear();
      resources.dispose();
      canvas.width = 0;
      canvas.height = 0;
    },
  };
}
