import test from "node:test";
import assert from "node:assert/strict";
import {
  artworkSource,
  imageIsNearViewport,
} from "../src/services/artworkImages";

test("cache separates server, login scope, artwork and original/preview", () => {
  const source = (scope: string, preview = true, base = "https://server") =>
    artworkSource(base, scope, "work", preview, {
      Authorization: "Bearer secret",
    });
  assert.equal(source("a").cacheKey, source("a").cacheKey);
  assert.notEqual(source("a").cacheKey, source("b").cacheKey);
  assert.notEqual(source("a").cacheKey, source("a", false).cacheKey);
  assert.notEqual(
    source("a").cacheKey,
    source("a", true, "https://other").cacheKey,
  );
  assert.ok(!source("a").cacheKey.includes("secret"));
  assert.ok(source("a", false).uri.endsWith("/image"));
  assert.ok(source("a").uri.endsWith("/thumbnail"));
});

test("only visible and nearby images load, including latest chat at the bottom", () => {
  assert.equal(imageIsNearViewport(200, 240, 100, 700), true);
  assert.equal(imageIsNearViewport(850, 240, 100, 700), true);
  assert.equal(imageIsNearViewport(1200, 240, 100, 700), false);
  assert.equal(imageIsNearViewport(-5000, 240, 100, 700), false);
  assert.equal(imageIsNearViewport(200, 240, 0, 0), false);
});
