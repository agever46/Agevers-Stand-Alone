import { auth, defineMcp } from "@lovable.dev/mcp-js";
import searchProductsTool from "./tools/search-products";
import getProductTool from "./tools/get-product";
import listMyOrdersTool from "./tools/list-my-orders";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "agever-s-digital-codes",
  title: "Agever's Digital Codes",
  version: "0.1.0",
  instructions:
    "Tools for the Agever's store. Use `search_products` to find game keys, gift cards and software with prices and stock, `get_product` for full details of one product, and `list_my_orders` to read the signed-in customer's own order history.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [searchProductsTool, getProductTool, listMyOrdersTool],
});
