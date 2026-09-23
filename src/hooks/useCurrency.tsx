import { createContext, useContext, useState, useEffect, useCallback, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";

interface CurrencyContextType {
  currency: string;
  setCurrency: (c: string) => void;
  rates: Record<string, number>;
  convert: (eurAmount: number) => number;
  symbol: string;
  formatPrice: (eurAmount: number) => string;
  loading: boolean;
}

const SYMBOLS: Record<string, string> = {
  EUR: "€", USD: "$", GBP: "£", ILS: "₪", CAD: "C$", AUD: "A$",
  JPY: "¥", CHF: "CHF", SEK: "kr", NOK: "kr", DKK: "kr", PLN: "zł",
  CZK: "Kč", HUF: "Ft", RON: "lei", BGN: "лв", HRK: "kn", TRY: "₺",
  BRL: "R$", MXN: "MX$", ARS: "AR$", CLP: "CL$", COP: "COL$",
  INR: "₹", KRW: "₩", CNY: "¥", THB: "฿", MYR: "RM", SGD: "S$",
  IDR: "Rp", PHP: "₱", VND: "₫", SAR: "﷼", AED: "د.إ", QAR: "﷼",
  ZAR: "R", EGP: "E£", NGN: "₦", KES: "KSh", GHS: "GH₵",
  NZD: "NZ$", RUB: "₽", UAH: "₴",
};

export const SUPPORTED_CURRENCIES = [
  "EUR", "USD", "GBP", "ILS", "CAD", "AUD", "JPY", "CHF",
  "SEK", "NOK", "DKK", "PLN", "CZK", "HUF", "TRY", "BRL",
  "MXN", "INR", "KRW", "CNY", "THB", "SGD", "NZD", "ZAR",
  "AED", "SAR", "QAR", "RUB",
];

const CurrencyContext = createContext<CurrencyContextType>({
  currency: "EUR",
  setCurrency: () => {},
  rates: {},
  convert: (n) => n,
  symbol: "€",
  formatPrice: (n) => `€${n.toFixed(2)}`,
  loading: false,
});

const CACHE_KEY = "currency_rates";
const CACHE_TTL = 24 * 3600000; // 24 hours — exchange rates change ~once/day

export const CurrencyProvider = ({ children }: { children: ReactNode }) => {
  const [currency, setCurrencyState] = useState(() => localStorage.getItem("preferred_currency") || "EUR");
  const [rates, setRates] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(false);

  const setCurrency = (c: string) => {
    setCurrencyState(c);
    localStorage.setItem("preferred_currency", c);
  };

  useEffect(() => {
    const fetchRates = async () => {
      // Check cache
      const cached = localStorage.getItem(CACHE_KEY);
      if (cached) {
        try {
          const { rates: cachedRates, timestamp } = JSON.parse(cached);
          if (Date.now() - timestamp < CACHE_TTL) {
            setRates(cachedRates);
            return;
          }
        } catch {}
      }

      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("exchange-rates");
        if (error) throw error;

        if (data?.rates) {
          setRates(data.rates);
          localStorage.setItem(CACHE_KEY, JSON.stringify({ rates: data.rates, timestamp: Date.now() }));
        }
      } catch (e) {
        console.error("Failed to fetch exchange rates:", e);
      }
      setLoading(false);
    };
    fetchRates();
  }, []);

  const convert = useCallback((eurAmount: number) => {
    if (currency === "EUR") return eurAmount;
    const rate = rates[currency];
    if (!rate) return eurAmount;
    return eurAmount * rate;
  }, [currency, rates]);

  const symbol = SYMBOLS[currency] || currency;

  const formatPrice = useCallback((eurAmount: number) => {
    const converted = convert(eurAmount);
    if (currency === "JPY" || currency === "KRW") {
      return `${symbol}${Math.round(converted)}`;
    }
    return `${symbol}${converted.toFixed(2)}`;
  }, [convert, currency, symbol]);

  return (
    <CurrencyContext.Provider value={{ currency, setCurrency, rates, convert, symbol, formatPrice, loading }}>
      {children}
    </CurrencyContext.Provider>
  );
};

export const useCurrency = () => useContext(CurrencyContext);
