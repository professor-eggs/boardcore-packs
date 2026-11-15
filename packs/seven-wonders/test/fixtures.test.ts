// A87 (s11-attack.md): an old game, recorded by 7 Wonders 0.1.0 with Leaders and Cities switched on as options
// inside one bundle, still replays on the old version; the new base (1.0.0) is a different pack, so the game is
// "pack missing" once the old version is gone. Its header is a base-only game (no add-ons) and stays one.
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { verifyReplay } from "@boardcore/testkit";
import { kit } from "@boardcore-packs/kit";
import { room } from "./rooms";

const read = (f: string) => JSON.parse(readFileSync(new URL(`fixtures/${f}`, import.meta.url), "utf8"));

describe("A87: games recorded before the port", () => {
  it("replay on 0.1.0 and not on 1.0.0", async () => {
    const bgn = read("v0.1.0-game.bgn") as Parameters<typeof verifyReplay>[0];
    const old = read("v0.1.0.json") as { manifest: unknown; bundle: string };
    expect(bgn.addons).toEqual([]);
    expect(bgn.options).toMatchObject({ leaders: true, cities: true });
    const v = await kit.verify(old.manifest, old.bundle);
    const h = await kit.load(v, "trusted");
    expect(verifyReplay(bgn, h).ok).toBe(true);
    const now = (await room({ addons: [] })).trusted;
    const r = verifyReplay(bgn, now);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.atPly).toBe(0);
  });
});
