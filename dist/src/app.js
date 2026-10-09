import {
  LIMITS,
  uid,
  blankDocument,
  identity,
  dimensions,
  parseDocument,
  validateDocument,
  History,
  localBounds,
  center,
  transformedBounds,
  makePattern,
} from "./model.js";
import { renderDocument, toSVG, exportSize } from "./render.js";
const $ = (id) => document.getElementById(id),
  el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
const KEY = "draw-desk-project-v1",
  canvas = $("canvas"),
  temp = document.createElement("canvas");
let doc,
  history,
  layerId,
  selectedId = null,
  tool = "ink",
  camera = { x: 0, y: 0, zoom: 1 },
  pending = null,
  gesture = null,
  space = false,
  raf = 0,
  needsFit = true,
  autoFit = true,
  storageBlocked = false,
  dirty = false,
  newMode = false;
const pointers = new Map(),
  names = {
    select: "선택",
    ink: "브러시",
    pencil: "연필",
    marker: "마커",
    eraser: "지우개",
    line: "직선",
    rect: "사각형",
    ellipse: "타원",
    text: "글자",
    hand: "이동",
  };
function notice(text) {
  $("notice").textContent = text;
  clearTimeout(notice.timer);
  notice.timer = setTimeout(() => ($("notice").textContent = ""), 5000);
}
function sample() {
  const d = blankDocument();
  d.title = "해안선 · 샘플";
  d.background = "#faf3e4";
  const sun = {
    id: uid(),
    type: "ellipse",
    x: 1630,
    y: 170,
    width: 390,
    height: 390,
    size: 0.1,
    color: "#de895e",
    fill: "#de895e",
    opacity: 1,
    transform: identity(),
  };
  d.layers[0].name = "햇빛";
  d.layers[0].items = [sun];
  const waves = {
    id: uid(),
    name: "물결",
    visible: true,
    locked: false,
    opacity: 1,
    blend: "normal",
    items: [],
  };
  for (let k = 0; k < 34; k++) {
    const points = Array.from({ length: 160 }, (_, j) => {
      const x = (j / 159) * 2600 - 100;
      return {
        x,
        y:
          700 +
          k * 24 +
          Math.sin(x / 400 + k * 0.14) * 115 +
          Math.sin(x / 1200) * 160,
        p: 1,
      };
    });
    waves.items.push({
      id: uid(),
      type: "stroke",
      tool: "ink",
      color: k % 3 === 0 ? "#b5bfa5" : k % 3 === 1 ? "#467874" : "#225853",
      size: k < 5 ? 8 : 4,
      opacity: k < 5 ? 0.8 : 1,
      transform: identity(),
      points,
    });
  }
  d.layers.push(waves);
  return d;
}
try {
  const raw = localStorage.getItem(KEY);
  if (raw) {
    doc = parseDocument(raw);
    if (!doc) {
      storageBlocked = true;
      notice(
        "저장된 문서를 읽지 못했습니다. 원본은 유지됩니다. 파일로 새 문서를 저장하세요.",
      );
    }
  }
} catch {
  storageBlocked = true;
}
doc ??= sample();
history = new History(doc);
layerId = doc.layers.at(-1).id;
const activeLayer = () =>
  doc.layers.find((l) => l.id === layerId) || doc.layers.at(-1);
const selected = () =>
  doc.layers.flatMap((l) => l.items).find((i) => i.id === selectedId) || null;
const owner = (i) =>
  doc.layers.find((l) => l.items.some((x) => x.id === i?.id));
