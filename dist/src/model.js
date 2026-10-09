export const LIMITS = Object.freeze({
  edge: 8192,
  pixels: 32_000_000,
  layers: 16,
  items: 5000,
  points: 300000,
  erasers: 64,
  file: 40_000_000,
  autosave: 4_000_000,
  undo: 48_000_000,
});
export const BLENDS = ["normal", "multiply", "screen", "overlay"];
const colors = /^#[0-9a-fA-F]{6}$/;
const finite = (v, min, max) => Number.isFinite(v) && v >= min && v <= max;
export function uid() {
  return crypto.randomUUID();
}
export function dimensions(width, height) {
  return (
    Number.isInteger(width) &&
    Number.isInteger(height) &&
    width >= 256 &&
    height >= 256 &&
    width <= LIMITS.edge &&
    height <= LIMITS.edge &&
    width * height <= LIMITS.pixels
  );
}
export function blankDocument(width = 2400, height = 1600) {
  if (!dimensions(width, height))
    throw new RangeError("Invalid document dimensions");
  return {
    version: 1,
    title: "새 그림",
    width,
    height,
    background: "#fffdf7",
    layers: [
      {
        id: uid(),
        name: "레이어 1",
        visible: true,
        locked: false,
        opacity: 1,
        blend: "normal",
        items: [],
      },
    ],
  };
}
export function identity() {
  return { x: 0, y: 0, sx: 1, sy: 1, angle: 0 };
}
export function localBounds(item) {
  if (item.type === "stroke") {
    const x = item.points.map((p) => p.x),
      y = item.points.map((p) => p.y),
      r = item.size / 2;
    return {
      x: Math.min(...x) - r,
      y: Math.min(...y) - r,
      width: Math.max(...x) - Math.min(...x) + 2 * r,
      height: Math.max(...y) - Math.min(...y) + 2 * r,
    };
  }
  return { x: item.x, y: item.y, width: item.width, height: item.height };
}
export function center(item) {
  const b = localBounds(item);
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}
export function transformedBounds(item) {
  const b = localBounds(item),
    c = center(item),
    t = item.transform,
    a = (t.angle * Math.PI) / 180;
  const pts = [
    [b.x, b.y],
    [b.x + b.width, b.y],
    [b.x, b.y + b.height],
    [b.x + b.width, b.y + b.height],
  ].map(([x, y]) => {
    const dx = (x - c.x) * t.sx,
      dy = (y - c.y) * t.sy;
    return {
      x: c.x + t.x + dx * Math.cos(a) - dy * Math.sin(a),
      y: c.y + t.y + dx * Math.sin(a) + dy * Math.cos(a),
    };
  });
  return {
    x: Math.min(...pts.map((p) => p.x)),
    y: Math.min(...pts.map((p) => p.y)),
    width: Math.max(...pts.map((p) => p.x)) - Math.min(...pts.map((p) => p.x)),
    height: Math.max(...pts.map((p) => p.y)) - Math.min(...pts.map((p) => p.y)),
  };
}
export function parseDocument(raw) {
  if (typeof raw !== "string" || raw.length > LIMITS.file) return null;
  try {
    const d = JSON.parse(raw);
    if (
      d?.version !== 1 ||
      !dimensions(d.width, d.height) ||
      typeof d.title !== "string" ||
      d.title.length > 160 ||
      !(d.background === "transparent" || colors.test(d.background)) ||
      !Array.isArray(d.layers) ||
      !d.layers.length ||
      d.layers.length > LIMITS.layers
    )
      return null;
    const ids = new Set();
    let points = 0,
      items = 0;
    const validId = (id) =>
      typeof id === "string" &&
      /^[\w-]{1,80}$/.test(id) &&
      !ids.has(id) &&
      ids.add(id);
    const output = {
      version: 1,
      title: d.title,
      width: d.width,
      height: d.height,
      background: d.background,
      layers: [],
    };
    for (const l of d.layers) {
      if (
        !validId(l.id) ||
        typeof l.name !== "string" ||
        l.name.length > 100 ||
        typeof l.visible !== "boolean" ||
        typeof l.locked !== "boolean" ||
        !finite(l.opacity, 0, 1) ||
        !BLENDS.includes(l.blend) ||
        !Array.isArray(l.items) ||
        l.items.length > LIMITS.items
      )
        return null;
      let erasers = 0;
      const layer = {
        id: l.id,
        name: l.name,
        visible: l.visible,
        locked: l.locked,
        opacity: l.opacity,
        blend: l.blend,
        items: [],
      };
      for (const i of l.items) {
        if (
          ++items > LIMITS.items ||
          !validId(i.id) ||
          !["stroke", "rect", "ellipse", "text"].includes(i.type) ||
          !colors.test(i.color) ||
          !finite(i.size, 0.1, 512) ||
          !finite(i.opacity, 0, 1) ||
          !i.transform ||
          !finite(i.transform.x, -32768, 32768) ||
          !finite(i.transform.y, -32768, 32768) ||
          !finite(i.transform.sx, 0.01, 32) ||
          !finite(i.transform.sy, 0.01, 32) ||
          !finite(i.transform.angle, -36000, 36000)
        )
          return null;
        const item = {
          id: i.id,
          type: i.type,
          color: i.color,
          size: i.size,
          opacity: i.opacity,
          transform: {
            x: i.transform.x,
            y: i.transform.y,
            sx: i.transform.sx,
            sy: i.transform.sy,
            angle: i.transform.angle,
          },
        };
        if (i.type === "stroke") {
          if (
            !["ink", "pencil", "marker", "eraser", "line"].includes(i.tool) ||
            !Array.isArray(i.points) ||
            !i.points.length ||
            i.points.length > 50000
          )
            return null;
          if (i.tool === "eraser" && ++erasers > LIMITS.erasers) return null;
          points += i.points.length;
          if (points > LIMITS.points) return null;
          item.tool = i.tool;
          item.points = [];
          for (const p of i.points) {
            if (
              !finite(p.x, -32768, 32768) ||
              !finite(p.y, -32768, 32768) ||
              !finite(p.p, 0, 1)
            )
              return null;
            item.points.push({ x: p.x, y: p.y, p: p.p });
          }
        } else {
          if (
            !finite(i.x, -32768, 32768) ||
            !finite(i.y, -32768, 32768) ||
            !finite(i.width, 0.1, 16384) ||
            !finite(i.height, 0.1, 16384) ||
            !(i.fill === "none" || colors.test(i.fill))
          )
            return null;
          Object.assign(item, {
            x: i.x,
            y: i.y,
            width: i.width,
            height: i.height,
            fill: i.fill,
          });
          if (i.type === "text") {
            if (
              typeof i.text !== "string" ||
              i.text.length > 2000 ||
              !["sans-serif", "serif", "monospace"].includes(i.font) ||
              !finite(i.fontSize, 1, 512)
            )
              return null;
            Object.assign(item, {
              text: i.text,
              font: i.font,
              fontSize: i.fontSize,
            });
          }
        }
        layer.items.push(item);
      }
      output.layers.push(layer);
    }
    return output;
  } catch {
    return null;
  }
}
export function validateDocument(doc) {
  const safe = parseDocument(JSON.stringify(doc));
  if (!safe) throw new RangeError("Invalid or over-budget drawing");
  return safe;
}
export class History {
  constructor(initial) {
    this.current = JSON.stringify(initial);
    this.back = [];
    this.forward = [];
  }
  commit(doc) {
    const next = JSON.stringify(doc);
    if (next === this.current) return false;
    this.back.push(this.current);
    this.current = next;
    this.forward = [];
    this.trim();
    return true;
  }
  trim() {
    while (
      this.back.length + this.forward.length > 60 ||
      this.back.reduce((n, s) => n + s.length * 2, 0) +
        this.forward.reduce((n, s) => n + s.length * 2, 0) >
        LIMITS.undo
    ) {
      if (this.back.length) this.back.shift();
      else if (this.forward.length) this.forward.shift();
      else break;
    }
  }
  undo() {
    if (!this.back.length) return null;
    this.forward.push(this.current);
    this.current = this.back.pop();
    this.trim();
    return JSON.parse(this.current);
  }
  redo() {
    if (!this.forward.length) return null;
    this.back.push(this.current);
    this.current = this.forward.pop();
    this.trim();
    return JSON.parse(this.current);
  }
}
export function random(seed) {
  let s = seed >>> 0;
  return () => {
    s += 0x6d2b79f5;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const palettes = {
  ocean: ["#296f81", "#47a49d", "#afcbbc", "#ddc991"],
  ember: ["#ea7038", "#b93434", "#f5b55f", "#413357"],
  ink: ["#183942", "#587671", "#9cb09a", "#d0bd92"],
};
export function makePattern({
  seed,
  width,
  height,
  count = 80,
  steps = 96,
  strength = 0.5,
  mode = "attract",
  palette = "ocean",
}) {
  if (
    !Number.isInteger(seed) ||
    seed < 0 ||
    seed > 0xffffffff ||
    !dimensions(width, height) ||
    !Number.isInteger(count) ||
    count < 12 ||
    count > 160 ||
    !Number.isInteger(steps) ||
    steps < 16 ||
    steps > 160 ||
    !finite(strength, 0.001, 2) ||
    !["attract", "repel", "orbit"].includes(mode) ||
    !palettes[palette]
  )
    throw new RangeError("Invalid pattern");
  const r = random(seed),
    items = [];
  for (let i = 0; i < count; i++) {
    const theta = r() * Math.PI * 2,
      rad = Math.min(width, height) * (0.1 + r() * 0.38);
    let x = width / 2 + Math.cos(theta) * rad,
      y = height / 2 + Math.sin(theta) * rad,
      vx = -Math.sin(theta) * 2,
      vy = Math.cos(theta) * 2;
    const points = [];
    for (let j = 0; j < steps; j++) {
      points.push({ x, y, p: 0.45 + (0.55 * j) / steps });
      const dx = width / 2 - x,
        dy = height / 2 - y,
        d = Math.max(20, Math.hypot(dx, dy));
      if (mode === "orbit") {
        vx += ((-dy / d) * 0.35 + (dx / d) * 0.02) * strength;
        vy += ((dx / d) * 0.35 + (dy / d) * 0.02) * strength;
      } else {
        const f = mode === "repel" ? -1 : 1;
        vx += (dx / d) * strength * f;
        vy += (dy / d) * strength * f;
      }
      vx *= 0.985;
      vy *= 0.985;
      x = Math.max(-32000, Math.min(32000, x + vx * 4));
      y = Math.max(-32000, Math.min(32000, y + vy * 4));
    }
    items.push({
      id: uid(),
      type: "stroke",
      tool: "ink",
      color: palettes[palette][i % 4],
      size: 0.5 + r() * 3,
      opacity: 0.65,
      transform: identity(),
      points,
    });
  }
  return {
    id: uid(),
    name: `패턴 ${seed}`,
    visible: true,
    locked: false,
    opacity: 1,
    blend: "normal",
    items,
  };
}
