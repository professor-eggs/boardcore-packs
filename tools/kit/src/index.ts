// Runs built private packs (dist/manifest.json + dist/bundle.mjs), a base alone or composed with its add-ons
// as Rooms composes them (12 §17: base defaults, add-on presets in order, then the creator's values), through
// Boardcore's test kit in both adapters: random games with equal hashes every ply, BGN replays, interleaved
// rooms against solo rooms. The two-worlds (D52), D82 and hidden-zone checks are the published kit's
// `leakCheck` (part 7b); this harness keeps only what the kit lacks: composed loading, timings, the costliest
// sandboxed call. Test code: runs in Node only, never inside a pack.
import { readFileSync } from "node:fs";
import type { Json, SeatInfo } from "@boardcore/pack-sdk";
import type { ComposeWith, PackHandle, VerifiedPack } from "@boardcore/core/rules-runtime";
import { optionsOf, resolveOptions } from "@boardcore/pack-library";
import { defaultLoader } from "@boardcore/runtime-quickjs/default-loader";
import { interleaved, makeKit, playRandom, soloGame, verifyReplay, type PlayOptions } from "@boardcore/testkit";

export type { PlayOptions };
export { leakCheck as kitLeakCheck, LEAK_KINDS, type LeakReport as KitLeakReport } from "@boardcore/testkit";

export const kit = makeKit({ quickjs: defaultLoader });

export interface Dist { manifest: unknown; bundle: string }

/** Reads a built pack from its dist folder (a file URL ending in "/"). */
export function readDist(dir: URL): Dist {
  return {
    manifest: JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")),
    bundle: readFileSync(new URL("bundle.mjs", dir), "utf8"),
  };
}

export interface Handles {
  trusted: PackHandle;
  sandboxed: PackHandle;
  load(trust: "trusted" | "sandboxed"): Promise<PackHandle>;
  /** The base's filled options (the header's `options`): what every game of these handles is started with. */
  options: { [k: string]: Json };
}

/** Filled options as Rooms fills them (12 §17): base defaults, add-on presets in the room's order, then the creator's. */
export function filled(base: VerifiedPack, addons: VerifiedPack[], given: { [k: string]: Json } = {}, addonGiven: { [id: string]: { [k: string]: Json } } = {}): ComposeWith {
  const presets: { [k: string]: Json } = {};
  for (const a of addons) Object.assign(presets, (a.manifest as { addon?: { presets?: { [k: string]: Json } } }).addon?.presets ?? {});
  const r = resolveOptions(optionsOf(base), { ...presets, ...given });
  if (!r.ok) throw new Error(r.reason);
  return {
    options: r.options,
    addons: addons.map((a) => {
      const o = resolveOptions(optionsOf(a), addonGiven[a.manifest.id] ?? {});
      if (!o.ok) throw new Error(o.reason);
      return { pack: a, options: o.options };
    }),
  };
}

/** One handle per adapter for a base and its add-ons, in the room's order. */
export async function loadBoth(base: Dist, addons: Dist[] = [], given: { [k: string]: Json } = {}, addonGiven: { [id: string]: { [k: string]: Json } } = {}): Promise<Handles> {
  const b = await kit.verify(base.manifest, base.bundle);
  const as: VerifiedPack[] = [];
  for (const a of addons) as.push(await kit.verify(a.manifest, a.bundle));
  const w = filled(b, as, given, addonGiven);
  const load = (t: "trusted" | "sandboxed") => kit.load(b, t, w);
  return { trusted: await load("trusted"), sandboxed: await load("sandboxed"), load, options: w.options };
}

export const seatsOf = (names: readonly string[], n: number): SeatInfo[] => names.slice(0, n).map((seat) => ({ seat, team: null }));

export interface GameRun {
  plies: number;
  /** Milliseconds for the whole game, per adapter. */
  ms: { trusted: number; sandboxed: number };
  firstDifference: number | null;
  outcome: unknown;
  suspended: { trusted: string | null; sandboxed: string | null };
  replay: { trusted: string | null; sandboxed: string | null };
  /** Costliest sandboxed call seen while replaying, in interrupt checks (budget 2,000). */
  maxCost: number;
}

/** One random game in both adapters through Match, hashes compared every ply, then its BGN replayed in both. */
export function playBoth(h: Handles, o: PlayOptions): GameRun {
  o = { ...o, options: o.options ?? h.options };
  let t0 = performance.now();
  const a = playRandom(h.trusted, o);
  const tMs = performance.now() - t0;
  t0 = performance.now();
  const b = playRandom(h.sandboxed, o);
  const sMs = performance.now() - t0;
  let firstDifference: number | null = null;
  const n = Math.max(a.hashes.length, b.hashes.length);
  for (let i = 0; i < n; i++) if (a.hashes[i] !== b.hashes[i]) { firstDifference = i; break; }
  const replay = (p: PackHandle, bgn: typeof a.bgn) => {
    if (!bgn.outcome) return "no outcome";
    const r = verifyReplay(bgn, p);
    return r.ok ? null : `ply ${r.atPly}: ${r.reason}`;
  };
  let maxCost = 0;
  const costly: PackHandle = new Proxy(h.sandboxed, {
    get(target, key) {
      const v = Reflect.get(target, key) as unknown;
      if (typeof v !== "function" || key === "lastCost" || key === "dispose") return v;
      return (...args: unknown[]) => {
        const r = (v as (...x: unknown[]) => unknown).apply(target, args);
        const c = target.lastCost();
        if (c !== null && c > maxCost) maxCost = c;
        return r;
      };
    },
  });
  return {
    plies: a.hashes.length - 1,
    ms: { trusted: tMs, sandboxed: sMs },
    firstDifference,
    outcome: a.match.data.outcome,
    suspended: { trusted: a.match.data.suspended?.reason ?? null, sandboxed: b.match.data.suspended?.reason ?? null },
    replay: { trusted: replay(h.trusted, a.bgn), sandboxed: replay(costly, a.bgn) },
    maxCost,
  };
}

/** Interleaved rooms against the same games played alone (§5), in one adapter. */
export async function interleave(h: Handles, trust: "trusted" | "sandboxed", rooms: number, o: PlayOptions): Promise<{ room: number; ply: number } | null> {
  o = { ...o, options: o.options ?? h.options };
  const hs: PackHandle[] = [];
  for (let i = 0; i < rooms; i++) hs.push(trust === "trusted" ? h.trusted : await h.load("sandboxed"));
  try {
    const base = trust === "trusted" ? h.trusted : h.sandboxed;
    return interleaved(hs, (i) => soloGame(base, i, o), o);
  } finally {
    if (trust === "sandboxed") for (const x of hs) x.dispose();
  }
}

/** One line for the report: plies, seconds per game and milliseconds per ply in each adapter, costliest call. */
export const runLine = (label: string, r: GameRun) =>
  `${label}: ${r.plies} plies; trusted ${(r.ms.trusted / 1000).toFixed(2)} s (${(r.ms.trusted / r.plies).toFixed(1)} ms/ply), ` +
  `sandboxed ${(r.ms.sandboxed / 1000).toFixed(2)} s (${(r.ms.sandboxed / r.plies).toFixed(1)} ms/ply); costliest call ${r.maxCost} checks`;
