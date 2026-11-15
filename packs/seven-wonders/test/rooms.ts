// The rooms the tests play: the base alone or with its add-ons, built and composed as Rooms composes them
// (base defaults, add-on presets in the room's order, then the creator's values). Handles are made once per room.
import type { Json } from "@boardcore/pack-sdk";
import { loadBoth, readDist, seatsOf, type Handles } from "@boardcore-packs/kit";

export const NAMES = ["red", "blue", "green", "yellow", "purple", "orange", "teal", "pink"];
export const seats = (n: number) => seatsOf(NAMES, n);
export type AddonName = "leaders" | "cities" | "wonder-pack";
const dist = (name: string) => readDist(new URL(`../../${name}/dist/`, import.meta.url));
const cache = new Map<string, Promise<Handles>>();

/** A room: its add-ons in the room's order (leaders, cities, wonder pack), base options and the Leaders promos. */
export interface Room { addons: AddonName[]; options?: { [k: string]: Json }; promos?: boolean }
export const label = (r: Room, n: number) => `${n} seats, ${r.addons.length ? r.addons.join(" + ") : "base"}${r.options && Object.keys(r.options).length ? ` ${JSON.stringify(r.options)}` : ""}${r.promos ? " (promos)" : ""}`;

export function room(r: Room): Promise<Handles> {
  const key = JSON.stringify(r);
  let h = cache.get(key);
  if (!h) {
    const order: AddonName[] = ["leaders", "cities", "wonder-pack"];
    const addons = order.filter((a) => r.addons.includes(a));
    h = loadBoth(dist("seven-wonders"), addons.map((a) => dist(`seven-wonders-${a}`)), r.options ?? {}, r.promos ? { "boardcore/seven-wonders-leaders": { promos: true } } : {});
    cache.set(key, h);
  }
  return h;
}
