# DRAW DESK architecture

Independent static drawing workshop. Native ES modules/Canvas/SVG; no backend, account, cloud upload, runtime API, tracking, external fonts, third-party image imports or shared-summary writes. Public output is dist. Every deliberate file import stays in memory/on this device.

## Layers

- model.js: versioned floating-point document, strict bounded parser, dimensions, object bounds/transforms and bounded undo history. No DOM/storage.
- render.js: preview/export Canvas renderer and XML-escaped SVG generation. Document coordinates are independent from CSS pixel size; exports rerender the original model, not the viewport screenshot. Pressure affects brush widths. Erasing affects only its own layer and earlier marks. Layer opacity/blend/visibility honored.
- app.js: pointer/keyboard/numeric controls, selection/property edits, viewport fit/zoom/pan, native dialogs, downloads and separate own-key storage adapter. Text through textContent; no imported HTML/SVG/images executed.
- index.html/styles.css: responsive product workspace with tools/properties/layers, keyboard focus, local project/save/export controls.
- tools/test/docs: loopback preview, syntax/assets/model/export validation and decision/evidence log. Pinned test-gated Pages deploy dist only.

## Precision and bounds

Floating-point coordinates, 0.1px brush size and numeric transforms. Document edges 256–8192px, <=32 million output pixels, max16 layers/5000 items/300000 sampled points/64 eraser strokes per layer. JSON <=40MB, text <=2000 characters, restricted color/font/blend strings. Every input is finite and bounded. Preview resolution is device-pixel-aware, not document quality. PNG export refuses over-budget allocations rather than silently lowering resolution; SVG remains vector where shapes/strokes/text allow. No raster resampling is claimed as new detail.

Undo retains <=60 snapshots within a 48MB byte budget. Device-local autosave draw-desk-project-v1 is limited to 4MB; bigger documents remain usable but require explicit file saving. Invalid stored data is preserved and autosave blocked until explicit replacement/new document. Before unload warn only if unsaved changes have no confirmed local/file save. No automatic migration, remote synchronization or cross-app progress modification.

The former SENSE LAB particle studio becomes a seeded editable vector pattern generator here. Its result is an actual document layer, not a continuously changing screenshot. No audio or clinical result is involved.

UTF-8 without BOM / CRLF. Native editable JSON plus final PNG/SVG are distinct deliverables. Tests do not substitute for real pen hardware/color management or Photoshop compatibility.
