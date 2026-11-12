// Writes the locally built private packs (seven-wonders, pandemic) as pack files into a folder, for a
// local server's PACKS_DIR. They aren't server samples: the image carries only the public samples.
// Usage: node tools/local-packs.mjs [out-dir]   (default ./local-packs; run `pnpm build` first)
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const out = process.argv[2] ?? "local-packs";
mkdirSync(out, { recursive: true });
for (const name of ["seven-wonders", "pandemic"]) {
  const manifest = JSON.parse(readFileSync(join(root, `packs/${name}/dist/manifest.json`), "utf8"));
  const bundle = readFileSync(join(root, `packs/${name}/dist/bundle.mjs`), "utf8");
  writeFileSync(join(out, `${name}.json`), JSON.stringify({ manifest, bundle }));
  console.log(`${join(out, `${name}.json`)} (${manifest.id} ${manifest.hash})`);
}
