// Lightweight utility for Storage WebP compression.
// The browser performs CPU-heavy WebP encoding; this function only verifies admin access,
// returns the known target list, and updates DB references after upload.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const SCAN_BUCKETS = [
  "product-images",
  "article-images",
  "section-banners",
  "brands",
  "news",
  "collections",
  "bundles",
] as const;
const BATCH_LIMIT = 25;

function toWebpPath(path: string) {
  return /\.(png|jpe?g|gif|bmp)$/i.test(path)
    ? path.replace(/\.(png|jpe?g|gif|bmp)$/i, ".webp")
    : "";
}

async function storageObjectExists(admin: ReturnType<typeof createClient>, bucket: string, path: string) {
  const slash = path.lastIndexOf("/");
  const prefix = slash >= 0 ? path.slice(0, slash) : "";
  const name = slash >= 0 ? path.slice(slash + 1) : path;
  try {
    const { data, error } = await admin.storage.from(bucket).list(prefix, {
      limit: 10,
      search: name,
    });
    if (error || !data) return false;
    return data.some((item) => item.name === name && !!item.metadata);
  } catch {
    return false;
  }
}

async function listCompressionTargets(admin: ReturnType<typeof createClient>) {
  const targets: Array<{ bucket: string; path: string; size: number }> = [];
  let totalRemaining = 0;

  async function walk(bucket: string, prefix: string) {
    let offset = 0;
    while (true) {
      let data: any[] | null = null;
      try {
        const res = await admin.storage.from(bucket).list(prefix, {
          limit: 100,
          offset,
          sortBy: { column: "name", order: "asc" },
        });
        if (res.error) return;
        data = res.data;
      } catch {
        return;
      }
      if (!data || data.length === 0) return;
      for (const item of data) {
        const fullPath = prefix ? `${prefix}/${item.name}` : item.name;
        // Folder (no metadata) — recurse
        if (!item.metadata) {
          await walk(bucket, fullPath);
          continue;
        }
        const lower = item.name.toLowerCase();
        if (lower.endsWith(".webp")) continue;
        if (!/\.(png|jpe?g|gif|bmp)$/i.test(lower)) continue;
        const size = Number(item.metadata?.size || 0);
        const webpPath = toWebpPath(fullPath);
        if (!webpPath) continue;
        // If the matching WebP already exists, this source image was already handled.
        // Do not return it in future batches even if the original file still exists.
        if (await storageObjectExists(admin, bucket, webpPath)) continue;
        totalRemaining++;
        targets.push({ bucket, path: fullPath, size });
      }
      if (data.length < 100) return;
      offset += 100;
    }
  }

  for (const bucket of SCAN_BUCKETS) {
    try {
      await walk(bucket, "");
    } catch { /* bucket may not exist */ }
  }

  // Largest first to maximize savings per batch
  targets.sort((a, b) => b.size - a.size);
  return { batch: targets.slice(0, BATCH_LIMIT), totalRemaining };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const action = typeof body?.action === "string" ? body.action : "list";

    // Auth: require admin
    const auth = req.headers.get("authorization") || "";
    const token = auth.replace(/^Bearer\s+/i, "");
    if (!token) {
      return new Response(JSON.stringify({ error: "Missing auth" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });
    const { data: userData, error: authError } = await anonClient.auth.getUser(token);
    const userId = userData?.user?.id;
    if (!userId) {
      return new Response(JSON.stringify({ error: authError?.message || "Invalid token" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const admin = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles, error: roleError } = await admin
      .from("user_roles")
      .select("role")
      .eq("user_id", userId)
      .in("role", ["admin", "super_admin"]);
    const isAdmin = !roleError && Array.isArray(roles) && roles.length > 0;
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: roleError?.message || "Forbidden — admin only" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "list") {
      const { batch, totalRemaining } = await listCompressionTargets(admin);
      return new Response(JSON.stringify({ total: batch.length, totalRemaining, targets: batch }, null, 2), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action !== "update_refs") {
      return new Response(JSON.stringify({ error: "Invalid action" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const bucket = String(body?.bucket || "");
    const path = String(body?.path || "");
    const newPath = String(body?.newPath || "");
    const webpBase64 = typeof body?.webpBase64 === "string" ? body.webpBase64 : "";
    if (
      !bucket ||
      !path ||
      !newPath.endsWith(".webp") ||
      !SCAN_BUCKETS.includes(bucket as typeof SCAN_BUCKETS[number]) ||
      !/\.(png|jpe?g|gif|bmp)$/i.test(path)
    ) {
      return new Response(JSON.stringify({ error: "Invalid compression target" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // If the browser supplied the encoded WebP bytes, upload via service role
    // to bypass storage RLS entirely.
    if (webpBase64) {
      const binary = Uint8Array.from(atob(webpBase64), (c) => c.charCodeAt(0));
      const { error: uploadError } = await admin.storage
        .from(bucket)
        .upload(newPath, binary, { contentType: "image/webp", upsert: true });
      if (uploadError) {
        return new Response(JSON.stringify({ error: `Upload failed: ${uploadError.message}` }), {
          status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    const oldUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${path}`;
    const newUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucket}/${newPath}`;
    const dbUpdates: any[] = [];
    for (const tbl of ["allowed_products", "brand_overrides", "collections", "guide_articles", "carousel_slots", "section_banners", "bundles"]) {
      try {
        const { data: updatedRows, error } = await admin
          .from(tbl)
          .update({ image_url: newUrl })
          .eq("image_url", oldUrl)
          .select("id");
        const count = Array.isArray(updatedRows) ? updatedRows.length : 0;
        if (!error && count > 0) dbUpdates.push({ table: tbl, count, newUrl });
      } catch { /* table may not exist */ }
    }

    return new Response(JSON.stringify({
      ok: true,
      oldUrl,
      newUrl,
      dbUpdates,
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    // Return 200 with empty batch so the UI can keep polling without breaking.
    return new Response(JSON.stringify({
      total: 0,
      totalRemaining: 0,
      targets: [],
      fallback: true,
      error: (e as Error)?.message || "Unknown error",
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
