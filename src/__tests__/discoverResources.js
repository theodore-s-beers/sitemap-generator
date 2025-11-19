import { describe, test, expect } from "vitest";
import discoverResources from "../discoverResources.js";

describe("#discoverResources", () => {
  test("should be a function", () => {
    expect(discoverResources).toBeInstanceOf(Function);
  });
});
