import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Receipt, TrendingUp, Percent, Euro } from "lucide-react";
import AgeversLoader from "@/components/AgeversLoader";

interface Sale {
  id: string;
  order_number: number;
  product_title: string;
  platform: string;
  sale_amount: number;
  commission_rate: number;
  commission_amount: number;
  net_earnings: number;
  status: string;
  created_at: string;
}

const SellerSales = () => {
  const { user } = useAuth();
  const [sales, setSales] = useState<Sale[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase
      .from("seller_sales")
      .select("*")
      .eq("seller_id", user.id)
      .order("created_at", { ascending: false })
      .then(({ data }) => {
        if (data) setSales(data as any);
        setLoading(false);
      });
  }, [user]);

  const totalSales = sales.reduce((sum, s) => sum + Number(s.sale_amount), 0);
  const totalCommission = sales.reduce((sum, s) => sum + Number(s.commission_amount), 0);
  const totalEarnings = sales.reduce((sum, s) => sum + Number(s.net_earnings), 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <AgeversLoader />
      </div>
    );
  }

  return (
    <div>
      <h2 className="font-display text-2xl font-black tracking-wider text-foreground mb-6">MY SALES</h2>

      {/* Summary cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center">
              <Euro className="h-5 w-5 text-primary" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Total Sales</p>
          </div>
          <p className="font-display text-2xl font-black text-foreground">€{totalSales.toFixed(2)}</p>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-destructive/20 flex items-center justify-center">
              <Percent className="h-5 w-5 text-destructive" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Commission</p>
          </div>
          <p className="font-display text-2xl font-black text-destructive">€{totalCommission.toFixed(2)}</p>
        </div>

        <div className="glass rounded-xl p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="h-9 w-9 rounded-lg bg-neon-green/20 flex items-center justify-center">
              <TrendingUp className="h-5 w-5 text-neon-green" />
            </div>
            <p className="font-display text-xs font-bold tracking-widest text-muted-foreground uppercase">Net Earnings</p>
          </div>
          <p className="font-display text-2xl font-black text-neon-green">€{totalEarnings.toFixed(2)}</p>
        </div>
      </div>

      {/* Sales table */}
      {sales.length === 0 ? (
        <div className="text-center py-16 glass rounded-xl">
          <Receipt className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground font-display">No sales yet</p>
          <p className="text-sm text-muted-foreground mt-1">Your sales will appear here once customers purchase your products.</p>
        </div>
      ) : (
        <div className="overflow-x-auto glass rounded-xl">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border/50">
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Order #</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Product</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Platform</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Sale Amount</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Commission</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Earnings</th>
                <th className="text-left p-4 font-display text-xs tracking-wider text-muted-foreground uppercase">Date</th>
              </tr>
            </thead>
            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-b border-border/30 hover:bg-secondary/30 transition-colors">
                  <td className="p-4 text-primary font-bold">#{sale.order_number}</td>
                  <td className="p-4 text-foreground font-medium">{sale.product_title}</td>
                  <td className="p-4 text-muted-foreground">{sale.platform}</td>
                  <td className="p-4 text-foreground font-semibold">€{Number(sale.sale_amount).toFixed(2)}</td>
                  <td className="p-4 text-destructive">
                    -€{Number(sale.commission_amount).toFixed(2)}
                    <span className="text-muted-foreground text-xs ml-1">({(Number(sale.commission_rate) * 100).toFixed(0)}%)</span>
                  </td>
                  <td className="p-4 text-neon-green font-semibold">€{Number(sale.net_earnings).toFixed(2)}</td>
                  <td className="p-4 text-muted-foreground text-xs">
                    {new Date(sale.created_at).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default SellerSales;
