import { CheerioCrawler } from "crawlee";
import { beforeEach, describe, expect, test, vi } from "vitest";
import createCrawler from "../createCrawler.js";

const { mockCheerioCrawler, mockConfiguration } = vi.hoisted(() => {
  const mockSet = vi.fn();

  const mockCheerioCrawler = vi.fn(function (this: object, options: unknown) {
    Object.assign(this, { options });
  });

  const mockConfiguration = {
    getGlobalConfig: vi.fn(() => ({
      set: mockSet,
    })),
  };

  return { mockCheerioCrawler, mockConfiguration };
});

vi.mock("crawlee", () => ({
  CheerioCrawler: mockCheerioCrawler,
  Configuration: mockConfiguration,
}));

describe("#createCrawler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test("should export a function", () => {
    expect(createCrawler).toBeInstanceOf(Function);
  });

  test("should return crawler instance", () => {
    const crawler = createCrawler(new URL("http://example.com"));
    expect(crawler).toBeInstanceOf(CheerioCrawler);
  });

  test("should disable HTTP/2 when disableHttp2 is true", async () => {
    createCrawler(new URL("http://example.com"), { disableHttp2: true });

    const options = mockCheerioCrawler.mock.calls[0][0] as {
      preNavigationHooks: Array<
        (
          ctx: { request: { url: string; skipNavigation?: boolean } },
          gotOptions: { http2?: boolean },
        ) => Promise<void>
      >;
    };

    const hook = options.preNavigationHooks[0];
    const request = { url: "http://example.com/" };
    const gotOptions = { http2: true };

    await hook({ request }, gotOptions);

    expect(gotOptions.http2).toBe(false);
  });

  test("should not modify HTTP/2 when disableHttp2 is false", async () => {
    createCrawler(new URL("http://example.com"));

    const options = mockCheerioCrawler.mock.calls[0][0] as {
      preNavigationHooks: Array<
        (
          ctx: { request: { url: string; skipNavigation?: boolean } },
          gotOptions: { http2?: boolean },
        ) => Promise<void>
      >;
    };

    const hook = options.preNavigationHooks[0];
    const request = { url: "http://example.com/" };
    const gotOptions = { http2: true };

    await hook({ request }, gotOptions);

    expect(gotOptions.http2).toBe(true);
  });
});
