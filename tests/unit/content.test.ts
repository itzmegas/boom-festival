import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { validatePoiReferences } from "../../src/content.config";
import { CATEGORY, CURRENT_EDITION, NOT_YET_CURATED } from "../../src/lib/poi";

const filePoiSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: z.string().min(1),
  category: z.string().min(1),
  plan: z.object({ x: z.number().min(0).max(1), y: z.number().min(0).max(1) }),
  description: z.string().min(1).optional(),
  gridRef: z.string().min(1).optional(),
});
const fileEditionSchema = z.object({ slug: z.string().min(1), name: z.string().min(1) });
const fileCategorySchema = z.object({ slug: z.string().min(1), name: z.string().min(1) });

const root = join(process.cwd(), "src/content");

function readJsonFiles(directory: string): unknown[] {
  return readdirSync(join(root, directory))
    .filter((name) => name.endsWith(".json"))
    .map((name) => JSON.parse(readFileSync(join(root, directory, name), "utf8")) as unknown);
}

describe("curated boom-2025 content", () => {
  const editions = readJsonFiles("editions").map((entry) => fileEditionSchema.parse(entry));
  const categories = readJsonFiles("categories").map((entry) => fileCategorySchema.parse(entry));
  const pois = readJsonFiles("pois").map((entry) => filePoiSchema.parse(entry));
  const categorySlugs = categories.map((category) => category.slug);

  it("targets Boom 2025 with 30–40 published POIs", () => {
    expect(editions.some((edition) => edition.slug === CURRENT_EDITION)).toBe(true);
    const published = pois.filter((poi) => poi.edition === CURRENT_EDITION);
    expect(published.length).toBeGreaterThanOrEqual(30);
    expect(published.length).toBeLessThanOrEqual(40);
  });

  it("keeps every POI on a known category and 0–1 plan point", () => {
    for (const poi of pois) {
      expect(() => validatePoiReferences(poi, categorySlugs)).not.toThrow();
      expect(poi.plan.x).toBeGreaterThanOrEqual(0);
      expect(poi.plan.x).toBeLessThanOrEqual(1);
    }
  });

  it("marks incomplete optional fields without inventing facts", () => {
    const incomplete = pois.filter((poi) => poi.description === undefined || poi.gridRef === undefined);
    expect(incomplete.length).toBeGreaterThan(0);
    expect(NOT_YET_CURATED).toBe("Not yet curated");
  });

  it("gives care landmarks a dedicated non-routing category", () => {
    const care = pois.filter((poi) => poi.category === CATEGORY.EMERGENCY);
    expect(care.map((poi) => poi.slug).sort()).toEqual(
      ["assembly-north", "assembly-south", "boom-medical", "kosmicare"].sort(),
    );
  });

  it("keeps an empty edition with no published POIs", () => {
    expect(pois.filter((poi) => poi.edition === "boom-empty")).toHaveLength(0);
  });
});
