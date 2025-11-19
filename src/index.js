import fs from "fs";
import http from "http";
import path from "path";
import normalizeUrl from "normalize-url";
import mitt from "mitt";
import { format } from "date-fns";

import createCrawler from "./createCrawler.js";
import SitemapRotator from "./SitemapRotator.js";
import createSitemapIndex from "./createSitemapIndex.js";
import extendFilename from "./helpers/extendFilename.js";
import validChangeFreq from "./helpers/validChangeFreq.js";

export default function SitemapGenerator(uri, opts) {
  const defaultOpts = {
    stripQuerystring: true,
    maxEntriesPerFile: 50000,
    maxDepth: 0,
    filepath: path.join(process.cwd(), "sitemap.xml"),
    userAgent: "Node/SitemapGenerator",
    respectRobotsTxt: true,
    ignoreInvalidSSL: true,
    timeout: 30000,
    decodeResponses: true,
    lastMod: false,
    changeFreq: "",
    priorityMap: [],
    ignoreAMP: true,
    ignore: null,
  };

  if (!uri) {
    throw new Error("Requires a valid URL.");
  }

  const options = Object.assign({}, defaultOpts, opts);

  // if changeFreq option was passed, check to see if the value is valid
  if (opts && opts.changeFreq) {
    options.changeFreq = validChangeFreq(opts.changeFreq);
  }

  const emitter = mitt();

  const parsedUrl = new URL(
    normalizeUrl(uri, {
      stripWWW: false,
      removeTrailingSlash: false,
    }),
  );

  // only resolve if sitemap path is truthy (a string preferably)
  const sitemapPath = options.filepath && path.resolve(options.filepath);

  // we don't care about invalid certs
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

  // create sitemap stream
  const sitemap = SitemapRotator(
    options.maxEntriesPerFile,
    options.lastMod,
    options.changeFreq,
    options.priorityMap,
  );

  const emitError = (code, url) => {
    emitter.emit("error", {
      code,
      message: http.STATUS_CODES[code] || "Unknown error",
      url,
    });
  };

  // Set up crawler with handlers
  const handlers = {
    onSuccess: async ({ url, depth, headers, body, $ }) => {
      // Check for noindex meta tag
      const metaRobots = $('meta[name="robots"]');
      const hasNoIndex =
        metaRobots.length && /noindex/i.test(metaRobots.attr("content"));

      // Check for AMP
      const isAMP = options.ignoreAMP && /<html[^>]+(amp|⚡)[^>]*>/.test(body);

      // Check custom ignore function
      const shouldIgnore =
        (opts.ignore && opts.ignore(url)) || hasNoIndex || isAMP;

      if (shouldIgnore) {
        emitter.emit("ignore", url);
      } else {
        emitter.emit("add", url);

        if (sitemapPath !== null) {
          const lastMod = headers["last-modified"];
          sitemap.addURL(
            url,
            depth,
            lastMod && format(new Date(lastMod), "yyyy-MM-dd"),
          );
        }
      }

      // Extract and queue links if not at max depth
      if (options.maxDepth === 0 || depth < options.maxDepth) {
        const links = [];
        $("a[href]").each((_, el) => {
          const href = $(el).attr("href");
          if (href) {
            try {
              const absoluteUrl = new URL(href, url).href;
              links.push(absoluteUrl);
            } catch {
              // Invalid URL, skip
            }
          }
        });

        // Add discovered links to queue
        for (const link of links) {
          await crawler.addRequests([
            {
              url: link,
              userData: { depth: depth + 1 },
            },
          ]);
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

    stop: async () => {
      // Crawlee doesn't have a graceful stop, but we can track the state
      isRunning = false;
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
