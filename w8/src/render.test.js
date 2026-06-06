import { test } from "node:test";
import assert from "node:assert";
import { renderData } from "./render.js";

test("builds data.json with the quote and date", () => {
  const out = renderData({ quote: "Hello", author: "Ada" }, "2026-06-06");
  const parsed = JSON.parse(out);
  assert.equal(parsed.quote, "Hello");
  assert.equal(parsed.author, "Ada");
  assert.equal(parsed.date, "2026-06-06");
});

test("keeps category whether string or array", () => {
  const a = JSON.parse(renderData({ quote: "Q", category: "wisdom" }, "d"));
  assert.equal(a.category, "wisdom");
  const b = JSON.parse(renderData({ quote: "Q", category: ["a", "b"] }, "d"));
  assert.deepEqual(b.category, ["a", "b"]);
});

test("omits empty optional fields", () => {
  const parsed = JSON.parse(renderData({ quote: "Q", author: "", category: [] }, "d"));
  assert.ok(!("author" in parsed));
  assert.ok(!("work" in parsed));
  assert.ok(!("category" in parsed));
});

test("produces valid JSON for tricky characters", () => {
  const out = renderData({ quote: 'a "b"', author: "x" }, "d");
  assert.equal(JSON.parse(out).quote, 'a "b"');
});
