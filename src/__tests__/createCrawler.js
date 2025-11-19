import { describe, test, expect } from "vitest";
import createCrawler from "../createCrawler.js";
import { CheerioCrawler } from "crawlee";

describe("#createCrawler", () => {
  test("should export a function", () => {
    expect(createCrawler).toBeInstanceOf(Function);
  });

  test("should return crawler instance", () => {
    const crawler = createCrawler(new URL("http://example.com"));
    expect(crawler).toBeInstanceOf(CheerioCrawler);
  });

  test("should apply options to crawler", () => {
    const options = {
      maxDepth: 2,
    };
    const crawler = createCrawler(new URL("http://example.com"), options);
    expect(crawler._maxDepth).toBe(2);
  });
});
