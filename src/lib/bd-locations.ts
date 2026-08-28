// Official divisions and districts of Bangladesh (factual public administrative data).
export const BD_DIVISIONS: Record<string, string[]> = {
  ঢাকা: [
    "ঢাকা",
    "গাজীপুর",
    "নারায়ণগঞ্জ",
    "নরসিংদী",
    "মানিকগঞ্জ",
    "মুন্সিগঞ্জ",
    "টাঙ্গাইল",
    "কিশোরগঞ্জ",
    "ফরিদপুর",
    "গোপালগঞ্জ",
    "মাদারীপুর",
    "রাজবাড়ী",
    "শরীয়তপুর",
  ],
  চট্টগ্রাম: [
    "চট্টগ্রাম",
    "কক্সবাজার",
    "কুমিল্লা",
    "ফেনী",
    "ব্রাহ্মণবাড়িয়া",
    "রাঙ্গামাটি",
    "নোয়াখালী",
    "চাঁদপুর",
    "লক্ষ্মীপুর",
    "খাগড়াছড়ি",
    "বান্দরবান",
  ],
  রাজশাহী: [
    "রাজশাহী",
    "বগুড়া",
    "পাবনা",
    "সিরাজগঞ্জ",
    "নাটোর",
    "জয়পুরহাট",
    "চাঁপাইনবাবগঞ্জ",
    "নওগাঁ",
  ],
  খুলনা: [
    "খুলনা",
    "যশোর",
    "সাতক্ষীরা",
    "বাগেরহাট",
    "নড়াইল",
    "মাগুরা",
    "ঝিনাইদহ",
    "কুষ্টিয়া",
    "চুয়াডাঙ্গা",
    "মেহেরপুর",
  ],
  বরিশাল: ["বরিশাল", "পটুয়াখালী", "ভোলা", "পিরোজপুর", "বরগুনা", "ঝালকাঠি"],
  সিলেট: ["সিলেট", "মৌলভীবাজার", "হবিগঞ্জ", "সুনামগঞ্জ"],
  রংপুর: [
    "রংপুর",
    "দিনাজপুর",
    "কুড়িগ্রাম",
    "গাইবান্ধা",
    "নীলফামারী",
    "পঞ্চগড়",
    "ঠাকুরগাঁও",
    "লালমনিরহাট",
  ],
  ময়মনসিংহ: ["ময়মনসিংহ", "জামালপুর", "নেত্রকোণা", "শেরপুর"],
};

export const BD_DIVISION_LIST = Object.keys(BD_DIVISIONS);

export function districtsFor(division: string): string[] {
  return BD_DIVISIONS[division] ?? [];
}

export function isInsideDhaka(district: string): boolean {
  return district === "ঢাকা";
}

// ---------------------------------------------------------------------------
// Bilingual matchers — map free-text location names (English or Bengali, as
// returned by reverse geocoders) onto the canonical Bengali strings above.
// ---------------------------------------------------------------------------

/** English spellings seen in OSM/geocoder output, keyed by normalized form. */
const DIVISION_ALIASES: Record<string, string> = {
  dhaka: "ঢাকা",
  chittagong: "চট্টগ্রাম",
  chattogram: "চট্টগ্রাম",
  rajshahi: "রাজশাহী",
  khulna: "খুলনা",
  barishal: "বরিশাল",
  barisal: "বরিশাল",
  sylhet: "সিলেট",
  rangpur: "রংপুর",
  mymensingh: "ময়মনসিংহ",
};

const DISTRICT_ALIASES: Record<string, string> = {
  // ঢাকা
  dhaka: "ঢাকা",
  gazipur: "গাজীপুর",
  narayanganj: "নারায়ণগঞ্জ",
  narsingdi: "নরসিংদী",
  narsindi: "নরসিংদী",
  manikganj: "মানিকগঞ্জ",
  munshiganj: "মুন্সিগঞ্জ",
  munshigonj: "মুন্সিগঞ্জ",
  tangail: "টাঙ্গাইল",
  kishoreganj: "কিশোরগঞ্জ",
  kishoregonj: "কিশোরগঞ্জ",
  faridpur: "ফরিদপুর",
  gopalganj: "গোপালগঞ্জ",
  gopalgonj: "গোপালগঞ্জ",
  madaripur: "মাদারীপুর",
  rajbari: "রাজবাড়ী",
  shariatpur: "শরীয়তপুর",
  // চট্টগ্রাম
  chittagong: "চট্টগ্রাম",
  chattogram: "চট্টগ্রাম",
  "coxs bazar": "কক্সবাজার",
  "cox bazar": "কক্সবাজার",
  coxbazar: "কক্সবাজার",
  cumilla: "কুমিল্লা",
  comilla: "কুমিল্লা",
  feni: "ফেনী",
  brahmanbaria: "ব্রাহ্মণবাড়িয়া",
  rangamati: "রাঙ্গামাটি",
  noakhali: "নোয়াখালী",
  chandpur: "চাঁদপুর",
  lakshmipur: "লক্ষ্মীপুর",
  laxmipur: "লক্ষ্মীপুর",
  khagrachhari: "খাগড়াছড়ি",
  khagrachari: "খাগড়াছড়ি",
  bandarban: "বান্দরবান",
  // রাজশাহী
  rajshahi: "রাজশাহী",
  bogura: "বগুড়া",
  bogra: "বগুড়া",
  pabna: "পাবনা",
  sirajganj: "সিরাজগঞ্জ",
  sirajgonj: "সিরাজগঞ্জ",
  natore: "নাটোর",
  joypurhat: "জয়পুরহাট",
  jaipurhat: "জয়পুরহাট",
  chapainawabganj: "চাঁপাইনবাবগঞ্জ",
  "chapai nawabganj": "চাঁপাইনবাবগঞ্জ",
  naogaon: "নওগাঁ",
  // খুলনা
  khulna: "খুলনা",
  jashore: "যশোর",
  jessore: "যশোর",
  satkhira: "সাতক্ষীরা",
  bagerhat: "বাগেরহাট",
  narail: "নড়াইল",
  magura: "মাগুরা",
  jhenaidah: "ঝিনাইদহ",
  kushtia: "কুষ্টিয়া",
  chuadanga: "চুয়াডাঙ্গা",
  meherpur: "মেহেরপুর",
  // বরিশাল
  barishal: "বরিশাল",
  barisal: "বরিশাল",
  patuakhali: "পটুয়াখালী",
  bhola: "ভোলা",
  pirojpur: "পিরোজপুর",
  barguna: "বরগুনা",
  jhalokati: "ঝালকাঠি",
  jhalakathi: "ঝালকাঠি",
  // সিলেট
  sylhet: "সিলেট",
  moulvibazar: "মৌলভীবাজার",
  maulovibazar: "মৌলভীবাজার",
  habiganj: "হবিগঞ্জ",
  sunamganj: "সুনামগঞ্জ",
  // রংপুর
  rangpur: "রংপুর",
  dinajpur: "দিনাজপুর",
  kurigram: "কুড়িগ্রাম",
  gaibandha: "গাইবান্ধা",
  nilphamari: "নীলফামারী",
  panchagarh: "পঞ্চগড়",
  thakurgaon: "ঠাকুরগাঁও",
  lalmonirhat: "লালমনিরহাট",
  // ময়মনসিংহ
  mymensingh: "ময়মনসিংহ",
  jamalpur: "জামালপুর",
  netrokona: "নেত্রকোণা",
  netrakona: "নেত্রকোণা",
  sherpur: "শেরপুর",
};

