import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Percent } from "lucide-react";

const fetchQtyDiscounts = async () => {
  const { data } = await supabase
    .from("quantity_discounts")
    .select("*")
    .eq("is_active", true)
    .order("min_quantity");
  return data || [];
};

/** Shows quantity discount badges on the product detail page */
export const QuantityDiscountBadge = () => {
  const { data: discounts = [] } = useQuery({
    queryKey: ["qty-discounts"],
    queryFn: fetchQtyDiscounts,
  });

  if (discounts.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-2">
      {discounts.map((d: any) => (
        <div
          key={d.id}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20 text-xs font-display font-bold text-primary"
        >
          <Percent className="h-3 w-3" />
          {d.label || `Buy ${d.min_quantity}+, save ${Math.round(d.discount_pct * 100)}%`}
        </div>
      ))}
    </div>
  );
};

export default QuantityDiscountBadge;
