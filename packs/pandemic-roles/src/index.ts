// Pandemic: On the Brink's six roles, an add-on of boardcore/pandemic 1.x. The roles join the `roles` registry;
// with them a 5th player and the legendary game (7 epidemics) become possible. Each role works through the base's
// points: the Generalist's 5 actions and the Archivist's hand limit of 8 are modifiers, the Troubleshooter's look
// at the infection deck is a `peek` at the start of her turn and her direct flights only show the card (`payCard`),
// the Containment Specialist removes a cube where a colour has 2 or more as she enters (`onEnter`), and the
// Archivist's, Epidemiologist's and Field Operative's own actions are `actions` with their `steps` and `act`, and
// the Field Operative's cure with samples is the base's `cureSwap`. The
// Epidemiologist takes a card through the base's `askCard`: the other player chooses which card from his closed
// hand, or refuses (G2). Mechanics only.
import { defineAddon, type Json, type Option, type Prompt, type SeatId } from "@boardcore/pack-sdk";

const ROLES = ["Archivist", "Containment Specialist", "Epidemiologist", "Field Operative", "Generalist", "Troubleshooter"];
type S = PDState;

const opt = (id: string, label: string, disabled?: string | null): Option => (disabled ? { id, label, disabled } : { id, label });
const pick = (label: string, options: Option[]): Prompt | null => (options.length ? { kind: "pick", label, options } : null);
/** A `steps` answer (a prompt is plain data). */
const P = (p: Prompt | null) => ({ prompt: p as unknown as Json });
const has = (s: S, seat: SeatId, role: string) => s.pl[seat]?.role === role;
const here = (s: S, seat: SeatId) => s.pl[seat]!.city;
const used = (s: S, seat: SeatId, flag: string) => s.pl[seat]!.used.includes(flag);
const cubesHere = (s: S, city: string) => Object.entries(s.cubes[city] ?? {}).filter(([, n]) => n > 0);

export default defineAddon<"boardcore/pandemic">({
  contributes: {
    roles: ROLES.map((id) => ({ id })),
    maxPlayers: ({ value }) => Math.max(value, 5),
    maxEpidemics: ({ value }) => Math.max(value, 7),
    actionLimit: ({ state, value, args }) => (state && has(state, args.seat, "Generalist") ? value + 1 : value),
    handLimit: ({ state, value, args }) => (state && has(state, args.seat, "Archivist") ? Math.max(value, 8) : value),
    payCard: ({ state, value, args }) => (state && args.kind === "direct" && has(state, args.payer, "Troubleshooter") ? false : value),
    // The Field Operative: 3 samples of a colour stand in for 2 of the cards of a cure.
    cureSwap: ({ state, value, args }) => (state && has(state, args.seat, "Field Operative") ? { cards: 2, samples: 3 } : value),
    turnStart: ({ state, args }) => (state && has(state, args.seat, "Troubleshooter") && state.infDeck.items.length ? { ops: [{ op: "peek", seat: args.seat }] } : {}),
    onEnter: ({ state, args }) => {
      const s = state!;
      if (!has(s, args.seat, "Containment Specialist")) return {};
      const ops: PDOp[] = [];
      for (const [c, n] of cubesHere(s, args.city)) if (n >= 2) ops.push({ op: "log", text: `The Containment Specialist removes a ${c} cube in ${args.city}.` }, { op: "remove", city: args.city, color: c, n: 1 });
      return { ops };
    },
    actions: ({ state, args }) => {
      const s = state!, seat = args.seat, out: PDActionOpt[] = [];
      if (has(s, seat, "Archivist") && !used(s, seat, "archive") && s.playerDiscard.includes(`city:${here(s, seat)}`))
        out.push({ id: "archive", label: `Take ${here(s, seat)} back from the discard pile`, cost: 1 });
      if (has(s, seat, "Epidemiologist") && !used(s, seat, "epi")) {
        const others = s.players.filter((x) => x !== seat && here(s, x) === here(s, seat) && !used(s, seat, `epiAsk:${x}`));
        if (others.length) out.push({ id: "epidemiologist", label: "Ask a player here for a city card (free, once a turn)", cost: 0, ...(others.some((x) => s.pl[x]!.hand.items.length) ? {} : { disabled: "no one here has cards" }) });
      }
      if (has(s, seat, "Field Operative")) {
        const fo = s.pl[seat]!;
        if (!used(s, seat, "sample") && cubesHere(s, here(s, seat)).length) out.push({ id: "sample", label: "Move a cube here onto your role card as a sample", cost: 1 });
        if (Object.values(fo.samples).some((n) => n > 0)) out.push({ id: "returnSamples", label: "Return samples to the supply (free)", cost: 0 });
      }
      return out;
    },
    steps: ({ state, args }) => {
      const s = state!, { id, seat, rest } = args;
      switch (id) {
        case "archive": return P(null);
        case "epidemiologist":
          return P(rest.length ? null : pick("Ask whom", s.players.filter((x) => x !== seat && here(s, x) === here(s, seat) && !used(s, seat, `epiAsk:${x}`)).map((x) => opt(x, `Ask ${x}`, s.pl[x]!.hand.items.length ? null : `${x} has no cards`))));
        case "sample": return P(rest.length ? null : pick("Sample which disease", cubesHere(s, here(s, seat)).map(([c, n]) => opt(c, `${c} (${n} here)`))));
        case "returnSamples": return P(rest.length ? null : pick("Return which colour", Object.entries(s.pl[seat]!.samples).filter(([, n]) => n > 0).map(([c, n]) => opt(c, `${c} (${n})`))));
        default: return null;
      }
    },
    act: ({ state, args }) => {
      const s = state!, { id, seat, rest } = args;
      switch (id) {
        case "archive": {
          const card = `city:${here(s, seat)}`;
          return { ops: [{ op: "discardToHand", seat, card }, { op: "use", seat, flag: "archive" }, { op: "log", text: `${seat} takes ${here(s, seat)} back from the discard pile.` }, { op: "handLimit", seat }] };
        }
        case "epidemiologist": {
          const from = String(rest[0]);
          return { ops: [{ op: "use", seat, flag: `epiAsk:${from}` }, { op: "log", text: `${seat} asks ${from} for a city card.` }, { op: "askCard", from, to: seat, city: null, cost: 0, flag: "epi" }] };
        }
        case "sample": {
          const c = String(rest[0]);
          return { ops: [{ op: "sample", seat, city: here(s, seat), color: c }, { op: "use", seat, flag: "sample" }, { op: "log", text: `${seat} takes a ${c} sample in ${here(s, seat)}.` }] };
        }
        case "returnSamples": {
          const c = String(rest[0]), n = s.pl[seat]!.samples[c] ?? 0;
          return { ops: [{ op: "unsample", seat, color: c, n }, { op: "log", text: `${seat} returns ${n} ${c} samples.` }] };
        }
        default: return {};
      }
    },
  },
  describe: ({ view }) => (view.log.length ? view.log.join(" ") : null),
  text: { legend: () => "On the Brink roles: the Archivist, Containment Specialist, Epidemiologist, Field Operative, Generalist and Troubleshooter join the roles; up to 5 players." },
});

