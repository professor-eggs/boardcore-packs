// 7 Wonders: Cities. Black cards (one per player per age, a hand of 8), debts, diplomacy, masks (read by
// the base, shared with the Great Wall), clandestine docks, the Architect Cabinet, new guilds and leaders,
// Petra and Byzantium, 8 players (deal 7, play 6, set up like 7 players), and optional team play.
import { shuffle, type SeatId } from "@boardcore/pack-sdk";
import { CARDS, leaderDef, type Eff } from "../data";
import { effectsOf, gain, nbrs, opt, setP, type Conflict, type Ctx, type Item, type Line, type PayCtx, type State } from "../engine";
import type { SevenAddOn } from "../flow";

interface Ext { absent: SeatId[]; caligula: { [seat: string]: number }; berenicePly: number; partner: { [seat: string]: SeatId }; diploSpent: SeatId[] }
const ext = (s: State): Ext => (s.ext.cities as unknown as Ext | undefined) ?? { absent: [], caligula: {}, berenicePly: -1, partner: {}, diploSpent: [] };
const teamPlay = (s: State) => s.addons.includes("teamPlay");
const withExt = (s: State, e: Ext): State => ({ ...s, ext: { ...s.ext, cities: e as unknown as State["ext"][string] } });
const leaderEffs = (s: State, seat: SeatId) => s.players[seat]!.leaders.filter((l) => !s.players[seat]!.entombed.includes(l)).flatMap((l) => leaderDef(l).eff);

