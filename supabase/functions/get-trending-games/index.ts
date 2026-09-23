import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawgGame {
  id: number;
  name: string;
  slug: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  rating_top: number;
  ratings_count: number;
  added: number;
  metacritic: number | null;
  platforms?: Array<{ platform: { name: string } }>;
  genres?: Array<{ name: string }>;
  parent_platforms?: Array<{ platform: { name: string } }>;
}

interface EnrichedGame extends RawgGame {
  in_catalog: boolean;
  catalog_product_id: string | null;
  catalog_slug: string | null;
  kinguin_search_url: string;
  steam_top_seller: boolean;
  steam_most_played: boolean;
  hot_score: number;
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// Strip platform/region/edition suffixes used in catalog titles like
// "Game Name - Xbox - Europe" or "Game Name (PC) Steam Key Global"
function stripCatalogSuffixes(s: string): string {
  let out = s;
  // Remove common prefixes like "PRE-ORDER BONUS:", "PRE-ORDER:", "DLC:", "BONUS:"
  out = out.replace(/^\s*(pre[-\s]?order(\s+bonus)?|bonus|dlc|edition)\s*[:\-]\s*/i, '');
  // Cut at " - " separator (common pattern: "Title - Platform - Region")
  const dashIdx = out.indexOf(' - ');
  if (dashIdx > 3) out = out.slice(0, dashIdx);
  // Remove parenthesized fragments
  out = out.replace(/\([^)]*\)/g, ' ');
  return out;
}

