import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Gift, Copy, Check, Users, Flame } from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const generateCode = () => {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "REF-";
  for (let i = 0; i < 6; i++) code += chars[Math.floor(Math.random() * chars.length)];
  return code;
};

const ReferralCard = () => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [stats, setStats] = useState({ total_referrals: 0, total_coins_earned: 0 });
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const { data } = await supabase
        .from("referral_codes")
        .select("code, total_referrals, total_coins_earned")
        .eq("user_id", user.id)
        .maybeSingle();

      if (data) {
        setReferralCode(data.code);
        setStats({ total_referrals: data.total_referrals, total_coins_earned: data.total_coins_earned });
      } else {
        const newCode = generateCode();
        const { error } = await supabase.from("referral_codes").insert({ user_id: user.id, code: newCode });
        if (!error) setReferralCode(newCode);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const shareUrl = referralCode
    ? `${window.location.origin}/auth?ref=${referralCode}`
    : "";

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      toast.success(t("account.referral.toast.copied"));
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(t("account.referral.toast.copyFailed"));
    }
  };

  if (loading) return null;

  return (
    <div className="glass rounded-xl p-6 border border-primary/20 bg-gradient-to-r from-primary/5 to-purple-500/5">
      <div className="flex items-center gap-3 mb-4">
        <div className="h-10 w-10 rounded-full bg-gradient-to-br from-primary to-purple-500 flex items-center justify-center">
          <Gift className="h-5 w-5 text-white" />
        </div>
        <div>
          <h3 className="font-display text-sm font-bold tracking-wider text-foreground">{t("account.referral.title")}</h3>
          <p className="text-xs text-muted-foreground">{t("account.referral.subtitle")}</p>
        </div>
      </div>

      {/* Share link */}
      <div className="flex items-center gap-2 mb-4">
        <div className="flex-1 min-w-0 bg-background/50 rounded-lg px-3 py-2.5 border border-border/50">
          <p className="text-xs text-muted-foreground truncate font-mono">{shareUrl}</p>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-lg bg-primary hover:bg-primary/90 text-primary-foreground text-xs font-display font-bold transition-colors shrink-0"
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          {copied ? t("account.referral.copied") : t("account.referral.copy")}
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-background/30 rounded-lg p-3 text-center">
          <Users className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="font-display text-xl font-black text-foreground">{stats.total_referrals}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("account.referral.friendsReferred")}</p>
        </div>
        <div className="bg-background/30 rounded-lg p-3 text-center">
          <Flame className="h-4 w-4 text-orange-400 mx-auto mb-1" />
          <p className="font-display text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-orange-400 to-yellow-400">
            {stats.total_coins_earned}
          </p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{t("account.referral.coinsEarned")}</p>
        </div>
      </div>
    </div>
  );
};

export default ReferralCard;
