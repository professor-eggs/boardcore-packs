// The Cities content as data (mechanics only): three guilds, 27 black cards (9 an age), Petra and Byzantium.
// Names from the Cities parts list; costs, points and effects from the references in ../../RULES-AUDIT.md
// (Mourners' cost UNVERIFIED). Effects the base rules read are their own kinds; this module's are `cities:<name>`.
type Eff = SWEff;
const vp = (n: number): Eff => ({ k: "vp", n });
const sh = (n: number): Eff => ({ k: "shields", n });
const card = (name: string, age: 1 | 2 | 3, color: SWColor, cost: string, counts: number[], eff: Eff[]): SWCardDef =>
  ({ id: `${name}@${age}`, name, age, color, cost, counts, from: [], eff });
const st = (cost: string, ...eff: Eff[]): SWStageDef => ({ cost, eff });

export const CITIES_CARDS: readonly SWCardDef[] = [
  card("Counterfeiters Guild", 3, "purple", "OOOLG", [], [vp(5), { k: "cities:loss", n: 3 }]),
  card("Guild of Shadows", 3, "purple", "SSWP", [], [{ k: "perVP", n: 1, who: "nbr", colors: ["black"] }]),
  card("Mourners Guild", 3, "purple", "SSCG", [], [{ k: "perVP", n: 1, who: "nbr", victories: true }]), // cost UNVERIFIED
  card("Pigeon Loft", 1, "black", "$1O", [], [{ k: "mask" }]),
  card("Militia", 1, "black", "$3", [], [sh(2)]),
  card("Hideout", 1, "black", "", [], [vp(1), { k: "cities:loss", n: 1 }]),
  card("Residence", 1, "black", "C", [], [vp(1), { k: "cities:diplomacy" }]),
  card("Gambling Den", 1, "black", "", [], [{ k: "coins", n: 6 }, { k: "nbrCoins", n: 1 }]),
  card("Secret Warehouse", 1, "black", "$2", [], [{ k: "warehouse" }]),
  card("Clandestine Dock West", 1, "black", "$1", [], [{ k: "dock", side: "L" }]),
  card("Clandestine Dock East", 1, "black", "$1", [], [{ k: "dock", side: "R" }]),
  card("Gates of the City", 1, "black", "$1W", [], [vp(4)]),
  card("Spy Ring", 2, "black", "$2SC", [], [{ k: "mask" }]),
  card("Mercenaries", 2, "black", "$4P", [], [sh(3)]),
  card("Lair", 2, "black", "WG", [], [vp(3), { k: "cities:loss", n: 2 }]),
  card("Consulate", 2, "black", "CP", [], [vp(2), { k: "cities:diplomacy" }]),
  card("Gambling House", 2, "black", "$1", [], [{ k: "coins", n: 9 }, { k: "nbrCoins", n: 2 }]),
  card("Sepulcher", 2, "black", "SGL", [], [vp(4), { k: "cities:lossPer", n: 1, what: "victories" }]),
  card("Architect Cabinet", 2, "black", "$1P", [], [vp(2), { k: "noWonderRes" }]),
  card("Black Market", 2, "black", "OL", [], [{ k: "blackMarket" }]),
  card("Tabularium", 2, "black", "$2OWL", [], [vp(6)]),
  card("Torture Chamber", 3, "black", "$3OOG", [], [{ k: "mask" }]),
  card("Contingent", 3, "black", "$5L", [], [sh(5)]),
  card("Brotherhood", 3, "black", "WWWOL", [], [vp(4), { k: "cities:loss", n: 3 }]),
  card("Embassy", 3, "black", "SLP", [], [vp(3), { k: "cities:diplomacy" }]),
  card("Cenotaph", 3, "black", "CCSLG", [], [vp(5), { k: "cities:lossPer", n: 1, what: "victories" }]),
  card("Builders Union", 3, "black", "CWPG", [], [vp(4), { k: "cities:lossPer", n: 1, what: "stages" }]),
  card("Capitol", 3, "black", "$2CCSSGP", [], [vp(8)]),
  card("Slave Market", 3, "black", "OOWW", [], [{ k: "perCoins", n: 1, who: "self", victories: true }, { k: "perVP", n: 1, who: "self", victories: true }]),
  card("Secret Society", 3, "black", "SP", [], [{ k: "perCoins", n: 1, who: "self", colors: ["black"] }, { k: "perVP", n: 1, who: "self", colors: ["black"] }]),
];

export const CITIES_WONDERS: readonly SWWonderDef[] = [
  // Petra and Byzantium. Starting resources: Petra clay, Byzantium stone, both sides. Stage costs UNVERIFIED.
  { id: "Petra", base: "C",
    A: [st("SW", vp(3)), st("$7", vp(7)), st("SSWW", vp(7))],
    B: [st("WO", vp(3), { k: "cities:loss", n: 2 }), st("$14", vp(14))] },
  { id: "Byzantium", base: "S",
    A: [st("WW", vp(3)), st("SSS", vp(2), { k: "cities:diplomacy" }), st("WWWG", vp(7))],
    B: [st("CLP", vp(3), { k: "cities:diplomacy" }), st("WWG", vp(4), { k: "cities:diplomacy" })] },
];

/** Every black card of an age (the decks take one per seat, seven at eight seats). */
export const blackOf = (age: number) => CITIES_CARDS.filter((c) => c.color === "black" && c.age === age).map((c) => c.id);
export const GUILDS = CITIES_CARDS.filter((c) => c.color === "purple").map((c) => c.id);
