import { CheerioCrawler, Configuration } from "crawlee";

export default (uri, options = {}, handlers = {}) => {
  // excluded filetypes
  const exclude = [
    "gif",
    "jpg",
    "jpeg",
    "png",
    "ico",
    "bmp",
    "ogg",
    "webp",
    "mp4",
    "webm",
    "mp3",
    "ttf",
    "woff",
    "json",
    "rss",
    "atom",
    "gz",
    "zip",
    "rar",
    "7z",
    "css",
    "js",
    "gzip",
    "exe",
    "svg",
  ].join("|");

  const extRegex = new RegExp(`\\.(${exclude})$`, "i");

  Configuration.getGlobalConfig().set("persistStorage", false);

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: options.maxRequestsPerCrawl ?? Infinity,
    maxConcurrency: options.maxConcurrency ?? 10,
    requestHandlerTimeoutSecs: (options.timeout ?? 30000) / 1000,
    maxRequestRetries: 1,

    respectRobotsTxtFile: options.respectRobotsTxt ?? true,
    ignoreSslErrors: !!options.ignoreInvalidSSL,

    async requestHandler({ request, response, $ }) {
      if (handlers.onSuccess) {
        const depth = request.userData.depth || 0;
        await handlers.onSuccess({
          url: request.url,
          depth,
          statusCode: response.statusCode,
          headers: response.headers,
          body: $.html(),
          $,
        });
      }
    },

    async failedRequestHandler({ request }, error) {
      if (handlers.onError) {
        handlers.onError({
          url: request.url,
          statusCode: error.statusCode || 500,
          error,
        });
      }
    },

    preNavigationHooks: [
      async ({ request }) => {
        const url = new URL(request.url);

        // File type exclusion
        if (extRegex.test(url.pathname)) {
          request.skipNavigation = true;
          return;
        }

        // Restrict to initial path if provided
        if (uri.pathname !== "/") {
          if (!url.pathname.startsWith(uri.pathname)) {
            request.skipNavigation = true;
            return;
          }
        }

        // Check if URL is on same domain
        if (url.hostname !== uri.hostname) {
          request.skipNavigation = true;
          return;
        }
      },
    ],
  });

  return crawler;
};
