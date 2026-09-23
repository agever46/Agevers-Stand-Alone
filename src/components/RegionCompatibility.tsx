import { useState, useEffect } from "react";
import { AlertTriangle, CheckCircle, Globe, ChevronDown, ChevronUp, MapPin } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

// Map regions to the countries they include
const REGION_COUNTRIES: Record<string, string[]> = {
  "Global": [],
  "Worldwide": [],
  "Europe": [
    "Austria", "Belgium", "Bulgaria", "Croatia", "Cyprus", "Czech Republic", "Denmark",
    "Estonia", "Finland", "France", "Germany", "Greece", "Hungary", "Iceland", "Ireland",
    "Italy", "Latvia", "Lithuania", "Luxembourg", "Malta", "Netherlands", "Norway",
    "Poland", "Portugal", "Romania", "Slovakia", "Slovenia", "Spain", "Sweden",
    "Switzerland", "United Kingdom"
  ],
  "North America": ["United States", "Canada", "Mexico"],
  "Latin America": [
    "Argentina", "Bolivia", "Brazil", "Chile", "Colombia", "Costa Rica", "Cuba",
    "Dominican Republic", "Ecuador", "El Salvador", "Guatemala", "Honduras", "Mexico",
    "Nicaragua", "Panama", "Paraguay", "Peru", "Puerto Rico", "Uruguay", "Venezuela"
  ],
  "Middle East": [
    "Bahrain", "Egypt", "Iran", "Iraq", "Israel", "Jordan", "Kuwait", "Lebanon",
    "Oman", "Palestine", "Qatar", "Saudi Arabia", "Syria", "Turkey", "United Arab Emirates", "Yemen"
  ],
  "Southeast Asia": [
    "Brunei", "Cambodia", "Indonesia", "Laos", "Malaysia", "Myanmar", "Philippines",
    "Singapore", "Thailand", "Vietnam"
  ],
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
    "Tuvalu", "Turkey", "Uganda", "Vanuatu", "Vietnam", "Yemen", "Zambia", "Zimbabwe"
  ],
  "United States": ["United States"],
  "United Kingdom": ["United Kingdom"],
  "France": ["France"],
  "Germany": ["Germany"],
  "Italy": ["Italy"],
  "Spain": ["Spain"],
  "Poland": ["Poland"],
  "Czech Republic": ["Czech Republic"],
  "Russia": ["Russia"],
  "Turkey": ["Turkey"],
  "Argentina": ["Argentina"],
  "Brazil": ["Brazil"],
  "Australia": ["Australia"],
  "Japan": ["Japan"],
  "South Korea": ["South Korea"],
  "China": ["China"],
  "India": ["India"],
  "Canada": ["Canada"],
  "Mexico": ["Mexico"],
  "New Zealand": ["New Zealand"],
  "Hong Kong": ["Hong Kong"],
  "Kuwait": ["Kuwait"],
  "Bahrain": ["Bahrain"],
  "Oman": ["Oman"],
  "Qatar": ["Qatar"],
  "Lebanon": ["Lebanon"],
  "Jordan": ["Jordan"],
  "Iraq": ["Iraq"],
  "Egypt": ["Egypt"],
  "UAE": ["United Arab Emirates"],
  "Ukraine": ["Ukraine"],
  "Uruguay": ["Uruguay"],
  "Costa Rica": ["Costa Rica"],
  "Singapore": ["Singapore"],
  "Colombia": ["Colombia"],
  "Luxembourg": ["Luxembourg"],
  "Cyprus": ["Cyprus"],
  "Slovakia": ["Slovakia"],
  "Slovenia": ["Slovenia"],
  "Finland": ["Finland"],
  "Denmark": ["Denmark"],
  "Sweden": ["Sweden"],
  "Norway": ["Norway"],
  "Switzerland": ["Switzerland"],
  "Belgium": ["Belgium"],
  "Netherlands": ["Netherlands"],
  "Austria": ["Austria"],
  "Portugal": ["Portugal"],
  "Romania": ["Romania"],
  "Hungary": ["Hungary"],
  "Croatia": ["Croatia"],
  "Chile": ["Chile"],
  "Peru": ["Peru"],
  "Indonesia": ["Indonesia"],
  "Philippines": ["Philippines"],
  "Malaysia": ["Malaysia"],
  "Thailand": ["Thailand"],
  "Vietnam": ["Vietnam"],
  "Taiwan": ["Taiwan"],
};

