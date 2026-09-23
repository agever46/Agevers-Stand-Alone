import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Package } from "lucide-react";

interface Collection {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  product_count: number;
}

interface CollectionTilesProps {
  categoryFilter?: string;
  onCollectionClick?: (collection: Collection) => void;
}

const CollectionTiles = ({ categoryFilter, onCollectionClick }: CollectionTilesProps) => {
  const [collections, setCollections] = useState<Collection[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchCollections = async () => {
      let query = supabase
        .from("collections" as any)
        .select("id, name, slug, description, image_url, display_order")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (categoryFilter) {
        query = query.eq("category_filter", categoryFilter);
      }

      const { data: cols } = await query;
      if (!cols || cols.length === 0) {
        setCollections([]);
        setLoading(false);
        return;
      }

      // Get product counts with pagination to avoid 1000-row limit
      const colIds = (cols as any[]).map((c: any) => c.id);
      let allCpData: any[] = [];
      let cpOffset = 0;
      const cpBatch = 1000;
      while (true) {
        const { data: cpChunk } = await supabase
          .from("collection_products" as any)
          .select("collection_id")
          .in("collection_id", colIds)
          .range(cpOffset, cpOffset + cpBatch - 1);
        if (!cpChunk || cpChunk.length === 0) break;
        allCpData = allCpData.concat(cpChunk);
        if (cpChunk.length < cpBatch) break;
        cpOffset += cpBatch;
      }

      const countMap: Record<string, number> = {};
      allCpData.forEach((cp: any) => {
        countMap[cp.collection_id] = (countMap[cp.collection_id] || 0) + 1;
      });

      setCollections(
        (cols as any[]).map((c: any) => ({
          ...c,
          product_count: countMap[c.id] || 0,
        }))
      );
      setLoading(false);
    };

    fetchCollections();
  }, [categoryFilter]);

  if (loading || collections.length === 0) return null;

  return (
    <div className="mb-8">
      <h3 className="font-display text-lg font-bold tracking-wider text-foreground mb-4">
        Browse by Collection
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {collections.map((col, i) => (
          <motion.button
            key={col.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.03 }}
            whileHover={{ y: -4, scale: 1.03 }}
            onClick={() => {
              if (onCollectionClick) {
                onCollectionClick(col);
              } else {
                navigate(`/collection/${col.slug}`);
              }
            }}
            className="glass rounded-xl overflow-hidden text-left group cursor-pointer border border-border/50 hover:border-primary/40 transition-colors"
          >
            <div className="aspect-square overflow-hidden bg-background/50 p-2">
              {col.image_url ? (
                <img
                  src={col.image_url}
                  alt={col.name}
                  loading="lazy"
                  className="w-full h-full object-contain transition-transform duration-500 group-hover:scale-110"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                </div>
              )}
            </div>
            <div className="p-2.5">
              <p className="font-display text-sm font-bold text-foreground line-clamp-1">
                {col.name}
              </p>
              <p className="text-[10px] text-muted-foreground mt-0.5">
                {col.product_count} {col.product_count === 1 ? "product" : "products"}
              </p>
            </div>
          </motion.button>
        ))}
      </div>
    </div>
  );
};

export default CollectionTiles;
