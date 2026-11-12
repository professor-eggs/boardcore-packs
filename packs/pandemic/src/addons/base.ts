// The base game as the first add-on: it contributes the base roles, events, actions and interrupts
// through the same registries the expansions use.
import { BASE_ACTIONS, BASE_EVENTS, discardInterrupt, drawOrderInterrupt } from "../actions";
import { BASE_EVENTS as EVENT_NAMES, BASE_ROLES } from "../data";
import type { PandemicAddOn } from "../addon";

export const base: PandemicAddOn = {
  id: "base",
  actions: BASE_ACTIONS,
  events: BASE_EVENTS,
  interrupts: { discard: discardInterrupt, drawOrder: drawOrderInterrupt },
  handlers: {
    roles: () => [...BASE_ROLES],
    events: () => [...EVENT_NAMES],
  },
};
