import { CheerioCrawler, Configuration } from "crawlee";
import type { CheerioCrawlingContext } from "crawlee";

interface CreateCrawlerOptions {
  maxRequestsPerCrawl?: number;
  maxConcurrency?: number;
  timeout?: number;
  respectRobotsTxt?: boolean;
  ignoreInvalidSSL?: boolean;
}

interface CrawlSuccessContext {
  url: string;
  depth: number;
  statusCode?: number;
  headers?: Record<string, string>;
  body: string;
  $: any;
}

interface CrawlErrorContext {
  url: string;
  statusCode?: number;
  error?: any;
}

export interface CrawlerHandlers {
  onSuccess?: (context: CrawlSuccessContext) => Promise<void>;
  onError?: (context: CrawlErrorContext) => void;
}

export default (
  uri: URL,
  options: CreateCrawlerOptions = {},
  handlers: CrawlerHandlers = {},
): CheerioCrawler => {
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

    async requestHandler({ request, response, $ }: CheerioCrawlingContext) {
      if (handlers.onSuccess) {
        const depth = (request.userData.depth as number | undefined) || 0;
        await handlers.onSuccess({
          url: request.url,
          depth,
          statusCode: response?.statusCode,
          headers: response?.headers as Record<string, string> | undefined,
          body: $.html(),
          $,
        });
      }
    },

    async failedRequestHandler(
      { request }: CheerioCrawlingContext,
      error: any,
    ) {
      if (handlers.onError) {
        handlers.onError({
          url: request.url,
          statusCode: error?.statusCode || 500,
          error,
        });
      }
    },

    preNavigationHooks: [
      async ({ request }: CheerioCrawlingContext) => {
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
