import { describe, test, expect, beforeEach } from "vitest";
import SitemapGenerator, { type SitemapGeneratorInstance } from "../index.js";

describe("#SitemapGenerator", () => {
  let gen: SitemapGeneratorInstance;

  beforeEach(() => {
    gen = SitemapGenerator("http://foo.bar");
  });

  test("should be a function", () => {
    expect(SitemapGenerator).toBeInstanceOf(Function);
  });

  test("should have method start", () => {
    expect(gen).toHaveProperty("start");
  });

  test("should have method queueURL", () => {
    expect(gen).toHaveProperty("queueURL");
  });
});
