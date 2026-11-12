// The add-on kernel (D41, SP1 findings F1-F4): add-ons reach the base only through the extension
// points declared here, never by editing base code. Handlers are code in a static table; the state
// holds only the ids of the add-ons switched on, so state stays plain JSON.
import type { Json } from "@boardcore/pack-sdk";

export type Combine = "chain" | "collect" | "first";

/** A handler table keyed by point name. Each handler's signature is fixed by the point (see POINTS in engine.ts). */
// biome-ignore lint: handler signatures vary per point
export type Handlers = { [point: string]: (...args: any[]) => any };

export interface AddOn {
  id: string;
  /** Other add-ons this one needs switched on. */
  requires?: string[];
  handlers: Handlers;
}

export interface Hooks {
  /** chain: each handler gets the value so far and returns the next, in add-on order. */
  chain<T>(point: string, value: T, ...args: unknown[]): T;
  /** collect: every handler's result, flattened, in add-on order. */
  collect<T>(point: string, ...args: unknown[]): T[];
  /** first: the first non-null result, or the fallback. */
  first<T>(point: string, fallback: T, ...args: unknown[]): T;
}

export function makeHooks(table: { [id: string]: AddOn }, active: readonly string[], declared: { [point: string]: Combine }): Hooks {
  const list = active.map((id) => {
    const a = table[id];
    if (!a) throw new Error(`unknown add-on ${id}`);
    return a;
  });
  const handlers = (point: string, want: Combine) => {
    if (declared[point] !== want) throw new Error(`extension point ${point} is not a ${want} point`);
    return list.flatMap((a) => (a.handlers[point] ? [a.handlers[point]!] : []));
  };
  return {
    chain: (point, value, ...args) => handlers(point, "chain").reduce((v, h) => h(v, ...args), value),
    collect: (point, ...args) => handlers(point, "collect").flatMap((h) => {
      const r = h(...args);
      return r === null || r === undefined ? [] : Array.isArray(r) ? r : [r];
    }),
    first: (point, fallback, ...args) => {
      for (const h of handlers(point, "first")) {
        const r = h(...args);
        if (r !== null && r !== undefined) return r;
      }
      return fallback;
    },
  };
}

/** Checks the add-on list: every id known, every requirement on. Returns a reason or null. */
export function checkAddOns(table: { [id: string]: AddOn }, active: readonly string[]): string | null {
  for (const id of active) {
    const a = table[id];
    if (!a) return `unknown add-on ${id}`;
    for (const r of a.requires ?? []) if (!active.includes(r)) return `${id} needs ${r} switched on`;
  }
  return null;
}

export type JsonObj = { [k: string]: Json };
