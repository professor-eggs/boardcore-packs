// Runs a built private pack (dist/manifest.json + dist/bundle.mjs) through Boardcore's test kit in both
// adapters: random games with equal hashes every ply, BGN replays, interleaved rooms against solo rooms,
// the two-worlds leak check (D52) and D82's check that a resampled world gives the seat the same view.
// Test code: runs in Node only, never inside a pack.
import { readFileSync } from "node:fs";
import type { Action, Json, SeatId, SeatInfo } from "@boardcore/pack-sdk";
import type { PackHandle } from "@boardcore/core/rules-runtime";
import { canonical, Pcg32 } from "@boardcore/pack-sdk/kernel";
import { defaultLoader } from "@boardcore/runtime-quickjs/default-loader";
import { interleaved, legalActions, makeKit, playRandom, soloGame, validate, verifyReplay, type PlayOptions } from "@boardcore/testkit";

export type { PlayOptions };

export const kit = makeKit({ quickjs: defaultLoader });

/** Reads a built pack from its dist folder (a file URL ending in "/"). */
export function readDist(dir: URL): { manifest: unknown; bundle: string } {
  return {
    manifest: JSON.parse(readFileSync(new URL("manifest.json", dir), "utf8")),
    bundle: readFileSync(new URL("bundle.mjs", dir), "utf8"),
  };
}

export interface Handles { trusted: PackHandle; sandboxed: PackHandle; load(trust: "trusted" | "sandboxed"): Promise<PackHandle> }

export async function loadBoth(dist: { manifest: unknown; bundle: string }): Promise<Handles> {
  const pack = await kit.verify(dist.manifest, dist.bundle);
  return { trusted: await kit.load(pack, "trusted"), sandboxed: await kit.load(pack, "sandboxed"), load: (t) => kit.load(pack, t) };
}

export const seatsOf = (names: readonly string[], n: number): SeatInfo[] => names.slice(0, n).map((seat) => ({ seat, team: null }));

const same = (a: unknown, b: unknown) => canonical(a as Json) === canonical(b as Json);

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

/** Interleaved rooms against the same games played alone (§5, A45), in one adapter. */
export async function interleave(h: Handles, trust: "trusted" | "sandboxed", rooms: number, o: PlayOptions): Promise<{ room: number; ply: number } | null> {
  const hs: PackHandle[] = [];
  for (let i = 0; i < rooms; i++) hs.push(trust === "trusted" ? h.trusted : await h.load("sandboxed"));
  try {
    const base = trust === "trusted" ? h.trusted : h.sandboxed;
    return interleaved(hs, (i) => soloGame(base, i, o), o);
  } finally {
    if (trust === "sandboxed") for (const x of hs) x.dispose();
  }
}

// ---- Two worlds (D52) and resampled views (D82) -------------------------------------------------------------

export interface Finding { ply: number; kind: string; seat: SeatId; observer: SeatId; action: Action | null; detail: string }

export interface LeakReport {
  states: number;
  /** Actions that drew nothing and revealed nothing, each checked against every observer's resampled world. */
  quietActions: number;
  worlds: number;
  findings: Finding[];
  /** Findings by kind, for the report. */
  kinds: { [kind: string]: number };
  ended: boolean;
}

const counting = (seed: number) => {
  const g = Pcg32.seeded(BigInt(seed), 5n);
  let n = 0;
  return { rng: { int: (k: number) => { n++; return g.int(k); } }, drew: () => n };
};

/**
 * Plays one random game on the raw handle and, every `every` plies, checks:
 * - D82: for each seat, `view(resampleHidden(s, seat), seat)` equals `view(s, seat)`, and so do its prompt
 *   and the public actors;
 * - D52: each sampled action that draws nothing and isn't flagged `reveal` gives every observer the same
 *   view, `describe` text and actors in the real world and in that observer's resampled world.
 */