/** Administrative suffixes geocoder names carry; tried longest-first. */
const NAME_SUFFIXES = [
  "city corporation",
  "corporation",
  "district",
  "division",
  "upazila",
  "upazilla",
  "sadar",
  "zila",
  "city",
  "thana",
  "বিভাগ",
  "জেলা",
  "কর্পোরেশন",
  "উপজেলা",
  "থানা",
  "সিটি",
];

/** Lowercases, drops zero-width chars and punctuation, collapses whitespace. */
function normalizeName(input: string): string {
  return input
    .replace(/[​‌‍]/g, "")
    .replace(/\(.*?\)/g, " ")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[-_.]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripSuffixes(norm: string): string[] {
  const candidates = [norm];
  for (const suffix of NAME_SUFFIXES) {
    const withSpace = ` ${suffix}`;
    if (norm.endsWith(withSpace)) {
      candidates.push(norm.slice(0, -withSpace.length).trim());
    } else if (norm.endsWith(suffix) && norm.length > suffix.length) {
      candidates.push(norm.slice(0, -suffix.length).trim());
    }
  }
  return candidates;
}

function matchInAliases(
  raw: string | undefined | null,
  canonicalSet: Map<string, string>,
  aliases: Record<string, string>,
): string | null {
  const norm = normalizeName(raw ?? "");
  if (!norm) return null;

  // 1. Exact canonical (Bengali) or alias (English) hit, then suffix-stripped.
  for (const candidate of stripSuffixes(norm)) {
    const hit = canonicalSet.get(candidate) ?? aliases[candidate];
    if (hit) return hit;
  }

  // 2. Containment: "gazipur sadar north" contains "gazipur".
  for (const candidate of stripSuffixes(norm)) {
    if (candidate.length < 4) continue;
    for (const [key, canonical] of canonicalSet) {
      if (candidate.includes(key)) return canonical;
    }
    for (const [key, canonical] of Object.entries(aliases)) {
      if (key.length >= 4 && candidate.includes(key)) return canonical;
    }
  }
  return null;
}

/** Lazily built normalized-name → canonical-Bengali lookup tables. */
let divisionIndex: Map<string, string> | null = null;
let districtIndex: Map<string, string> | null = null;

function getDivisionIndex(): Map<string, string> {
  if (!divisionIndex) {
    divisionIndex = new Map();
    for (const division of BD_DIVISION_LIST) divisionIndex.set(normalizeName(division), division);
  }
  return divisionIndex;
}

function getDistrictIndex(): Map<string, string> {
  if (!districtIndex) {
    districtIndex = new Map();
    for (const districts of Object.values(BD_DIVISIONS)) {
      for (const district of districts) districtIndex.set(normalizeName(district), district);
    }
  }
  return districtIndex;
}

/** Maps a free-text division name (e.g. "Dhaka Division") to its Bengali form. */
export function matchDivision(raw: string | undefined | null): string | null {
  return matchInAliases(raw, getDivisionIndex(), DIVISION_ALIASES);
}

/** Maps a free-text district name (e.g. "Gazipur District") to its Bengali form. */
export function matchDistrict(raw: string | undefined | null): string | null {
  return matchInAliases(raw, getDistrictIndex(), DISTRICT_ALIASES);
}

/** Reverse lookup: which division a canonical Bengali district belongs to. */
export function divisionOf(district: string): string | null {
  for (const [division, districts] of Object.entries(BD_DIVISIONS)) {
    if (districts.includes(district)) return division;
  }
  return null;
}
