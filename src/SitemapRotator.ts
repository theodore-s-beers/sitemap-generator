import SitemapStream, { type SitemapStreamInstance } from "./SitemapStream.js";

export interface SitemapRotatorInstance {
  getPaths: () => string[];
  addURL: (url: string) => void;
  finish: () => void;
}

export default function SitemapRotator(
  maxEntries: number,
): SitemapRotatorInstance {
  const sitemaps: SitemapStreamInstance[] = [];
  let count = 0;
  let current: SitemapStreamInstance | null = null;

  const getPaths = (): string[] => sitemaps.map((map) => map.getPath());

  const ensureStream = (): void => {
    if (current === null) {
      current = SitemapStream();
      sitemaps.push(current);
      count = 0;
    }
  };

  const rotateIfNeeded = (): void => {
    if (count === maxEntries) {
      current!.end();
      current = SitemapStream();
      sitemaps.push(current);
      count = 0;
    }
  };

  const addURL = (url: string): void => {
    if (/sitemap\.xml$/i.test(url)) {
      return;
    }

    ensureStream();
    rotateIfNeeded();

    current!.write(url);
    count += 1;
  };

  const finish = (): void => {
    if (current) current.end();
  };

  return { getPaths, addURL, finish };
}
