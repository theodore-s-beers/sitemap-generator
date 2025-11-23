import path from "path";
import os from "os";
import fs from "fs";
import crypto from "crypto";

import escapeUnsafe from "./helpers/escapeUnsafe.js";

export interface SitemapStreamInstance {
  getPath: () => string;
  write: (url: string) => void;
  end: () => void;
}

export default function SitemapStream(): SitemapStreamInstance {
  const tmpPath = path.join(
    os.tmpdir(),
    `sitemap_${crypto.randomBytes(5).toString("hex")}`,
  );
  const stream = fs.createWriteStream(tmpPath);

  stream.write('<?xml version="1.0" encoding="utf-8" standalone="yes" ?>');
  stream.write(
    '\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
  );

  const getPath = (): string => tmpPath;

  const write = (url: string): void => {
    const escapedUrl = escapeUnsafe(url);

    stream.write("\n  <url>\n");
    stream.write(`    <loc>${escapedUrl}</loc>\n`);
    stream.write("  </url>");
  };

  const end = (): void => {
    stream.write("\n</urlset>");
    stream.end();
  };

  return { getPath, write, end };
}
