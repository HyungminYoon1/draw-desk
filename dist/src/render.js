import { localBounds, center, LIMITS } from "./model.js";
const n = (v) => Number(v.toFixed(4));
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&apos;",
      })[c],
  );
export function strokePath(item) {
  const pts = item.points,
    rad = (p) => (item.size / 2) * (0.2 + 0.8 * p.p);
  if (pts.length === 1) {
    const p = pts[0],
      r = rad(p);
    return `M ${n(p.x + r)} ${n(p.y)} A ${n(r)} ${n(r)} 0 1 0 ${n(p.x - r)} ${n(p.y)} A ${n(r)} ${n(r)} 0 1 0 ${n(p.x + r)} ${n(p.y)} Z`;
  }
  const sides = pts.map((p, i) => {
    const prev = pts[Math.max(0, i - 1)],
      next = pts[Math.min(pts.length - 1, i + 1)],
      dx = next.x - prev.x,
      dy = next.y - prev.y,
      d = Math.hypot(dx, dy) || 1,
      r = rad(p);
    return {
      l: [p.x - (dy / d) * r, p.y + (dx / d) * r],
      r: [p.x + (dy / d) * r, p.y - (dx / d) * r],
      radius: r,
    };
  });
  const first = sides[0],
    last = sides.at(-1),
    point = (p) => `${n(p[0])} ${n(p[1])}`;
  return (
    `M ${point(first.l)} ` +
    sides
      .slice(1)
      .map((p) => `L ${point(p.l)}`)
      .join(" ") +
    ` A ${n(last.radius)} ${n(last.radius)} 0 0 0 ${point(last.r)} ` +
    sides
      .slice(0, -1)
      .reverse()
      .map((p) => `L ${point(p.r)}`)
      .join(" ") +
    ` A ${n(first.radius)} ${n(first.radius)} 0 0 0 ${point(first.l)} Z`
  );
}
function transform(ctx, item) {
  const c = center(item),
    t = item.transform;
  ctx.translate(c.x + t.x, c.y + t.y);
  ctx.rotate((t.angle * Math.PI) / 180);
  ctx.scale(t.sx, t.sy);
  ctx.translate(-c.x, -c.y);
}
function drawItem(ctx, i) {
  ctx.save();
  transform(ctx, i);
  ctx.globalAlpha = i.opacity;
  ctx.fillStyle = i.color;
  ctx.strokeStyle = i.color;
  ctx.lineWidth = i.size;
  ctx.lineJoin = "round";
  if (i.type === "stroke") {
    if (i.tool === "eraser") ctx.globalCompositeOperation = "destination-out";
    ctx.fill(new Path2D(strokePath(i)));
  } else if (i.type === "text") {
    ctx.font = `${i.fontSize}px ${i.font}`;
    ctx.textBaseline = "top";
    i.text.split('\n').forEach((line,index)=>ctx.fillText(line,i.x,i.y+index*i.fontSize*1.2));
  } else {
    ctx.beginPath();
    if (i.type === "rect") ctx.rect(i.x, i.y, i.width, i.height);
    else
      ctx.ellipse(
        i.x + i.width / 2,
        i.y + i.height / 2,
        i.width / 2,
        i.height / 2,
        0,
        0,
        Math.PI * 2,
      );
    if (i.fill !== "none") {
      ctx.fillStyle = i.fill;
      ctx.fill();
    }
    ctx.stroke();
  }
  ctx.restore();
}
export function renderDocument(
  canvas,
  doc,
  {
    x = 0,
    y = 0,
    scale = 1,
    selection = null,
    gutter = false,
    temp = null,
  } = {},
) {
  const ctx = canvas.getContext("2d");
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (gutter) {
    ctx.fillStyle = "#dee2e4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(scale, scale);
  if (doc.background !== "transparent") {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, doc.width, doc.height);
  } else if (gutter) {
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, doc.width, doc.height);
  }
  ctx.restore();
  const buffer = temp || document.createElement("canvas");
  if (buffer.width !== canvas.width) buffer.width = canvas.width;
  if (buffer.height !== canvas.height) buffer.height = canvas.height;
  const b = buffer.getContext("2d");
  for (const layer of doc.layers) {
    if (!layer.visible || !layer.opacity) continue;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.clearRect(0, 0, buffer.width, buffer.height);
    b.save();
    b.translate(x, y);
    b.scale(scale, scale);
    b.beginPath();
    b.rect(0, 0, doc.width, doc.height);
    b.clip();
    for (const item of layer.items) drawItem(b, item);
    b.restore();
    ctx.save();
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation =
      layer.blend === "normal" ? "source-over" : layer.blend;
    ctx.drawImage(buffer, 0, 0);
    ctx.restore();
  }
  if (selection) {
    const b = localBounds(selection),
      c = center(selection),
      t = selection.transform;
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(scale, scale);
    transform(ctx, selection);
    ctx.strokeStyle = "#197f90";
    ctx.lineWidth = 1.5 / (scale * Math.max(t.sx, t.sy));
    ctx.setLineDash([6 / scale, 4 / scale]);
    ctx.strokeRect(
      b.x - 3 / scale,
      b.y - 3 / scale,
      b.width + 6 / scale,
      b.height + 6 / scale,
    );
    ctx.setLineDash([]);
    ctx.fillStyle = "#fff";
    for (const [cx, cy] of [
      [b.x, b.y],
      [b.x + b.width, b.y],
      [b.x, b.y + b.height],
      [b.x + b.width, b.y + b.height],
    ]) {
      ctx.fillRect(cx - 3 / scale, cy - 3 / scale, 6 / scale, 6 / scale);
      ctx.strokeRect(cx - 3 / scale, cy - 3 / scale, 6 / scale, 6 / scale);
    }
    ctx.restore();
  }
  if (!temp) {
    buffer.width = 1;
    buffer.height = 1;
  }
}
function matrix(i) {
  const c = center(i),
    t = i.transform;
  return `translate(${n(c.x + t.x)} ${n(c.y + t.y)}) rotate(${n(t.angle)}) scale(${n(t.sx)} ${n(t.sy)}) translate(${n(-c.x)} ${n(-c.y)})`;
}
function itemSVG(i, erase = false) {
  const color = erase ? "black" : i.color,
    attrs = `transform="${matrix(i)}" opacity="${n(i.opacity)}"`;
  if (i.type === "stroke")
    return `<path ${attrs} d="${strokePath(i)}" fill="${color}"/>`;
  if (i.type === "text")
    return `<text ${attrs} fill="${color}" font-family="${i.font}" font-size="${n(i.fontSize)}">${i.text.split('\n').map((line,index)=>`<tspan x="${n(i.x)}" y="${n(i.y+i.fontSize*.82+index*i.fontSize*1.2)}">${esc(line)}</tspan>`).join('')}</text>`;
  const shape =
    i.type === "rect"
      ? `rect x="${n(i.x)}" y="${n(i.y)}" width="${n(i.width)}" height="${n(i.height)}"`
      : `ellipse cx="${n(i.x + i.width / 2)}" cy="${n(i.y + i.height / 2)}" rx="${n(i.width / 2)}" ry="${n(i.height / 2)}"`;
  return `<${shape} ${attrs} fill="${i.fill}" stroke="${color}" stroke-width="${n(i.size)}"/>`;
}
export function toSVG(doc) {
  let masks = "",
    body =
      doc.background === "transparent"
        ? ""
        : `<rect width="${doc.width}" height="${doc.height}" fill="${doc.background}"/>`;
  let index = 0;
  for (const layer of doc.layers) {
    if (!layer.visible) continue;
    let content = "";
    for (const i of layer.items) {
      if (i.type === "stroke" && i.tool === "eraser") {
        const id = `erase-${index++}`;
        masks += `<mask id="${id}" maskUnits="userSpaceOnUse" x="0" y="0" width="${doc.width}" height="${doc.height}"><rect width="100%" height="100%" fill="white"/>${itemSVG(i, true)}</mask>`;
        content = `<g mask="url(#${id})">${content}</g>`;
      } else content += itemSVG(i);
    }
    body += `<g opacity="${n(layer.opacity)}" style="mix-blend-mode:${layer.blend}">${content}</g>`;
  }
  return `<?xml version="1.0" encoding="UTF-8"?><svg xmlns="http://www.w3.org/2000/svg" width="${doc.width}" height="${doc.height}" viewBox="0 0 ${doc.width} ${doc.height}"><title>${esc(doc.title)}</title><defs><clipPath id="paper"><rect width="${doc.width}" height="${doc.height}"/></clipPath>${masks}</defs><g clip-path="url(#paper)">${body}</g></svg>`;
}
export function exportSize(doc, longEdge) {
  if (!Number.isInteger(longEdge) || longEdge < 256 || longEdge > LIMITS.edge)
    throw new RangeError("Long edge outside bounds");
  const scale = longEdge / Math.max(doc.width, doc.height),
    width = Math.round(doc.width * scale),
    height = Math.round(doc.height * scale);
  if (width * height > LIMITS.pixels)
    throw new RangeError("Export exceeds 32 megapixels");
  return { width, height, scale };
}
