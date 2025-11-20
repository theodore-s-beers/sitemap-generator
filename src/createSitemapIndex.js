import extendFilename from "./helpers/extendFilename.js";

export default (url, filename, sitemapCount) => {
  const base = url.replace(/\/$/, "");
  const lines = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  ];

  for (let i = 1; i <= sitemapCount; i += 1) {
    const newFilename = extendFilename(filename, `_part${i}`);
    const sitemapUrl = `${base}/${newFilename}`;
    lines.push("  <sitemap>", `    <loc>${sitemapUrl}</loc>`, "  </sitemap>");
  }

  lines.push("</sitemapindex>");
  return lines.join("\n");
};
