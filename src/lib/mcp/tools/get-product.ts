import { defineTool, ToolError } from "@lovable.dev/mcp-js";
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
  description: string | null;
  image_url: string | null;
  release_date: string | null;
  languages: string[] | null;
  kinguin_products: OfferRow[] | null;
}

export default defineTool({
  name: "get_product",
  title: "Get product details",
  description: "Get full details for one Agever's store product by its slug or id.",
  inputSchema: {
    slug_or_id: z.string().trim().min(1).describe("Product slug (from its URL) or product id."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ slug_or_id }) => {
    const supabase = supabaseAnon();
    const columns =
      "id,title,slug,platform,region,product_type,description,image_url,release_date,languages,kinguin_products(sell_price,kinguin_stock,is_active)";

    let { data, error } = await supabase
      .from("allowed_products")
      .select(columns)
      .eq("slug", slug_or_id)
      .maybeSingle();

    if (!data && !error && /^[0-9a-f-]{36}$/i.test(slug_or_id)) {
      ({ data, error } = await supabase
        .from("allowed_products")
        .select(columns)
        .eq("id", slug_or_id)
        .maybeSingle());
    }

    if (error) throw new ToolError(error.message);
    if (!data) throw new ToolError(`No product found for "${slug_or_id}".`);

    const row = data as unknown as ProductRow;
    const offer = (row.kinguin_products ?? []).find((o) => o.is_active) ?? null;
    const product = {
      id: row.id,
      title: row.title ?? "",
      platform: row.platform ?? "",
      region: row.region ?? "",
      product_type: row.product_type ?? "",
      description: row.description ?? "",
      image_url: row.image_url ?? "",
      release_date: row.release_date ?? null,
      languages: (row.languages ?? []).map((l) => l),
      price_eur: offer?.sell_price ?? null,
      in_stock: (offer?.kinguin_stock ?? 0) > 0,
      url: `${SITE_URL}/product/${row.slug ?? row.id}`,
    };

    return {
      content: [
        {
          type: "text" as const,
          text: `${product.title} (${product.platform}) — ${product.price_eur ?? "n/a"} EUR — ${product.in_stock ? "in stock" : "out of stock"}\n${product.url}`,
        },
      ],
      structuredContent: { product },
    };
  },
});
