import fs from "fs";
import http from "http";
import path from "path";
import normalizeUrl from "normalize-url";
import _mitt from "mitt";

import createCrawler from "./createCrawler.js";
import type { CrawlerHandlers } from "./createCrawler.js";
import SitemapRotator from "./SitemapRotator.js";
import type { SitemapRotatorInstance } from "./SitemapRotator.js";
import createSitemapIndex from "./createSitemapIndex.js";
import extendFilename from "./helpers/extendFilename.js";
import type { CheerioCrawler } from "crawlee";

export interface SitemapGeneratorOptions {
  stripQuerystring?: boolean;
  maxEntriesPerFile?: number;
  maxDepth?: number;
  filepath?: string;
  userAgent?: string;
  respectRobotsTxt?: boolean;
  ignoreInvalidSSL?: boolean;
  timeout?: number;
  decodeResponses?: boolean;
  ignoreAMP?: boolean;
  ignore?: ((url: string) => boolean) | null;
}

export interface SitemapGeneratorInstance {
  start: () => Promise<void>;
  getCrawler: () => CheerioCrawler;
  getSitemap: () => SitemapRotatorInstance;
  queueURL: (url: string) => Promise<void>;
  on: (type: string, handler: (data: unknown) => void) => void;
  off: (type: string, handler: (data: unknown) => void) => void;
}

export default function SitemapGenerator(
  uri: string,
  opts?: SitemapGeneratorOptions,
): SitemapGeneratorInstance {
  const defaultOpts: Required<SitemapGeneratorOptions> = {
    stripQuerystring: true,
    maxEntriesPerFile: 50000,
    maxDepth: 0,
    filepath: path.join(process.cwd(), "sitemap.xml"),
    userAgent: "Node/SitemapGenerator",
    respectRobotsTxt: true,
    ignoreInvalidSSL: false,
    timeout: 30000,
    decodeResponses: true,
    ignoreAMP: true,
    ignore: null,
  };

  if (!uri) {
    throw new Error("Requires a valid URL.");
  }

  const options = Object.assign({}, defaultOpts, opts);

  const mitt = _mitt as unknown as typeof _mitt.default;
  const emitter = mitt();

  const parsedUrl = new URL(
    normalizeUrl(uri, {
      stripWWW: false,
      removeTrailingSlash: false,
    }),
  );

  const sitemapPath = options.filepath ? path.resolve(options.filepath) : null;

  if (options.ignoreInvalidSSL) {
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
  }

  const sitemap = SitemapRotator(options.maxEntriesPerFile);

  const emitError = (code: number, url: string) => {
    emitter.emit("error", {
      code,
      message: http.STATUS_CODES[code] || "Unknown error",
      url,
    });
  };

  const handlers: CrawlerHandlers = {
    onSuccess: async ({ url, depth, body, $ }) => {
      const metaRobots = $('meta[name="robots"]');
      const hasNoIndex =
        metaRobots.length && /noindex/i.test(metaRobots.attr("content"));

      const isAMP = options.ignoreAMP && /<html[^>]+(amp|⚡)[^>]*>/.test(body);

      const shouldIgnore = options.ignore?.(url) || hasNoIndex || isAMP;

      if (shouldIgnore) {
        emitter.emit("ignore", url);
      } else {
        emitter.emit("add", url);

        if (sitemapPath !== null) {
          sitemap.addURL(url);
        }
      }

      const links: string[] = [];
      $("a[href]").each((_: number, el: unknown) => {
        const href = $(el).attr("href");
        if (href) {
          try {
            const absoluteUrl = new URL(href, url);

            if (absoluteUrl.hostname !== parsedUrl.hostname) {
              return;
            }

            if (parsedUrl.pathname && parsedUrl.pathname !== "/") {
              if (!absoluteUrl.pathname.startsWith(parsedUrl.pathname)) {
                return;
              }
            }

            links.push(absoluteUrl.href);
          } catch {
            // Invalid URL, skip
          }
        }
      });

      if (links.length) {
        const nextDepth = depth + 1;
        if (options.maxDepth === 0 || nextDepth <= options.maxDepth) {
          await crawler.addRequests(
            links.map((link) => ({
              url: link,
              userData: { depth: nextDepth },
            })),
          );
        }
      }
    },

    onError: ({ url, statusCode, error }) => {
      if (statusCode === 404) {
        emitError(404, url);
      } else if (statusCode === 410) {
        emitError(410, url);
      } else if (error?.code === "ENOTFOUND") {
        emitError(404, url);
      } else if (error?.name === "TimeoutError") {
        emitError(408, url);
      } else {
        emitError(statusCode || 500, url);
      }
    },
  };

  const crawler = createCrawler(parsedUrl, options, handlers);

  let isRunning = false;

  return {
    start: async () => {
      if (isRunning) return;
      isRunning = true;

      try {
        await crawler.run([
          {
            url: parsedUrl.href,
            userData: { depth: 0 },
          },
        ]);

        sitemap.finish();

        const sitemaps = sitemap.getPaths();

        const cb = () => emitter.emit("done");

        if (sitemapPath !== null) {
          if (sitemaps.length > 1) {
            let count = 1;
            for (const tmpPath of sitemaps) {
              const newPath = extendFilename(sitemapPath, `_part${count}`);
              await fs.promises.copyFile(tmpPath, newPath);
              await fs.promises.unlink(tmpPath);
              count += 1;
            }

            const filename = path.basename(sitemapPath);
            await fs.promises.writeFile(
              sitemapPath,
              createSitemapIndex(
                parsedUrl.toString(),
                filename,
                sitemaps.length,
              ),
            );
            cb();
          } else if (sitemaps.length) {
            await fs.promises.copyFile(sitemaps[0], sitemapPath);
            await fs.promises.unlink(sitemaps[0]);
            cb();
          } else {
            cb();
          }
        } else {
          cb();
        }
      } catch (error) {
        emitter.emit("error", error);
      } finally {
        isRunning = false;
      }
    },

    getCrawler: () => crawler,
    getSitemap: () => sitemap,

    queueURL: async (url) => {
      await crawler.addRequests([
        {
          url,
          userData: { depth: 0 },
        },
      ]);
    },

    on: emitter.on,
    off: emitter.off,
  };
}
