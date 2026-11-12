// What a Pandemic add-on may bring besides hook handlers: actions, events, phases and interrupts.
import type { Handlers } from "./hooks";
import type { ActionDef, Ctx, EventDef, InterruptDef, PhaseDef } from "./engine";

export interface PandemicAddOn {
  id: string;
  requires?: string[];
  /** Hook handlers; a function when they need the game's context (to place cubes, say). */
  handlers: Handlers | ((ctx: Ctx) => Handlers);
  actions?: ActionDef[];
  events?: EventDef[];
  phases?: { [id: string]: PhaseDef };
  interrupts?: { [kind: string]: InterruptDef };
}
