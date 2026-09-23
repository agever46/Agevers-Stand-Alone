import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import GameCard from "@/components/GameCard";
import { FlyToCartOverlay, useFlyToCart } from "@/components/FlyToCart";
import { motion } from "framer-motion";
import { Tv, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import AdminBulkPlatformBar from "@/components/AdminBulkPlatformBar";

import game1 from "@/assets/game1.jpg";

const BRAND_KEYWORDS = [
  "YOUTUBE PREMIUM", "APPLE TV", "APPLE MUSIC", "APPLE ARCADE", "EA PLAY",
  "HBO MAX", "PARAMOUNT PLUS",
  "NETFLIX", "SPOTIFY", "HULU", "CRUNCHYROLL", "DEEZER", "DAZN", "TIDAL",
];

function detectBrand(title: string): string {
  const upper = title.toUpperCase();
  for (const kw of BRAND_KEYWORDS) {
    if (upper.includes(kw)) return kw.split(" ").map(w => w.charAt(0) + w.slice(1).toLowerCase()).join(" ");
  }
  const dash = title.indexOf(" - ");
  if (dash > 0) return title.substring(0, dash).trim();
  return "Other";
}

interface Product {
  id: string;
  title: string;
  image_url: string | null;
  platform: string;
  region: string;
  slug: string;
  sold_count: number;
  wishlist_count: number;
}

interface BrandGroup {
  brand: string;
  image: string | null;
  count: number;
}

const MediaStreaming = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedBrand = searchParams.get("brand");
  const { flyingItems, triggerFly } = useFlyToCart();
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true);
      let all: Product[] = [];
      let from = 0;
      const batchSize = 1000;
      while (true) {
        const { data } = await supabase
          .from("allowed_products")
          .select("id, title, image_url, platform, region, slug, sold_count, wishlist_count")
          .eq("platform", "Media & Streaming")
          .range(from, from + batchSize - 1);
        if (!data || data.length === 0) break;
        all = all.concat(data);
        if (data.length < batchSize) break;
        from += batchSize;
      }
      setProducts(all);
      setLoading(false);
    };
    fetchAll();
  }, []);

  const brands = useMemo(() => {
    const map = new Map<string, BrandGroup>();
    for (const p of products) {
      const brand = detectBrand(p.title);
      const existing = map.get(brand);
      if (existing) {
        existing.count++;
        if (!existing.image && p.image_url) existing.image = p.image_url;
      } else {
        map.set(brand, { brand, image: p.image_url, count: 1 });
      }
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [products]);

  const brandProducts = useMemo(() => {
    if (!selectedBrand) return [];
    return products.filter(p => detectBrand(p.title) === selectedBrand);
  }, [products, selectedBrand]);

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <div className="container mx-auto px-4 py-20 text-center">
          <div className="animate-pulse text-muted-foreground">Loading streaming products...</div>
        </div>
        <Footer />
      </div>
    );
  }

  if (selectedBrand) {
    return (
      <div className="min-h-screen bg-background">
        <Navbar />
        <FlyToCartOverlay items={flyingItems} />
        <div className="container mx-auto px-4 py-8">
          <Button variant="ghost" className="mb-4 gap-2" onClick={() => setSearchParams({})}>
            <ArrowLeft className="h-4 w-4" /> Back to all brands
          </Button>
          <h1 className="text-3xl font-bold mb-6">{selectedBrand}</h1>
          <AdminBulkPlatformBar
            selectMode={selectMode}
            setSelectMode={setSelectMode}
            selectedIds={selectedIds}
            setSelectedIds={setSelectedIds}
            visibleIds={brandProducts.map((p) => p.id)}
            onComplete={() => window.location.reload()}
          />
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 mt-6">
            {brandProducts.map((p) => (
              <GameCard
                key={p.id}
                id={p.id}
                title={p.title.split(" - ")[0]}
                image={p.image_url || game1}
                platform={p.platform}
                slug={p.slug}
                price={0}
                soldCount={p.sold_count}
                wishlistCount={p.wishlist_count}
                selectable={selectMode}
                selected={selectedIds.has(p.id)}
                onSelect={(id) => {
                  const next = new Set(selectedIds);
                  if (next.has(id)) next.delete(id); else next.add(id);
                  setSelectedIds(next);
                }}
              />
            ))}
          </div>
          {brandProducts.length === 0 && <p className="text-center text-muted-foreground mt-10">No products found.</p>}
        </div>
        <Footer />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-10">
          <Tv className="h-12 w-12 mx-auto mb-3 text-primary" />
          <h1 className="text-3xl font-bold">Media & Streaming</h1>
          <p className="text-muted-foreground mt-2">Browse Spotify, Netflix, Disney+ and other streaming subscriptions</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
          {brands.map((b) => (
            <motion.div
              key={b.brand}
              whileHover={{ scale: 1.03 }}
              className="cursor-pointer rounded-xl border border-border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
              onClick={() => setSearchParams({ brand: b.brand })}
            >
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {b.image ? (
                  <img src={b.image} alt={b.brand} className="w-full h-full object-cover" />
                ) : (
                  <Tv className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <div className="p-3 text-center">
                <h3 className="font-semibold text-sm truncate">{b.brand}</h3>
                <p className="text-xs text-muted-foreground">{b.count} products</p>
              </div>
            </motion.div>
          ))}
        </div>
        {brands.length === 0 && <p className="text-center text-muted-foreground mt-10">No streaming products available yet.</p>}
      </div>
      <Footer />
    </div>
  );
};

export default MediaStreaming;