export const cities: SevenAddOn = {
  id: "cities",
  interrupts: {
    debt: {
      prompt(s, seat, partial, data) {
        if (partial.length) return null;
        const n = Number(data), coins = s.players[seat]!.coins;
        if (coins === 0) return null;
        const options = [];
        for (let k = Math.min(coins, n); k >= 0; k--) options.push(opt(`pay:${k}`, k === n ? `Pay all ${n} coins` : `Pay ${k}, take ${n - k} debt`));
        return { kind: "pick", label: `You lose ${n} coin${n === 1 ? "" : "s"}: pay or take debt tokens`, options };
      },
      apply(s, seat, action, data) {
        const n = Number(data), k = Number(String(action[0]).slice(4));
        s = setP(s, seat, (p) => ({ ...p, coins: p.coins - k, debt: p.debt + n - k }));
        return { ...s, log: [...s.log, `${seat} pays ${k} and takes ${n - k} debt.`] };
      },
      auto: (s, seat, data) => setP(s, seat, (p) => ({ ...p, debt: p.debt + Number(data) })),
    },
  },
  handlers: {
    seatCheck(n: number, opts: { teamPlay?: boolean }) {
      return opts.teamPlay && (n < 4 || n % 2 !== 0) ? ["Team play needs 4, 6 or 8 players"] : [];
    },
    setup(s: State): State {
      if (!teamPlay(s) || s.seats.length % 2 !== 0) return s;
      const partner: { [seat: string]: SeatId } = {};
      // Adjacent pairs in seat order: 0 with 1, 2 with 3, and so on.
      for (let i = 0; i + 1 < s.seats.length; i += 2) {
        const a = s.seats[i]!, b = s.seats[i + 1]!;
        partner[a] = b;
        partner[b] = a;
      }
      return withExt({ ...s, log: [...s.log, `Team play: ${s.seats.filter((_, i) => i % 2 === 0).map((a) => `${a} & ${partner[a]}`).join(", ")}.`] }, { ...ext(s), partner });
    },
    decks(decks: { age: number; names: string[] }[], _opts: unknown, n: number, rng: { int(n: number): number }) {
      const per = n === 8 ? 7 : n;
      return decks.map((d) => {
        const black = shuffle(rng, CARDS.filter((c) => c.set === "cities" && c.color === "black" && c.age === d.age).map((c) => c.name)).slice(0, per);
        const guilds = d.age === 3 ? CARDS.filter((c) => c.set === "cities" && c.color === "purple").map((c) => c.name) : [];
        return { ...d, names: [...d.names, ...black, ...guilds] };
      });
    },
    payment(pc: PayCtx, s: State, seat: SeatId, item: Item, ctx?: Ctx): PayCtx {
      void ctx;
      const effs = s.players[seat]!.cards.flatMap((k) => CARDS.find((c) => `${c.name}@${c.age}` === k)?.eff ?? []);
      const rebate = { ...pc.rebate };
      for (const e of effs) if (e.k === "dock") rebate[e.side] += 1;
      const waive = pc.waive || (item.type === "stage" && effs.some((e) => e.k === "noWonderRes"));
      return { ...pc, rebate, waive };
    },
    freeBuild(s: State, seat: SeatId, item: Item) {
      if (item.type !== "card" || item.color !== "black" || ext(s).caligula[seat] === s.age) return null;
      return leaderEffs(s, seat).some((e) => e.k === "caligula") ? "Caligula" : null;
    },
    onBuild(s: State, seat: SeatId, item: Item, effs: Eff[]): State {
      const others = s.seats.filter((x) => x !== seat);
      const losses = { ...s.losses };
      for (const e of effs) {
        if (e.k === "loss") for (const x of others) losses[x] = (losses[x] ?? 0) + e.n;
        if (e.k === "lossPer") for (const x of others) {
          const p = s.players[x]!;
          losses[x] = (losses[x] ?? 0) + e.n * (e.what === "victories" ? p.victories.length : p.built.length);
        }
        if (e.k === "nbrCoins") for (const x of nbrs(s, seat)) s = gain(s, x, e.n);
        if (e.k === "diplomacy") s = setP(s, seat, (p) => ({ ...p, diplomacy: p.diplomacy + 1 }));
      }
      s = { ...s, losses: Object.fromEntries(Object.entries(losses).filter(([, n]) => n > 0)) };
      if (item.type === "card" && item.color === "black") s = gain(s, seat, 2 * leaderEffs(s, seat).filter((e) => e.k === "diocletian").length);
      if (item.free === "Caligula") s = withExt(s, { ...ext(s), caligula: { ...ext(s).caligula, [seat]: s.age } });
      return s;
    },
    settleLoss: (s: State, seat: SeatId, n: number): State => ({ ...s, pending: [...s.pending, { seat, kind: "debt", data: n }] }),
    endTurn(s: State): State {
      // Berenice: +1 coin once a turn when the seat took coins from the bank.
      const e = ext(s);
      if (e.berenicePly === s.logPly) return s;
      for (const x of s.seats) if ((s.gained[x] ?? 0) > 0 && leaderEffs(s, x).some((f) => f.k === "berenice")) s = gain(s, x, 1);
      return withExt(s, { ...ext(s), berenicePly: s.logPly });
    },
    ageEnd(s: State): State {
      // Diplomacy: spend one token if you have any (cheatsheet: one must be spent each age). In the
      // usual game you sit the conflicts out and your neighbours fight. In team play you still fight,
      // and both sides take one fewer conflict token (handled in the conflict hook).
      const holding = s.seats.filter((x) => s.players[x]!.diplomacy > 0);
      for (const x of holding) s = setP(s, x, (p) => ({ ...p, diplomacy: p.diplomacy - 1 }));
      const absent = teamPlay(s) ? [] : holding;
      if (holding.length) s = { ...s, log: [...s.log, teamPlay(s)
        ? `Diplomacy: ${holding.join(", ")} still fight, one fewer token each side.`
        : `Diplomacy: ${holding.join(", ")} sit${holding.length === 1 ? "s" : ""} out the conflicts.`] };
      return withExt(s, { ...ext(s), absent, diploSpent: holding });
    },
    conflictSeats: (seats: SeatId[], s: State) => seats.filter((x) => !ext(s).absent.includes(x)),
    conflict(c: Conflict, s: State): Conflict {
      if (!teamPlay(s)) return c;
      if (ext(s).partner[c.a] === c.b) return { ...c, tokens: 0, winner: null };
      const prev = c.tokens;
      let tokens = prev * 2;
      if (ext(s).diploSpent.includes(c.a) || ext(s).diploSpent.includes(c.b)) tokens = Math.max(0, tokens - 1);
      const bonus = { ...c.bonus };
      if (prev > 0 && tokens !== prev) for (const x of Object.keys(bonus)) bonus[x] = bonus[x]! / prev * tokens;
      return { ...c, tokens, bonus };
    },
    shields: (n: number, s: State, seat: SeatId) => n + (leaderEffs(s, seat).some((e) => e.k === "semiramis") ? s.players[seat]!.defeats : 0),
    score(s: State, seat: SeatId, ctx: Ctx): Line[] {
      const lines: Line[] = [{ cat: "treasury", vp: -s.players[seat]!.debt }];
      for (const { eff } of effectsOf(s, seat, ctx))
        if (eff.k === "nbrVictoryVP") lines.push({ cat: "guilds", vp: eff.n * nbrs(s, seat).reduce((t, x) => t + s.players[x]!.victories.length, 0) });
      return lines;
    },
  },
};
