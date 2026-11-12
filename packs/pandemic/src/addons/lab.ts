// STUB: the Lab challenge. The brief listed "the lab challenge" under On the Brink, but On the Brink (2013)
// has no lab: the Lab is from "Pandemic: In the Lab" (a different expansion). It is not offered as an
// option. Where it would hook in: a "lab" phase via betweenTurns (sequencing samples), a cureCost change
// (cures need a sequenced disease), and actions on the registry. Turning it on fails at setup with this
// reason, so nothing pretends to run it.
import type { PandemicAddOn } from "../addon";

export const LAB_REASON = "The Lab challenge is from Pandemic: In the Lab, not On the Brink; it is not built (see the pack README)";

export const lab: PandemicAddOn = {
  id: "lab",
  handlers: { seatCheck: () => LAB_REASON },
};