function saveLocal() {
  const raw = JSON.stringify(doc),
    size = new TextEncoder().encode(raw).length;
  if (storageBlocked) {
    $("save-state").textContent = "자동 저장 불가 · 파일 저장 필요";
    return;
  }
  if (size > LIMITS.autosave) {
    $("save-state").textContent = "4MB 초과 · 파일 저장 필요";
    return;
  }
  try {
    localStorage.setItem(KEY, raw);
    if (localStorage.getItem(KEY) !== raw) throw new Error("Readback");
    dirty = false;
    $("save-state").textContent = "이 브라우저에 저장됨";
  } catch {
    storageBlocked = true;
    $("save-state").textContent = "저장 공간 사용 불가 · 파일 저장 필요";
  }
}
function commit() {
  try {
    doc = validateDocument(doc);
    history.commit(doc);
    dirty = true;
    saveLocal();
    sync();
  } catch {
    doc = JSON.parse(history.current);
    pending = null;
    selectedId = null;
    notice("문서 한도를 넘었거나 잘못된 값입니다. 변경 전 상태를 유지합니다.");
    sync();
  }
  schedule();
}
function update(fn) {
  fn();
  commit();
}
function sync() {
  if (!doc.layers.some((l) => l.id === layerId)) layerId = doc.layers.at(-1).id;
  $("title").value = doc.title;
  $("undo").disabled = !history.back.length;
  $("redo").disabled = !history.forward.length;
  $("document-size").textContent = `${doc.width} × ${doc.height} px`;
  $("object-count").textContent =
    `${doc.layers.length} 레이어 · ${doc.layers.reduce((n, l) => n + l.items.length, 0)} 개체`;
  $("zoom").value = Number((camera.zoom * 100).toFixed(1));
  const l = activeLayer();
  $("layer-name").value = l.name;
  $("layer-opacity").value = l.opacity;
  $("layer-opacity-value").value = Math.round(l.opacity * 100) + "%";
  $("blend").value = l.blend;
  $("layer-lock").textContent = l.locked ? "잠금 해제" : "잠금";
  $("layers").replaceChildren(
    ...[...doc.layers].reverse().map((layer) => {
      const row = el(
          "div",
          "layer-row" + (layer.id === layerId ? " active" : ""),
        ),
        visible = el("button", "visibility", layer.visible ? "◉" : "○");
      visible.setAttribute(
        "aria-label",
        `${layer.name} ${layer.visible ? "숨기기" : "보이기"}`,
      );
      visible.addEventListener("click", () =>
        update(() => (layer.visible = !layer.visible)),
      );
      const choose = el("button", "layer-select", layer.name);
      choose.append(el("small", null, `${layer.items.length} 개체`));
      choose.addEventListener("click", () => {
        layerId = layer.id;
        selectedId = null;
        sync();
        schedule();
      });
      row.append(visible, choose);
      if (layer.locked) row.append(el("span", "locked", "잠금"));
      return row;
    }),
  );
  const item = selected();
  $("selection-settings").hidden = !item;
  if (item) {
    const b = localBounds(item),
      c = center(item);
    $("select-x").value = Number((c.x + item.transform.x).toFixed(3));
    $("select-y").value = Number((c.y + item.transform.y).toFixed(3));
    $("select-width").value = Number((b.width * item.transform.sx).toFixed(3));
    $("select-height").value = Number(
      (b.height * item.transform.sy).toFixed(3),
    );
    $("select-angle").value = item.transform.angle;
    $("color").value = item.color;
    $("size").value = item.size;
    $("opacity").value = item.opacity;
    $("selected-text-label").hidden = item.type !== "text";
    if(item.type === "text") { $("selected-text").value=item.text; $("font").value=item.font; $("font-size").value=item.fontSize; }
    for(const id of ["select-x","select-y","select-width","select-height","select-angle","selected-text","duplicate","delete-object"])$(id).disabled=owner(item).locked;
  }
  $("opacity-value").value = Math.round(Number($("opacity").value) * 100) + "%";
}
function schedule() {
  if (!raf) raf = requestAnimationFrame(draw);
}
function draw() {
  raf = 0;
  const ratio = Math.min(devicePixelRatio || 1, 2),
    view = pending
      ? {
          ...doc,
          layers: doc.layers.map((l) =>
            l.id === layerId ? { ...l, items: [...l.items, pending] } : l,
          ),
        }
      : doc;
  renderDocument(canvas, view, {
    x: camera.x * ratio,
    y: camera.y * ratio,
    scale: camera.zoom * ratio,
    selection: tool === "select" ? selected() : null,
    gutter: true,
    temp,
  });
}
function fit() {
  const b = $("stage").getBoundingClientRect();
  camera.zoom = Math.max(
    0.05,
    Math.min(8, (b.width - 58) / doc.width, (b.height - 58) / doc.height),
  );
  camera.x = (b.width - doc.width * camera.zoom) / 2;
  camera.y = (b.height - doc.height * camera.zoom) / 2;
  needsFit = false;
  autoFit = true;
  $("zoom").value = Number((camera.zoom * 100).toFixed(1));
  schedule();
}
new ResizeObserver(() => {
  const b = $("stage").getBoundingClientRect(),
    ratio = Math.min(devicePixelRatio || 1, 2);
  canvas.width = Math.max(1, Math.round(b.width * ratio));
  canvas.height = Math.max(1, Math.round(b.height * ratio));
  if (needsFit || autoFit) fit();
  else schedule();
}).observe($("stage"));
function zoomTo(
  zoom,
  x = $("stage").clientWidth / 2,
  y = $("stage").clientHeight / 2,
) {
  autoFit = false;
  const next = Math.max(0.05, Math.min(16, zoom)),
    wx = (x - camera.x) / camera.zoom,
    wy = (y - camera.y) / camera.zoom;
  camera.zoom = next;
  camera.x = x - wx * next;
  camera.y = y - wy * next;
  $("zoom").value = Number((next * 100).toFixed(1));
  schedule();
}
$("zoom-in").addEventListener("click", () => zoomTo(camera.zoom * 1.2));
$("zoom-out").addEventListener("click", () => zoomTo(camera.zoom / 1.2));
$("zoom").addEventListener("change", () => {
  const z = Number($("zoom").value) / 100;
  if (Number.isFinite(z)) zoomTo(z);
});
$("fit").addEventListener("click", fit);
canvas.addEventListener(
  "wheel",
  (event) => {
    event.preventDefault();
    const b = canvas.getBoundingClientRect();
    if (event.ctrlKey || event.metaKey)
      zoomTo(
        camera.zoom * Math.exp(-event.deltaY * 0.002),
        event.clientX - b.left,
        event.clientY - b.top,
      );
    else {
      autoFit = false;
      camera.x -= event.deltaX;
      camera.y -= event.deltaY;
      schedule();
    }
  },
  { passive: false },
);
function setTool(next) {
  tool = next;
  if (next !== "select") selectedId = null;
  for (const button of document.querySelectorAll("[data-tool]"))
    button.setAttribute("aria-pressed", String(button.dataset.tool === tool));
  $("tool-name").textContent = names[next];
  $("tool-hint").textContent =
    next === "select"
      ? "선택 후 드래그 · 모서리로 크기 조절 · 속성에서 정밀 편집"
      : next === "hand"
        ? "드래그로 이동 · Ctrl/⌘ + 휠로 확대"
        : next === "eraser"
          ? "현재 레이어의 앞선 선을 지웁니다."
          : next === "text"
            ? "캔버스를 눌러 글자를 넣으세요."
            : "Space + 드래그로 이동 · Ctrl/⌘ + 휠로 확대";
  canvas.style.cursor =
    next === "hand" ? "grab" : next === "select" ? "default" : "crosshair";
  if (next === "pencil") $("size").value = 3;
  if (next === "marker") {
    $("size").value = 55;
    $("opacity").value = 0.35;
  }
  sync();
  schedule();
}
document
  .querySelectorAll("[data-tool]")
  .forEach((b) => b.addEventListener("click", () => setTool(b.dataset.tool)));
