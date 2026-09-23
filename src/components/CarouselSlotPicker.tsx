import { KeyboardEvent, useState, useEffect, useCallback } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface Product {
  id: string;
  title: string;
  image_url: string | null;
}

const CarouselSlotPicker = ({ open, onClose, slotPosition, candidates: _legacyCandidates, onSaved }: {
  open: boolean;
  onClose: () => void;
  slotPosition: number;
  candidates: Product[];
  onSaved: () => void;
}) => {
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Product[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoaded, setInitialLoaded] = useState(false);

  const loadProducts = useCallback(async (query: string) => {
    setLoading(true);
    let q = supabase
      .from("allowed_products")
      .select("id, title, image_url")
      .not("image_url", "is", null);

    if (query.trim()) {
      q = q.ilike("title", `%${query.trim()}%`);
    } else {
      // Random-ish: order by created_at desc to get newest products
      q = q.order("created_at", { ascending: false });
    }

    const { data } = await q.limit(60);
    setResults(data || []);
    setLoading(false);
    setInitialLoaded(true);
  }, []);

  useEffect(() => {
    if (open && !initialLoaded) {
      loadProducts("");
    }
  }, [open, initialLoaded, loadProducts]);

  useEffect(() => {
    if (!open) {
      setInitialLoaded(false);
      setSearch("");
      setResults([]);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const timer = setTimeout(() => loadProducts(search), 300);
    return () => clearTimeout(timer);
  }, [search, open, loadProducts]);

  const handleSelect = async (product: Product) => {
    const {
      data: { session },
    } = await supabase.auth.getSession();
    const user = session?.user;

    if (!user) return;

    const { error } = await supabase
      .from("carousel_slots")
      .upsert(
        {
          slot_position: slotPosition,
          allowed_product_id: product.id,
          title: product.title,
          image_url: product.image_url!,
          updated_by: user.id,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "slot_position" }
      );

    if (error) {
      toast.error(`Failed to save: ${error.message}`);
      return;
    }

    toast.success(`Slot ${slotPosition + 1} updated!`);
    onSaved();
    onClose();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>, product: Product) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      void handleSelect(product);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] flex flex-col overflow-hidden">
        <DialogHeader>
          <DialogTitle className="font-display">Pick product for slot {slotPosition + 1}</DialogTitle>
        </DialogHeader>

        <Input
          placeholder="Search products..."
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />

        <div className="flex-1 min-h-0 overflow-y-auto pr-1">
          {loading && (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          )}
          {!loading && (
          <div className="grid grid-cols-3 gap-3">
            {results.map((product) => (
              <div
                key={product.id}
                role="button"
                tabIndex={0}
                onClick={() => void handleSelect(product)}
                onKeyDown={(event) => handleKeyDown(event, product)}
                className="group cursor-pointer overflow-hidden rounded-lg border border-border/50 bg-card text-left transition-colors hover:border-primary/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
              >
                <div className="h-40 overflow-hidden bg-card flex items-center justify-center p-2">
                  <img
                    src={product.image_url!}
                    alt={product.title}
                    className="h-full w-full object-contain transition-transform duration-200 group-hover:scale-105"
                  />
                </div>
                <p className="p-2 text-[10px] font-display text-foreground line-clamp-2 min-h-[2.5rem]">
                  {product.title}
                </p>
              </div>
            ))}

            {results.length === 0 && !loading && (
              <p className="col-span-3 py-8 text-center text-muted-foreground">No products found</p>
            )}
          </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CarouselSlotPicker;
