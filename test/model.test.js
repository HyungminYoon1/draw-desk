import test from "node:test";
import assert from "node:assert/strict";
import {
  blankDocument,
  parseDocument,
  validateDocument,
  identity,
  History,
  makePattern,
  dimensions,
  transformedBounds,
  localBounds,
} from "../dist/src/model.js";
import { strokePath, toSVG, exportSize } from "../dist/src/render.js";
const stroke = () => ({
  id: "test-stroke",
  type: "stroke",
  tool: "ink",
  points: [
    { x: 12.125, y: 20.025, p: 0.2 },
    { x: 44.625, y: 37.075, p: 0.9 },
  ],
  size: 3.1,
  color: "#112233",
  opacity: 0.7,
  transform: identity(),
});
test("float precision and pressure survive project serialization and SVG geometry", () => {
  const d = blankDocument();
  d.layers[0].items.push(stroke());
  assert.deepEqual(parseDocument(JSON.stringify(d)), d);
  const path = strokePath(stroke());
  assert(path.includes("12.") && path.includes("A "));
  const fixed = stroke();
  fixed.points.forEach((p) => (p.p = 1));
  assert.notEqual(strokePath(fixed), path);
  const svg = toSVG(d);
  assert(
    svg.includes('viewBox="0 0 2400 1600"') &&
      svg.includes('opacity="0.7"') &&
      !svg.includes("undefined"),
  );
});
test("schema rejects unsafe fields, extreme sizes, malformed transforms and excess erasers", () => {
  for (const raw of [
    "{",
    "{}",
    JSON.stringify({ ...blankDocument(), version: 8 }),
    JSON.stringify({ ...blankDocument(), width: 100000 }),
    JSON.stringify({
      ...blankDocument(),
      background: "url(https://example.org)",
    }),
  ])
    assert.equal(parseDocument(raw), null);
  const d = blankDocument();
  const i = stroke();
  i.transform.sx = 0;
  d.layers[0].items.push(i);
  assert.equal(parseDocument(JSON.stringify(d)), null);
  i.transform.sx = 1;
  i.points[0].x = Infinity;
  assert.equal(parseDocument(JSON.stringify(d)), null);
  const many = blankDocument();
  many.layers[0].items = Array.from({ length: 65 }, (_, n) => ({
    ...stroke(),
    id: `eraser-${n}`,
    tool: "eraser",
  }));
  assert.equal(parseDocument(JSON.stringify(many)), null);
});
test("unsupported extra project content is stripped and text is XML escaped", () => {
  const d = blankDocument();
  d.untrusted = "<script>";
  d.layers[0].items = [
    {
      id: "text",
      type: "text",
      x: 1,
      y: 2,
      width: 100,
      height: 30,
      size: 1,
      color: "#000000",
      fill: "none",
      opacity: 1,
      transform: identity(),
      text: '<script> & "한글"',
      font: "sans-serif",
      fontSize: 24,
    },
  ];
  const safe = parseDocument(JSON.stringify(d));
  assert(!("untrusted" in safe));
  const svg = toSVG(safe);
  assert(
    svg.includes("&lt;script&gt;") &&
      svg.includes("&amp;") &&
      !svg.includes("<script>"),
  );
});
test("undo/redo restores actual geometry and bounded count without clobbering branches", () => {
  let d = blankDocument();
  const h = new History(d);
  d.layers[0].items.push(stroke());
  h.commit(d);
  const first = structuredClone(d);
  d.layers[0].items[0].points[0].x += 0.1;
  h.commit(d);
  assert.deepEqual(h.undo(), first);
  assert.deepEqual(h.redo(), d);
  h.undo();
  d = first;
  d.title = "branch";
  h.commit(d);
  assert.equal(h.redo(), null);
  for (let i = 0; i < 100; i++) {
    d.title = String(i);
    h.commit(d);
  }
  assert(h.back.length <= 60);
});
test("numeric transforms rotate around center and preserve subpixel values", () => {
  const i = stroke(),
    b = localBounds(i);
  i.transform.x = 0.125;
  i.transform.y = 0.25;
  const moved = transformedBounds(i);
  assert(Math.abs(moved.x - b.x - 0.125) < 1e-8);
  i.transform.angle = 90;
  const rotated = transformedBounds(i);
  assert(Math.abs(rotated.width - b.height) < 1e-8);
});
test("export rerender sizes are true aspect ratios and reject allocations above limits", () => {
  const d = blankDocument();
  assert.deepEqual(exportSize(d, 4096), {
    width: 4096,
    height: 2731,
    scale: 4096 / 2400,
  });
  assert.throws(() => exportSize(d, 8192));
  assert(dimensions(8192, 2048));
  assert(!dimensions(8192, 8192));
});
test("seeded particle art becomes editable vector strokes, distinct seeds and fine forces change geometry", () => {
  const a = makePattern({ seed: 3, width: 2400, height: 1600 }),
    b = makePattern({ seed: 4, width: 2400, height: 1600 }),
    c = makePattern({ seed: 3, width: 2400, height: 1600, strength: 0.501 });
  assert.equal(a.items.length, 80);
  assert.notDeepEqual(a.items[0].points, b.items[0].points);
  assert.notDeepEqual(a.items[0].points, c.items[0].points);
  const d = blankDocument();
  d.layers.push(a);
  assert(validateDocument(d));
  for (const mode of ["attract", "repel", "orbit"]) {
    const layer = makePattern({
      seed: 4,
      width: 2400,
      height: 1600,
      count: 160,
      steps: 160,
      strength: 2,
      mode,
    });
    const check = blankDocument();
    check.layers.push(layer);
    assert(validateDocument(check));
  }
  assert.throws(() =>
    makePattern({ seed: 1, width: 2400, height: 1600, count: 900 }),
  );
});
test("eraser masks only already painted content and preserve later marks", () => {
  const d = blankDocument(),
    a = stroke(),
    erase = { ...stroke(), id: "erase", tool: "eraser" },
    after = { ...stroke(), id: "after", color: "#ff0000" };
  d.layers[0].items = [a, erase, after];
  const svg = toSVG(d);
  assert(svg.includes('maskUnits="userSpaceOnUse"'));
  assert(svg.indexOf('fill="#ff0000"') > svg.indexOf('mask="url(#erase-0)"'));
});