for (const color of [
  "#254d54",
  "#e29466",
  "#bf4e47",
  "#deb874",
  "#779579",
  "#99bdc3",
  "#352c4d",
  "#f9f6e9",
]) {
  const button = el("button");
  button.style.background = color;
  button.setAttribute("aria-label", `색 ${color}`);
  button.addEventListener("click", () => {
    $("color").value = color;
    applyStyle(true);
  });
  $("swatches").append(button);
}
function applyStyle(save = false) {
  const i = selected();
  $("opacity-value").value = Math.round(Number($("opacity").value) * 100) + "%";
  if (i && tool === "select" && !owner(i).locked) {
    i.color = $("color").value;
    i.size = Math.max(0.1, Math.min(512, Number($("size").value) || 0.1));
    i.opacity = Number($("opacity").value);
    if (i.type !== "stroke" && i.type !== "text")
      i.fill = $("fill-shapes").checked ? $("color").value : "none";
    if (i.type === "text") {
      i.font = $("font").value;
      i.fontSize = Math.max(
        1,
        Math.min(512, Number($("font-size").value) || 1),
      );
      updateTextBounds(i);
    }
    if (save) commit();
    else schedule();
  }
}
function updateTextBounds(item){const ctx=canvas.getContext('2d');ctx.font=`${item.fontSize}px ${item.font}`;const lines=item.text.split('\n');item.width=Math.max(.1,...lines.map(line=>ctx.measureText(line).width));item.height=item.fontSize*1.2*lines.length;}
$('selected-text').addEventListener('change',()=>{const i=selected();if(!i||i.type!=='text'||owner(i).locked)return;update(()=>{i.text=$('selected-text').value;updateTextBounds(i);});});
for (const id of [
  "color",
  "size",
  "opacity",
  "fill-shapes",
  "font",
  "font-size",
]) {
  $(id).addEventListener("input", () => applyStyle());
  $(id).addEventListener("change", () => applyStyle(true));
}
$("smoothing").addEventListener(
  "input",
  () =>
    ($("smoothing-value").value =
      Math.round(Number($("smoothing").value) * 100) + "%"),
);
function point(event) {
  const b = canvas.getBoundingClientRect();
  return {
    x: (event.clientX - b.left - camera.x) / camera.zoom,
    y: (event.clientY - b.top - camera.y) / camera.zoom,
    p:
      $("pressure").checked && event.pointerType === "pen"
        ? Math.max(0, Math.min(1, event.pressure))
        : 1,
  };
}
function hit(p) {
  for (const layer of [...doc.layers].reverse()) {
    if (!layer.visible || layer.locked) continue;
    for (const i of [...layer.items].reverse()) {
      if (i.type === "stroke" && i.tool === "eraser") continue;
      const b = transformedBounds(i),
        margin = 6 / camera.zoom;
      if (
        p.x >= b.x - margin &&
        p.x <= b.x + b.width + margin &&
        p.y >= b.y - margin &&
        p.y <= b.y + b.height + margin
      )
        return { layer, item: i };
    }
  }
  return null;
}
function corners(item) {
  const b = localBounds(item),
    c = center(item),
    t = item.transform,
    a = (t.angle * Math.PI) / 180;
  return [
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
}
canvas.addEventListener("pointerdown", (event) => {
  if (event.button !== 0 && event.button !== 1) return;
  event.preventDefault();
  canvas.focus({ preventScroll: true });
  canvas.setPointerCapture(event.pointerId);
  pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  if (pointers.size === 2) {
    pending = null;
    gesture = null;
    const p = [...pointers.values()];
    gesture = {
      kind: "pinch",
      distance: Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y),
      zoom: camera.zoom,
    };
    schedule();
    return;
  }
  const p = point(event);
  if (space || tool === "hand" || event.button === 1) {
    gesture = {
      kind: "pan",
      id: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      camera: { ...camera },
    };
    return;
  }
  if (tool === "select") {
    const current = selected();
    if (
      current &&
      !owner(current).locked &&
      corners(current).some(
        (c) => Math.hypot(c.x - p.x, c.y - p.y) < 10 / camera.zoom,
      )
    ) {
      gesture = {
        kind: "resize",
        id: event.pointerId,
        item: current,
        transform: { ...current.transform },
        center: center(current),
        bounds: localBounds(current),
      };
      return;
    }
    const found = hit(p);
    if (found) {
      selectedId = found.item.id;
      layerId = found.layer.id;
      gesture = {
        kind: "move",
        id: event.pointerId,
        item: found.item,
        transform: { ...found.item.transform },
        start: p,
      };
    } else selectedId = null;
    sync();
    schedule();
    return;
  }
  const layer = activeLayer();
  if (layer.locked || !layer.visible) {
    notice("보이고 잠기지 않은 레이어를 선택하세요.");
    return;
  }
  const common = {
    id: uid(),
    color: $("color").value,
    size: Math.max(0.1, Math.min(512, Number($("size").value) || 0.1)),
    opacity: Number($("opacity").value),
    transform: identity(),
  };
  if (tool === "text") {
    const text = prompt("넣을 글자를 입력하세요.", "");
    if (text === null || !text.trim()) return;
    const fontSize = Math.max(
        1,
        Math.min(512, Number($("font-size").value) || 96),
      ),
      font = $("font").value,
      ctx = canvas.getContext("2d");
    ctx.font = `${fontSize}px ${font}`;
    const item = {
      ...common,
      type: "text",
      x: p.x,
      y: p.y,
      width: Math.max(0.1, Math.min(16384, ctx.measureText(text).width)),
      height: fontSize * 1.2,
      fill: "none",
      font,
      fontSize,
      text,
    };
    update(() => layer.items.push(item));
    selectedId = item.id;
    setTool("select");
    return;
  }
  pending = ["rect", "ellipse"].includes(tool)
    ? {
        ...common,
        type: tool,
        x: p.x,
        y: p.y,
        width: 0.1,
        height: 0.1,
        fill: $("fill-shapes").checked ? $("color").value : "none",
      }
    : { ...common, type: "stroke", tool, points: [p] };
  gesture = { kind: "draw", id: event.pointerId, start: p };
  schedule();
});
canvas.addEventListener("pointermove", (event) => {
  if (pointers.has(event.pointerId))
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
  const p = point(event);
  $("coordinates").textContent = `X ${p.x.toFixed(1)} · Y ${p.y.toFixed(1)}`;
  if (!gesture) return;
  if (gesture.kind === "pinch" && pointers.size >= 2) {
    const p = [...pointers.values()],
      b = canvas.getBoundingClientRect();
    zoomTo(
      (gesture.zoom * Math.hypot(p[0].x - p[1].x, p[0].y - p[1].y)) /
        Math.max(1, gesture.distance),
      (p[0].x + p[1].x) / 2 - b.left,
      (p[0].y + p[1].y) / 2 - b.top,
    );
    return;
  }
  if (gesture.id !== event.pointerId) return;
  if (gesture.kind === "pan") {
    autoFit = false;
    camera.x = gesture.camera.x + event.clientX - gesture.x;
    camera.y = gesture.camera.y + event.clientY - gesture.y;
    canvas.style.cursor = "grabbing";
    schedule();
    return;
  }
  if (gesture.kind === "move") {
    gesture.item.transform.x = Math.max(
      -32768,
      Math.min(32768, gesture.transform.x + p.x - gesture.start.x),
    );
    gesture.item.transform.y = Math.max(
      -32768,
      Math.min(32768, gesture.transform.y + p.y - gesture.start.y),
    );
    schedule();
    return;
  }
  if (gesture.kind === "resize") {
    const g = gesture,
      a = (-g.transform.angle * Math.PI) / 180,
      dx = p.x - g.center.x - g.transform.x,
      dy = p.y - g.center.y - g.transform.y;
    g.item.transform.sx = Math.max(
      0.01,
      Math.min(
        32,
        Math.abs(dx * Math.cos(a) - dy * Math.sin(a)) / (g.bounds.width / 2),
      ),
    );
    g.item.transform.sy = Math.max(
      0.01,
      Math.min(
        32,
        Math.abs(dx * Math.sin(a) + dy * Math.cos(a)) / (g.bounds.height / 2),
      ),
    );
    schedule();
    return;
  }
  if (!pending) return;
  if (pending.type === "stroke") {
    if (pending.tool === "line") {
      pending.points = [gesture.start, p];
    } else
      for (const e of event.getCoalescedEvents?.().length
        ? event.getCoalescedEvents()
        : [event]) {
        const next = point(e),
          last = pending.points.at(-1),
          s = Number($("smoothing").value);
        next.x = last.x * s + next.x * (1 - s);
        next.y = last.y * s + next.y * (1 - s);
        if (
          Math.hypot(next.x - last.x, next.y - last.y) > 0.15 &&
          pending.points.length < 50000
        )
          pending.points.push(next);
      }
  } else {
    pending.x = Math.min(gesture.start.x, p.x);
    pending.y = Math.min(gesture.start.y, p.y);
    pending.width = Math.max(0.1, Math.abs(p.x - gesture.start.x));
    pending.height = Math.max(0.1, Math.abs(p.y - gesture.start.y));
  }
  schedule();
});
function finishPointer(event, cancel = false) {
  pointers.delete(event.pointerId);
  if (!gesture || gesture.kind === "pinch") {
    if (pointers.size < 2) gesture = null;
    return;
  }
  if (gesture.id !== event.pointerId) return;
  const kind = gesture.kind;
  if (cancel) {
    if (["move", "resize"].includes(kind))
      gesture.item.transform = gesture.transform;
    pending = null;
    schedule();
  } else if (kind === "draw" && pending) {
    activeLayer().items.push(pending);
    pending = null;
    commit();
  } else if (["move", "resize"].includes(kind)) commit();
  gesture = null;
  canvas.style.cursor =
    tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";
}
canvas.addEventListener("pointerup", (e) => finishPointer(e));
canvas.addEventListener("pointercancel", (e) => finishPointer(e, true));
canvas.addEventListener("lostpointercapture", (e) => {
  if (gesture?.id === e.pointerId) finishPointer(e, true);
});
for (const [id, key] of [
  ["select-x", "x"],
  ["select-y", "y"],
  ["select-width", "sx"],
  ["select-height", "sy"],
  ["select-angle", "angle"],
])
  $(id).addEventListener("change", () => {
    const i = selected();
    if (!i || owner(i).locked) return;
    const v = Number($(id).value),
      b = localBounds(i),
      c = center(i);
    if (!Number.isFinite(v)) {
      sync();
      return;
    }
    update(
      () =>
        (i.transform[key] =
          key === "x"
            ? v - c.x
            : key === "y"
              ? v - c.y
              : key === "sx"
                ? v / b.width
                : key === "sy"
                  ? v / b.height
                  : v),
    );
  });
