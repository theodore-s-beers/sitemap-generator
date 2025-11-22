# Sitemap Generator

> Easily create XML sitemaps for your website.

Generates a sitemap by crawling your site. Uses streams to efficiently write the sitemap to your drive and runs asynchronously to avoid blocking the thread. Creates multiple sitemaps if the threshold is reached. Respects `robots.txt` and meta tags.

## About This Fork

This is a maintained and modernized fork of the original [`sitemap-generator`](https://github.com/lgraubner/sitemap-generator) by Lars Graubner. The original project has not been maintained since ca. 2021. This fork includes:

- Migration to ESM (ES modules)
- Replacement of deprecated `simplecrawler` with modern `crawlee`
- Updated dependencies and security fixes
- Modern development setup with Vitest, ESLint 9, and Prettier

All credit for the original concept and implementation goes to Lars Graubner. This fork maintains the same MIT license.

## Install

This package is available on [npm](https://www.npmjs.com/).

```sh
npm install @t6e/sitemap-generator
```

NB, this module runs only with Node.js (`>=20.0.0`) and is not meant to be used in the browser.

## Usage

```js
import SitemapGenerator from "@t6e/sitemap-generator";

// Create generator
const generator = SitemapGenerator("http://example.com", {
  stripQuerystring: false,
});

// Register event listeners
generator.on("done", () => {
  console.log("Sitemap created!");
});

generator.on("add", (url) => {
  console.log("Added:", url);
});

// Start the crawler
generator.start();
```

The crawler will fetch HTML pages and other file types [parsed by Google](https://support.google.com/webmasters/answer/35287?hl=en). If present, the `robots.txt` file will be taken into account, with rules applied to each URL to consider if it should be added to the sitemap. The crawler will not fetch URLs from a page if the `robots` meta tag with the value `nofollow` is present, and will ignore a page completely if the `noindex` rule is present.

## API

The generator offers straightforward methods to start the crawler and manage URLs.

### `start()`

Starts the crawler asynchronously and writes the sitemap to disk.

```js
await generator.start();
```

### `getCrawler()`

Returns the underlying [Crawlee](https://crawlee.dev/) crawler instance. This can be useful for advanced configuration.

```js
const crawler = generator.getCrawler();
```

### `getSitemap()`

Returns the sitemap instance (`SitemapRotator`). This can be useful to add static URLs to the sitemap:

```js
const sitemap = generator.getSitemap();
sitemap.addURL("/my/static/url");
```

### `queueURL(url)`

Add a URL to the crawler's queue. Useful to help the crawler fetch pages it can't find itself.

```js
await generator.queueURL("http://example.com/hidden-page");
```

### `on(event, handler)` / `off(event, handler)`

Register or unregister event listeners. See [Events](#events) section below.

```js
generator.on("add", (url) => console.log(url));
```

## Options

Configure the sitemap generator by passing an options object as the second argument.

```js
const generator = SitemapGenerator("http://example.com", {
  maxDepth: 0,
  filepath: "./sitemap.xml",
  maxEntriesPerFile: 50000,
  stripQuerystring: true,
  userAgent: "Node/SitemapGenerator",
  timeout: 30000,
});
```

### `filepath`

Type: `string`  
Default: `./sitemap.xml`

Filepath for the new sitemap. If multiple sitemaps are created, `_part1`, `_part2`, etc. are appended to each filename. If you don't want to write files at all, you can pass `null` as the filepath.

### `maxEntriesPerFile`

Type: `number`  
Default: `50000`

Google limits the maximum number of URLs in one sitemap to 50,000. If this limit is reached, the sitemap-generator creates multiple sitemaps and a sitemap index file.

### `stripQuerystring`

Type: `boolean`  
Default: `true`

Whether to strip query strings from URLs before adding them to the sitemap.

### `maxDepth`

Type: `number`  
Default: `0` (i.e., unlimited)

Maximum crawl depth. Set to `0` for unlimited depth, or specify a number to limit how many levels deep the crawler will go.

### `userAgent`

Type: `string`  
Default: `Node/SitemapGenerator`

The user agent string to use when crawling.

### `respectRobotsTxt`

Type: `boolean`  
Default: `true`

Whether to respect `robots.txt` rules.

### `ignoreInvalidSSL`

Type: `boolean`  
Default: `false`

Whether to ignore invalid SSL certificates.

### `timeout`

Type: `number`  
Default: `30000` (i.e., 30 seconds)

Request timeout in milliseconds.

### `ignoreAMP`

Type: `boolean`  
Default: `true`

Whether to ignore AMP (Accelerated Mobile Pages) versions of pages.

### `ignore(url)`

Type: `function`  
Default: `null`

A custom function to determine if a URL should be ignored. Return `true` to ignore the URL.

Example:

```js
const generator = SitemapGenerator("http://example.com", {
  ignore: (url) => {
    // Ignore URLs containing "admin"
    return url.includes("/admin/");
  },
});
```

## Events

The Sitemap Generator emits several events which can be listened to.

### `add`

Triggered when the crawler successfully adds a URL to the sitemap.

```js
generator.on("add", (url) => {
  console.log("Added:", url);
});
```

### `done`

Triggered when the crawler finishes and the sitemap is created.

```js
generator.on("done", () => {
  console.log("Sitemap generation complete!");
});
```

### `error`

Triggered when there's an error fetching a URL. Passes an object with the HTTP status code, a message, and the URL.

```js
generator.on("error", (error) => {
  console.log(error);
  // => { code: 404, message: 'Not Found', url: 'http://example.com/missing' }
});
```

### `ignore`

Triggered when a URL is ignored (due to robots.txt, noindex meta tag, AMP detection, or custom ignore function). Passes the ignored URL.

```js
generator.on("ignore", (url) => {
  console.log("Ignored:", url);
});
```
