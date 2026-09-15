import type { CollectionEntry } from "astro:content";

export const CATEGORY = {
  EMERGENCY: "emergency",
} as const;

export const NOT_YET_CURATED = "Not yet curated";

export const CURRENT_EDITION = "boom-2025";

export type PoiEntry = CollectionEntry<"pois">;
export type CategoryEntry = CollectionEntry<"categories">;

function refId(value: unknown): string {
  if (typeof value === "string") {
    return value;
  }
  if (typeof value === "object" && value !== null && "id" in value) {
    return String((value as { id: string }).id);
  }
  return String(value);
}

export function categoryId(poi: PoiEntry): string {
  return refId(poi.data.category);
}

export function editionId(poi: PoiEntry): string {
  return refId(poi.data.edition);
}

export function isProminent(poi: PoiEntry): boolean {
  return categoryId(poi) === CATEGORY.EMERGENCY;
}

export function sortPois(pois: readonly PoiEntry[]): PoiEntry[] {
  return [...pois].sort((left, right) => {
    const rank = Number(isProminent(right)) - Number(isProminent(left));
    if (rank !== 0) {
      return rank;
    }
    return left.data.name.localeCompare(right.data.name);
  });
}

export function filterPois(
  pois: readonly PoiEntry[],
  edition: string,
  category: string | undefined,
): PoiEntry[] {
  return sortPois(
    pois.filter((poi) => {
      const matchesEdition = editionId(poi) === edition;
      const matchesCategory = category === undefined || categoryId(poi) === category;
      return matchesEdition && matchesCategory;
    }),
  );
}