function deleteObject() {
  const i = selected();
  if (!i || owner(i).locked) return;
  update(() => {
    const l = owner(i);
    l.items = l.items.filter((item) => item.id !== i.id);
    selectedId = null;
  });
}
$("delete-object").addEventListener("click", deleteObject);
$("duplicate").addEventListener("click", () => {
  const i = selected();
  if (!i || owner(i).locked) return;
  const copy = structuredClone(i);
  copy.id = uid();
  copy.transform.x += 20;
  copy.transform.y += 20;
  update(() => {
    owner(i).items.push(copy);
    selectedId = copy.id;
  });
});
$("add-layer").addEventListener("click", () => {
  if (doc.layers.length >= LIMITS.layers) {
    notice("레이어는 최대 16개입니다.");
    return;
  }
  update(() => {
    const l = {
      id: uid(),
      name: `레이어 ${doc.layers.length + 1}`,
      visible: true,
      locked: false,
      opacity: 1,
      blend: "normal",
      items: [],
    };
    doc.layers.push(l);
    layerId = l.id;
    selectedId = null;
  });
});
$("layer-name").addEventListener("change", () =>
  update(() => (activeLayer().name = $("layer-name").value)),
);
$("layer-opacity").addEventListener("input", () => {
  activeLayer().opacity = Number($("layer-opacity").value);
  $("layer-opacity-value").value =
    Math.round(activeLayer().opacity * 100) + "%";
  schedule();
});
$("layer-opacity").addEventListener("change", commit);
$("blend").addEventListener("change", () =>
  update(() => (activeLayer().blend = $("blend").value)),
);
$("layer-lock").addEventListener("click", () =>
  update(() => (activeLayer().locked = !activeLayer().locked)),
);
for (const [id, step] of [
  ["layer-up", 1],
  ["layer-down", -1],
])
  $(id).addEventListener("click", () => {
    const n = doc.layers.findIndex((l) => l.id === layerId);
    if (n + step < 0 || n + step >= doc.layers.length) return;
    update(
      () =>
        ([doc.layers[n], doc.layers[n + step]] = [
          doc.layers[n + step],
          doc.layers[n],
        ]),
    );
  });
