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
import { markerStyle } from "../../lib/map-markers";
import { createMarkerTexture } from "./marker-texture";

const PLAN = { width: 10, depth: 20 / 3 } as const;
const INITIAL_CAMERA_STATE: IsometricCameraState = { targetX: 0, targetZ: 0, distance: 14 };

export interface MapPoi extends NormalizedPoint {
  slug: string;
  name: string;
  category: string;
  categoryName: string;
  prominent: boolean;
}

export interface MapSceneOptions {
  canvas: HTMLCanvasElement;
  planUrl: string;
  pois: MapPoi[];
  onRender(): void;
  onTextureReady(): void;
  onTextureError(): void;
  onMarkerActivate(slug: string): void;
  onMarkerPreview(poi: MapPoi | null): void;
}

export interface MapSceneHandle {
  zoomIn(): void;
  zoomOut(): void;
  resetView(): void;
  clearHover(): void;
  dispose(): void;
}

interface DragState {
  pointerId: number;
  x: number;
  y: number;
  moved: boolean;
  startX: number;
  startY: number;
}

interface MarkerTextures {
  normal: THREE.Texture;
  highlighted: THREE.Texture;
}

export function createMapScene(options: MapSceneOptions): MapSceneHandle {
  const { canvas, planUrl, pois, onRender, onTextureReady, onTextureError, onMarkerActivate, onMarkerPreview } = options;
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
  let cameraState: IsometricCameraState = { ...INITIAL_CAMERA_STATE };
  let drag: DragState | undefined;
  let active = true;
  let textureReady = false;
  let textureReportedReady = false;
  let selectedSlug: string | null = null;
  let hoveredSlug: string | null = null;

  renderer.setPixelRatio(capDevicePixelRatio(window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const render = () => {
    const width = Math.max(1, canvas.clientWidth);
    const height = Math.max(1, canvas.clientHeight);
    renderer.setSize(width, height, false);
    resizeCameraProjection(camera, width, height);
    // Screen-sized billboards remain readable as the plan moves or zooms.
    const markerSize = width < 500 ? 32 : 38;
    const scale = markerSize * 2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / height;
    for (const marker of markers) {
      const highlighted = marker.userData.slug === hoveredSlug || marker.userData.slug === selectedSlug;
      marker.scale.setScalar(scale * (highlighted ? 1.15 : 1));
    }
    renderer.render(scene, camera);
    onRender();
    if (textureReady && !textureReportedReady) {
      textureReportedReady = true;
      onTextureReady();
    }
  };
  const invalidator = createRenderInvalidator(render);

  const applyCamera = () => {
    const position = positionForCamera(cameraState);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(cameraState.targetX, 0, cameraState.targetZ);
    invalidator.invalidate();
  };

  const texture = resources.track(new THREE.TextureLoader().load(
    planUrl,
    () => {
      if (!active) return;
      textureReady = true;
      invalidator.invalidate();
    },
    undefined,
    () => {
      if (active) onTextureError();
    },
  ));
  texture.colorSpace = THREE.SRGBColorSpace;
  const planGeometry = resources.track(new THREE.PlaneGeometry(PLAN.width, PLAN.depth));
  const planMaterial = resources.track(new THREE.MeshBasicMaterial({ map: texture }));
  const plan = new THREE.Mesh(planGeometry, planMaterial);
  plan.rotation.x = -Math.PI / 2;
  scene.add(plan);

  const textures = new Map<string, MarkerTextures>();
  const markers = pois.map((poi) => {
    let categoryTextures = textures.get(poi.category);
    if (!categoryTextures) {
      const style = markerStyle(poi.category);
      categoryTextures = {
        normal: resources.track(createMarkerTexture(style, false)),
        highlighted: resources.track(createMarkerTexture(style, true)),
      };
      textures.set(poi.category, categoryTextures);
    }
    const material = resources.track(new THREE.SpriteMaterial({
      map: categoryTextures.normal,
      sizeAttenuation: false,
      depthTest: false,
    }));
    const marker = new THREE.Sprite(material);
    const point = projectToPlanPlane(poi, PLAN);
    marker.position.set(point.x, 0.15, point.z);
    marker.userData.slug = poi.slug;
    scene.add(marker);
    return marker;
  });

  const updateMarkers = () => {
    for (const [index, marker] of markers.entries()) {
      const highlighted = marker.userData.slug === hoveredSlug || marker.userData.slug === selectedSlug;
      const poi = pois[index]!;
      const categoryTextures = textures.get(poi.category)!;
      marker.material.map = highlighted ? categoryTextures.highlighted : categoryTextures.normal;
      marker.renderOrder = highlighted ? 1 : 0;
    }
    const previewSlug = hoveredSlug ?? selectedSlug;
    onMarkerPreview(pois.find((poi) => poi.slug === previewSlug) ?? null);
    invalidator.invalidate();
  };

  const clearHover = () => {
    canvas.style.cursor = "";
    if (hoveredSlug === null) return;
    hoveredSlug = null;
    updateMarkers();
  };

  listenForPoiSelect(
    window,
    (slug) => {
      selectedSlug = slug;
      hoveredSlug = null;
      canvas.style.cursor = "";
      updateMarkers();
    },
    controller.signal,
  );

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  const iconCenter = new THREE.Vector2(0.5, 0.5);
  const markerAt = (event: PointerEvent): string | null => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    const screenDistance = (object: THREE.Object3D) => {
      const center = object.position.clone().project(camera);
      return Math.hypot((center.x - pointer.x) * rect.width, (center.y - pointer.y) * rect.height);
    };
    const hit = raycaster.intersectObjects(markers, false)
      // Ignore transparent corners and choose the nearest icon center in dense areas.
      .filter((intersection) => intersection.uv && intersection.uv.distanceTo(iconCenter) <= (intersection.object.renderOrder ? 0.46 : 0.38))
      .sort((left, right) => screenDistance(left.object) - screenDistance(right.object))[0];
    return hit ? String(hit.object.userData.slug) : null;
  };
  const selectAt = (event: PointerEvent) => {
    const slug = markerAt(event);
    dispatchPoiSelect(window, slug);
    // Touch visitors can inspect a place before choosing the preview's detail link.
    if (slug && active && event.pointerType !== "touch") onMarkerActivate(slug);
  };

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!event.isPrimary || event.button !== 0) return;
      clearHover();
      drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      canvas.setPointerCapture(event.pointerId);
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!textureReportedReady || !event.isPrimary) return;
      if (!drag) {
        if (event.pointerType === "touch") return;
        const slug = markerAt(event);
        canvas.style.cursor = slug ? "pointer" : "";
        if (slug !== hoveredSlug) {
          hoveredSlug = slug;
          updateMarkers();
        }
        return;
      }
      if (drag.pointerId !== event.pointerId) return;
      const deltaX = event.clientX - drag.x;
      const deltaY = event.clientY - drag.y;
      drag.moved ||= Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3;
      if (drag.moved) cameraState = panCamera(cameraState, -deltaX * 0.01, -deltaY * 0.01, bounds);
      drag.x = event.clientX;
      drag.y = event.clientY;
      applyCamera();
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (textureReportedReady && drag?.pointerId === event.pointerId && !drag.moved) {
        selectAt(event);
      }
      if (drag?.pointerId === event.pointerId) {
        drag = undefined;
        if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      }
    },
    { signal: controller.signal },
  );
  canvas.addEventListener("pointercancel", () => { drag = undefined; }, { signal: controller.signal });
  canvas.addEventListener("lostpointercapture", () => { drag = undefined; }, { signal: controller.signal });
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
    clearHover,
    zoomIn() {
      if (!active || !textureReportedReady) return;
      cameraState = zoomCamera(cameraState, -1, bounds);
      applyCamera();
    },
    zoomOut() {
      if (!active || !textureReportedReady) return;
      cameraState = zoomCamera(cameraState, 1, bounds);
      applyCamera();
    },
    resetView() {
      if (!active || !textureReportedReady) return;
      cameraState = { ...INITIAL_CAMERA_STATE };
      applyCamera();
    },
    dispose() {
      active = false;
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