export function leakCheck(h: PackHandle, o: {
  options: { [k: string]: Json }; seats: SeatInfo[]; seed: number; every?: number; perActor?: number; maxPlies?: number;
  /** Findings kept per kind (all are counted). */
  maxFindings?: number;
  /** A known gap: who may act is public (waitingFor), so compare views without this key and count actor
   *  differences under their own kind instead of failing every other comparison with them. */
  actorsKey?: string;
}): LeakReport {
  const seats = o.seats.map((x) => x.seat);
  const play = Pcg32.seeded(BigInt(o.seed), 11n);
  const game = Pcg32.seeded(BigInt(o.seed), 13n);
  let s = h.setup({ options: o.options, seats: o.seats, rng: game });
  const rep: LeakReport = { states: 0, quietActions: 0, worlds: 0, findings: [], kinds: {}, ended: false };
  const add = (f: Finding) => {
    rep.kinds[f.kind] = (rep.kinds[f.kind] ?? 0) + 1;
    if (rep.kinds[f.kind]! <= (o.maxFindings ?? 3)) rep.findings.push(f);
  };
  let seed = o.seed * 1000;
  const strip = (v: Json): Json => (o.actorsKey && v && typeof v === "object" && !Array.isArray(v) ? Object.fromEntries(Object.entries(v).filter(([k]) => k !== o.actorsKey)) : v);
  const view = (s: Json, x: SeatId) => strip(h.view(s, x));
  for (let ply = 0; ply < (o.maxPlies ?? 3000); ply++) {
    const st = h.status(s);
    if (st.outcome) { rep.ended = true; break; }
    if (!st.actors.length) break;
    if (ply % (o.every ?? 1) === 0) {
      rep.states++;
      const worlds = new Map<SeatId, Json>();
      for (const x of seats) {
        const w = h.resampleHidden(s, x, counting(++seed).rng);
        rep.worlds++;
        worlds.set(x, w);
        if (!same(view(w, x), view(s, x))) add({ ply, kind: "D82 view differs in a resampled world", seat: x, observer: x, action: null, detail: diff(view(s, x), view(w, x)) });
        if (!same(h.choices(w, x, []), h.choices(s, x, []))) add({ ply, kind: "prompt depends on hidden information", seat: x, observer: x, action: null, detail: diff(h.choices(s, x, []), h.choices(w, x, [])) });
        if (!same(h.status(w).actors, st.actors)) add({ ply, kind: "actors depend on hidden information", seat: x, observer: x, action: null, detail: `${canonical(st.actors)} vs ${canonical(h.status(w).actors)}` });
      }
      for (const a of st.actors) {
        const acts = legalActions(h, s, a);
        const picks = sample(acts, o.perActor ?? 4, play);
        for (const x of picks) {
          const c = counting(++seed);
          const r = h.apply(s, a, x, c.rng);
          if (c.drew() || r.reveal) continue;
          rep.quietActions++;
          for (const obs of seats) {
            const w = worlds.get(obs)!;
            if (validate(h, w, a, x) !== null) {
              if (obs === a) add({ ply, kind: "own action illegal in own resampled world", seat: a, observer: obs, action: x, detail: validate(h, w, a, x)! });
              continue;
            }
            const cw = counting(seed);
            let rw;
            try { rw = h.apply(w, a, x, cw.rng); } catch (e) { add({ ply, kind: "apply faults in a resampled world", seat: a, observer: obs, action: x, detail: String((e as { reason?: string }).reason ?? e) }); continue; }
            if (cw.drew() || rw.reveal) { add({ ply, kind: "commit point depends on hidden information", seat: a, observer: obs, action: x, detail: cw.drew() ? "draws in the other world" : "reveals in the other world" }); continue; }
            const v1 = view(r.state, obs), v2 = view(rw.state, obs);
            if (!same(v1, v2)) add({ ply, kind: "view after a quiet action depends on hidden information", seat: a, observer: obs, action: x, detail: diff(v1, v2) });
            const d1 = h.describe(r.state, a, x, obs), d2 = h.describe(rw.state, a, x, obs);
            if (d1 !== d2) add({ ply, kind: "describe depends on hidden information", seat: a, observer: obs, action: x, detail: `${d1} | ${d2}` });
            if (!same(h.status(r.state).actors, h.status(rw.state).actors)) add({ ply, kind: "actors after a quiet action depend on hidden information", seat: a, observer: obs, action: x, detail: "" });
          }
        }
      }
    }
    const a = st.actors[play.int(st.actors.length)]!;
    const acts = legalActions(h, s, a);
    if (!acts.length) break;
    s = h.apply(s, a, acts[play.int(acts.length)]!, game).state;
  }
  return rep;
}

function sample<T>(xs: T[], k: number, g: { int(n: number): number }): T[] {
  if (xs.length <= k) return xs;
  const out: T[] = [];
  const pool = xs.slice();
  for (let i = 0; i < k; i++) out.push(pool.splice(g.int(pool.length), 1)[0]!);
  return out;
}

/** The first path where two JSON values differ, for a readable finding. */
export function diff(a: unknown, b: unknown, path = "$"): string {
  if (same(a, b)) return "";
  if (a && b && typeof a === "object" && typeof b === "object" && Array.isArray(a) === Array.isArray(b)) {
    const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])];
    for (const k of keys) {
      const d = diff((a as { [k: string]: unknown })[k], (b as { [k: string]: unknown })[k], `${path}.${k}`);
      if (d) return d;
    }
  }
  const show = (v: unknown) => (v === undefined ? "undefined" : canonical(v as Json).slice(0, 120));
  return `${path}: ${show(a)} vs ${show(b)}`;
}

/** One line for the report: plies, seconds per game and milliseconds per ply in each adapter, costliest call. */
export const runLine = (label: string, r: GameRun) =>
  `${label}: ${r.plies} plies; trusted ${(r.ms.trusted / 1000).toFixed(2)} s (${(r.ms.trusted / r.plies).toFixed(1)} ms/ply), ` +
  `sandboxed ${(r.ms.sandboxed / 1000).toFixed(2)} s (${(r.ms.sandboxed / r.plies).toFixed(1)} ms/ply); costliest call ${r.maxCost} checks`;
