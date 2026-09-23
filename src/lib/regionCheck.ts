// Reuse region compatibility logic for cart/buy warnings

const REGION_COUNTRIES: Record<string, string[]> = {
  "Global": [], "Worldwide": [],
  // "Rest of World" keys are region-locked to a specific, curated country
  // list that (per Kinguin's own product pages) typically EXCLUDES Israel
  // and several other countries — it is not a synonym for "everywhere".
  // Kept in sync with the list in RegionCompatibility.tsx.
  "Rest of World": [
    "Afghanistan", "Albania", "Algeria", "Angola", "Bangladesh", "Benin", "Bhutan",
    "Bosnia and Herzegovina", "Botswana", "Brunei", "Burkina Faso", "Burundi", "Cambodia",
    "Cameroon", "Cape Verde", "Central African Republic", "Chad", "Comoros", "Congo",
    "Côte d'Ivoire", "Djibouti", "Dominica", "Dominican Republic", "Egypt",
    "Equatorial Guinea", "Eritrea", "Eswatini", "Ethiopia", "Gabon", "Gambia", "Ghana",
    "Guinea", "Guinea-Bissau", "Haiti", "India", "Indonesia", "Iraq", "Jamaica", "Jordan",
    "Kenya", "Kiribati", "Laos", "Lebanon", "Lesotho", "Liberia", "Libya", "Madagascar",
    "Malawi", "Malaysia", "Maldives", "Mali", "Mauritania", "Mauritius", "Mongolia",
    "Morocco", "Mozambique", "Myanmar", "Namibia", "Nauru", "Nepal", "Niger", "Nigeria",
    "North Macedonia", "Pakistan", "Palestine", "Papua New Guinea", "Philippines",
    "Puerto Rico", "Rwanda", "Samoa", "Senegal", "Serbia", "Seychelles", "Sierra Leone",
    "Somalia", "South Africa", "Sri Lanka", "Sudan", "Syria", "Tanzania", "Thailand",
    "Timor-Leste", "Togo", "Tonga", "Trinidad and Tobago", "Tunisia", "Turkmenistan",
    "Tuvalu", "Turkey", "Uganda", "Vanuatu", "Vietnam", "Yemen", "Zambia", "Zimbabwe",
  ],
  "Europe": [
    "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark",
    "Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland",
    "Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Norway",
    "Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden",
    "Switzerland","United Kingdom",
  ],
  "North America": ["United States","Canada","Mexico"],
  "Latin America": [
    "Argentina","Bolivia","Brazil","Chile","Colombia","Costa Rica","Cuba",
    "Dominican Republic","Ecuador","El Salvador","Guatemala","Honduras","Mexico",
    "Nicaragua","Panama","Paraguay","Peru","Uruguay","Venezuela",
  ],
  "Middle East": [
    "Bahrain","Egypt","Iran","Iraq","Israel","Jordan","Kuwait","Lebanon",
    "Oman","Palestine","Qatar","Saudi Arabia","Turkey","United Arab Emirates","Yemen",
  ],
  "Southeast Asia": [
    "Brunei","Cambodia","Indonesia","Laos","Malaysia","Myanmar","Philippines",
    "Singapore","Thailand","Vietnam",
  ],
  "EU/NA": [
    "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark",
    "Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland",
    "Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Norway",
    "Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden",
    "Switzerland","United Kingdom","United States","Canada","Mexico",
  ],
  "EMEA": [
    "Austria","Belgium","Bulgaria","Croatia","Cyprus","Czech Republic","Denmark",
    "Estonia","Finland","France","Germany","Greece","Hungary","Iceland","Ireland",
    "Italy","Latvia","Lithuania","Luxembourg","Malta","Netherlands","Norway",
    "Poland","Portugal","Romania","Slovakia","Slovenia","Spain","Sweden",
    "Switzerland","United Kingdom","Bahrain","Egypt","Iran","Iraq","Israel","Jordan",
    "Kuwait","Lebanon","Oman","Palestine","Qatar","Saudi Arabia","Turkey",
    "United Arab Emirates","Yemen","South Africa","Nigeria","Kenya",
  ],
};

