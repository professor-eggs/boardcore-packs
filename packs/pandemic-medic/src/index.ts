// Medic (S11 part 8b): a persona for the co-op game. Its evaluation is the same for every seat (the team wins or
// loses together): cures and eradications count for, outbreaks and cubes on the board against. Its prior likes
// curing and treating, and ending a turn with actions left least. Mechanics only.
import { definePersona, type Json } from "@boardcore/pack-sdk";

interface View {
  [k: string]: Json;
  cubes: { [city: string]: { [c: string]: number } };
  cured: string[];
  eradicated: string[];
  outbreaks: number;
  infectionRate: number;
  actionsLeft: number;
  outcome: { winners: string[] } | null;
}

export default definePersona<View>({
  evaluate(v) {
    if (v.outcome) return v.outcome.winners.length ? 1 : 0;
    let cubes = 0, hot = 0;
    for (const c of Object.keys(v.cubes)) for (const n of Object.values(v.cubes[c]!)) { cubes += n; if (n >= 3) hot++; }
    const x = 0.45 + 0.12 * v.cured.length + 0.03 * v.eradicated.length - 0.05 * v.outbreaks - 0.006 * cubes - 0.02 * hot - 0.01 * v.infectionRate;
    return Math.max(0, Math.min(1, x));
  },
  prior(v, _seat, action) {
    const a = action[0];
    if (a === "cure") return 8;
    if (a === "treat") return 3;
    if (a === "share" || a === "build") return 2;
    if (a === "end") return v.actionsLeft > 0 ? 0.2 : 1;
    return 1;
  },
});
