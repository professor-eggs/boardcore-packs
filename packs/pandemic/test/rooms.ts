// The rooms the tests play: the base alone or with its add-ons, built and composed as Rooms composes them
// (base defaults, add-on presets in the room's order, then the creator's values). Handles are made once per room.
import type { Json } from "@boardcore/pack-sdk";
import { loadBoth, readDist, seatsOf, type Handles } from "@boardcore-packs/kit";

export const NAMES = ["red", "blue", "green", "yellow", "purple"];
export const seats = (n: number) => seatsOf(NAMES, n);
export type AddonName = "roles" | "events" | "virulent-strain" | "mutation" | "bioterrorist";
/** The room order Rooms keeps: the `after` lists put the challenges after the roles, events and Virulent Strain. */
export const ORDER: AddonName[] = ["roles", "events", "virulent-strain", "mutation", "bioterrorist"];
export const dist = (name: string) => readDist(new URL(`../../${name}/dist/`, import.meta.url));
const cache = new Map<string, Promise<Handles>>();

/** A room: its add-ons, base options and add-on options by add-on name. */
export interface Room { addons: AddonName[]; options?: { [k: string]: Json }; addonOptions?: { [name: string]: { [k: string]: Json } } }
export const label = (r: Room, n: number) =>
  `${n} seats, ${r.addons.length ? r.addons.join(" + ") : "base"}${r.options && Object.keys(r.options).length ? ` ${JSON.stringify(r.options)}` : ""}${r.addonOptions ? ` ${JSON.stringify(r.addonOptions)}` : ""}`;

export function room(r: Room): Promise<Handles> {
  const key = JSON.stringify(r);
  let h = cache.get(key);
  if (!h) {
    const addons = ORDER.filter((a) => r.addons.includes(a));
    const given = Object.fromEntries(Object.entries(r.addonOptions ?? {}).map(([k, v]) => [`boardcore/pandemic-${k}`, v]));
    h = loadBoth(dist("pandemic"), addons.map((a) => dist(`pandemic-${a}`)), r.options ?? {}, given);
    cache.set(key, h);
  }
  return h;
}
