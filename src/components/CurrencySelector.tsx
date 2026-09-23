import { useCurrency, SUPPORTED_CURRENCIES } from "@/hooks/useCurrency";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const CurrencySelector = ({ className = "" }: { className?: string }) => {
  const { currency, setCurrency } = useCurrency();

  return (
    <Select value={currency} onValueChange={setCurrency}>
      <SelectTrigger className={`w-[80px] h-8 text-xs font-display font-bold ${className}`}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent className="max-h-60 z-[2147483001]">
        {SUPPORTED_CURRENCIES.map((c) => (
          <SelectItem key={c} value={c} className="text-xs font-display">
            {c}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
};

export default CurrencySelector;
