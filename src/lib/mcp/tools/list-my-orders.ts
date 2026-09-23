import { defineTool } from "@lovable.dev/mcp-js";
import { z } from "zod";
import { supabaseForUser } from "../supabase";

interface OrderRow {
  id: string;
  game_title: string | null;
  platform: string | null;
  price: number | null;
  quantity: number | null;
  status: string | null;
  created_at: string | null;
  code_delivered: boolean | null;
}

export default defineTool({
  name: "list_my_orders",
  title: "List my orders",
  description:
    "List the signed-in customer's own Agever's orders with status and totals. Game codes are never returned.",
  inputSchema: {
    limit: z.number().int().min(1).max(50).optional().describe("Maximum orders (default 10)."),
  },
  annotations: { readOnlyHint: true, idempotentHint: true, openWorldHint: false },
  handler: async ({ limit }, ctx) => {
    if (!ctx.isAuthenticated()) {
      return { content: [{ type: "text" as const, text: "Not authenticated" }], isError: true };
    }
    const supabase = supabaseForUser(ctx);
    const { data, error } = await supabase
      .from("orders")
      .select("id,game_title,platform,price,quantity,status,created_at,code_delivered")
      .eq("user_id", ctx.getUserId())
      .order("created_at", { ascending: false })
      .limit(limit ?? 10);

    if (error) return { content: [{ type: "text" as const, text: error.message }], isError: true };

    const orders = ((data ?? []) as OrderRow[]).map((o) => ({
      id: o.id,
      title: o.game_title ?? "",
      platform: o.platform ?? "",
      price_eur: o.price ?? null,
      quantity: o.quantity ?? 1,
      status: o.status ?? "",
      created_at: o.created_at ?? null,
      code_delivered: Boolean(o.code_delivered),
    }));

    return {
      content: [
        {
          type: "text" as const,
          text: orders.length
            ? orders
                .map((o) => `${o.created_at?.slice(0, 10) ?? ""} — ${o.title} — ${o.price_eur ?? "n/a"} EUR — ${o.status}`)
                .join("\n")
            : "No orders found for this account.",
        },
      ],
      structuredContent: { orders },
    };
  },
});
