// The world map (48 cities, 4 colours) and card names. Mechanics only.
// Cities, colours and connections checked against the board in the base rulebook's setup pictures (pp. 2-3);
// names, colours and populations also against the supplied card list.
export type Color = "blue" | "yellow" | "black" | "red" | "purple";
export const COLORS: readonly Color[] = ["blue", "yellow", "black", "red"];

export const CITIES: { readonly [name: string]: Color } = {
  "Atlanta": "blue", "Chicago": "blue", "Essen": "blue", "London": "blue", "Madrid": "blue", "Milan": "blue",
  "Montreal": "blue", "New York": "blue", "Paris": "blue", "San Francisco": "blue", "St. Petersburg": "blue", "Washington": "blue",
  "Bogota": "yellow", "Buenos Aires": "yellow", "Johannesburg": "yellow", "Khartoum": "yellow", "Kinshasa": "yellow", "Lagos": "yellow",
  "Lima": "yellow", "Los Angeles": "yellow", "Mexico City": "yellow", "Miami": "yellow", "Santiago": "yellow", "Sao Paulo": "yellow",
  "Algiers": "black", "Baghdad": "black", "Cairo": "black", "Chennai": "black", "Delhi": "black", "Istanbul": "black",
  "Karachi": "black", "Kolkata": "black", "Moscow": "black", "Mumbai": "black", "Riyadh": "black", "Tehran": "black",
  "Bangkok": "red", "Beijing": "red", "Ho Chi Minh City": "red", "Hong Kong": "red", "Jakarta": "red", "Manila": "red",
  "Osaka": "red", "Seoul": "red", "Shanghai": "red", "Sydney": "red", "Taipei": "red", "Tokyo": "red",
};

const EDGES: readonly [string, string][] = [
  ["Atlanta", "Chicago"], ["Atlanta", "Washington"], ["Atlanta", "Miami"],
  ["Chicago", "San Francisco"], ["Chicago", "Los Angeles"], ["Chicago", "Mexico City"], ["Chicago", "Montreal"],
  ["Montreal", "New York"], ["Montreal", "Washington"], ["New York", "Washington"], ["New York", "London"], ["New York", "Madrid"],
  ["Washington", "Miami"], ["San Francisco", "Tokyo"], ["San Francisco", "Manila"], ["San Francisco", "Los Angeles"],
  ["London", "Madrid"], ["London", "Paris"], ["London", "Essen"], ["Madrid", "Paris"], ["Madrid", "Algiers"], ["Madrid", "Sao Paulo"],
  ["Paris", "Essen"], ["Paris", "Milan"], ["Paris", "Algiers"], ["Essen", "Milan"], ["Essen", "St. Petersburg"],
  ["Milan", "Istanbul"], ["St. Petersburg", "Istanbul"], ["St. Petersburg", "Moscow"],
  ["Los Angeles", "Mexico City"], ["Los Angeles", "Sydney"], ["Mexico City", "Miami"], ["Mexico City", "Bogota"], ["Mexico City", "Lima"],
  ["Miami", "Bogota"], ["Bogota", "Lima"], ["Bogota", "Buenos Aires"], ["Bogota", "Sao Paulo"], ["Lima", "Santiago"],
  ["Buenos Aires", "Sao Paulo"], ["Sao Paulo", "Lagos"], ["Lagos", "Kinshasa"], ["Lagos", "Khartoum"],
  ["Kinshasa", "Khartoum"], ["Kinshasa", "Johannesburg"], ["Johannesburg", "Khartoum"], ["Khartoum", "Cairo"],
  ["Algiers", "Istanbul"], ["Algiers", "Cairo"], ["Istanbul", "Moscow"], ["Istanbul", "Baghdad"], ["Istanbul", "Cairo"],
  ["Moscow", "Tehran"], ["Cairo", "Baghdad"], ["Cairo", "Riyadh"], ["Baghdad", "Riyadh"], ["Baghdad", "Karachi"], ["Baghdad", "Tehran"],
  ["Riyadh", "Karachi"], ["Tehran", "Karachi"], ["Tehran", "Delhi"], ["Karachi", "Mumbai"], ["Karachi", "Delhi"],
  ["Mumbai", "Delhi"], ["Mumbai", "Chennai"], ["Delhi", "Chennai"], ["Delhi", "Kolkata"], ["Chennai", "Kolkata"],
  ["Chennai", "Bangkok"], ["Chennai", "Jakarta"], ["Kolkata", "Bangkok"], ["Kolkata", "Hong Kong"],
  ["Bangkok", "Jakarta"], ["Bangkok", "Ho Chi Minh City"], ["Bangkok", "Hong Kong"], ["Jakarta", "Ho Chi Minh City"], ["Jakarta", "Sydney"],
  ["Ho Chi Minh City", "Hong Kong"], ["Ho Chi Minh City", "Manila"], ["Hong Kong", "Shanghai"], ["Hong Kong", "Taipei"], ["Hong Kong", "Manila"],
  ["Shanghai", "Beijing"], ["Shanghai", "Seoul"], ["Shanghai", "Tokyo"], ["Shanghai", "Taipei"], ["Beijing", "Seoul"], ["Seoul", "Tokyo"],
  ["Tokyo", "Osaka"], ["Osaka", "Taipei"], ["Taipei", "Manila"], ["Manila", "Sydney"],
];

