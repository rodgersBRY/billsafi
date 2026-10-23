import { describe, expect, it } from "vitest";
import {
  PRODUCT_TOUR_VERSIONS,
  type ProductTourState,
  saveProductTourSchema,
  shouldShowTour,
} from "./product-tours.js";

const saved = (version: number): ProductTourState => ({
  key: "first-run",
  version,
  status: "dismissed",
  lastStep: 0,
  updatedAt: "2026-10-23T00:00:00.000Z",
});

describe("shouldShowTour", () => {
  it("shows a tour the account has never seen", () => {
    expect(shouldShowTour([], "first-run")).toBe(true);
  });

  it("hides a tour saved at the current version", () => {
    expect(shouldShowTour([saved(PRODUCT_TOUR_VERSIONS["first-run"])], "first-run")).toBe(false);
  });

  it("shows a tour again after its version is raised", () => {
    expect(shouldShowTour([saved(PRODUCT_TOUR_VERSIONS["first-run"] - 1)], "first-run")).toBe(true);
  });
});

describe("saveProductTourSchema", () => {
  it("defaults the last step and rejects unknown statuses", () => {
    expect(saveProductTourSchema.parse({ version: 1, status: "completed" })).toEqual({
      version: 1,
      status: "completed",
      lastStep: 0,
    });
    expect(saveProductTourSchema.safeParse({ version: 1, status: "paused" }).success).toBe(false);
  });
});
