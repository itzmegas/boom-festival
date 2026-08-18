import { describe, expect, it } from "vitest";
import {
  categorySchema,
  editionSchema,
  poiSchema,
  validatePoiReferences,
} from "../../src/content.config";

const validEdition = { slug: "boom-2025", name: "Boom 2025" };
const validCategory = { slug: "healing", name: "Healing" };
const validPoi = {
  slug: "sacred-fire",
  name: "Sacred Fire",
  edition: "boom-2025",
  category: "healing",
  plan: { x: 0.4, y: 0.6 },
};

describe("content collection contracts", () => {
  it("accepts the minimal valid collection fixtures", () => {
    expect(editionSchema.parse(validEdition)).toEqual(validEdition);
    expect(categorySchema.parse(validCategory)).toEqual(validCategory);
    expect(poiSchema.parse(validPoi)).toEqual(validPoi);
  });

  it("rejects an unknown category reference", () => {
    expect(() => validatePoiReferences(validPoi, ["food"])).toThrow(
      "Unknown category reference: healing",
    );
  });

  it("rejects missing required fields", () => {
    expect(() => poiSchema.parse({ ...validPoi, name: undefined })).toThrow();
  });

  it.each([
    ["x", -0.01],
    ["x", 1.01],
    ["y", -0.01],
    ["y", 1.01],
  ])("rejects plan coordinate %s=%s outside 0–1", (axis, value) => {
    expect(() => poiSchema.parse({ ...validPoi, plan: { x: 0.4, y: 0.6, [axis]: value } })).toThrow();
  });
});
