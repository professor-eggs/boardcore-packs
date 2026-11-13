// The outcome's places and scores (11 §2, D79): points, a tie broken by coins, still tied shares the place.
import { describe, expect, it } from "@effect/vitest";
import { outcomeOf } from "../src/index";
import type { State } from "../src/engine";

const at = (coins: { [seat: string]: number }) =>
  ({ seats: Object.keys(coins), players: Object.fromEntries(Object.entries(coins).map(([x, c]) => [x, { coins: c }])) }) as unknown as State;

describe("seven-wonders outcome", () => {
  it("places by points, then coins, and shares a place still tied (1, 1, 3)", () => {
    const o = outcomeOf(at({ red: 4, blue: 4, green: 9, yellow: 1 }), { red: 50, blue: 50, green: 40, yellow: 50 });
    expect(o.places).toEqual({ red: 1, blue: 1, yellow: 3, green: 4 });
    expect(o.winners).toEqual(["red", "blue"]);
    expect(o.scores).toEqual({ red: 50, blue: 50, green: 40, yellow: 50 });
  });
  it("a coin tie-break makes a single winner", () => {
    const o = outcomeOf(at({ red: 2, blue: 5, green: 0 }), { red: 30, blue: 30, green: 31 });
    expect(o.places).toEqual({ green: 1, blue: 2, red: 3 });
    expect(o.winners).toEqual(["green"]);
  });
});
