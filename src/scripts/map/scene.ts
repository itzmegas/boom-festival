import * as THREE from "three";
import {
  CAMERA_PRESET,
  anchorCamera,
  boundsForOverview,
  capDevicePixelRatio,
  clampCameraState,
  fitPlanCamera,
  pinchCamera,
  planPointAtScreen,
  positionForCamera,
  resizeCameraProjection,
  zoomCamera,
  type IsometricCameraBounds,
  type IsometricCameraState,
} from "./camera-controls";
import { createDisposalRegistry, createRenderInvalidator } from "./lifecycle";
import { projectToPlanPlane, type NormalizedPoint, type PlanPoint } from "./projection";
import { dispatchPoiSelect, listenForPoiSelect } from "./selection";
import { markerStyle } from "../../lib/map-markers";
import { createMarkerTexture } from "./marker-texture";
import { createMapDiorama } from "./diorama";

const PLAN = { width: 10, depth: 20 / 3 } as const;

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
  focusPoi(slug: string): boolean;
  dispose(): void;
}

interface PointerPosition {
  x: number;
  y: number;
}

interface DragState extends PointerPosition {
  pointerId: number;
  moved: boolean;
  startX: number;
  startY: number;
}

interface PinchState {
  pointerIds: [number, number];
  separation: number;
  camera: IsometricCameraState;
  anchor: PlanPoint | null;
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
  let overview = fitPlanCamera(PLAN, canvas.clientWidth, canvas.clientHeight, 70);
  let bounds: IsometricCameraBounds = boundsForOverview(PLAN, overview);
  let cameraState: IsometricCameraState = { ...overview };
  let overviewMode = true;
  let focusedSlug: string | null = null;
  let lastWidth = 0;
  let lastHeight = 0;
  let lastInset = 0;
  let drag: DragState | undefined;
  const pointers = new Map<number, PointerPosition>();
  let pinch: PinchState | undefined;
  let multiTouch = false;
  let active = true;
  let textureReady = false;
  let textureReportedReady = false;
  let selectedSlug: string | null = null;
  let hoveredSlug: string | null = null;

  renderer.setPixelRatio(capDevicePixelRatio(window.devicePixelRatio || 1));
  renderer.setClearColor(0x000000, 0);

