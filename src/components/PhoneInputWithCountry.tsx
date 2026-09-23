import { useState, useMemo, useRef, useEffect } from "react";
import { ChevronDown, Search } from "lucide-react";

const COUNTRIES = [
  { name: "Israel", code: "IL", dial: "+972" },
  { name: "United States", code: "US", dial: "+1" },
  { name: "United Kingdom", code: "GB", dial: "+44" },
  { name: "Germany", code: "DE", dial: "+49" },
  { name: "France", code: "FR", dial: "+33" },
  { name: "Italy", code: "IT", dial: "+39" },
  { name: "Spain", code: "ES", dial: "+34" },
  { name: "Netherlands", code: "NL", dial: "+31" },
  { name: "Belgium", code: "BE", dial: "+32" },
  { name: "Switzerland", code: "CH", dial: "+41" },
  { name: "Austria", code: "AT", dial: "+43" },
  { name: "Sweden", code: "SE", dial: "+46" },
  { name: "Norway", code: "NO", dial: "+47" },
  { name: "Denmark", code: "DK", dial: "+45" },
  { name: "Finland", code: "FI", dial: "+358" },
  { name: "Poland", code: "PL", dial: "+48" },
  { name: "Portugal", code: "PT", dial: "+351" },
  { name: "Greece", code: "GR", dial: "+30" },
  { name: "Czech Republic", code: "CZ", dial: "+420" },
  { name: "Romania", code: "RO", dial: "+40" },
  { name: "Hungary", code: "HU", dial: "+36" },
  { name: "Ireland", code: "IE", dial: "+353" },
  { name: "Turkey", code: "TR", dial: "+90" },
  { name: "Russia", code: "RU", dial: "+7" },
  { name: "Ukraine", code: "UA", dial: "+380" },
  { name: "Canada", code: "CA", dial: "+1" },
  { name: "Mexico", code: "MX", dial: "+52" },
  { name: "Brazil", code: "BR", dial: "+55" },
  { name: "Argentina", code: "AR", dial: "+54" },
  { name: "Colombia", code: "CO", dial: "+57" },
  { name: "Chile", code: "CL", dial: "+56" },
  { name: "Peru", code: "PE", dial: "+51" },
  { name: "Australia", code: "AU", dial: "+61" },
  { name: "New Zealand", code: "NZ", dial: "+64" },
  { name: "Japan", code: "JP", dial: "+81" },
  { name: "South Korea", code: "KR", dial: "+82" },
  { name: "China", code: "CN", dial: "+86" },
  { name: "India", code: "IN", dial: "+91" },
  { name: "Thailand", code: "TH", dial: "+66" },
  { name: "Singapore", code: "SG", dial: "+65" },
  { name: "Malaysia", code: "MY", dial: "+60" },
  { name: "Philippines", code: "PH", dial: "+63" },
  { name: "Indonesia", code: "ID", dial: "+62" },
  { name: "Vietnam", code: "VN", dial: "+84" },
  { name: "Pakistan", code: "PK", dial: "+92" },
  { name: "Bangladesh", code: "BD", dial: "+880" },
  { name: "Saudi Arabia", code: "SA", dial: "+966" },
  { name: "UAE", code: "AE", dial: "+971" },
  { name: "Qatar", code: "QA", dial: "+974" },
  { name: "Kuwait", code: "KW", dial: "+965" },
  { name: "Bahrain", code: "BH", dial: "+973" },
  { name: "Oman", code: "OM", dial: "+968" },
  { name: "Jordan", code: "JO", dial: "+962" },
  { name: "Lebanon", code: "LB", dial: "+961" },
  { name: "Egypt", code: "EG", dial: "+20" },
  { name: "Morocco", code: "MA", dial: "+212" },
  { name: "Tunisia", code: "TN", dial: "+216" },
  { name: "South Africa", code: "ZA", dial: "+27" },
  { name: "Nigeria", code: "NG", dial: "+234" },
  { name: "Kenya", code: "KE", dial: "+254" },
  { name: "Ghana", code: "GH", dial: "+233" },
  { name: "Ethiopia", code: "ET", dial: "+251" },
  { name: "Tanzania", code: "TZ", dial: "+255" },
  { name: "Uganda", code: "UG", dial: "+256" },
  { name: "Iceland", code: "IS", dial: "+354" },
  { name: "Luxembourg", code: "LU", dial: "+352" },
  { name: "Croatia", code: "HR", dial: "+385" },
  { name: "Serbia", code: "RS", dial: "+381" },
  { name: "Bulgaria", code: "BG", dial: "+359" },
  { name: "Slovakia", code: "SK", dial: "+421" },
  { name: "Slovenia", code: "SI", dial: "+386" },
  { name: "Lithuania", code: "LT", dial: "+370" },
  { name: "Latvia", code: "LV", dial: "+371" },
  { name: "Estonia", code: "EE", dial: "+372" },
  { name: "Cyprus", code: "CY", dial: "+357" },
  { name: "Malta", code: "MT", dial: "+356" },
  { name: "Georgia", code: "GE", dial: "+995" },
  { name: "Armenia", code: "AM", dial: "+374" },
  { name: "Azerbaijan", code: "AZ", dial: "+994" },
  { name: "Kazakhstan", code: "KZ", dial: "+7" },
  { name: "Uzbekistan", code: "UZ", dial: "+998" },
  { name: "Taiwan", code: "TW", dial: "+886" },
  { name: "Hong Kong", code: "HK", dial: "+852" },
  { name: "Macau", code: "MO", dial: "+853" },
  { name: "Sri Lanka", code: "LK", dial: "+94" },
  { name: "Nepal", code: "NP", dial: "+977" },
  { name: "Cambodia", code: "KH", dial: "+855" },
  { name: "Myanmar", code: "MM", dial: "+95" },
  { name: "Iraq", code: "IQ", dial: "+964" },
  { name: "Libya", code: "LY", dial: "+218" },
  { name: "Algeria", code: "DZ", dial: "+213" },
  { name: "Ecuador", code: "EC", dial: "+593" },
  { name: "Venezuela", code: "VE", dial: "+58" },
  { name: "Uruguay", code: "UY", dial: "+598" },
  { name: "Paraguay", code: "PY", dial: "+595" },
  { name: "Bolivia", code: "BO", dial: "+591" },
  { name: "Costa Rica", code: "CR", dial: "+506" },
  { name: "Panama", code: "PA", dial: "+507" },
  { name: "Dominican Republic", code: "DO", dial: "+1" },
  { name: "Puerto Rico", code: "PR", dial: "+1" },
  { name: "Jamaica", code: "JM", dial: "+1" },
  { name: "Cuba", code: "CU", dial: "+53" },
  { name: "Guatemala", code: "GT", dial: "+502" },
  { name: "Honduras", code: "HN", dial: "+504" },
  { name: "El Salvador", code: "SV", dial: "+503" },
  { name: "Nicaragua", code: "NI", dial: "+505" },
  { name: "Albania", code: "AL", dial: "+355" },
  { name: "North Macedonia", code: "MK", dial: "+389" },
  { name: "Bosnia & Herzegovina", code: "BA", dial: "+387" },
  { name: "Montenegro", code: "ME", dial: "+382" },
  { name: "Moldova", code: "MD", dial: "+373" },
  { name: "Belarus", code: "BY", dial: "+375" },
];

