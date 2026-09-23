import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Package, FileText, Loader2, ShieldAlert, ChevronRight, KeyRound } from "lucide-react";
import { toast } from "sonner";
import AgeversLoader from "@/components/AgeversLoader";
import { useTranslation } from "react-i18next";

interface Order {
  id: string;
  game_title: string;
  platform: string;
  price: number;
  paypal_order_id: string | null;
  status: string;
  created_at: string;
  is_held?: boolean;
  held_reason?: string | null;
}

const AccountOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [receiptLoading, setReceiptLoading] = useState<string | null>(null);
  const [receiptsEnabled, setReceiptsEnabled] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    supabase
      .from("orders")
      .select("id, game_title, platform, price, paypal_order_id, status, created_at, is_held, held_reason")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setOrders(data);
        setLoading(false);
      });
  }, [user]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase.rpc("get_public_site_flags" as any) as any);
      const row = Array.isArray(data) ? data[0] : data;
      setReceiptsEnabled(row?.receipts_enabled === true);
    })();
  }, []);

  const handleDownloadReceipt = async (orderId: string) => {
    setReceiptLoading(orderId);
    try {
      const { data, error } = await supabase.functions.invoke("generate-receipt", {
        body: { order_id: orderId, language: "en" },
      });
      if (error) throw error;
      const url = data?.pdf_original;
      if (!url) throw new Error("No receipt URL returned");
      window.open(url, "_blank", "noopener,noreferrer");
      toast.success(t("account.orders.toast.receiptReady"));
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to generate receipt";
      toast.error(msg);
    } finally {
      setReceiptLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="font-display text-2xl font-black tracking-wider text-foreground">{t("account.orders.title")}</h2>
        <p className="text-muted-foreground text-sm mt-1">{t("account.orders.subtitle")}</p>
      </div>

      <div className="space-y-4">
        {orders.length === 0 ? (
          <div className="glass rounded-xl p-12 text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <p className="text-muted-foreground font-body">{t("account.orders.empty.title")}</p>
            <p className="text-sm text-muted-foreground/60 font-body mt-1">
              {t("account.orders.empty.subtitle")}
            </p>
          </div>
        ) : (
          orders.map((order) => {
            const underReview = order.status === "held" || order.is_held;
            return (
            <div
              key={order.id}
              className={`glass rounded-xl p-5 flex items-center justify-between gap-4 transition-all ${
                order.paypal_order_id ? "cursor-pointer hover:ring-1 hover:ring-primary/40" : ""
              }`}
              role={order.paypal_order_id ? "button" : undefined}
              onClick={() => order.paypal_order_id && navigate(`/order/${order.paypal_order_id}`)}
            >
              <div className="flex-1 min-w-0">
                <h3 className="font-display text-sm font-semibold text-foreground">{order.game_title}</h3>
                <p className="text-xs text-muted-foreground font-body mt-1">
                  {order.platform} • {new Date(order.created_at).toLocaleDateString()}
                </p>
                {order.paypal_order_id && (
                  <span className="mt-2 inline-flex items-center gap-1.5 text-xs font-display font-semibold text-primary">
                    <KeyRound className="h-3.5 w-3.5" />
                    {order.status === "completed" ? "View my code" : "Open order & reveal my code"}
                    <ChevronRight className="h-3.5 w-3.5" />
                  </span>
                )}
                {underReview && (
                  <div className="mt-2 flex items-start gap-2 rounded-md border border-yellow-500/30 bg-yellow-500/10 p-2">
                    <ShieldAlert className="h-4 w-4 text-yellow-400 shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-xs font-display font-semibold text-yellow-300">{t("account.orders.underReview.title")}</p>
                      <p className="text-[11px] text-yellow-200/70 leading-snug">
                        {t("account.orders.underReview.desc")}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className="font-display text-sm font-bold text-primary">€{order.price.toFixed(2)}</p>
                  <span className={`text-xs font-body px-2 py-0.5 rounded ${
                    order.status === "completed"
                      ? "bg-green-500/10 text-green-400"
                      : underReview
                        ? "bg-yellow-500/10 text-yellow-300"
                        : "bg-yellow-500/10 text-yellow-400"
                  }`}>
                    {underReview ? t("account.orders.status.underReview") : order.status}
                  </span>
                </div>
                {order.status === "completed" && receiptsEnabled && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDownloadReceipt(order.id);
                    }}
                    disabled={receiptLoading === order.id}
                    className="flex items-center gap-1.5 text-xs font-body px-3 py-2 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors disabled:opacity-50"
                    title={t("account.orders.receiptTitle")}
                  >
                    {receiptLoading === order.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <FileText className="h-3.5 w-3.5" />
                    )}
                    <span className="hidden sm:inline">{t("account.orders.receipt")}</span>
                  </button>
                )}
              </div>
            </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default AccountOrders;