  const render = () => {
    // Loading hides the canvas; measure its host so the first render can become ready.
    const width = canvas.clientWidth || canvas.parentElement?.clientWidth || 0;
    const height = canvas.clientHeight || canvas.parentElement?.clientHeight || 0;
    if (!width || !height) return;
    const rect = canvas.clientWidth ? canvas.getBoundingClientRect() : canvas.parentElement!.getBoundingClientRect();
    const controls = canvas.parentElement?.querySelector(".map-controls")?.getBoundingClientRect();
    const bottomInset = controls ? rect.bottom - controls.top + 16 : 70;
    if (width !== lastWidth || height !== lastHeight || bottomInset !== lastInset) {
      resetPointers();
      const previousDistance = overview.distance;
      overview = fitPlanCamera(PLAN, width, height, bottomInset);
      bounds = boundsForOverview(PLAN, overview);
      cameraState = overviewMode ? { ...overview } : clampCameraState({
        ...cameraState,
        distance: cameraState.distance / previousDistance * overview.distance,
      }, bounds);
      lastWidth = width;
      lastHeight = height;
      lastInset = bottomInset;
      centerFocusedPoi();
      positionCamera();
    }
    renderer.setSize(width, height, false);
    camera.far = Math.max(100, bounds.maxDistance * 4);
    resizeCameraProjection(camera, width, height);
    canvas.dataset.camera = JSON.stringify(cameraState);
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
      invalidator.invalidate();
    }
  };
  const invalidator = createRenderInvalidator(render);

  const positionCamera = () => {
    const position = positionForCamera(cameraState);
    camera.position.set(position.x, position.y, position.z);
    camera.lookAt(cameraState.targetX, 0, cameraState.targetZ);
    camera.updateMatrixWorld();
  };
  const applyCamera = () => {
    centerFocusedPoi();
    positionCamera();
    invalidator.invalidate();
  };

  const centerFocusedPoi = () => {
    const poi = pois.find((poi) => poi.slug === focusedSlug);
    if (!poi || !canvas.clientWidth || !canvas.clientHeight) return;
    const rect = canvas.getBoundingClientRect();
    const preview = canvas.closest(".map-display")?.querySelector<HTMLElement>("[data-map-preview]");
    const previewRect = preview && !preview.hidden ? preview.getBoundingClientRect() : null;
    const top = previewRect && previewRect.top < rect.bottom ? previewRect.bottom - rect.top + 22 : 38;
    const y = Math.min(rect.height - lastInset - 22, (top + rect.height - lastInset) / 2);
    cameraState = anchorCamera(cameraState, projectToPlanPlane(poi, PLAN),
      { x: 0, y: 1 - 2 * y / rect.height }, rect.width / rect.height, bounds, 0.15);
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
  scene.add(createMapDiorama(PLAN, resources));

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
      if (focusedSlug !== slug) focusedSlug = null;
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

  const screenPosition = (x: number, y: number): NormalizedPoint => {
    const rect = canvas.getBoundingClientRect();
    return { x: 2 * (x - rect.left) / Math.max(1, rect.width) - 1, y: 1 - 2 * (y - rect.top) / Math.max(1, rect.height) };
  };
  const pairGeometry = (first: PointerPosition, second: PointerPosition) => ({
    separation: Math.hypot(second.x - first.x, second.y - first.y),
    screen: screenPosition((first.x + second.x) / 2, (first.y + second.y) / 2),
  });
  const resetPointers = () => {
    const ids = [...pointers.keys()];
    pointers.clear();
    drag = undefined;
    pinch = undefined;
    multiTouch = false;
    for (const id of ids) {
      if (canvas.hasPointerCapture(id)) canvas.releasePointerCapture(id);
    }
  };

  canvas.addEventListener(
    "pointerdown",
    (event) => {
      if (!textureReportedReady || event.button !== 0 || (event.pointerType !== "touch" && !event.isPrimary)) return;
      clearHover();
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size === 1 && !multiTouch) {
        drag = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, startX: event.clientX, startY: event.clientY, moved: false };
      } else if (pointers.size === 2 && !multiTouch) {
        multiTouch = true;
        drag = undefined;
        const entries = [...pointers.entries()];
        const geometry = pairGeometry(entries[0]![1], entries[1]![1]);
        pinch = {
          pointerIds: [entries[0]![0], entries[1]![0]],
          separation: geometry.separation,
          camera: { ...cameraState },
          anchor: planPointAtScreen(cameraState, geometry.screen, camera.aspect),
        };
      }
      canvas.setPointerCapture(event.pointerId);
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointermove",
    (event) => {
      if (!textureReportedReady) return;
      if (!pointers.has(event.pointerId)) {
        if (event.pointerType === "touch" || pointers.size) return;
        const slug = markerAt(event);
        canvas.style.cursor = slug ? "pointer" : "";
        if (slug !== hoveredSlug) {
          hoveredSlug = slug;
          updateMarkers();
        }
        return;
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pinch) {
        if (!pinch.pointerIds.includes(event.pointerId)) return;
        const first = pointers.get(pinch.pointerIds[0]);
        const second = pointers.get(pinch.pointerIds[1]);
        if (!first || !second) return;
        const geometry = pairGeometry(first, second);
        focusedSlug = null;
        overviewMode = false;
        cameraState = pinchCamera(pinch.camera, pinch.separation, geometry.separation,
          pinch.anchor, geometry.screen, camera.aspect, bounds);
        applyCamera();
        return;
      }
      if (!drag) return;
      if (drag.pointerId !== event.pointerId) return;
      drag.moved ||= Math.abs(event.clientX - drag.startX) + Math.abs(event.clientY - drag.startY) > 3;
      if (drag.moved) {
        focusedSlug = null;
        overviewMode = false;
        const anchor = planPointAtScreen(cameraState, screenPosition(drag.x, drag.y), camera.aspect);
        if (anchor) cameraState = anchorCamera(cameraState, anchor, screenPosition(event.clientX, event.clientY), camera.aspect, bounds);
      }
      drag.x = event.clientX;
      drag.y = event.clientY;
      applyCamera();
    },
    { signal: controller.signal },
  );
  canvas.addEventListener(
    "pointerup",
    (event) => {
      if (!pointers.has(event.pointerId)) return;
      if (textureReportedReady && !multiTouch && drag?.pointerId === event.pointerId && !drag.moved) {
        selectAt(event);
      }
      pointers.delete(event.pointerId);
      if (drag?.pointerId === event.pointerId) drag = undefined;
      if (pinch?.pointerIds.includes(event.pointerId)) {
        const remainingId = pinch.pointerIds.find((id) => pointers.has(id));
        const remaining = remainingId === undefined ? undefined : pointers.get(remainingId);
        pinch = undefined;
        if (remaining && remainingId !== undefined) {
          drag = { pointerId: remainingId, ...remaining, startX: remaining.x, startY: remaining.y, moved: true };
        }
      }
      if (!pointers.size) resetPointers();
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
    },
    { signal: controller.signal },
  );
  canvas.addEventListener("pointercancel", resetPointers, { signal: controller.signal });
  canvas.addEventListener("lostpointercapture", (event) => {
    if (pointers.has(event.pointerId)) resetPointers();
  }, { signal: controller.signal });
  window.addEventListener("pagehide", resetPointers, { signal: controller.signal });
  canvas.addEventListener(
    "wheel",
    (event) => {
      if (!textureReportedReady) return;
      event.preventDefault();
      overviewMode = false;
      cameraState = zoomCamera(cameraState, event.deltaY * 0.01, bounds);
      applyCamera();
    },
    { passive: false, signal: controller.signal },
  );

  const resizeObserver = new ResizeObserver(() => invalidator.invalidate());
  resizeObserver.observe(canvas);
  if (canvas.parentElement) resizeObserver.observe(canvas.parentElement);
  applyCamera();

  return {
    clearHover,
    focusPoi(slug) {
      if (!active || !textureReportedReady || !pois.some((poi) => poi.slug === slug)) return false;
      overviewMode = false;
      focusedSlug = slug;
      dispatchPoiSelect(window, slug);
      applyCamera();
      return true;
    },
    zoomIn() {
      if (!active || !textureReportedReady) return;
      overviewMode = false;
      cameraState = zoomCamera(cameraState, -1, bounds);
      applyCamera();
    },
    zoomOut() {
      if (!active || !textureReportedReady) return;
      overviewMode = false;
      cameraState = zoomCamera(cameraState, 1, bounds);
      applyCamera();
    },
    resetView() {
      if (!active || !textureReportedReady) return;
      overviewMode = true;
      focusedSlug = null;
      cameraState = { ...overview };
      applyCamera();
    },
    dispose() {
      active = false;
      resetPointers();
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
