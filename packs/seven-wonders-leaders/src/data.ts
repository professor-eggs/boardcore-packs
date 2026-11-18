// The Leaders add-on as data (mechanics only): the leaders, four guilds and Roma. Leaders whose effects the
// base reads use the base's kinds (discounts, a bank purchase, free guilds, science, points); the rest use this
// add-on's kinds `leaders:<name>`, or the Cities add-on's `cities:<name>` (read by that add-on from a seat's
// extras, and dealt only when Cities is in the room). Costs and effects: the base's RULES-AUDIT.md.
type Eff = SWEff;
export interface LeaderDef { name: string; cost: number; eff: Eff[]; set: "leaders" | "cities" | "promo" }
const L = (name: string, cost: number, ...eff: Eff[]): LeaderDef => ({ name, cost, eff, set: "leaders" });
const LC = (name: string, cost: number, ...eff: Eff[]): LeaderDef => ({ name, cost, eff, set: "cities" });
const LP = (name: string, cost: number, ...eff: Eff[]): LeaderDef => ({ name, cost, eff, set: "promo" });
const per = (n: number, color: SWColor): Eff => ({ k: "perVP", n, who: "self", colors: [color] });
const vp = (n: number): Eff => ({ k: "vp", n });
const lvp = (what: string): Eff => ({ k: "leaders:vp", what });
const disc = (color: SWColor | "wonder"): Eff => ({ k: "discount", color });

export const LEADERS: readonly LeaderDef[] = [
  L("Alexander", 3, lvp("victories")),
  L("Amytis", 4, { k: "perVP", n: 2, who: "self", stages: true }),
  L("Archimedes", 4, disc("green")),
  L("Aristotle", 3, { k: "sciSetBonus", n: 3 }),
  L("Bilkis", 4, { k: "bank" }),
  L("Caesar", 5, { k: "shields", n: 2 }),
  L("Cleopatra", 4, vp(5)),
  L("Croesus", 1, { k: "coins", n: 6 }),
  L("Euclid", 5, { k: "sci", s: "c" }),
  L("Hammurabi", 2, disc("blue")),
  L("Hannibal", 2, { k: "shields", n: 1 }),
  L("Hatshepsut", 2, { k: "leaders:hatshepsut" }),
  L("Hiram", 3, per(2, "purple")),
  L("Hypatia", 4, per(1, "green")),
  L("Imhotep", 3, disc("wonder")),
  L("Justinian", 3, lvp("justinian")),
  L("Leonidas", 2, disc("red")),
  L("Maecenas", 1, { k: "leaders:free" }),
  L("Midas", 3, lvp("coins3")),
  L("Nebuchadnezzar", 4, per(1, "blue")),
  L("Nefertiti", 3, vp(4)),
  L("Nero", 1, { k: "leaders:nero" }),
  L("Pericles", 6, per(2, "red")),
  L("Phidias", 3, per(1, "brown")),
  L("Plato", 4, lvp("plato")),
  L("Praxiteles", 3, per(2, "grey")),
  L("Ptolemy", 5, { k: "sci", s: "t" }),
  L("Pythagoras", 5, { k: "sci", s: "g" }),
  L("Ramses", 5, { k: "freeColor", color: "purple" }),
  L("Sappho", 1, vp(2)),
  L("Solomon", 3, { k: "discardBuild" }),
  L("Tomyris", 4, { k: "leaders:tomyris" }),
  L("Varro", 3, per(1, "yellow")),
  L("Vitruvius", 1, { k: "leaders:vitruvius" }),
  L("Xenophon", 2, { k: "leaders:xenophon" }),
  L("Zenobia", 2, vp(3)),
  LC("Berenice", 2, { k: "cities:berenice" }),
  LC("Darius", 4, per(1, "black")),
  LC("Aspasia", 3, vp(2), { k: "cities:diplomacy" }),
  LC("Caligula", 3, { k: "freeColor", color: "black", perAge: true }),
  LC("Semiramis", 2, { k: "cities:semiramis" }),
  LC("Diocletian", 2, { k: "cities:diocletian" }),
  LP("Louis", 4, lvp("louis")),
  LP("Stevie", 0, { k: "leaders:stevie" }),
  LP("Esteban", 5, { k: "leaders:esteban" }),
];
export const LEADER = new Map(LEADERS.map((l) => [l.name, l]));

const guild = (name: string, cost: string, eff: Eff): SWCardDef => ({ id: `${name}@3`, name, age: 3, color: "purple", cost, counts: [], from: [], eff: [eff] });
export const LEADERS_GUILDS: readonly SWCardDef[] = [
  guild("Courtesans Guild", "SCGL", { k: "leaders:courtesan" }),
  guild("Diplomats Guild", "SWGP", { k: "leaders:perNbrLeader", n: 1 }),
  guild("Gamers Guild", "SCWO", lvp("coins3")),
  guild("Architects Guild", "OOOCPL", { k: "perVP", n: 3, who: "nbr", colors: ["purple"] }),
];

const st = (cost: string, ...eff: Eff[]): SWStageDef => ({ cost, eff });
/** Roma: side A recruits for free, side B for 2 less (its neighbours 1 less). Stage costs UNVERIFIED. */
export const ROMA: SWWonderDef = {
  id: "Roma", base: "",
  board: { A: [{ k: "leaders:cost", self: 99, nbr: 0 }], B: [{ k: "leaders:cost", self: 2, nbr: 1 }] },
  A: [st("WWO", vp(4)), st("SSSO", vp(6))],
  B: [st("WO", { k: "coins", n: 5 }, { k: "leaders:draw", n: 4 }), st("SSC", vp(3), { k: "leaders:extra" }), st("GPLW", vp(3), { k: "leaders:extra" })],
};
