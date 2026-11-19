import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const TOOLS = [
  // === Existing Product Tools ===
  {
    type: "function",
    function: {
      name: "search_products",
      description: "Search products in the allowed_products catalog by title, platform, store, or region",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for product title" },
          platform: { type: "string", description: "Filter by platform (PC, Xbox, PlayStation, Nintendo)" },
          store: { type: "string", description: "Filter by store (Steam, Epic Games, etc.)" },
          limit: { type: "number", description: "Max results to return (default 20)" },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_product_price",
      description: "Update the sell price of a Kinguin-linked product by its allowed_product_id",
      parameters: {
        type: "object",
        properties: {
          allowed_product_id: { type: "string", description: "The UUID of the allowed product" },
          new_price: { type: "number", description: "The new sell price in EUR" },
        },
        required: ["allowed_product_id", "new_price"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_product_details",
      description: "Get full details of a specific product including Kinguin link, stock, and price",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "The UUID of the allowed product" },
        },
        required: ["product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_recent_orders",
      description: "List recent orders with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: completed, pending, refunded" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_order_status",
      description: "Update the status of an order (e.g. completed, refunded, pending)",
      parameters: {
        type: "object",
        properties: {
          order_id: { type: "string", description: "The UUID of the order" },
          status: { type: "string", enum: ["completed", "pending", "refunded"], description: "New status" },
          game_code: { type: "string", description: "Optionally set/update the game code/key" },
        },
        required: ["order_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_support_tickets",
      description: "List support tickets with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", description: "Filter by status: open, in_progress, resolved, closed" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_ticket_status",
      description: "Update the status of a support ticket and optionally add an admin note",
      parameters: {
        type: "object",
        properties: {
          ticket_id: { type: "string", description: "The UUID of the support ticket" },
          status: { type: "string", enum: ["open", "in_progress", "resolved", "closed"], description: "New status" },
          admin_note: { type: "string", description: "Optional admin note" },
          resolution_type: { type: "string", enum: ["refund", "replacement", "no_action", "other"], description: "Resolution type" },
        },
        required: ["ticket_id", "status"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_store_stats",
      description: "Get overall store statistics: total products, orders, revenue, active tickets, sellers, fraud flags, withdrawals",
      parameters: { type: "object", properties: {} },
    },
  },
  {
    type: "function",
    function: {
      name: "bulk_update_prices",
      description: "Update prices for multiple products by a percentage increase or decrease",
      parameters: {
        type: "object",
        properties: {
          product_ids: { type: "array", items: { type: "string" }, description: "Array of allowed_product_id UUIDs" },
          percentage: { type: "number", description: "Percentage change (positive to increase, negative to decrease)" },
        },
        required: ["product_ids", "percentage"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_products",
      description: "Delete products from the catalog by their IDs. For deleting ALL products, use delete_all_products instead.",
      parameters: {
        type: "object",
        properties: {
          product_ids: { type: "array", items: { type: "string" }, description: "Array of allowed_product_id UUIDs to delete" },
        },
        required: ["product_ids"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_all_products",
      description: "Delete ALL products from the catalog. Use with caution! Optionally filter by platform or store.",
      parameters: {
        type: "object",
        properties: {
          platform: { type: "string", description: "Only delete products of this platform (optional)" },
          store: { type: "string", description: "Only delete products of this store (optional)" },
          confirm: { type: "boolean", description: "Must be true to confirm deletion" },
        },
        required: ["confirm"],
      },
    },
  },
  // === Kinguin Tools ===
  {
    type: "function",
    function: {
      name: "search_kinguin",
      description: "Search Kinguin marketplace for products to potentially import. Use tags='dlc' to find in-game items/DLC, tags='prepaid' for gift cards, tags='software' for software products.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query (game name, brand, etc.)" },
          limit: { type: "number", description: "Max results per API page (default 50)" },
          tags: { type: "string", description: "Comma-separated Kinguin tags: base, dlc, software, prepaid, indie valley. Use 'dlc' for in-game items." },
          platform: { type: "string", description: "Kinguin platform filter: Steam, Epic Games, Xbox One, PlayStation 4, etc." },
        },
        required: [],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_kinguin_products",
      description: "List products linked to Kinguin in the store database, with prices, stock, and active status",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search by product title (optional)" },
          is_active: { type: "boolean", description: "Filter by active status (optional)" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "import_from_kinguin",
      description: "Import products from Kinguin marketplace into the store. Supports filtering by platform, tags, date range, and sorting.",
      parameters: {
        type: "object",
        properties: {
          query: { type: "string", description: "Search query for Kinguin products" },
          platform: { type: "string", description: "Kinguin platform filter: Steam, Epic Games, Ubisoft, EA App, Xbox One, Xbox Series X|S, Nintendo Switch, PlayStation 4, PlayStation 5, Android, Other" },
          tags: { type: "string", description: "Comma-separated tags: base, dlc, software, prepaid, indie valley" },
          sort_by: { type: "string", enum: ["updatedAt", "kinguinId"], description: "Sort field" },
          sort_type: { type: "string", enum: ["asc", "desc"], description: "Sort direction" },
          updated_since: { type: "string", description: "Only products updated after this date (YYYY-MM-DD)" },
          updated_to: { type: "string", description: "Only products updated before this date (YYYY-MM-DD)" },
          genre: { type: "string", description: "Comma-separated genres" },
          max_pages: { type: "number", description: "Pages to fetch (1 page = 50 products, default 1, max 50). For broad imports like 'all Steam games' use max_pages=50" },
          skip_paraphrase: { type: "boolean", description: "Skip AI description paraphrasing (default false)" },
          category_override: { type: "string", description: "Force category assignment: 'in-game-items', 'gift-cards', 'media-streaming', 'software', 'pre-orders'" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "toggle_kinguin_product",
      description: "Activate or deactivate a Kinguin-linked product",
      parameters: {
        type: "object",
        properties: {
          allowed_product_id: { type: "string", description: "The UUID of the allowed product" },
          is_active: { type: "boolean", description: "true to activate, false to deactivate" },
        },
        required: ["allowed_product_id", "is_active"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "unlink_kinguin_product",
      description: "Remove the Kinguin link from a product AND delete the product from catalog",
      parameters: {
        type: "object",
        properties: {
          allowed_product_id: { type: "string", description: "The UUID of the allowed product to unlink" },
        },
        required: ["allowed_product_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "trigger_stock_sync",
      description: "Trigger a Kinguin stock sync to update all linked product stock counts and prices",
      parameters: { type: "object", properties: {} },
    },
  },
  // === Product Keys Tools ===
  {
    type: "function",
    function: {
      name: "list_product_keys",
      description: "List product keys (manual keys) for a specific product or all products. Shows key codes, status, and seller info.",
      parameters: {
        type: "object",
        properties: {
          allowed_product_id: { type: "string", description: "Filter by allowed_product_id (optional)" },
          product_id: { type: "string", description: "Filter by seller's product_id (optional)" },
          status: { type: "string", enum: ["active", "sold", "pending", "preorder", "reported"], description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "add_product_keys",
      description: "Add manual product keys to a product",
      parameters: {
        type: "object",
        properties: {
          allowed_product_id: { type: "string", description: "The allowed_product_id to attach keys to" },
          keys: { type: "array", items: { type: "string" }, description: "Array of key codes to add" },
          seller_id: { type: "string", description: "The seller UUID (use admin's user_id for admin-added keys)" },
        },
        required: ["allowed_product_id", "keys", "seller_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_product_keys",
      description: "Delete specific product keys by their IDs",
      parameters: {
        type: "object",
        properties: {
          key_ids: { type: "array", items: { type: "string" }, description: "Array of key UUIDs to delete" },
        },
        required: ["key_ids"],
      },
    },
  },
  // === Seller Application Tools ===
  {
    type: "function",
    function: {
      name: "list_seller_applications",
      description: "List seller applications with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected"], description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "review_seller_application",
      description: "Approve or reject a seller application. Approving grants the 'seller' role automatically.",
      parameters: {
        type: "object",
        properties: {
          application_id: { type: "string", description: "The UUID of the seller application" },
          action: { type: "string", enum: ["approve", "reject"], description: "Approve or reject" },
          admin_note: { type: "string", description: "Optional note to attach" },
        },
        required: ["application_id", "action"],
      },
    },
  },
  // === Withdrawal Tools ===
  {
    type: "function",
    function: {
      name: "list_withdrawals",
      description: "List withdrawal requests from sellers with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected", "paid"], description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "process_withdrawal",
      description: "Approve, reject, or mark a withdrawal as paid",
      parameters: {
        type: "object",
        properties: {
          withdrawal_id: { type: "string", description: "The UUID of the withdrawal request" },
          action: { type: "string", enum: ["approve", "reject", "paid"], description: "Action to take" },
          admin_note: { type: "string", description: "Optional admin note" },
        },
        required: ["withdrawal_id", "action"],
      },
    },
  },
  // === Fraud Management Tools ===
  {
    type: "function",
    function: {
      name: "list_fraud_flags",
      description: "List fraud flags with optional filters for resolved/unresolved and severity",
      parameters: {
        type: "object",
        properties: {
          resolved: { type: "boolean", description: "Filter by resolved status (true/false)" },
          severity: { type: "string", enum: ["low", "medium", "high", "critical"], description: "Filter by severity" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "resolve_fraud_flag",
      description: "Resolve a fraud flag with a resolution note",
      parameters: {
        type: "object",
        properties: {
          flag_id: { type: "string", description: "The UUID of the fraud flag" },
          resolution_note: { type: "string", description: "Note explaining the resolution" },
        },
        required: ["flag_id", "resolution_note"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_fraud_score",
      description: "Get the fraud score and risk details for a specific user",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or find user by email" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "block_user",
      description: "Block or unblock a user from making purchases (fraud prevention)",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          block: { type: "boolean", description: "true to block, false to unblock" },
          notes: { type: "string", description: "Reason for blocking/unblocking" },
        },
        required: ["user_id", "block"],
      },
    },
  },
  // === Reviews Tools ===
  {
    type: "function",
    function: {
      name: "list_reviews",
      description: "List product reviews with optional filters",
      parameters: {
        type: "object",
        properties: {
          seller_id: { type: "string", description: "Filter by seller UUID" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_review",
      description: "Delete a review by its ID",
      parameters: {
        type: "object",
        properties: {
          review_id: { type: "string", description: "The UUID of the review to delete" },
        },
        required: ["review_id"],
      },
    },
  },
  // === Product Requests Tools ===
  {
    type: "function",
    function: {
      name: "list_product_requests",
      description: "List product requests from sellers with optional status filter",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["pending", "approved", "rejected"], description: "Filter by status" },
          limit: { type: "number", description: "Max results (default 20)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "review_product_request",
      description: "Approve or reject a product request from a seller. Approving creates the product in allowed_products.",
      parameters: {
        type: "object",
        properties: {
          request_id: { type: "string", description: "The UUID of the product request" },
          action: { type: "string", enum: ["approve", "reject"], description: "Approve or reject" },
          admin_note: { type: "string", description: "Optional note" },
        },
        required: ["request_id", "action"],
      },
    },
  },
  // === Seller Sales Tools ===
  {
    type: "function",
    function: {
      name: "list_seller_sales",
      description: "List seller sales with optional filters by seller, status, or date",
      parameters: {
        type: "object",
        properties: {
          seller_id: { type: "string", description: "Filter by seller UUID" },
          status: { type: "string", description: "Filter by status: completed, refunded" },
          limit: { type: "number", description: "Max results (default 30)" },
        },
      },
    },
  },
  // === Paraphrase Tool ===
  {
    type: "function",
    function: {
      name: "trigger_paraphrase",
      description: "Trigger AI description paraphrasing for a single product or queue multiple products",
      parameters: {
        type: "object",
        properties: {
          allowed_product_ids: { type: "array", items: { type: "string" }, description: "Array of allowed_product_id UUIDs to paraphrase" },
        },
        required: ["allowed_product_ids"],
      },
    },
  },
  // === Existing Tools ===
  {
    type: "function",
    function: {
      name: "get_bot_logs",
      description: "Get recent bot action logs for review",
      parameters: {
        type: "object",
        properties: {
          limit: { type: "number", description: "Max results (default 20)" },
          action_type: { type: "string", description: "Filter by action type" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "list_users",
      description: "List all registered users with their roles and emails",
      parameters: {
        type: "object",
        properties: {
          page: { type: "number", description: "Page number (default 1)" },
          per_page: { type: "number", description: "Users per page (default 50)" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "get_user_details",
      description: "Get full details of a specific user including profile, orders, wishlist, and roles",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or search by email instead of user_id" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_user",
      description: "Create a new user with email, password, and optional username",
      parameters: {
        type: "object",
        properties: {
          email: { type: "string", description: "User email address" },
          password: { type: "string", description: "User password (min 6 chars)" },
          username: { type: "string", description: "Optional display name/username" },
        },
        required: ["email", "password"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_user",
      description: "Delete a user completely (auth + data). Cannot delete super_admin unless caller is super_admin.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user to delete" },
          email: { type: "string", description: "Or find user by email" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "set_user_role",
      description: "Grant or revoke a role for a user. Available roles: admin, seller, user, super_admin.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or find user by email" },
          role: { type: "string", enum: ["admin", "seller", "user", "super_admin"], description: "The role to set" },
          remove: { type: "boolean", description: "If true, removes the role instead of granting it" },
        },
        required: ["role"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "reset_user_password",
      description: "Reset a user's password to a new value",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or find user by email" },
          new_password: { type: "string", description: "The new password to set" },
        },
        required: ["new_password"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "verify_user_email",
      description: "Manually verify a user's email address",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or find user by email" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_user_profile",
      description: "Update a user's profile fields like display_name, username, phone, country, etc.",
      parameters: {
        type: "object",
        properties: {
          user_id: { type: "string", description: "The UUID of the user" },
          email: { type: "string", description: "Or find user by email" },
          display_name: { type: "string", description: "New display name" },
          username: { type: "string", description: "New username" },
          phone: { type: "string", description: "Phone number" },
          country: { type: "string", description: "Country" },
          avatar_url: { type: "string", description: "Avatar URL" },
        },
      },
    },
  },
  // === Update Product Metadata ===
  {
    type: "function",
    function: {
      name: "update_product",
      description: "Update product metadata like title, description, platform, store, region, image_url",
      parameters: {
        type: "object",
        properties: {
          product_id: { type: "string", description: "The UUID of the allowed product" },
          title: { type: "string", description: "New title" },
          description: { type: "string", description: "New description" },
          platform: { type: "string", description: "New platform" },
          store: { type: "string", description: "New store" },
          region: { type: "string", description: "New region" },
          image_url: { type: "string", description: "New image URL" },
        },
        required: ["product_id"],
      },
    },
  },
  // === Collection Management Tools ===
  {
    type: "function",
    function: {
      name: "list_collections",
      description: "List all collections (visual product groupings/tiles) with product counts",
      parameters: {
        type: "object",
        properties: {
          is_active: { type: "boolean", description: "Filter by active status (optional)" },
          category_filter: { type: "string", description: "Filter by category (e.g. 'In-Game Items', 'Gift Cards')" },
        },
      },
    },
  },
  {
    type: "function",
    function: {
      name: "create_collection",
      description: "Create a new collection (visual grouping/tile). Use auto_group_keyword to auto-assign products by title match.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Display name (e.g. 'Fortnite', 'Roblox')" },
          slug: { type: "string", description: "URL-safe slug (e.g. 'fortnite', 'roblox')" },
          description: { type: "string", description: "Short description" },
          image_url: { type: "string", description: "Cover image URL" },
          auto_group_keyword: { type: "string", description: "Keyword to auto-match products by title (e.g. 'Fortnite')" },
          category_filter: { type: "string", description: "Limit to category: 'In-Game Items', 'Gift Cards', 'Media & Streaming', 'Software'" },
          display_order: { type: "number", description: "Sort order (lower = first)" },
        },
        required: ["name", "slug"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "update_collection",
      description: "Update a collection's properties",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "UUID of the collection" },
          name: { type: "string" },
          description: { type: "string" },
          image_url: { type: "string" },
          auto_group_keyword: { type: "string" },
          category_filter: { type: "string" },
          is_active: { type: "boolean" },
          display_order: { type: "number" },
        },
        required: ["collection_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "delete_collection",
      description: "Delete a collection (products remain in catalog)",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "UUID of the collection to delete" },
        },
        required: ["collection_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "assign_products_to_collection",
      description: "Assign products to a collection by product IDs or auto-assign by keyword match",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "UUID of the collection" },
          product_ids: { type: "array", items: { type: "string" }, description: "Array of allowed_product_id UUIDs to assign" },
          auto_assign: { type: "boolean", description: "If true, auto-assign all products matching the collection's auto_group_keyword" },
        },
        required: ["collection_id"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "remove_products_from_collection",
      description: "Remove specific products from a collection",
      parameters: {
        type: "object",
        properties: {
          collection_id: { type: "string", description: "UUID of the collection" },
          product_ids: { type: "array", items: { type: "string" }, description: "Array of allowed_product_id UUIDs to remove" },
        },
        required: ["collection_id", "product_ids"],
      },
    },
  },
];

// Tool execution
async function executeTool(
  supabase: any,
  toolName: string,
  args: any,
  conversationId: string,
  userToken?: string,
  callerUserId?: string,
): Promise<string> {
  let result: any;
  let logStatus = "success";
  let logError: string | null = null;

  try {
    switch (toolName) {
      case "search_products": {
        let query = supabase.from("allowed_products").select("id, title, platform, store, region, image_url");
        if (args.query) query = query.ilike("title", `%${args.query}%`);
        if (args.platform) query = query.eq("platform", args.platform);
        if (args.store) query = query.eq("store", args.store);
        const { data, error } = await query.limit(args.limit || 100).order("created_at", { ascending: false });
        if (error) throw error;

        const ids = (data || []).map((p: any) => p.id);
        const { data: kgData } = await supabase.from("kinguin_products").select("allowed_product_id, sell_price, kinguin_price, kinguin_stock").in("allowed_product_id", ids);
        const kgMap = new Map((kgData || []).map((k: any) => [k.allowed_product_id, k]));

        result = (data || []).map((p: any) => {
          const kg = kgMap.get(p.id);
          return { ...p, sell_price: kg?.sell_price, kinguin_price: kg?.kinguin_price, kinguin_stock: kg?.kinguin_stock };
        });
        break;
      }

      case "update_product_price": {
        const { error } = await supabase
          .from("kinguin_products")
          .update({ sell_price: args.new_price })
          .eq("allowed_product_id", args.allowed_product_id);
        if (error) throw error;
        result = { success: true, message: `Price updated to €${args.new_price}` };
        break;
      }

      case "get_product_details": {
        const { data: product, error } = await supabase
          .from("allowed_products")
          .select("*")
          .eq("id", args.product_id)
          .single();
        if (error) throw error;

        const { data: kgData } = await supabase
          .from("kinguin_products")
          .select("*")
          .eq("allowed_product_id", args.product_id)
          .maybeSingle();

        const { data: mkData } = await supabase
          .from("product_keys")
          .select("id")
          .eq("allowed_product_id", args.product_id)
          .eq("status", "active");

        result = { ...product, kinguin: kgData, manual_keys_count: mkData?.length || 0 };
        break;
      }

      case "list_recent_orders": {
        let query = supabase.from("orders").select("id, game_title, platform, price, status, created_at, quantity, user_id, paypal_order_id");
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "update_order_status": {
        const updateData: any = { status: args.status };
        if (args.game_code) updateData.game_code = args.game_code;
        const { error } = await supabase.from("orders").update(updateData).eq("id", args.order_id);
        if (error) throw error;
        result = { success: true, message: `Order ${args.order_id} updated to ${args.status}` };
        break;
      }

      case "list_support_tickets": {
        let query = supabase.from("support_tickets").select("id, issue_type, message, status, buyer_email, created_at, admin_note, seller_response, resolution_type, seller_id");
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "update_ticket_status": {
        const updateData: any = { status: args.status };
        if (args.admin_note) updateData.admin_note = args.admin_note;
        if (args.resolution_type) updateData.resolution_type = args.resolution_type;
        const { error } = await supabase.from("support_tickets").update(updateData).eq("id", args.ticket_id);
        if (error) throw error;
        result = { success: true, message: `Ticket ${args.ticket_id} updated to ${args.status}` };
        break;
      }

      case "get_store_stats": {
        const [products, orders, tickets, kgProducts, sellers, fraudFlags, withdrawals, reviews] = await Promise.all([
          supabase.from("allowed_products").select("id", { count: "exact", head: true }),
          supabase.from("orders").select("id, price, status"),
          supabase.from("support_tickets").select("id, status"),
          supabase.from("kinguin_products").select("id, is_active"),
          supabase.from("seller_applications").select("id, status"),
          supabase.from("fraud_flags").select("id, resolved"),
          supabase.from("withdrawal_requests").select("id, status, amount"),
          supabase.from("reviews").select("id", { count: "exact", head: true }),
        ]);

        const allOrders = orders.data || [];
        const completedOrders = allOrders.filter((o: any) => o.status === "completed");
        const totalRevenue = completedOrders.reduce((s: number, o: any) => s + Number(o.price), 0);
        const openTickets = (tickets.data || []).filter((t: any) => t.status === "open" || t.status === "in_progress");
        const pendingSellers = (sellers.data || []).filter((s: any) => s.status === "pending");
        const unresolvedFlags = (fraudFlags.data || []).filter((f: any) => !f.resolved);
        const pendingWithdrawals = (withdrawals.data || []).filter((w: any) => w.status === "pending");
        const pendingWithdrawalAmount = pendingWithdrawals.reduce((s: number, w: any) => s + Number(w.amount), 0);

        result = {
          total_products: products.count || 0,
          total_orders: allOrders.length,
          completed_orders: completedOrders.length,
          total_revenue: `€${totalRevenue.toFixed(2)}`,
          open_tickets: openTickets.length,
          active_kinguin_products: (kgProducts.data || []).filter((k: any) => k.is_active).length,
          total_reviews: reviews.count || 0,
          pending_seller_applications: pendingSellers.length,
          unresolved_fraud_flags: unresolvedFlags.length,
          pending_withdrawals: pendingWithdrawals.length,
          pending_withdrawal_amount: `€${pendingWithdrawalAmount.toFixed(2)}`,
        };
        break;
      }

      case "bulk_update_prices": {
        const { data: currentPrices, error: fetchErr } = await supabase
          .from("kinguin_products")
          .select("id, allowed_product_id, sell_price")
          .in("allowed_product_id", args.product_ids);
        if (fetchErr) throw fetchErr;

        const updates = (currentPrices || []).map((kp: any) => ({
          id: kp.id,
          sell_price: Math.ceil(kp.sell_price * (1 + args.percentage / 100) * 100) / 100,
        }));

        for (const u of updates) {
          await supabase.from("kinguin_products").update({ sell_price: u.sell_price }).eq("id", u.id);
        }
        result = { success: true, updated: updates.length, message: `Updated ${updates.length} products by ${args.percentage}%` };
        break;
      }

      case "delete_products": {
        const { data: delResult } = await supabase.rpc("delete_allowed_products_bulk", { product_ids: args.product_ids });
        result = { success: true, deleted: delResult, message: `Deleted ${delResult} products` };
        break;
      }

      case "delete_all_products": {
        if (!args.confirm) {
          result = { success: false, message: "You must set confirm=true to delete products" };
          break;
        }
        let delQuery = supabase.from("allowed_products").select("id");
        if (args.platform) delQuery = delQuery.eq("platform", args.platform);
        if (args.store) delQuery = delQuery.eq("store", args.store);
        
        const allIds: string[] = [];
        let page = 0;
        const pageSize = 500;
        while (true) {
          const { data: batch } = await delQuery.range(page * pageSize, (page + 1) * pageSize - 1);
          if (!batch || batch.length === 0) break;
          allIds.push(...batch.map((p: any) => p.id));
          if (batch.length < pageSize) break;
          page++;
        }
        
        if (allIds.length === 0) {
          result = { success: true, deleted: 0, message: "No products found matching the criteria" };
          break;
        }
        
        let totalDeleted = 0;
        for (let i = 0; i < allIds.length; i += 200) {
          const batch = allIds.slice(i, i + 200);
          const { data: delCount } = await supabase.rpc("delete_allowed_products_bulk", { product_ids: batch });
          totalDeleted += (delCount || 0);
        }
        
        result = { success: true, deleted: totalDeleted, total_found: allIds.length, message: `Deleted ${totalDeleted} products` };
        break;
      }

      case "search_kinguin": {
        const SUPABASE_URL_SEARCH = Deno.env.get("SUPABASE_URL");
        const searchLimit = args.limit || 50;
        const searchParams = new URLSearchParams();
        if (args.query) searchParams.set("query", args.query);
        searchParams.set("limit", String(searchLimit));
        if (args.tags) searchParams.set("tags", args.tags);
        if (args.platform) searchParams.set("platform", args.platform);
        const searchUrl = `${SUPABASE_URL_SEARCH}/functions/v1/kinguin-search?${searchParams.toString()}`;
        const searchRes = await fetch(searchUrl, {
          headers: {
            Authorization: `Bearer ${userToken}`,
            "Content-Type": "application/json",
          },
        });
        if (!searchRes.ok) {
          const errText = await searchRes.text();
          throw new Error(`Kinguin search error [${searchRes.status}]: ${errText}`);
        }
        const searchData = await searchRes.json();
        const searchResults = searchData.results || [];
        result = searchResults.map((p: any) => ({
          productId: p.productId || p.kinguinId,
          name: p.name,
          platform: p.platform,
          price: p.price,
          qty: p.qty || p.totalQty || 0,
          regionId: p.regionId,
        }));
        break;
      }

      case "list_kinguin_products": {
        let query = supabase
          .from("kinguin_products")
          .select("id, allowed_product_id, kinguin_product_id, sell_price, kinguin_price, kinguin_stock, is_active, last_stock_check");
        if (args.is_active !== undefined) query = query.eq("is_active", args.is_active);
        const { data: kgList, error: kgErr } = await query.limit(args.limit || 500).order("sell_price", { ascending: true });
        if (kgErr) throw kgErr;

        const apIds = (kgList || []).map((k: any) => k.allowed_product_id);
        const { data: apData } = await supabase.from("allowed_products").select("id, title, platform, store, region").in("id", apIds);
        const apMap = new Map((apData || []).map((a: any) => [a.id, a]));

        let results = (kgList || []).map((k: any) => {
          const ap = apMap.get(k.allowed_product_id) || {};
          return { ...k, title: (ap as any).title, platform: (ap as any).platform, store: (ap as any).store, region: (ap as any).region };
        });

        if (args.query) {
          const q = args.query.toLowerCase();
          results = results.filter((r: any) => r.title && r.title.toLowerCase().includes(q));
        }

        result = { total_linked: results.length, products: results };
        break;
      }

      case "import_from_kinguin": {
        const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const importBody: any = {
          query: args.query || "",
          maxPages: Math.min(args.max_pages || 1, 50),
          skipParaphrase: args.skip_paraphrase ?? false,
        };
        if (args.platform) importBody.platform = args.platform;
        if (args.tags) importBody.tags = args.tags;
        if (args.sort_by) importBody.sortBy = args.sort_by;
        if (args.sort_type) importBody.sortType = args.sort_type;
        if (args.updated_since) importBody.updatedSince = args.updated_since;
        if (args.updated_to) importBody.updatedTo = args.updated_to;
        if (args.genre) importBody.genre = args.genre;
        if (args.category_override) importBody.categoryOverride = args.category_override;

        const importRes = await fetch(
          `${SUPABASE_URL_ENV}/functions/v1/kinguin-bulk-import`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
              apikey: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_KEY,
            },
            body: JSON.stringify(importBody),
          }
        );

        if (!importRes.ok) {
          const errText = await importRes.text();
          throw new Error(`Import failed: ${errText}`);
        }

        const importData = await importRes.json();
        result = {
          total_found: importData.total,
          added: importData.added,
          skipped: importData.skipped,
          details: (importData.results || []).slice(0, 20).map((r: any) => ({
            name: r.name,
            status: r.status,
            sellPrice: r.sellPrice,
          })),
          message: `Imported ${importData.added} products, skipped ${importData.skipped} out of ${importData.total} found`,
        };
        break;
      }

      case "toggle_kinguin_product": {
        const { error } = await supabase
          .from("kinguin_products")
          .update({ is_active: args.is_active })
          .eq("allowed_product_id", args.allowed_product_id);
        if (error) throw error;
        result = { success: true, message: `Product ${args.is_active ? "activated" : "deactivated"}` };
        break;
      }

      case "unlink_kinguin_product": {
        // Delete kinguin link first, then the allowed product (cascade via trigger)
        const { error: kgErr } = await supabase
          .from("kinguin_products")
          .delete()
          .eq("allowed_product_id", args.allowed_product_id);
        if (kgErr) throw kgErr;
        
        const { error: apErr } = await supabase
          .from("allowed_products")
          .delete()
          .eq("id", args.allowed_product_id);
        if (apErr) throw apErr;
        
        result = { success: true, message: "Product unlinked and removed from catalog" };
        break;
      }

      case "trigger_stock_sync": {
        const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        const syncRes = await fetch(
          `${SUPABASE_URL_ENV}/functions/v1/kinguin-stock-sync`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
              apikey: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_KEY,
            },
            body: JSON.stringify({}),
          }
        );

        if (!syncRes.ok) {
          const errText = await syncRes.text();
          throw new Error(`Stock sync failed: ${errText}`);
        }

        const syncData = await syncRes.json();
        result = { success: true, ...syncData, message: `Stock sync completed` };
        break;
      }

      // === Product Keys ===
      case "list_product_keys": {
        let query = supabase.from("product_keys").select("id, key_code, status, seller_id, allowed_product_id, product_id, added_at, sold_at, order_id");
        if (args.allowed_product_id) query = query.eq("allowed_product_id", args.allowed_product_id);
        if (args.product_id) query = query.eq("product_id", args.product_id);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 50).order("added_at", { ascending: false });
        if (error) throw error;
        result = { total: (data || []).length, keys: data };
        break;
      }

      case "add_product_keys": {
        const keysToInsert = args.keys.map((k: string) => ({
          key_code: k.trim(),
          allowed_product_id: args.allowed_product_id,
          seller_id: args.seller_id,
          status: "active",
        }));
        const { data, error } = await supabase.from("product_keys").insert(keysToInsert).select("id");
        if (error) throw error;
        result = { success: true, added: (data || []).length, message: `Added ${(data || []).length} keys` };
        break;
      }

      case "delete_product_keys": {
        const { error } = await supabase.from("product_keys").delete().in("id", args.key_ids);
        if (error) throw error;
        result = { success: true, message: `Deleted ${args.key_ids.length} keys` };
        break;
      }

      // === Seller Applications ===
      case "list_seller_applications": {
        let query = supabase.from("seller_applications").select("id, full_name, email, country, product_types, status, created_at, admin_note, user_id, business_name, experience, why_sell");
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "review_seller_application": {
        const newStatus = args.action === "approve" ? "approved" : "rejected";
        const updateData: any = { status: newStatus };
        if (args.admin_note) updateData.admin_note = args.admin_note;
        
        const { error: updateErr } = await supabase
          .from("seller_applications")
          .update(updateData)
          .eq("id", args.application_id);
        if (updateErr) throw updateErr;

        // If approved, grant seller role
        if (args.action === "approve") {
          const { data: app } = await supabase
            .from("seller_applications")
            .select("user_id")
            .eq("id", args.application_id)
            .single();
          
          if (app?.user_id) {
            // Check if role already exists
            const { data: existing } = await supabase
              .from("user_roles")
              .select("id")
              .eq("user_id", app.user_id)
              .eq("role", "seller")
              .maybeSingle();
            
            if (!existing) {
              await supabase.from("user_roles").insert({ user_id: app.user_id, role: "seller" });
            }
          }
        }

        result = { success: true, message: `Application ${newStatus}${args.action === "approve" ? " and seller role granted" : ""}` };
        break;
      }

      // === Withdrawals ===
      case "list_withdrawals": {
        let query = supabase.from("withdrawal_requests").select("id, seller_id, amount, method, status, paypal_email, payoneer_email, admin_note, created_at, updated_at");
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        
        // Enrich with seller info
        const sellerIds = [...new Set((data || []).map((w: any) => w.seller_id))];
        const { data: profiles } = await supabase.from("profiles").select("user_id, display_name, username").in("user_id", sellerIds);
        const profileMap = new Map((profiles || []).map((p: any) => [p.user_id, p]));
        
        result = (data || []).map((w: any) => {
          const profile = profileMap.get(w.seller_id);
          return { ...w, seller_name: profile?.display_name || profile?.username || "Unknown" };
        });
        break;
      }

      case "process_withdrawal": {
        const updateData: any = { status: args.action === "paid" ? "paid" : args.action === "approve" ? "approved" : "rejected" };
        if (args.admin_note) updateData.admin_note = args.admin_note;
        const { error } = await supabase.from("withdrawal_requests").update(updateData).eq("id", args.withdrawal_id);
        if (error) throw error;
        result = { success: true, message: `Withdrawal ${updateData.status}` };
        break;
      }

      // === Fraud Management ===
      case "list_fraud_flags": {
        let query = supabase.from("fraud_flags").select("id, user_id, flag_type, description, severity, resolved, resolution_note, created_at, metadata");
        if (args.resolved !== undefined) query = query.eq("resolved", args.resolved);
        if (args.severity) query = query.eq("severity", args.severity);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "resolve_fraud_flag": {
        const { error } = await supabase.from("fraud_flags").update({
          resolved: true,
          resolution_note: args.resolution_note,
          resolved_at: new Date().toISOString(),
          resolved_by: callerUserId,
        }).eq("id", args.flag_id);
        if (error) throw error;
        result = { success: true, message: "Fraud flag resolved" };
        break;
      }

      case "get_fraud_score": {
        let userId = args.user_id;
        if (!userId && args.email) {
          const adminClient = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
          const { data: listData } = await adminClient.auth.admin.listUsers({ perPage: 1000 });
          const found = listData?.users?.find((u: any) => u.email?.toLowerCase() === args.email.toLowerCase());
          if (!found) throw new Error(`User not found: ${args.email}`);
          userId = found.id;
        }
        
        const { data: score } = await supabase.from("fraud_scores").select("*").eq("user_id", userId).maybeSingle();
        const { data: flags } = await supabase.from("fraud_flags").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10);
        
        result = { score: score || { risk_score: 0, risk_level: "low", is_blocked: false }, recent_flags: flags || [] };
        break;
      }

      case "block_user": {
        const { data: existing } = await supabase.from("fraud_scores").select("id").eq("user_id", args.user_id).maybeSingle();
        
        if (existing) {
          const { error } = await supabase.from("fraud_scores").update({
            is_blocked: args.block,
            notes: args.notes || (args.block ? "Blocked by admin via bot" : "Unblocked by admin via bot"),
          }).eq("user_id", args.user_id);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("fraud_scores").insert({
            user_id: args.user_id,
            is_blocked: args.block,
            notes: args.notes || (args.block ? "Blocked by admin via bot" : "Unblocked by admin via bot"),
            risk_level: args.block ? "high" : "low",
          });
          if (error) throw error;
        }
        
        result = { success: true, message: `User ${args.block ? "blocked" : "unblocked"}` };
        break;
      }

      // === Reviews ===
      case "list_reviews": {
        let query = supabase.from("reviews").select("id, buyer_id, seller_id, order_id, rating_product, rating_service, rating_shipping, comment, seller_response, created_at");
        if (args.seller_id) query = query.eq("seller_id", args.seller_id);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "delete_review": {
        const { error } = await supabase.from("reviews").delete().eq("id", args.review_id);
        if (error) throw error;
        result = { success: true, message: "Review deleted" };
        break;
      }

      // === Product Requests ===
      case "list_product_requests": {
        let query = supabase.from("product_requests").select("id, title, platform, store, region, description, status, admin_note, requested_by, created_at");
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      case "review_product_request": {
        const newStatus = args.action === "approve" ? "approved" : "rejected";
        const updateData: any = { status: newStatus };
        if (args.admin_note) updateData.admin_note = args.admin_note;
        
        // If approving, create the allowed_product entry
        if (args.action === "approve") {
          const { data: req } = await supabase
            .from("product_requests")
            .select("*")
            .eq("id", args.request_id)
            .single();
          
          if (req) {
            await supabase.from("allowed_products").insert({
              title: req.title,
              original_title: req.title,
              platform: req.platform,
              store: req.store,
              region: req.region,
              description: req.description,
            });
          }
        }
        
        const { error } = await supabase.from("product_requests").update(updateData).eq("id", args.request_id);
        if (error) throw error;
        result = { success: true, message: `Product request ${newStatus}${args.action === "approve" ? " and product added to catalog" : ""}` };
        break;
      }

      // === Seller Sales ===
      case "list_seller_sales": {
        let query = supabase.from("seller_sales").select("id, seller_id, product_title, platform, sale_amount, commission_amount, net_earnings, status, created_at, available_at, order_number");
        if (args.seller_id) query = query.eq("seller_id", args.seller_id);
        if (args.status) query = query.eq("status", args.status);
        const { data, error } = await query.limit(args.limit || 30).order("created_at", { ascending: false });
        if (error) throw error;
        
        const totalSales = (data || []).reduce((s: number, d: any) => s + Number(d.sale_amount), 0);
        const totalEarnings = (data || []).reduce((s: number, d: any) => s + Number(d.net_earnings), 0);
        const totalCommission = (data || []).reduce((s: number, d: any) => s + Number(d.commission_amount), 0);
        
        result = {
          total_records: (data || []).length,
          total_sales: `€${totalSales.toFixed(2)}`,
          total_earnings: `€${totalEarnings.toFixed(2)}`,
          total_commission: `€${totalCommission.toFixed(2)}`,
          sales: data,
        };
        break;
      }

      // === Paraphrase ===
      case "trigger_paraphrase": {
        const ids = args.allowed_product_ids;
        const batchId = crypto.randomUUID();
        
        // Check which products already have paraphrased descriptions
        const { data: existing } = await supabase
          .from("allowed_products")
          .select("id, description_paraphrased")
          .in("id", ids);
        
        const toProcess = (existing || []).filter((p: any) => !p.description_paraphrased).map((p: any) => p.id);
        const alreadyDone = ids.length - toProcess.length;
        
        if (toProcess.length === 0) {
          result = { success: true, message: "All products already paraphrased", already_done: alreadyDone };
          break;
        }
        
        // Insert into paraphrase_queue
        const queueItems = toProcess.map((id: string) => ({
          allowed_product_id: id,
          batch_id: batchId,
          status: "pending",
        }));
        
        const { error: qErr } = await supabase.from("paraphrase_queue").insert(queueItems);
        if (qErr) throw qErr;
        
        // Trigger the processor
        const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        
        fetch(`${SUPABASE_URL_ENV}/functions/v1/process-paraphrase-queue`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SUPABASE_SERVICE_KEY}`,
            apikey: Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || SUPABASE_SERVICE_KEY,
          },
          body: JSON.stringify({ batchId }),
        }).catch(() => {});
        
        result = {
          success: true,
          queued: toProcess.length,
          already_done: alreadyDone,
          batch_id: batchId,
          message: `Queued ${toProcess.length} products for paraphrasing${alreadyDone > 0 ? ` (${alreadyDone} already done)` : ""}`,
        };
        break;
      }

      // === Update Product Metadata ===
      case "update_product": {
        const fields: any = {};
        if (args.title) fields.title = args.title;
        if (args.description) fields.description = args.description;
        if (args.platform) fields.platform = args.platform;
        if (args.store) fields.store = args.store;
        if (args.region) fields.region = args.region;
        if (args.image_url) fields.image_url = args.image_url;
        
        if (Object.keys(fields).length === 0) {
          result = { error: "No fields to update" };
          break;
        }
        
        const { error } = await supabase.from("allowed_products").update(fields).eq("id", args.product_id);
        if (error) throw error;
        result = { success: true, message: `Product updated`, updated_fields: Object.keys(fields) };
        break;
      }

      case "get_bot_logs": {
        let query = supabase.from("bot_action_logs").select("*");
        if (args.action_type) query = query.eq("action_type", args.action_type);
        const { data, error } = await query.limit(args.limit || 20).order("created_at", { ascending: false });
        if (error) throw error;
        result = data;
        break;
      }

      // === User Management Tools ===
      case "list_users":
      case "get_user_details":
      case "create_user":
      case "delete_user":
      case "set_user_role":
      case "reset_user_password":
      case "verify_user_email":
      case "update_user_profile": {
        const SUPABASE_URL_ENV = Deno.env.get("SUPABASE_URL")!;
        const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
        const ANON_KEY = Deno.env.get("SUPABASE_PUBLISHABLE_KEY") || Deno.env.get("SUPABASE_ANON_KEY") || SUPABASE_SERVICE_KEY;

        async function resolveUserId(a: any): Promise<string> {
          if (a.user_id) return a.user_id;
          if (!a.email) throw new Error("Either user_id or email is required");
          const adminClient2 = createClient(SUPABASE_URL_ENV, SUPABASE_SERVICE_KEY);
          const { data: listData } = await adminClient2.auth.admin.listUsers({ perPage: 1000 });
          const found = listData?.users?.find((u: any) => u.email?.toLowerCase() === a.email.toLowerCase());
          if (!found) throw new Error(`User not found with email: ${a.email}`);
          return found.id;
        }

        let adminAction: string;
        let adminParams: any = {};

        switch (toolName) {
          case "list_users": {
            adminAction = "list_users";
            adminParams = { page: args.page || 1, perPage: args.per_page || 50 };
            break;
          }
          case "get_user_details": {
            const uid = await resolveUserId(args);
            adminAction = "get_user_details";
            adminParams = { userId: uid };
            break;
          }
          case "create_user": {
            adminAction = "create_user";
            adminParams = { email: args.email, password: args.password, username: args.username };
            break;
          }
          case "delete_user": {
            const uid = await resolveUserId(args);
            adminAction = "delete_user";
            adminParams = { userId: uid };
            break;
          }
          case "set_user_role": {
            const uid = await resolveUserId(args);
            adminAction = "set_role";
            adminParams = { userId: uid, role: args.role, remove: args.remove || false };
            break;
          }
          case "reset_user_password": {
            const uid = await resolveUserId(args);
            adminAction = "reset_password";
            adminParams = { userId: uid, newPassword: args.new_password };
            break;
          }
          case "verify_user_email": {
            const uid = await resolveUserId(args);
            adminAction = "verify_email";
            adminParams = { userId: uid };
            break;
          }
          case "update_user_profile": {
            const uid = await resolveUserId(args);
            const profileFields: any = {};
            if (args.display_name) profileFields.display_name = args.display_name;
            if (args.username) profileFields.username = args.username;
            if (args.phone) profileFields.phone = args.phone;
            if (args.country) profileFields.country = args.country;
            if (args.avatar_url) profileFields.avatar_url = args.avatar_url;
            
            if (Object.keys(profileFields).length === 0) {
              result = { error: "No fields to update" };
              break;
            }
            const { error: profErr } = await supabase.from("profiles").update(profileFields).eq("user_id", uid);
            if (profErr) throw profErr;
            result = { success: true, message: `Profile updated for user ${uid}`, updated_fields: Object.keys(profileFields) };
            break;
          }
          default:
            throw new Error(`Unknown user tool: ${toolName}`);
        }

        if (toolName === "update_user_profile") break;

        const userMgmtRes = await fetch(
          `${SUPABASE_URL_ENV}/functions/v1/admin-users`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${userToken}`,
              apikey: ANON_KEY,
            },
            body: JSON.stringify({ action: adminAction, ...adminParams }),
          }
        );

        if (!userMgmtRes.ok) {
          const errText = await userMgmtRes.text();
          throw new Error(`User management error: ${errText}`);
        }

        const userMgmtData = await userMgmtRes.json();
        
        if (toolName === "list_users" && userMgmtData.users) {
          result = {
            total: userMgmtData.users.length,
            users: userMgmtData.users.map((u: any) => ({
              id: u.id,
              email: u.email,
              roles: u.roles,
              email_confirmed: !!u.email_confirmed_at,
              last_sign_in: u.last_sign_in_at,
              created_at: u.created_at,
            })),
          };
        } else {
          result = userMgmtData;
        }
        break;
      }

      // === Collections ===
      case "list_collections": {
        let query = supabase.from("collections").select("id, name, slug, description, image_url, display_order, is_active, auto_group_keyword, category_filter, created_at");
        if (args.is_active !== undefined) query = query.eq("is_active", args.is_active);
        if (args.category_filter) query = query.eq("category_filter", args.category_filter);
        const { data, error } = await query.order("display_order", { ascending: true });
        if (error) throw error;

        // Get product counts per collection
        const collectionIds = (data || []).map((c: any) => c.id);
        const { data: cpData } = await supabase.from("collection_products").select("collection_id").in("collection_id", collectionIds);
        const countMap: Record<string, number> = {};
        (cpData || []).forEach((cp: any) => { countMap[cp.collection_id] = (countMap[cp.collection_id] || 0) + 1; });

        result = (data || []).map((c: any) => ({ ...c, product_count: countMap[c.id] || 0 }));
        break;
      }

      case "create_collection": {
        const insertData: any = {
          name: args.name,
          slug: args.slug,
        };
        if (args.description) insertData.description = args.description;
        if (args.image_url) insertData.image_url = args.image_url;
        if (args.auto_group_keyword) insertData.auto_group_keyword = args.auto_group_keyword;
        if (args.category_filter) insertData.category_filter = args.category_filter;
        if (args.display_order !== undefined) insertData.display_order = args.display_order;

        const { data, error } = await supabase.from("collections").insert(insertData).select().single();
        if (error) throw error;

        // Auto-assign products if keyword is set
        if (args.auto_group_keyword) {
          let prodQuery = supabase.from("allowed_products").select("id").ilike("title", `%${args.auto_group_keyword}%`);
          if (args.category_filter) {
            const storeMap: Record<string, string> = {
              "In-Game Items": "In-Game Items",
              "Gift Cards": "Gift Cards",
              "Media & Streaming": "Media & Streaming",
              "Software": "Software",
            };
            const store = storeMap[args.category_filter];
            if (store) prodQuery = prodQuery.eq("store", store);
          }
          const { data: products } = await prodQuery;
          if (products && products.length > 0) {
            const inserts = products.map((p: any) => ({
              collection_id: data.id,
              allowed_product_id: p.id,
            }));
            await supabase.from("collection_products").upsert(inserts, { onConflict: "collection_id,allowed_product_id" });
          }
          result = { success: true, collection: data, auto_assigned: products?.length || 0 };
        } else {
          result = { success: true, collection: data };
        }
        break;
      }

      case "update_collection": {
        const updateData: any = {};
        if (args.name) updateData.name = args.name;
        if (args.description !== undefined) updateData.description = args.description;
        if (args.image_url !== undefined) updateData.image_url = args.image_url;
        if (args.auto_group_keyword !== undefined) updateData.auto_group_keyword = args.auto_group_keyword;
        if (args.category_filter !== undefined) updateData.category_filter = args.category_filter;
        if (args.is_active !== undefined) updateData.is_active = args.is_active;
        if (args.display_order !== undefined) updateData.display_order = args.display_order;

        const { error } = await supabase.from("collections").update(updateData).eq("id", args.collection_id);
        if (error) throw error;
        result = { success: true, message: "Collection updated" };
        break;
      }

      case "delete_collection": {
        const { error } = await supabase.from("collections").delete().eq("id", args.collection_id);
        if (error) throw error;
        result = { success: true, message: "Collection deleted" };
        break;
      }

      case "assign_products_to_collection": {
        if (args.auto_assign) {
          // Get collection's keyword
          const { data: col } = await supabase.from("collections").select("auto_group_keyword, category_filter").eq("id", args.collection_id).single();
          if (!col?.auto_group_keyword) throw new Error("Collection has no auto_group_keyword set");

          let prodQuery = supabase.from("allowed_products").select("id").ilike("title", `%${col.auto_group_keyword}%`);
          if (col.category_filter) {
            prodQuery = prodQuery.eq("store", col.category_filter);
          }
          const { data: products } = await prodQuery;
          if (products && products.length > 0) {
            const inserts = products.map((p: any) => ({
              collection_id: args.collection_id,
              allowed_product_id: p.id,
            }));
            await supabase.from("collection_products").upsert(inserts, { onConflict: "collection_id,allowed_product_id" });
          }
          result = { success: true, assigned: products?.length || 0 };
        } else if (args.product_ids?.length) {
          const inserts = args.product_ids.map((pid: string) => ({
            collection_id: args.collection_id,
            allowed_product_id: pid,
          }));
          const { error } = await supabase.from("collection_products").upsert(inserts, { onConflict: "collection_id,allowed_product_id" });
          if (error) throw error;
          result = { success: true, assigned: args.product_ids.length };
        } else {
          throw new Error("Provide product_ids or set auto_assign=true");
        }
        break;
      }

      case "remove_products_from_collection": {
        const { error } = await supabase.from("collection_products")
          .delete()
          .eq("collection_id", args.collection_id)
          .in("allowed_product_id", args.product_ids);
        if (error) throw error;
        result = { success: true, removed: args.product_ids.length };
        break;
      }

      default:
        throw new Error(`Unknown tool: ${toolName}`);
    }
  } catch (err: any) {
    logStatus = "error";
    logError = err.message;
    result = { error: err.message };
  }

  // Log the action
  await supabase.from("bot_action_logs").insert({
    action_type: toolName,
    action_description: JSON.stringify(args),
    input_data: args,
    output_data: typeof result === "string" ? { text: result } : result,
    status: logStatus,
    error_message: logError,
    conversation_id: conversationId,
  });

  return JSON.stringify(result);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    if (!GEMINI_API_KEY) throw new Error("GEMINI_API_KEY not configured");

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Not authenticated");
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) throw new Error("Not authenticated");

    const { data: roleRows } = await supabase
      .from("user_roles").select("role").eq("user_id", user.id).in("role", ["admin", "super_admin"]);
    if (!roleRows || roleRows.length === 0) throw new Error("Admin access required");

    const { messages, conversationId } = await req.json();
    if (!messages || !Array.isArray(messages)) throw new Error("Messages required");

    const systemPrompt = `You are Agever Bot, the internal AI assistant for the Agevers digital game key marketplace.
You help the admin manage the store efficiently. You have FULL access to all store management capabilities.

=== TOOL REFERENCE ===

PRODUCT MANAGEMENT:
- "search_products" - Search allowed_products catalog by title, platform, store
- "get_product_details" - Full product details with Kinguin link and manual keys count
- "update_product" - Update product metadata (title, description, platform, store, region, image)
- "update_product_price" - Update sell price of Kinguin-linked product
- "bulk_update_prices" - Update multiple product prices by percentage
- "delete_products" - Delete specific products by ID
- "delete_all_products" - Delete all products (with optional platform/store filter, requires confirm=true)

KINGUIN MARKETPLACE:
- "search_kinguin" - Search EXTERNAL Kinguin marketplace (preview only, no import)
- "list_kinguin_products" - List products LINKED to Kinguin in our database
- "import_from_kinguin" - IMPORT products from Kinguin into our store
- "toggle_kinguin_product" - Activate/deactivate a Kinguin-linked product
- "unlink_kinguin_product" - Remove Kinguin link and delete product from catalog
- "trigger_stock_sync" - Sync all Kinguin stock counts and prices

PRODUCT KEYS:
- "list_product_keys" - List manual product keys (filter by product, status)
- "add_product_keys" - Add manual keys to a product
- "delete_product_keys" - Delete specific keys by ID

ORDERS:
- "list_recent_orders" - List orders with optional status filter
- "update_order_status" - Update order status (completed/pending/refunded) and optionally set game code

SUPPORT TICKETS:
- "list_support_tickets" - List tickets with optional status filter
- "update_ticket_status" - Update ticket status, admin note, and resolution type

SELLER APPLICATIONS:
- "list_seller_applications" - List seller applications (filter by status)
- "review_seller_application" - Approve/reject application (approve auto-grants seller role)

WITHDRAWALS:
- "list_withdrawals" - List withdrawal requests (filter by status)
- "process_withdrawal" - Approve/reject/mark as paid with optional admin note

FRAUD MANAGEMENT:
- "list_fraud_flags" - List fraud flags (filter by resolved/severity)
- "resolve_fraud_flag" - Resolve a fraud flag with a note
- "get_fraud_score" - Get user's fraud score and risk details
- "block_user" - Block/unblock a user from purchases

REVIEWS:
- "list_reviews" - List reviews (filter by seller)
- "delete_review" - Delete a review

PRODUCT REQUESTS:
- "list_product_requests" - List seller product requests (filter by status)
- "review_product_request" - Approve/reject (approve creates allowed_product entry)

SELLER SALES:
- "list_seller_sales" - View seller sales with totals (filter by seller/status)

AI DESCRIPTIONS:
- "trigger_paraphrase" - Queue products for AI description paraphrasing

USER MANAGEMENT:
- "list_users" - List all users with roles
- "get_user_details" - Full user details (profile, orders, roles)
- "create_user" - Create new user
- "delete_user" - Delete user
- "set_user_role" - Grant/revoke roles (admin, seller, user, super_admin)
- "reset_user_password" - Reset password
- "verify_user_email" - Verify email
- "update_user_profile" - Update profile fields

COLLECTIONS (Visual Product Groupings/Tiles):
- "list_collections" - List all collections with product counts
- "create_collection" - Create a new collection (set auto_group_keyword to auto-assign matching products)
- "update_collection" - Update collection properties
- "delete_collection" - Delete a collection
- "assign_products_to_collection" - Assign products manually or auto-assign by keyword
- "remove_products_from_collection" - Remove products from a collection

STATS & LOGS:
- "get_store_stats" - Comprehensive store statistics
- "get_bot_logs" - View bot action history

=== CRITICAL RULES ===

TOOL DISTINCTION:
- "search_kinguin" = PREVIEW Kinguin marketplace. Use for "כמה משחקים", "מה יש", "show me"
- "import_from_kinguin" = ACTUALLY IMPORTS. Only when admin says "import", "ייבא", "תוסיף"
- "list_kinguin_products" = Shows OUR LINKED products (internal inventory)
- "search_products" = Searches our full catalog (all products)

Import & Search filtering:
- "steam games" → platform="Steam", tags="base"
- "steam DLC" / "in-game items" → tags="dlc" (use category_override="in-game-items" when importing)
- "xbox games" → platform="Xbox One", tags="base"
- "playstation games" → platform="PlayStation 4" or "PlayStation 5", tags="base"
- "software" → tags="software"
- "new/newest" → sort_by="updatedAt", sort_type="desc"
- "from 2026" → updated_since="2026-01-01"
Available platforms: Steam, Epic Games, Ubisoft, EA App, Xbox One, Xbox Series X|S, Nintendo Switch, PlayStation 4, PlayStation 5, Android, Other
Available tags: base, dlc, software, prepaid, indie valley

CRITICAL - IN-GAME ITEMS / DLC SEARCH:
To find in-game items (skins, DLC, packs, etc.) on Kinguin, use tags="dlc".
- "in-game items for Fortnite" → search_kinguin with query="Fortnite", tags="dlc"
- "import in-game items" → import_from_kinguin with tags="dlc", category_override="in-game-items"
- "Roblox in-game items" → query="Roblox", tags="dlc", category_override="in-game-items"
Both search_kinguin and import_from_kinguin support the tags parameter.

CRITICAL - CATEGORY OVERRIDE:
When importing, use category_override to force correct categorization:
- category_override="in-game-items" → In-Game Items category
- category_override="gift-cards" → Gift Cards category
- category_override="media-streaming" → Media & Streaming category
- category_override="software" → Software category
- category_override="pre-orders" → Pre-Orders category

CRITICAL - GIFT CARDS / PREPAID / TOP-UPS IMPORT:
For gift cards, prepaid cards, wallet cards, top-ups - DO NOT set the "platform" parameter!
Kinguin categorizes gift cards differently than games. Setting platform="PlayStation 5" will return 0 results for gift cards.
Instead:
- "PlayStation gift cards USD" → query="PlayStation Network USD", tags="prepaid", NO platform filter
- "Xbox gift cards" → query="Xbox Gift Card", tags="prepaid", NO platform filter  
- "Steam wallet cards" → query="Steam Wallet", tags="prepaid", NO platform filter
- "Nintendo eShop cards" → query="Nintendo eShop", tags="prepaid", NO platform filter
- For specific currency/region, include it in the query: e.g. query="PlayStation Network USD"
- Use max_pages=5 or more for comprehensive results
The key insight: gift cards on Kinguin don't have a gaming platform - they are financial products. Only use "platform" for actual GAMES.

CRITICAL - BROAD IMPORTS (e.g. "import all Steam games", "ייבא את כל המשחקי סטים"):
When the admin asks to import ALL or MANY products from a platform, ALWAYS use max_pages=50.
- "all Steam games" → platform="Steam", tags="base", max_pages=50
- "all Xbox games" → platform="Xbox One", tags="base", max_pages=50
- "all PlayStation games" → platform="PlayStation 4", tags="base", max_pages=50
- "import everything" → max_pages=50
Do NOT default to 1 page for broad import requests! 1 page = only 50 products.

BEHAVIOR:
- Always respond in Hebrew unless admin writes in English
- Be concise and actionable
- Confirm before destructive actions (delete, bulk changes, blocking)
- Format prices in EUR (€)
- Show relevant details when listing items
- admin and super_admin roles are mutually exclusive

LEARNING / MISSING CAPABILITY:
If you CANNOT do something:
1. Explain what's missing
2. Ask: "רוצה שאבקש את היכולת הזו מ-Lovable?"
3. If yes, format a feature request block

WEBSITE CONTENT KNOWLEDGE:
=== PRIVACY POLICY ===
Last updated: March 2026. Company: Agevers. Contact: privacy@agevers.com, support@agevers.com. GDPR protected for EU residents. Data: name, email, IP, cookies. Third-party: Paddle (payments), IPQS (fraud).

=== TERMS OF SERVICE ===
Last updated: March 2026. Paddle.com is Merchant of Record. Refunds only for invalid/defective codes within 48 hours. Governing law: Israel.

=== REFUND POLICY ===
Digital sales final. Exception: invalid code within 48 hours with screenshot. Contact: support@agevers.com

=== ABOUT US ===
Agevers - digital game keys, software licenses, gift cards. 10K+ Products, 50+ Platforms, 24/7 Support. Contact: support@agevers.com, business@agevers.com

=== CONTACT ===
Support: support@agevers.com. Business: business@agevers.com. Address: Agever's, Hativat HaNegev 11, Eilat, Israel.

=== FAQ ===
Keys delivered instantly. Payments via credit cards, PayPal. Refunds for unused keys within 14 days. Keys guaranteed authentic.

=== HELP CENTER ===
Activation guides for Steam, PlayStation, Xbox, Nintendo, Epic, GOG. Coins earned via mini-games. Sellers need ID verification.`;

    let aiMessages = [
      { role: "system", content: systemPrompt },
      // Only role + content survive, and roles are whitelisted: a caller cannot
      // inject system/tool turns into the model context.
      ...(Array.isArray(messages) ? messages : [])
        .filter((m: any) => m && typeof m.content === "string")
        .map((m: any) => ({
          role: m.role === "assistant" ? "assistant" : "user",
          content: m.content,
        })),
    ];

    // Tool name to Hebrew label map
    const toolLabels: Record<string, string> = {
      search_products: "🔍 מחפש מוצרים בקטלוג...",
      get_product_details: "📋 מביא פרטי מוצר...",
      update_product: "✏️ מעדכן מוצר...",
      update_product_price: "💰 מעדכן מחיר...",
      bulk_update_prices: "💰 מעדכן מחירים בכמות...",
      delete_products: "🗑️ מוחק מוצרים...",
      delete_all_products: "🗑️ מוחק את כל המוצרים...",
      search_kinguin: "🔍 מחפש ב-Kinguin...",
      list_kinguin_products: "📦 מביא מוצרי Kinguin מקושרים...",
      import_from_kinguin: "📥 מייבא מ-Kinguin...",
      toggle_kinguin_product: "🔄 מפעיל/מכבה מוצר Kinguin...",
      unlink_kinguin_product: "🔗 מנתק קישור Kinguin...",
      trigger_stock_sync: "🔄 מסנכרן מלאי...",
      list_product_keys: "🔑 מביא מפתחות מוצר...",
      add_product_keys: "🔑 מוסיף מפתחות...",
      delete_product_keys: "🗑️ מוחק מפתחות...",
      list_recent_orders: "📦 מביא הזמנות אחרונות...",
      update_order_status: "✏️ מעדכן סטטוס הזמנה...",
      list_support_tickets: "🎫 מביא טיקטים...",
      update_ticket_status: "✏️ מעדכן טיקט...",
      list_seller_applications: "👤 מביא בקשות מוכרים...",
      review_seller_application: "✅ בודק בקשת מוכר...",
      list_withdrawals: "💸 מביא בקשות משיכה...",
      process_withdrawal: "💸 מעבד משיכה...",
      list_fraud_flags: "🚨 מביא דגלי הונאה...",
      resolve_fraud_flag: "✅ פותר דגל הונאה...",
      get_fraud_score: "📊 מביא ציון הונאה...",
      block_user: "🚫 חוסם/משחרר משתמש...",
      list_reviews: "⭐ מביא ביקורות...",
      delete_review: "🗑️ מוחק ביקורת...",
      list_product_requests: "📋 מביא בקשות מוצרים...",
      review_product_request: "✅ בודק בקשת מוצר...",
      list_seller_sales: "💰 מביא מכירות מוכר...",
      trigger_paraphrase: "✍️ מפעיל ניסוח מחדש...",
      list_users: "👥 מביא רשימת משתמשים...",
      get_user_details: "👤 מביא פרטי משתמש...",
      create_user: "👤 יוצר משתמש חדש...",
      delete_user: "🗑️ מוחק משתמש...",
      set_user_role: "🔐 מעדכן הרשאות...",
      reset_user_password: "🔑 מאפס סיסמה...",
      verify_user_email: "✉️ מאמת אימייל...",
      update_user_profile: "👤 מעדכן פרופיל...",
      get_store_stats: "📊 מביא סטטיסטיקות חנות...",
      get_bot_logs: "📜 מביא לוגים...",
      list_collections: "🗂️ מביא קולקציות...",
      create_collection: "🗂️ יוצר קולקציה חדשה...",
      update_collection: "✏️ מעדכן קולקציה...",
      delete_collection: "🗑️ מוחק קולקציה...",
      assign_products_to_collection: "📦 משייך מוצרים לקולקציה...",
      remove_products_from_collection: "📦 מסיר מוצרים מקולקציה...",
    };

    // SSE streaming response
    const encoder = new TextEncoder();
    const stream = new ReadableStream({
      async start(controller) {
        const send = (event: string, data: any) => {
          controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
        };

        try {
          send("status", { step: "🤔 מנתח את הבקשה..." });

          const maxIterations = 8;
          for (let i = 0; i < maxIterations; i++) {
            send("status", { step: i === 0 ? "🧠 חושב..." : "🧠 ממשיך לעבד..." });

            const models = ["gemini-3.5-flash", "gemini-3.5-flash-lite"];
            let aiRes: Response | null = null;
            for (let modelIdx = 0; modelIdx < models.length; modelIdx++) {
              const model = models[modelIdx];
              for (let retry = 0; retry < 4; retry++) {
                aiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
                  method: "POST",
                  headers: {
                    Authorization: `Bearer ${GEMINI_API_KEY}`,
                    "Content-Type": "application/json",
                  },
                  body: JSON.stringify({
                    model,
                    messages: aiMessages,
                    tools: TOOLS,
                    temperature: 0.3,
                    max_tokens: 3000,
                  }),
                });

                if (aiRes.status === 429) {
                  send("status", { step: `⏳ ממתין לריענון... (ניסיון ${retry + 1})` });
                  const retryAfter = aiRes.headers.get("Retry-After");
                  const delayMs = retryAfter
                    ? parseInt(retryAfter) * 1000
                    : Math.pow(2, retry) * 3000 + Math.random() * 2000;
                  await aiRes.text();
                  await new Promise((r) => setTimeout(r, Math.min(delayMs, 45000)));
                  continue;
                }
                break;
              }
              if (aiRes && aiRes.status !== 429) break;
              if (modelIdx < models.length - 1) {
                send("status", { step: "🔄 מנסה מודל חלופי..." });
              }
            }

            if (!aiRes || aiRes.status === 429) {
              send("error", { error: "Rate limit exceeded, try again shortly" });
              controller.close();
              return;
            }

            if (!aiRes.ok) {
              if (aiRes.status === 402) {
                send("error", { error: "AI credits exhausted" });
                controller.close();
                return;
              }
              const errText = await aiRes.text();
              send("error", { error: `AI error ${aiRes.status}: ${errText}` });
              controller.close();
              return;
            }

            const aiData = await aiRes.json();
            const choice = aiData.choices?.[0];
            if (!choice) {
              send("error", { error: "No AI response" });
              controller.close();
              return;
            }

            const assistantMessage = choice.message;
            aiMessages.push(assistantMessage);

            if (!assistantMessage.tool_calls || assistantMessage.tool_calls.length === 0) {
              send("done", { reply: assistantMessage.content, conversationId });
              controller.close();
              return;
            }

            // Execute tool calls with status updates
            for (const toolCall of assistantMessage.tool_calls) {
              const fnName = toolCall.function.name;
              const fnArgs = JSON.parse(toolCall.function.arguments || "{}");
              
              const label = toolLabels[fnName] || `⚙️ מריץ ${fnName}...`;
              send("status", { step: label });

              const toolResult = await executeTool(supabase, fnName, fnArgs, conversationId, token, user.id);

              aiMessages.push({
                role: "tool",
                tool_call_id: toolCall.id,
                content: toolResult,
              });
            }

            send("status", { step: "🧠 מנתח תוצאות..." });
          }

          send("done", {
            reply: "ביצעתי מספר פעולות אבל צריך עוד מידע. נסה לשאול שוב עם יותר פירוט.",
            conversationId,
          });
          controller.close();
        } catch (error: unknown) {
          const message = error instanceof Error ? error.message : "Unknown error";
          console.error("admin-ai-chat streaming error:", message);
          send("error", { error: message });
          controller.close();
        }
      },
    });

    return new Response(stream, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("admin-ai-chat error:", message);
    return new Response(JSON.stringify({ error: message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