function normalizeCatalogTitle(s: string): string {
  let n = normalizeTitle(stripCatalogSuffixes(s));
  // Remove common boilerplate words after stripping
  n = n
    .replace(/\b(pre|order|bonus|dlc|steam|epic|gog|origin|uplay|ubisoft|xbox|playstation|ps4|ps5|nintendo|switch|pc|key|games|game|global|europe|us|usa|united states|united kingdom|uk|latin america|australia|canada|poland|rest of world|deluxe|edition|standard|complete|ultimate|gold|premium|digital|download|code|cd|ncsa|eclipse)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

// Fetch Steam Top Sellers (free, no key) — returns set of normalized titles
async function fetchSteamTopSellers(): Promise<Set<string>> {
  try {
    const res = await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=en', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const items = data?.top_sellers?.items || [];
    return new Set(items.map((i: any) => normalizeTitle(i.name || '')));
  } catch (e) {
    console.warn('Steam Top Sellers fetch failed:', e);
    return new Set();
  }
}

// Fetch Steam Most Played (free, no key)
async function fetchSteamMostPlayed(): Promise<Set<string>> {
  try {
    const res = await fetch('https://api.steampowered.com/ISteamChartsService/GetMostPlayedGames/v1/', {
      headers: { 'Accept': 'application/json' },
    });
    if (!res.ok) return new Set();
    const data = await res.json();
    const ranks = data?.response?.ranks || [];
    if (ranks.length === 0) return new Set();
    // Need to resolve appids → names via batch call to storefront
    const appids = ranks.slice(0, 50).map((r: any) => r.appid).join(',');
    const detailsRes = await fetch(`https://store.steampowered.com/api/appdetails?appids=${appids}&filters=basic&cc=us&l=en`);
    if (!detailsRes.ok) return new Set();
    const details = await detailsRes.json();
    const names = new Set<string>();
    Object.values(details || {}).forEach((entry: any) => {
      const name = entry?.data?.name;
      if (name) names.add(normalizeTitle(name));
    });
    return names;
  } catch (e) {
    console.warn('Steam Most Played fetch failed:', e);
    return new Set();
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const RAWG_API_KEY = Deno.env.get('RAWG_API_KEY');
    if (!RAWG_API_KEY) throw new Error('RAWG_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

    // Verify caller is admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const anonClient = createClient(SUPABASE_URL, ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: userData } = await anonClient.auth.getUser();
    if (!userData?.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);
    const { data: roles } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userData.user.id);
    const isAdmin = (roles || []).some((r: any) => r.role === 'admin' || r.role === 'super_admin');
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const url = new URL(req.url);
    const year = parseInt(url.searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const ordering = url.searchParams.get('ordering') || '-added'; // -added, -rating, -metacritic
    const pageSize = Math.min(parseInt(url.searchParams.get('page_size') || '20', 10), 40);

    if (year < 1990 || year > new Date().getFullYear() + 2) {
      return new Response(JSON.stringify({ error: 'Invalid year' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch from RAWG
    const rawgUrl = `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&dates=${year}-01-01,${year}-12-31&ordering=${ordering}&page_size=${pageSize}`;
    let rawgRes: Response | null = null;
    let lastStatus = 0;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const res = await fetch(rawgUrl, {
          headers: { Accept: 'application/json' },
          signal: AbortSignal.timeout(15000),
        });
        if (res.ok) { rawgRes = res; break; }
        lastStatus = res.status;
        await res.text().catch(() => '');
        // Only retry on transient upstream/CDN failures
        if (![408, 429, 500, 502, 503, 504, 520, 521, 522, 523, 524].includes(res.status)) break;
      } catch (_e) {
        lastStatus = 0;
      }
      if (attempt < 2) await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
    }
    if (!rawgRes) {
      return new Response(
        JSON.stringify({
          error: `RAWG.io is temporarily unavailable${lastStatus ? ` (status ${lastStatus})` : ''}. Please try again in a moment.`,
          upstream_status: lastStatus,
          year,
          games: [],
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }
    const rawgData = await rawgRes.json();
    const games: RawgGame[] = rawgData.results || [];

    if (games.length === 0) {
      return new Response(JSON.stringify({ year, games: [], total: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Load FULL catalog (paginated, Supabase 1000-row limit)
    async function loadFullCatalog() {
      const all: Array<{ id: string; title: string; slug: string | null }> = [];
      const PAGE = 1000;
      for (let from = 0; from < 50000; from += PAGE) {
        const { data, error } = await adminClient
          .from('allowed_products')
          .select('id, title, slug')
          .range(from, from + PAGE - 1);
        if (error) throw error;
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
      }
      return all;
    }

    const [catalog, steamTopSellers, steamMostPlayed] = await Promise.all([
      loadFullCatalog(),
      fetchSteamTopSellers(),
      fetchSteamMostPlayed(),
    ]);
    console.log(`Loaded ${catalog.length} catalog products`);

    // Map: cleaned-catalog-name → product. Keep first seen.
    const catalogMap = new Map<string, { id: string; slug: string | null; title: string }>();
    catalog.forEach((p: any) => {
      const norm = normalizeCatalogTitle(p.title || '');
      if (norm && !catalogMap.has(norm)) {
        catalogMap.set(norm, { id: p.id, slug: p.slug, title: p.title });
      }
    });

    const enriched: EnrichedGame[] = games.map((g) => {
      const norm = normalizeCatalogTitle(g.name);
      // 1) exact match on cleaned catalog title
      let match: { id: string; slug: string | null } | null = catalogMap.get(norm) || null;
      // 2) catalog title starts with rawg name OR equals it after dropping trailing tokens
      if (!match && norm.length >= 3) {
        for (const [k, v] of catalogMap.entries()) {
          if (k === norm || k.startsWith(norm + ' ') || norm.startsWith(k + ' ')) {
            match = v;
            break;
          }
        }
      }
      // 3) fallback: substring match (either direction) when titles are long enough
      if (!match && norm.length >= 6) {
        for (const [k, v] of catalogMap.entries()) {
          if (k.length >= 6 && (k.includes(norm) || norm.includes(k))) {
            match = v;
            break;
          }
        }
      }

      // Steam fuzzy match (any direction)
      const isInSteamSet = (set: Set<string>): boolean => {
        const steamNorm = normalizeTitle(g.name);
        if (set.has(steamNorm)) return true;
        for (const s of set) {
          if ((s.includes(steamNorm) || steamNorm.includes(s)) && Math.abs(s.length - steamNorm.length) < 8) {
            return true;
          }
        }
        return false;
      };
      const steam_top_seller = isInSteamSet(steamTopSellers);
      const steam_most_played = isInSteamSet(steamMostPlayed);

      // Hot score: combine RAWG signals + Steam signals
      // RAWG normalized: rating (0-5) → 0-50, added (popularity) → log scale
      const ratingScore = (g.rating || 0) * 10;
      const addedScore = Math.min(40, Math.log10((g.added || 1) + 1) * 8);
      const metacriticBoost = g.metacritic ? (g.metacritic / 10) : 0;
      const steamBoost = (steam_top_seller ? 25 : 0) + (steam_most_played ? 25 : 0);
      const hot_score = Math.round(ratingScore + addedScore + metacriticBoost + steamBoost);

      return {
        ...g,
        in_catalog: !!match,
        catalog_product_id: match?.id || null,
        catalog_slug: match?.slug || null,
        kinguin_search_url: `/admin/kinguin?q=${encodeURIComponent(g.name)}`,
        steam_top_seller,
        steam_most_played,
        hot_score,
      };
    });

    // Re-sort by hot_score (combined) when ordering=-added (default)
    if (ordering === '-added') {
      enriched.sort((a, b) => b.hot_score - a.hot_score);
    }

    return new Response(
      JSON.stringify({ year, ordering, total: enriched.length, games: enriched }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('get-trending-games error:', message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});