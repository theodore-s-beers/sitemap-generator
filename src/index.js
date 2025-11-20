import fs from "fs";
import http from "http";
import path from "path";
import normalizeUrl from "normalize-url";
import mitt from "mitt";

import createCrawler from "./createCrawler.js";
import SitemapRotator from "./SitemapRotator.js";
import createSitemapIndex from "./createSitemapIndex.js";
import extendFilename from "./helpers/extendFilename.js";

export default function SitemapGenerator(uri, opts) {
  const defaultOpts = {
    stripQuerystring: true,
    maxEntriesPerFile: 50000,
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

  // create sitemap stream
  const sitemap = SitemapRotator(options.maxEntriesPerFile);

  const emitError = (code, url) => {
    emitter.emit("error", {
      code,
      message: http.STATUS_CODES[code] || "Unknown error",
      url,
    });
  };

  // Set up crawler with handlers
  const handlers = {
    onSuccess: async ({ url, depth, body, $ }) => {
      // Check for noindex meta tag
      const metaRobots = $('meta[name="robots"]');
      const hasNoIndex =
        metaRobots.length && /noindex/i.test(metaRobots.attr("content"));

      // Check for AMP
      const isAMP = options.ignoreAMP && /<html[^>]+(amp|⚡)[^>]*>/.test(body);

      // Check custom ignore function
      const shouldIgnore = options.ignore?.(url) || hasNoIndex || isAMP;

      if (shouldIgnore) {
        emitter.emit("ignore", url);
      } else {
        emitter.emit("add", url);

        if (sitemapPath !== null) {
          sitemap.addURL(url, depth);
        }
      }

      // Extract and queue links (no depth limit check)
      const links = [];
      $("a[href]").each((_, el) => {
        const href = $(el).attr("href");
        if (href) {
          try {
            const absoluteUrl = new URL(href, url);

            // Only add links from the same domain
            if (absoluteUrl.hostname !== parsedUrl.hostname) {
              return;
            }

            // Respect initial path restriction
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

      // Add discovered links to queue
      if (links.length) {
        await crawler.addRequests(
          links.map((link) => ({
            url: link,
            userData: { depth: depth + 1 },
          })),
        );
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
        // Start crawling from the initial URL
        await crawler.run([
          {
            url: parsedUrl.href,
            userData: { depth: 0 },
          },
        ]);

        // Crawl complete - finalize sitemap
        sitemap.finish();

        const sitemaps = sitemap.getPaths();

        const cb = () => emitter.emit("done");

        if (sitemapPath !== null) {
          // move files
          if (sitemaps.length > 1) {
            // multiple sitemaps
            let count = 1;
            for (const tmpPath of sitemaps) {
              const newPath = extendFilename(sitemapPath, `_part${count}`);
              await fs.promises.copyFile(tmpPath, newPath);
              await fs.promises.unlink(tmpPath);
              count += 1;
            }

            // Write the sitemap index file
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