$("delete-layer").addEventListener("click", () => {
  if (doc.layers.length === 1) {
    notice("최소 1개의 레이어가 필요합니다.");
    return;
  }
  if (
    !confirm(
      `‘${activeLayer().name}’ 레이어를 삭제할까요? 실행 취소로 되돌릴 수 있습니다.`,
    )
  )
    return;
  update(() => {
    doc.layers = doc.layers.filter((l) => l.id !== layerId);
    layerId = doc.layers.at(-1).id;
    selectedId = null;
  });
});
function undo() {
  pending = null;
  gesture = null;
  const next = history.undo();
  if (next) {
    doc = next;
    selectedId = null;
    dirty = true;
    saveLocal();
    sync();
    schedule();
  }
}
function redo() {
  const next = history.redo();
  if (next) {
    doc = next;
    selectedId = null;
    dirty = true;
    saveLocal();
    sync();
    schedule();
  }
}
$("undo").addEventListener("click", undo);
$("redo").addEventListener("click", redo);
$("title").addEventListener("change", () =>
  update(() => (doc.title = $("title").value)),
);
document.addEventListener("keydown", (event) => {
  if (
    /INPUT|SELECT|TEXTAREA/.test(event.target.tagName) ||
    $("export-dialog").open ||
    $("canvas-dialog").open
  )
    return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
    event.preventDefault();
    event.shiftKey ? redo() : undo();
    return;
  }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
    event.preventDefault();
    saveProject();
    return;
  }
  if (event.key === " ") {
    event.preventDefault();
    space = true;
    canvas.style.cursor = "grab";
    return;
  }
  if (["Delete", "Backspace"].includes(event.key)) {
    event.preventDefault();
    deleteObject();
    return;
  }
  const map = {
    v: "select",
    b: "ink",
    p: "pencil",
    m: "marker",
    e: "eraser",
    l: "line",
    r: "rect",
    o: "ellipse",
    t: "text",
    h: "hand",
  };
  if (!event.ctrlKey && !event.metaKey && map[event.key.toLowerCase()])
    setTool(map[event.key.toLowerCase()]);
  if (event.key === "Escape") {
    pending = null;
    gesture = null;
    selectedId = null;
    sync();
    schedule();
  }
  if (
    tool === "select" &&
    selected() &&
    ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)
  ) {
    event.preventDefault();
    const i = selected();
    if (owner(i).locked) return;
    update(() => {
      const step = event.shiftKey ? 10 : 0.1;
      i.transform.x +=
        event.key === "ArrowRight"
          ? step
          : event.key === "ArrowLeft"
            ? -step
            : 0;
      i.transform.y +=
        event.key === "ArrowDown" ? step : event.key === "ArrowUp" ? -step : 0;
    });
  }
});
document.addEventListener("keyup", (e) => {
  if (e.key === " ") {
    space = false;
    canvas.style.cursor =
      tool === "hand" ? "grab" : tool === "select" ? "default" : "crosshair";
  }
});
window.addEventListener("blur", () => {
  space = false;
  if (gesture?.item) {
    gesture.item.transform = gesture.transform;
  }
  gesture = null;
  pending = null;
  pointers.clear();
  schedule();
});
$("pattern-toggle").addEventListener("click", () => {
  $("pattern-settings").hidden = !$("pattern-settings").hidden;
});
$("random-pattern").addEventListener("click", () => {
  $("pattern-seed").value = crypto.getRandomValues(new Uint32Array(1))[0];
});
$("generate-pattern").addEventListener("click", () => {
  try {
    if (doc.layers.length >= LIMITS.layers) throw new RangeError("Layer limit");
    const layer = makePattern({
      seed: Number($("pattern-seed").value),
      width: doc.width,
      height: doc.height,
      count: Number($("pattern-count").value),
      steps: Number($("pattern-steps").value),
      strength: Number($("pattern-strength").value),
      mode: $("pattern-mode").value,
      palette: $("pattern-palette").value,
    });
    update(() => {
      doc.layers.push(layer);
      layerId = layer.id;
      selectedId = null;
    });
  } catch {
    notice("패턴 설정을 확인하세요. 레이어 한도는 16개입니다.");
  }
});
function filename(ext) {
  return (
    (doc.title || "drawing")
      .replace(/[<>:"/\\|?*\x00-\x1f]/g, "-")
      .slice(0, 90) +
    "." +
    ext
  );
}
function download(blob, name) {
  const url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}
function saveProject() {
  download(
    new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" }),
    filename("draw.json"),
  );
  notice("작업 파일 다운로드를 요청했습니다.");
}
$("save-file").addEventListener("click", saveProject);
$("export-json").addEventListener("click", saveProject);
$("open-file").addEventListener("change", async (event) => {
  const file = event.target.files[0];
  event.target.value = "";
  if (!file) return;
  if (file.size > LIMITS.file) {
    notice("작업 파일은 최대 40MB입니다.");
    return;
  }
  try {
    const next = parseDocument(await file.text());
    if (!next) {
      notice("지원하지 않거나 손상된 작업 파일입니다. 현재 문서는 유지됩니다.");
      return;
    }
    if (
      !confirm(
        "현재 작업을 불러온 문서로 교체할까요? 필요한 작업은 먼저 파일로 저장하세요.",
      )
    )
      return;
    doc = next;
    history = new History(doc);
    layerId = doc.layers.at(-1).id;
    selectedId = null;
    storageBlocked = false;
    dirty = true;
    saveLocal();
    sync();
    fit();
    notice("작업 파일을 불러왔습니다.");
  } catch {
    notice("작업 파일을 읽지 못했습니다.");
  }
});
document
  .querySelectorAll("[data-close]")
  .forEach((b) =>
    b.addEventListener("click", () => $(b.dataset.close).close()),
  );
function canvasDialog(isNew) {
  newMode = isNew;
  $("canvas-dialog-title").textContent = isNew ? "새 문서" : "캔버스 설정";
  $("doc-width").value = doc.width;
  $("doc-height").value = doc.height;
  $("background").value =
    doc.background === "transparent" ? "#fffdf7" : doc.background;
  $("background-transparent").checked = doc.background === "transparent";
  $("canvas-status").textContent = "";
  $("canvas-dialog").showModal();
}
$("new-file").addEventListener("click", () => canvasDialog(true));
$("open-canvas").addEventListener("click", () => canvasDialog(false));
$("apply-canvas").addEventListener("click", () => {
  const width = Number($("doc-width").value),
    height = Number($("doc-height").value);
  if (!dimensions(width, height)) {
    $("canvas-status").textContent =
      "256–8192px의 정수, 최대 32메가픽셀로 설정하세요.";
    return;
  }
  if (newMode) {
    if (
      !confirm(
        "현재 문서를 새 문서로 교체할까요? 필요한 작업은 먼저 파일로 저장하세요.",
      )
    )
      return;
    doc = blankDocument(width, height);
    history = new History(doc);
    layerId = doc.layers[0].id;
    selectedId = null;
    storageBlocked = false;
  }
  doc.width = width;
  doc.height = height;
  doc.background = $("background-transparent").checked
    ? "transparent"
    : $("background").value;
  commit();
  fit();
  $("canvas-dialog").close();
});
function estimate() {
  try {
    const size = exportSize(doc, Number($("export-edge").value));
    $("export-estimate").textContent =
      `${size.width} × ${size.height} px · 작업 버퍼 약 ${Math.ceil((size.width * size.height * 8) / 1024 / 1024)}MB`;
    $("export-png").disabled = false;
  } catch {
    $("export-estimate").textContent =
      "32메가픽셀 한도를 넘습니다. 긴 변을 낮추거나 SVG로 저장하세요.";
    $("export-png").disabled = true;
  }
}
$("open-export").addEventListener("click", () => {
  estimate();
  $("export-status").textContent = "";
  $("export-dialog").showModal();
});
$("export-edge").addEventListener("change", estimate);
$("export-png").addEventListener("click", async () => {
  let output, buffer;
  const button = $("export-png");
  button.disabled = true;
  $("export-status").textContent = "PNG를 만드는 중…";
  try {
    const snapshot = structuredClone(doc),
      size = exportSize(snapshot, Number($("export-edge").value));
    if ($("transparent-export").checked) snapshot.background = "transparent";
    output = document.createElement("canvas");
    buffer = document.createElement("canvas");
    output.width = size.width;
    output.height = size.height;
    renderDocument(output, snapshot, { scale: size.scale, temp: buffer });
    const blob = await new Promise((resolve) =>
      output.toBlob(resolve, "image/png"),
    );
    if (!blob) throw new Error("Canvas allocation");
    download(blob, filename("png"));
    $("export-status").textContent =
      `${size.width} × ${size.height} PNG 다운로드 요청 완료`;
  } catch {
    $("export-status").textContent =
      "이 크기의 PNG를 만들지 못했습니다. 작은 크기나 SVG를 선택하세요. 현재 작업은 유지됩니다.";
  } finally {
    if (output) output.width = output.height = 1;
    if (buffer) buffer.width = buffer.height = 1;
    button.disabled = false;
  }
});
$("export-svg").addEventListener("click", () => {
  const snapshot = structuredClone(doc);
  if ($("transparent-export").checked) snapshot.background = "transparent";
  download(
    new Blob([toSVG(snapshot)], { type: "image/svg+xml" }),
    filename("svg"),
  );
  $("export-status").textContent =
    "SVG 다운로드 요청 완료 · 글꼴은 열람 기기의 기본 글꼴을 사용합니다.";
});
window.addEventListener("beforeunload", (event) => {
  if (dirty) {
    event.preventDefault();
    event.returnValue = "";
  }
});
window.addEventListener("storage", (event) => {
  if (event.key === KEY)
    notice("다른 탭에서 저장한 문서가 있습니다. 이 화면의 작업은 유지됩니다.");
});
$("save-state").textContent = storageBlocked
  ? "자동 저장 불가 · 파일 저장 필요"
  : "작업은 변경 후 이 브라우저에 저장됩니다.";
setTool("ink");
sync();
schedule();
