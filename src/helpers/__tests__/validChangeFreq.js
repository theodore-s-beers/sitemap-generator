import { describe, test, expect } from "vitest";
import validChangeFreq from "../validChangeFreq.js";

describe("#validateChangeFreq", () => {
  test("should be a function", () => {
    expect(validChangeFreq).toBeInstanceOf(Function);
  });

  test("should return string when valid", () => {
    expect(typeof validChangeFreq("daily")).toBe("string");
  });

  test("should return empty string when invalid", () => {
    const changeFreq = validChangeFreq("invalid");
    expect(typeof changeFreq).toBe("string");
    expect(changeFreq).toBe("");
  });
});
