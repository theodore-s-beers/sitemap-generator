import SitemapStream from "./SitemapStream.js";

export default function SitemapRotator(maxEntries) {
  const sitemaps = [];
  let count = 0;
  let current = null;

  const getPaths = () => sitemaps.map((map) => map.getPath());

  const ensureStream = () => {
    if (current === null) {
      current = SitemapStream();
      sitemaps.push(current);
      count = 0;
    }
  };

  const rotateIfNeeded = () => {
    if (count === maxEntries) {
      current.end();
      current = SitemapStream();
      sitemaps.push(current);
      count = 0;
    }
  };

  const addURL = (url) => {
    if (/sitemap\.xml$/i.test(url)) {
      return;
    }

    ensureStream();
    rotateIfNeeded();

    current.write(url);
    count += 1;
  };

  const finish = () => {
    if (current) current.end();
  };

  return { getPaths, addURL, finish };
}
