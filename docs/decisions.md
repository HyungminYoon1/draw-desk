# Decisions

## D04 — Self-hosted licensed Korean UI typography

Context: default font availability differs across desktops and browser QA, degrading Korean tool legibility. Options: remote CDN, machine-specific fonts, or vendored open fonts. Decision: unmodified Pretendard Variable v1.3.9 WOFF2 served from the same origin, with the author's complete SIL OFL retained in assets/fonts/OFL.txt; no CDN requests. Rationale: stable modern UI without tracking or licensing guesswork. Affected: font asset/license, stylesheet/CSP, binary attributes and documentation. Review: original upstream asset and license, browser font loading; exported SVG text uses stated native font families rather than bundling UI font outlines.

## D01 — Float vector document and bounded rendering

Context: requested fine edits and large outputs; viewport-only paint snapshots lose detail and cannot be edited later. Options: screen-sized bitmap, heavyweight remote editor, or local float document plus native renderer. Decision: float strokes/shapes/text with separate preview and full-resolution export, per-layer compositing, pressure-based widths; PNG <=32MP/8192 edges and SVG masks for ordered local erasing. Rationale: real editable data and predictable local memory without a paid provider. Affected: model/render/app, document/export controls. Review: actual PNG dimensions, opacity/erasing order, SVG reparse and pressure hardware (not simulated as certified).

## D02 — Local project persistence with explicit file portability

Context: artwork can be large and should not be uploaded or silently dropped. Options: cloud accounts, unbounded localStorage or explicit files plus bounded local autosave. Decision: own 4MB local key, 40MB JSON import, no shared-summary mutation. Invalid records preserved; storage/readback failures reported; large works prompt explicit save. Undo bounded by bytes/count. Rationale: free/static architecture, user control and device resilience. Affected: app/model/history and instructions. Review: quota/blocked/oversized/corrupt data, reload, cancel, replacement confirmation and dirty-state handling.

## D03 — Move pattern creation into a real editable layer

Context: SENSE LAB pattern studio did not test sensory ability. Options: retain a toy, discard creation, or integrate generated art with drawing layers. Decision: deterministic seeded attract/repel trajectories or radial/harmonic patterns become vector strokes on a normal named layer. User sets point count/iterations/force/trail palette; can undo, modify opacity, combine with drawing and export high resolution. Rationale: coherent creative purpose and editable output. Affected: pattern model/UI/render. Review: finite bounds, varied seeds and exported strokes match the document.
