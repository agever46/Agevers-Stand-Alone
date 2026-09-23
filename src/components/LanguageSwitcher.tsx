import { useTranslation } from "react-i18next";
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select";
import { SUPPORTED_LANGUAGES } from "@/i18n";
import { Globe } from "lucide-react";

const LanguageSwitcher = ({ className = "" }: { className?: string }) => {
  const { i18n } = useTranslation();
  const current = (i18n.resolvedLanguage || i18n.language || "en").slice(0, 2);

  return (
    <div className="flex items-center gap-2">
      <Select value={current} onValueChange={(v) => i18n.changeLanguage(v)}>
        <SelectTrigger
          className={`h-8 w-auto min-w-[84px] px-3 text-xs font-display font-bold gap-1.5 ${className}`}
          aria-label="Language selector"
        >
          <Globe className="h-3.5 w-3.5 shrink-0" />
          <span className="uppercase leading-none">{current}</span>
        </SelectTrigger>
        <SelectContent className="z-[2147483001]">
          {SUPPORTED_LANGUAGES.map((l) => (
            <SelectItem key={l.code} value={l.code} className="text-xs font-display">
              {l.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
};

export default LanguageSwitcher;