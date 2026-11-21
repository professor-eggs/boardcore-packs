// The rooms the tests play: the pack with a set of its On the Brink modules switched on as options, filled as
// Rooms fills them (the manifest's defaults, then the room's values). Handles are made once per room.
import type { Json } from "@boardcore/pack-sdk";
import { loadBoth, readDist, seatsOf, type Handles } from "@boardcore-packs/kit";

export const NAMES = ["green", "orange", "white", "pink", "brown"];
export const seats = (n: number) => seatsOf(NAMES, n);
export type ModName = "roles" | "events" | "virulentStrain" | "mutation" | "bioterrorist";
const CHALLENGES: ModName[] = ["virulentStrain", "mutation", "bioterrorist"];
export const dist = (name: string) => readDist(new URL(`../../${name}/dist/`, import.meta.url));
const cache = new Map<string, Promise<Handles>>();

/** A room: the modules switched on, and its other options. */
export interface Room { mods: ModName[]; options?: { [k: string]: Json } }
export const label = (r: Room, n: number) =>
  `${n} seats, ${r.mods.length ? r.mods.join(" + ") : "base"}${r.options && Object.keys(r.options).length ? ` ${JSON.stringify(r.options)}` : ""}`;

/**
 * The room's options. A room with a challenge plays 5 epidemics unless it says otherwise: the add-on packs
 * preset that, and an option can't (the form's default stays 4, the introductory game with open hands).
 */
export const optionsOf = (r: Room): { [k: string]: Json } =>
  ({ ...(r.mods.some((m) => CHALLENGES.includes(m)) ? { epidemics: 5 } : {}), ...Object.fromEntries(r.mods.map((m) => [m, true])), ...(r.options ?? {}) });

export function room(r: Room): Promise<Handles> {
  const key = JSON.stringify(r);
  let h = cache.get(key);
  if (!h) {
    h = loadBoth(dist("pandemic"), [], optionsOf(r));
    cache.set(key, h);
  }
  return h;
}