// Map country codes from timezone/locale to country names
const LOCALE_TO_COUNTRY: Record<string, string> = {
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
  "CL": "Chile", "CO": "Colombia", "PE": "Peru", "VE": "Venezuela",
  "EC": "Ecuador", "UY": "Uruguay", "PY": "Paraguay", "BO": "Bolivia",
  "CR": "Costa Rica", "PA": "Panama", "GT": "Guatemala", "HN": "Honduras",
  "SV": "El Salvador", "NI": "Nicaragua", "DO": "Dominican Republic", "CU": "Cuba",
  "PR": "Puerto Rico", "AU": "Australia", "NZ": "New Zealand", "JP": "Japan",
  "KR": "South Korea", "CN": "China", "IN": "India", "HK": "Hong Kong",
  "SG": "Singapore", "MY": "Malaysia", "TH": "Thailand", "ID": "Indonesia",
  "PH": "Philippines", "VN": "Vietnam", "KH": "Cambodia", "MM": "Myanmar",
  "SA": "Saudi Arabia", "AE": "United Arab Emirates", "QA": "Qatar",
  "KW": "Kuwait", "BH": "Bahrain", "OM": "Oman", "JO": "Jordan",
  "LB": "Lebanon", "IQ": "Iraq", "IR": "Iran", "EG": "Egypt",
  "PS": "Palestine", "SY": "Syria", "YE": "Yemen",
};

function detectUserCountry(): string | null {
  try {
    // Try Intl API
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // Simple timezone-to-country mapping for common cases
    const tzMap: Record<string, string> = {
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
    if (tzMap[tz]) return tzMap[tz];

    // Try navigator.language
    const lang = navigator.language || "";
    const parts = lang.split("-");
    if (parts.length >= 2) {
      const code = parts[parts.length - 1].toUpperCase();
      if (LOCALE_TO_COUNTRY[code]) return LOCALE_TO_COUNTRY[code];
    }
  } catch {}
  return null;
}

function isRegionCompatible(region: string, userCountry: string): boolean {
  if (region === "Global" || region === "Worldwide") return true;

  const countries = REGION_COUNTRIES[region];
  if (countries && countries.length > 0) {
    return countries.includes(userCountry);
  }
  
  // If region is not in our map, treat it as a country name and compare directly
  // This handles cases like "Bulgaria", "Saudi Arabia", etc. that aren't explicitly listed
  return region.toLowerCase() === userCountry.toLowerCase();
}

interface RegionCompatibilityProps {
  region: string;
}

export default function RegionCompatibility({ region }: RegionCompatibilityProps) {
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [showCountries, setShowCountries] = useState(false);

  useEffect(() => {
    setUserCountry(detectUserCountry());
  }, []);

  if (region === "Global" || region === "Worldwide") {
    return (
      <div className="rounded-lg border border-neon-green/30 bg-neon-green/5 p-3 mt-3">
        <div className="flex items-center gap-2">
          <Globe className="h-4 w-4 text-neon-green shrink-0" />
          <div>
            <p className="text-sm font-medium text-neon-green">Works worldwide</p>
            <p className="text-xs text-muted-foreground mt-0.5">This product can be activated in any country</p>
          </div>
        </div>
      </div>
    );
  }

  if (!userCountry) return null;

  const compatible = isRegionCompatible(region, userCountry);
  const countries = REGION_COUNTRIES[region] || (region !== userCountry ? [region] : []);

  return (
    <div className={`rounded-lg border p-3 mt-3 ${
      compatible
        ? "border-neon-green/30 bg-neon-green/5"
        : "border-yellow-500/30 bg-yellow-500/5"
    }`}>
      <div className="flex items-start gap-2">
        {compatible ? (
          <CheckCircle className="h-4 w-4 text-neon-green mt-0.5 shrink-0" />
        ) : (
          <AlertTriangle className="h-4 w-4 text-yellow-500 mt-0.5 shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-medium ${compatible ? "text-neon-green" : "text-yellow-500"}`}>
            {compatible
              ? `This product can be activated in ${userCountry}`
              : `This product may not work in ${userCountry}`
            }
          </p>
          <p className="text-xs text-muted-foreground mt-0.5">
            {compatible
              ? `Region: ${region}`
              : `This key is region-locked to ${region}.`
            }
          </p>

          {!compatible && countries.length > 0 && (
            <button
              onClick={() => setShowCountries(!showCountries)}
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 mt-1.5 transition-colors"
            >
              <MapPin className="h-3 w-3" />
              {showCountries ? "Hide" : "See"} compatible countries
              {showCountries ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>
          )}

          <AnimatePresence>
            {showCountries && countries.length > 0 && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {countries.map((c) => (
                    <span
                      key={c}
                      className="text-[11px] px-2 py-0.5 rounded-full bg-secondary text-foreground/80 border border-border/50"
                    >
                      {c}
                    </span>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}
