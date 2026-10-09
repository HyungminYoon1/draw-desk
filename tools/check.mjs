import { readdir, readFile } from "node:fs/promises";
import { resolve, dirname, sep } from "node:path";
import { execFileSync } from "node:child_process";
import assert from "node:assert/strict";
const root = resolve(import.meta.dirname, "../dist");
let count = 0;
async function walk(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const path = resolve(dir, e.name);
    if (e.isDirectory()) {
      await walk(path);
      continue;
    }
    count++;
    if (e.name.endsWith(".js"))
      execFileSync(process.execPath, ["--check", path], { stdio: "inherit" });
    if (!/\.(js|css|html|svg)$/.test(e.name)) continue;
    const bytes = await readFile(path);
    assert(
      !(bytes[0] === 239 && bytes[1] === 187 && bytes[2] === 191),
      "UTF-8 BOM",
    );
    if (!e.name.endsWith(".html")) continue;
    const html = bytes.toString("utf8");
    assert(
      html.includes('lang="ko"') &&
        html.includes("connect-src 'none'") &&
        html.includes("frame-src 'none'"),
    );
    assert(!/\son\w+=|<iframe\b/i.test(html));
    const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
    assert.equal(ids.length, new Set(ids).size);
    for (const [, ref] of html.matchAll(/(?:src|href)="([^"#]+)"/g)) {
      if (/^(https?:|data:)/.test(ref)) continue;
      const target = resolve(
        dirname(path),
        ref.endsWith("/") ? ref + "index.html" : ref,
      );
      assert(target.startsWith(root + sep));
      await readFile(target);
    }
  }
}
await walk(root);
const app = await readFile(resolve(root, "src/app.js"), "utf8");
assert(
  !/\bfetch\s*\(|document\.cookie|sessionStorage|web-lab-progress-v1/.test(app),
);
console.log(
  `PASS ${count} static files, syntax/assets/CSP, duplicate IDs and local-only project boundary.`,
);
