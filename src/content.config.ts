import { defineCollection, reference } from "astro:content";
import { glob } from "astro/loaders";
import { z } from "astro/zod";

const normalizedCoordinate = z.number().min(0).max(1);

export const editionSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const categorySchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
});

export const poiSchema = z.object({
  slug: z.string().min(1),
  name: z.string().min(1),
  edition: reference("editions"),
  category: reference("categories"),
  plan: z.object({
    x: normalizedCoordinate,
    y: normalizedCoordinate,
  }),
  description: z.string().min(1).optional(),
  gridRef: z.string().min(1).optional(),
});

export type Edition = z.input<typeof editionSchema>;
export type Category = z.input<typeof categorySchema>;
export type Poi = z.input<typeof poiSchema>;

export function validatePoiReferences(
  poi: Pick<Poi, "category">,
  categorySlugs: readonly string[],
): void {
  if (!categorySlugs.includes(poi.category)) {
    throw new Error(`Unknown category reference: ${poi.category}`);
  }
}

const editions = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/editions" }),
  schema: editionSchema,
});

const categories = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/categories" }),
  schema: categorySchema,
});

const pois = defineCollection({
  loader: glob({ pattern: "**/*.json", base: "./src/content/pois" }),
  schema: poiSchema,
});

export const collections = { editions, categories, pois };
