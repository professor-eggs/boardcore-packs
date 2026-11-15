// Pandemic: On the Brink's Mutation challenge, an add-on of boardcore/pandemic 1.x. A fifth, purple disease joins
// the `diseases` registry (12 cubes, cured with city cards of any colour, at least one of a city with purple on it;
// in the infection step a city that already has purple gets one more). Two Mutation infection cards start in the
// infection discards (`startDiscard`) and three Mutation event cards go into the player deck (`playerCards`); both
// put purple on the bottom card of the infection deck (`infectCard`, `drawCard`, the base's `infectBottom`). To
// win, purple must be cured too, or gone from the board (`cureGoal`). Mechanics only.
import { defineAddon } from "@boardcore/pack-sdk";

const PURPLE = "purple";
const EVENTS = ["Mutation Threatens", "Mutation Spreads", "Mutation Intensifies"];
type S = PDState;
const onBoard = (s: S, c: string) => Object.values(s.cubes).reduce((t, m) => t + (m[c] ?? 0), 0);

export default defineAddon<"boardcore/pandemic">({
  contributes: {
    diseases: [{ id: PURPLE, cubes: 12, cure: "any", follows: true }],
    startDiscard: ({ value }) => [...value, "Mutation! 1", "Mutation! 2"],
    playerCards: ({ value }) => [...value, ...EVENTS.map((m) => `mutation:${m}`)],
    // A Mutation event card is resolved when drawn and not replaced.
    drawCard: ({ state, args }) => {
      const s = state!;
      if (!args.card.startsWith("mutation:")) return {};
      const name = args.card.slice(9);
      if (s.eradicated.includes(PURPLE)) return { ops: [{ op: "log", text: `${name}: purple is eradicated, no effect.` }] };
      const ops: PDOp[] = [{ op: "log", text: `${name}!` }];
      if (name === "Mutation Threatens") ops.push({ op: "infectBottom", color: PURPLE, n: 3 });
      if (name === "Mutation Spreads") for (let i = 0; i < 3; i++) ops.push({ op: "infectBottom", color: PURPLE, n: 1 });
      if (name === "Mutation Intensifies") for (const city of Object.keys(s.cubes)) if ((s.cubes[city]![PURPLE] ?? 0) === 2) ops.push({ op: "place", city, color: PURPLE, n: 1 });
      return { ops };
    },
    // A Mutation infection card counts as one card drawn; the bottom card gets a purple cube (not an infection draw).
    infectCard: ({ state, args }) => {
      if (!args.card.startsWith("Mutation!")) return {};
      if (state!.eradicated.includes(PURPLE)) return { ops: [{ op: "log", text: "Mutation: purple is eradicated, no effect." }] };
      return { ops: [{ op: "log", text: "Mutation!" }, { op: "infectBottom", color: PURPLE, n: 1 }] };
    },
    cureGoal: ({ state, value }) => value && (state!.cured.includes(PURPLE) || onBoard(state!, PURPLE) === 0),
  },
  text: { legend: () => "Mutation: a fifth, purple disease; Mutation cards put purple on the bottom card of the infection deck. Cure it too (or clear it from the board) to win." },
});
