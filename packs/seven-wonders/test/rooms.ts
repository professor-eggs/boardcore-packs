// The games the tests play: the built pack with a mix of its options, filled as Rooms fills them (the manifest's
// defaults, then the creator's values). Handles are made once per mix.
import type { Json } from "@boardcore/pack-sdk";
import { loadBoth, readDist, seatsOf, type Handles } from "@boardcore-packs/kit";

export const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
export const seats = (n: number) => seatsOf(NAMES, n);
export const EXPANSIONS = ["leaders", "cities", "wonderPack"] as const;
export type ExpansionName = (typeof EXPANSIONS)[number];
const cache = new Map<string, Promise<Handles>>();

/** A room's options: the expansions switched on (and the promo leaders), and the base options. */
export type Room = { [option: string]: Json };
export const label = (r: Room, n: number) => {
  const on = EXPANSIONS.filter((x) => r[x] === true);
  const rest = Object.keys(r).filter((k) => !(EXPANSIONS as readonly string[]).includes(k) && r[k] !== false);
  return `${n} seats, ${on.length ? on.join(" + ") : "base"}${rest.length ? ` (${rest.join(", ")})` : ""}`;
};

/** Every mix of the three expansions: none, each alone, each pair, all three. */
export const MIXES: Room[] = [0, 1, 2, 3, 4, 5, 6, 7].map((bits) => Object.fromEntries(EXPANSIONS.filter((_, i) => bits & (1 << i)).map((x) => [x, true])));

export function room(r: Room = {}): Promise<Handles> {
  const key = JSON.stringify(Object.keys(r).sort().map((k) => [k, r[k]]));
  let h = cache.get(key);
  if (!h) {
    h = loadBoth(readDist(new URL("../dist/", import.meta.url)), [], r);
    cache.set(key, h);
  }
  return h;
}