const TZ_MAP: Record<string, string> = {
  "Asia/Jerusalem": "Israel", "Asia/Tel_Aviv": "Israel",
  "America/New_York": "United States", "America/Chicago": "United States",
  "America/Denver": "United States", "America/Los_Angeles": "United States",
  "Europe/London": "United Kingdom", "Europe/Paris": "France",
  "Europe/Berlin": "Germany", "Europe/Rome": "Italy", "Europe/Madrid": "Spain",
  "Europe/Warsaw": "Poland", "Europe/Prague": "Czech Republic",
  "Europe/Moscow": "Russia", "Europe/Istanbul": "Turkey",
  "America/Argentina/Buenos_Aires": "Argentina", "America/Sao_Paulo": "Brazil",
  "Australia/Sydney": "Australia", "Asia/Tokyo": "Japan",
  "Asia/Seoul": "South Korea", "Asia/Shanghai": "China",
  "Asia/Kolkata": "India", "Asia/Hong_Kong": "Hong Kong",
  "America/Toronto": "Canada", "America/Mexico_City": "Mexico",
  "Pacific/Auckland": "New Zealand", "Asia/Singapore": "Singapore",
  "Asia/Bangkok": "Thailand", "Asia/Jakarta": "Indonesia",
  "Asia/Manila": "Philippines", "Asia/Ho_Chi_Minh": "Vietnam",
  "Asia/Riyadh": "Saudi Arabia", "Asia/Dubai": "United Arab Emirates",
  "Europe/Amsterdam": "Netherlands", "Europe/Brussels": "Belgium",
  "Europe/Vienna": "Austria", "Europe/Zurich": "Switzerland",
  "Europe/Stockholm": "Sweden", "Europe/Oslo": "Norway",
  "Europe/Copenhagen": "Denmark", "Europe/Helsinki": "Finland",
  "Europe/Dublin": "Ireland", "Europe/Athens": "Greece",
  "Europe/Bucharest": "Romania", "Europe/Budapest": "Hungary",
  "Europe/Sofia": "Bulgaria", "Europe/Zagreb": "Croatia",
  "Europe/Ljubljana": "Slovenia", "Europe/Bratislava": "Slovakia",
  "Europe/Vilnius": "Lithuania", "Europe/Riga": "Latvia",
  "Europe/Tallinn": "Estonia", "Europe/Luxembourg": "Luxembourg",
  "Europe/Lisbon": "Portugal",
  "America/Bogota": "Colombia", "America/Lima": "Peru",
  "America/Santiago": "Chile", "America/Caracas": "Venezuela",
  "America/Montevideo": "Uruguay",
};

const LOCALE_MAP: Record<string, string> = {
  "IL": "Israel", "US": "United States", "GB": "United Kingdom", "UK": "United Kingdom",
  "FR": "France", "DE": "Germany", "IT": "Italy", "ES": "Spain", "PT": "Portugal",
  "NL": "Netherlands", "BE": "Belgium", "AT": "Austria", "CH": "Switzerland",
  "PL": "Poland", "CZ": "Czech Republic", "SK": "Slovakia", "HU": "Hungary",
  "RO": "Romania", "BG": "Bulgaria", "HR": "Croatia", "SI": "Slovenia",
  "SE": "Sweden", "NO": "Norway", "DK": "Denmark", "FI": "Finland",
  "IE": "Ireland", "GR": "Greece", "CY": "Cyprus", "MT": "Malta",
  "LT": "Lithuania", "LV": "Latvia", "EE": "Estonia", "LU": "Luxembourg",
  "IS": "Iceland", "RU": "Russia", "UA": "Ukraine", "TR": "Turkey",
  "CA": "Canada", "MX": "Mexico", "BR": "Brazil", "AR": "Argentina",
  "CL": "Chile", "CO": "Colombia", "PE": "Peru", "AU": "Australia",
  "NZ": "New Zealand", "JP": "Japan", "KR": "South Korea", "CN": "China",
  "IN": "India", "HK": "Hong Kong", "SG": "Singapore", "MY": "Malaysia",
  "TH": "Thailand", "ID": "Indonesia", "PH": "Philippines", "VN": "Vietnam",
  "SA": "Saudi Arabia", "AE": "United Arab Emirates", "QA": "Qatar",
  "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman", "JO": "Jordan",
  "LB": "Lebanon", "IQ": "Iraq", "EG": "Egypt", "PS": "Palestine",
};

let cachedCountry: string | null | undefined;

export function detectUserCountry(): string | null {
  if (cachedCountry !== undefined) return cachedCountry;
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (TZ_MAP[tz]) { cachedCountry = TZ_MAP[tz]; return cachedCountry; }
    const lang = navigator.language || "";
    const parts = lang.split("-");
    if (parts.length >= 2) {
      const code = parts[parts.length - 1].toUpperCase();
      if (LOCALE_MAP[code]) { cachedCountry = LOCALE_MAP[code]; return cachedCountry; }
    }
  } catch {}
  cachedCountry = null;
  return null;
}

export function isRegionCompatible(region: string, userCountry: string): boolean {
  if (!region || region === "Global" || region === "Worldwide") return true;
  const countries = REGION_COUNTRIES[region];
  if (countries && countries.length > 0) return countries.includes(userCountry);
  return region.toLowerCase() === userCountry.toLowerCase();
}
