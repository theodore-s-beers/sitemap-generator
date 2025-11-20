import { CheerioCrawler, Configuration, MemoryStorage } from "crawlee";

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

  const storageClient = new MemoryStorage();
  Configuration.getGlobalConfig().set("storageClient", storageClient);

  const crawler = new CheerioCrawler({
    maxRequestsPerCrawl: options.maxRequestsPerCrawl || Infinity,
    maxConcurrency: options.maxConcurrency || 10,
    requestHandlerTimeoutSecs: (options.timeout || 30000) / 1000,
    maxRequestRetries: 1,

    // Respect robots.txt if option is set
    ignoreSslErrors: options.ignoreInvalidSSL !== false,

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
        if (url.pathname.match(extRegex)) {
          request.skipNavigation = true;
          return;
        }

        // Restrict to initial path if provided
        if (uri.pathname && uri.pathname !== "/") {
          const initialURLRegex = new RegExp(`^${uri.pathname}`);
          if (!url.pathname.match(initialURLRegex)) {
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

  // Store metadata for compatibility
  crawler._uri = uri;
  crawler._options = options;

  return crawler;
};
