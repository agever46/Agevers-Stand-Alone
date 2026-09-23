import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { SITE_URL, supabaseAnon } from "../supabase";

interface OfferRow {
  sell_price: number | null;
  kinguin_stock: number | null;
  is_active: boolean | null;
}

interface ProductRow {
  id: string;
  title: string | null;
  slug: string | null;
  platform: string | null;
  region: string | null;
  product_type: string | null;
  image_url: string | null;
  kinguin_products: OfferRow[] | null;
}

const toProductJson = (row: ProductRow) => {
  const offer = (row.kinguin_products ?? []).find((o) => o.is_active) ?? null;
  return {
    id: row.id,
    title: row.title ?? "",
    platform: row.platform ?? "",
    region: row.region ?? "",
    product_type: row.product_type ?? "",
    image_url: row.image_url ?? "",
    price_eur: offer?.sell_price ?? null,
    in_stock: (offer?.kinguin_stock ?? 0) > 0,
    url: `${SITE_URL}/product/${row.slug ?? row.id}`,
  };
};

export default defineTool({
  name: "search_products",
  title: "Search products",
  description:
    "Search the Agever's store catalog (game keys, gift cards, software) by title and return prices, stock and product links.",
  inputSchema: {
    query: z.string().trim().min(2).describe("Text to search for in product titles."),
    platform: z
      .string()
      .trim()
      .optional()
      .describe("Optional platform filter, e.g. Steam, Xbox, PlayStation."),
    limit: z.number().int().min(1).max(25).optional().describe("Maximum results (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ query, platform, limit }) => {
    const supabase = supabaseAnon();
    let request = supabase
      .from("allowed_products")
      .select("id,title,slug,platform,region,product_type,image_url,kinguin_products(sell_price,kinguin_stock,is_active)")
      .ilike("title", `%${query}%`)
      .limit(limit ?? 10);
    if (platform) request = request.ilike("platform", `%${platform}%`);

    const { data, error } = await request;
    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };

    const products = ((data ?? []) as ProductRow[]).map(toProductJson);
    return {
      content: [
        {
          type: "text" as const,
          text: products.length
            ? products
                .map((p) => `${p.title} — ${p.platform} — ${p.price_eur ?? "n/a"} EUR — ${p.url}`)
                .join("\n")
            : `No products matched "${query}".`,
        },
      ],
      structuredContent: { products },
    };
  },
});
