export const MAP_EVENT = {
  POI_SELECT: "poi:select",
} as const;

export interface PoiSelectDetail {
  slug: string | null;
}

export function dispatchPoiSelect(target: EventTarget, slug: string | null): void {
  target.dispatchEvent(
    new CustomEvent<PoiSelectDetail>(MAP_EVENT.POI_SELECT, {
      detail: { slug },
    }),
  );
}

export function listenForPoiSelect(
  target: EventTarget,
  listener: (slug: string | null) => void,
  signal: AbortSignal,
): void {
  target.addEventListener(
    MAP_EVENT.POI_SELECT,
    (event) => listener((event as CustomEvent<PoiSelectDetail>).detail.slug),
    { signal },
  );
}
