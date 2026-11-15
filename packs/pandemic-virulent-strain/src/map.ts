// The world map (a copy of the base's data.ts: an add-on imports nothing but the SDK; a test checks the copy). Mechanics only.
export const CITIES: { readonly [name: string]: string } = {
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
