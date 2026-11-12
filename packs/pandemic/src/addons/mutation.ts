// Pandemic: On the Brink — the Mutation challenge: a fifth, purple disease (12 cubes), two Mutation infection
// cards that start in the infection discards, and three Mutation events shuffled into the player deck.
import { CITY_NAMES, MUTATION_EVENTS } from "../data";
import { cubesIn, place, say, touch, type Ctx, type State } from "../engine";
import { curePurple, purpleFollows, purpleGoal } from "../purple";
import type { PandemicAddOn } from "../addon";

/** Takes the bottom infection card to the discards; returns its city. */
function bottom(s: State): [State, string | null] {
  const card = s.infDeck[s.infDeck.length - 1];
  if (card === undefined) return [s, null];
  return [{ ...s, infDeck: s.infDeck.slice(0, -1), infDiscard: [...s.infDiscard, card] }, card];
}

const isCityCard = (c: string | null): c is string => c !== null && CITY_NAMES.includes(c);
const isMutationEvent = (card: string) => card.startsWith("mutation:");

export const mutation: PandemicAddOn = {
  id: "mutation",
  actions: [curePurple],
  handlers: (ctx: Ctx) => ({
    setup: (s: State) => ({ ...s, infDiscard: [...s.infDiscard, "Mutation! 1", "Mutation! 2"] }),
    // After the hands are dealt, before the epidemic piles are made.
    playerCards: (cards: string[]) => [...cards, ...MUTATION_EVENTS.map((m) => `mutation:${m}`)],
    // Two Mutation events drawn together: the player picks the order (an epidemic always comes after them).
    drawChoice: (_s: State, drawn: string[]) => (drawn.every(isMutationEvent) ? true : null),
    // Mutation events resolve at once and are not replaced. Bottom cards get purple only.
    drawCard(s: State, card: string): State | null {
      if (!isMutationEvent(card)) return null;
      const name = card.slice(9);
      s = say(touch({ ...s, removed: [...s.removed, card] }), `${name}!`);
      if (s.eradicated.includes("purple")) return say(s, "Purple is eradicated: no effect.");
      if (name === "Mutation Threatens") { const [t, c] = bottom(s); s = t; if (isCityCard(c)) s = place(say(s, `${c} gets 3 purple.`), c, "purple", 3, ctx); }
      if (name === "Mutation Spreads") for (let i = 0; i < 3 && !s.outcome; i++) { const [t, c] = bottom(s); s = t; if (isCityCard(c)) s = place(say(s, `${c} gets 1 purple.`), c, "purple", 1, ctx); }
      if (name === "Mutation Intensifies") {
        const twos = CITY_NAMES.filter((city) => cubesIn(s, city, "purple") === 2);
        for (const city of twos) if (!s.outcome) s = place(s, city, "purple", 1, ctx);
      }
      return s;
    },
    // A Mutation card in the infection step counts as one draw; its bottom card is not an infection draw.
    infectCard(s: State, card: string): State | null {
      if (!card.startsWith("Mutation!")) return null;
      if (s.eradicated.includes("purple")) return say(s, "Mutation: purple is eradicated, no effect.");
      const [t, c] = bottom(s);
      s = say(t, `Mutation!${c ? ` ${c} gets a purple cube.` : ""}`);
      return isCityCard(c) ? place(s, c, "purple", 1, ctx) : s;
    },
    infectAlso: purpleFollows,
    cureGoal: purpleGoal,
  }),
};