export const ADJ: { readonly [city: string]: readonly string[] } = Object.fromEntries(
  Object.keys(CITIES).map((c) => [c, EDGES.flatMap(([a, b]) => (a === c ? [b] : b === c ? [a] : []))]),
);
export const CITY_NAMES: readonly string[] = Object.keys(CITIES);

/**
 * City populations, used only to pick the first player (the highest city population in hand goes first).
 * Some are printed in the base rulebook's card pictures (pp. 2-6); all 48 (and every city's colour) match the
 * city-card list Xavier supplied (TTS card sprites). Chicago and Lima tie; the earlier seat goes first.
 */
export const POPULATION: { readonly [city: string]: number } = {
  "Atlanta": 4715000, "Chicago": 9121000, "Essen": 575000, "London": 8586000, "Madrid": 5427000, "Milan": 5232000,
  "Montreal": 3429000, "New York": 20464000, "Paris": 10755000, "San Francisco": 5864000, "St. Petersburg": 4879000, "Washington": 4679000,
  "Bogota": 8702000, "Buenos Aires": 13639000, "Johannesburg": 3888000, "Khartoum": 4887000, "Kinshasa": 9046000, "Lagos": 11547000,
  "Lima": 9121000, "Los Angeles": 14900000, "Mexico City": 19463000, "Miami": 5582000, "Santiago": 6015000, "Sao Paulo": 20186000,
  "Algiers": 2946000, "Baghdad": 6204000, "Cairo": 14718000, "Chennai": 8865000, "Delhi": 22242000, "Istanbul": 13576000,
  "Karachi": 20711000, "Kolkata": 14374000, "Moscow": 15512000, "Mumbai": 16910000, "Riyadh": 5037000, "Tehran": 7419000,
  "Bangkok": 7151000, "Beijing": 17311000, "Ho Chi Minh City": 8314000, "Hong Kong": 7106000, "Jakarta": 26063000, "Manila": 20767000,
  "Osaka": 2871000, "Seoul": 22547000, "Shanghai": 13482000, "Sydney": 3785000, "Taipei": 8338000, "Tokyo": 13189000,
};

export const BASE_ROLES = ["Contingency Planner", "Dispatcher", "Medic", "Operations Expert", "Quarantine Specialist", "Researcher", "Scientist"] as const;
export const OTB_ROLES = ["Archivist", "Containment Specialist", "Epidemiologist", "Field Operative", "Generalist", "Troubleshooter"] as const;
export const BASE_EVENTS = ["Airlift", "Forecast", "Government Grant", "One Quiet Night", "Resilient Population"] as const;
export const OTB_EVENTS = ["Borrowed Time", "Commercial Travel Ban", "Mobile Hospital", "New Assignment", "Rapid Vaccine Deployment", "Re-examined Research", "Remote Treatment", "Special Orders"] as const;
export const VS_EPIDEMICS = ["Chronic Effect", "Complex Molecular Structure", "Government Interference", "Hidden Pocket", "Rate Effect", "Slippery Slope", "Unacceptable Loss", "Uncounted Populations"] as const;
export const MUTATION_EVENTS = ["Mutation Threatens", "Mutation Spreads", "Mutation Intensifies"] as const;

/** Infection rate track. */
export const RATES = [2, 2, 2, 3, 3, 4, 4] as const;
/** Cubes per colour in the supply (the Petri dish holds the purple ones). */
export const SUPPLY: { readonly [c in Color]: number } = { blue: 24, yellow: 24, black: 24, red: 24, purple: 12 };
export const OUTBREAK_LIMIT = 8;
export const MAX_STATIONS = 6;