const flagEmoji = (code: string) => {
  const base = 0x1f1e6;
  return String.fromCodePoint(
    base + code.charCodeAt(0) - 65,
    base + code.charCodeAt(1) - 65
  );
};

interface PhoneInputWithCountryProps {
  value: string;
  onChange: (fullPhone: string) => void;
  required?: boolean;
  autoFocus?: boolean;
  className?: string;
  inputClassName?: string;
}

const PhoneInputWithCountry = ({
  value,
  onChange,
  required,
  autoFocus,
  className = "",
  inputClassName = "",
}: PhoneInputWithCountryProps) => {
  // Parse initial value to extract country code
  const findCountryFromValue = (val: string) => {
    if (!val) return COUNTRIES[0]; // Israel default
    for (const c of [...COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)) {
      if (val.startsWith(c.dial)) return c;
    }
    return COUNTRIES[0];
  };

  const [selectedCountry, setSelectedCountry] = useState(() => findCountryFromValue(value));
  const [localNumber, setLocalNumber] = useState(() => {
    const c = findCountryFromValue(value);
    return value.startsWith(c.dial) ? value.slice(c.dial.length) : value.replace(/^\+?\d*/, "");
  });
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES;
    const q = search.toLowerCase();
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.dial.includes(q) || c.code.toLowerCase().includes(q)
    );
  }, [search]);

  const handleCountrySelect = (country: typeof COUNTRIES[0]) => {
    setSelectedCountry(country);
    setOpen(false);
    setSearch("");
    onChange(country.dial + localNumber.replace(/\D/g, ""));
  };

  const handleNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const digits = e.target.value.replace(/\D/g, "");
    setLocalNumber(digits);
    onChange(selectedCountry.dial + digits);
  };

  return (
    <div className={`flex gap-1.5 ${className}`}>
      <div className="relative" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(!open)}
          className="h-10 px-2 rounded-md bg-secondary border border-border text-sm text-foreground font-body flex items-center gap-1 hover:bg-muted transition-colors min-w-[90px]"
        >
          <span className="text-base">{flagEmoji(selectedCountry.code)}</span>
          <span className="text-xs text-muted-foreground">{selectedCountry.dial}</span>
          <ChevronDown className="h-3 w-3 text-muted-foreground shrink-0" />
        </button>

        {open && (
          <div className="phone-country-menu absolute z-50 top-full left-0 mt-1 w-64 max-h-60 rounded-md shadow-xl overflow-hidden">
            <div className="phone-country-search-wrap p-2">
              <div className="relative">
                <Search className="phone-country-search-icon absolute left-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5" />
                <input
                  ref={searchRef}
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="phone-country-search w-full h-8 pl-7 pr-2 rounded-sm text-xs focus:outline-none"
                  placeholder="Search country..."
                />
              </div>
            </div>
            <div className="phone-country-list overflow-y-auto max-h-48">
              {filtered.map((c) => (
                <button
                  type="button"
                  key={c.code + c.dial}
                  onClick={() => handleCountrySelect(c)}
                  className={`phone-country-option w-full flex items-center gap-2 px-3 py-2 text-xs transition-colors text-left ${
                    c.code === selectedCountry.code && c.dial === selectedCountry.dial
                      ? "phone-country-option-selected font-semibold"
                      : ""
                  }`}
                >
                  <span className="phone-country-flag text-sm">{flagEmoji(c.code)}</span>
                  <span className="phone-country-name truncate flex-1">{c.name}</span>
                  <span className="phone-country-dial shrink-0">{c.dial}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-3">No countries found</p>
              )}
            </div>
          </div>
        )}
      </div>

      <input
        type="tel"
        required={required}
        value={localNumber}
        onChange={handleNumberChange}
        className={`flex-1 h-10 px-3 rounded-md bg-secondary border border-border text-sm text-foreground placeholder:text-muted-foreground font-body focus:outline-none focus:ring-1 focus:ring-primary ${inputClassName}`}
        placeholder="501234567"
        autoFocus={autoFocus}
      />
    </div>
  );
};

export default PhoneInputWithCountry;
