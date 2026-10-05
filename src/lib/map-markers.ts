export interface MarkerStyle {
  color: string;
  path: string;
}

// Shared 24 × 24 paths keep the map icons and their legend consistent.
export const MARKER_STYLES = {
  art: { color: "#963c70", path: "M12 3 21 12 12 21 3 12Z M8 12h8 M12 8v8" },
  camping: { color: "#416438", path: "M3 20 12 4 21 20Z M8 20l4-8 4 8 M12 4V2" },
  culture: { color: "#78552f", path: "M3 5c3-1 6-1 9 1v15c-3-2-6-2-9-1Z M21 5c-3-1-6-1-9 1v15c3-2 6-2 9-1Z" },
  dance: { color: "#6c3d99", path: "M9 17V5l11-2v12 M9 8l11-2 M9 17c0 4-6 4-6 1s6-4 6-1 M20 15c0 4-6 4-6 1s6-4 6-1" },
  emergency: { color: "#b63c24", path: "M8 3h8v5h5v8h-5v5H8v-5H3V8h5Z" },
  food: { color: "#97501e", path: "M5 3v6c0 4 6 4 6 0V3 M8 3v18 M20 21V3c-5 2-5 10 0 10" },
  healing: { color: "#2e6d5c", path: "M12 20C3 19 3 12 3 9c5 0 8 3 9 7 M12 20c9-1 9-8 9-11-5 0-8 3-9 7 M12 16C6 10 9 5 12 3c3 2 6 7 0 13Z" },
  services: { color: "#475976", path: "M12 10v8 M12 6v1 M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20" },
  stages: { color: "#65354e", path: "M3 20h18 M5 17V5h14v12 M5 5l7 9 7-9 M9 17h6" },
  water: { color: "#226781", path: "M12 2C9 7 5 11 5 15a7 7 0 0 0 14 0c0-4-4-8-7-13Z M8 15c0 3 2 4 4 4" },
} as const satisfies Record<string, MarkerStyle>;

const DEFAULT_MARKER_STYLE: MarkerStyle = {
  color: "#5f2879",
  path: "M12 2a10 10 0 1 0 0 20 10 10 0 1 0 0-20 M12 8v8 M8 12h8",
};

export function markerStyle(category: string): MarkerStyle {
  return Object.hasOwn(MARKER_STYLES, category)
    ? MARKER_STYLES[category as keyof typeof MARKER_STYLES]
    : DEFAULT_MARKER_STYLE;
}
