import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RawgGame {
  id: number;
  name: string;
  released: string | null;
  background_image: string | null;
  rating: number;
  added: number;
  metacritic: number | null;
}

function normalizeTitle(s: string): string {
  return s
    .toLowerCase()
    .replace(/[™®©]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripCatalogSuffixes(s: string): string {
  let out = s;
  const dashIdx = out.indexOf(' - ');
  if (dashIdx > 3) out = out.slice(0, dashIdx);
  out = out.replace(/\([^)]*\)/g, ' ');
  return out;
}

function normalizeCatalogTitle(s: string): string {
  let n = normalizeTitle(stripCatalogSuffixes(s));
  n = n
    .replace(/\b(steam|epic|gog|origin|uplay|ubisoft|xbox|playstation|ps4|ps5|nintendo|switch|pc|key|games|game|global|europe|us|usa|united states|united kingdom|uk|latin america|australia|canada|poland|rest of world|deluxe|edition|standard|complete|ultimate|gold|premium|digital|download|code|cd)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return n;
}

async function fetchSteamTopSellers(): Promise<Set<string>> {
  try {
    const res = await fetch('https://store.steampowered.com/api/featuredcategories?cc=us&l=en');
    if (!res.ok) return new Set();
    const data = await res.json();
    const items = data?.top_sellers?.items || [];
    return new Set(items.map((i: any) => normalizeTitle(i.name || '')));
  } catch {
    return new Set();
  }
}

// Cache for 1 hour to avoid hammering RAWG
let cache: { ts: number; data: any } | null = null;
const CACHE_MS = 60 * 60 * 1000;

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  let stage = 'init';
  try {
    if (cache && Date.now() - cache.ts < CACHE_MS) {
      return new Response(JSON.stringify(cache.data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    stage = 'env';
    const RAWG_API_KEY = Deno.env.get('RAWG_API_KEY');
    if (!RAWG_API_KEY) throw new Error('RAWG_API_KEY is not configured');

    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
    const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const adminClient = createClient(SUPABASE_URL, SERVICE_KEY);

    stage = 'rawg';
    const currentYear = new Date().getFullYear();
    // Pull both this year and last year for a richer pool of "hot & new"
    const rawgUrls = [
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&dates=${currentYear}-01-01,${currentYear}-12-31&ordering=-added&page_size=40`,
      `https://api.rawg.io/api/games?key=${RAWG_API_KEY}&dates=${currentYear - 1}-01-01,${currentYear - 1}-12-31&ordering=-added&page_size=40`,
    ];

    const [rawgA, rawgB, steamTop] = await Promise.all([
      fetch(rawgUrls[0]).then((r) => r.ok ? r.json() : { results: [] }),
      fetch(rawgUrls[1]).then((r) => r.ok ? r.json() : { results: [] }),
      fetchSteamTopSellers(),
    ]);

    console.log(`rawgA=${(rawgA.results || []).length} rawgB=${(rawgB.results || []).length} steam=${steamTop.size}`);
    stage = 'catalog';
    const games: RawgGame[] = [...(rawgA.results || []), ...(rawgB.results || [])];
    if (games.length === 0) {
      const empty = { games: [] };
      cache = { ts: Date.now(), data: empty };
      return new Response(JSON.stringify(empty), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }

    // Load catalog (only active products with images)
    async function loadCatalog() {
      const all: Array<{ id: string; title: string; slug: string | null; image_url: string | null }> = [];
      const PAGE = 1000;
      for (let from = 0; from < 20000; from += PAGE) {
        const { data, error } = await adminClient
          .from('allowed_products')
          .select('id, title, slug, image_url')
          .not('image_url', 'is', null)
          .range(from, from + PAGE - 1);
        if (error) throw new Error(`loadCatalog page ${from}: ${error.message}`);
        if (!data || data.length === 0) break;
        all.push(...(data as any));
        if (data.length < PAGE) break;
      }
      return all;
    }

    const catalog = await loadCatalog();
    console.log(`catalog size=${catalog.length}`);
    stage = 'match';
    const catalogMap = new Map<string, { id: string; slug: string | null; title: string; image_url: string | null }>();
    catalog.forEach((p: any) => {
      const norm = normalizeCatalogTitle(p.title || '');
      if (norm && !catalogMap.has(norm)) {
        catalogMap.set(norm, { id: p.id, slug: p.slug, title: p.title, image_url: p.image_url });
      }
    });

    type Out = {
      id: string;
      title: string;
      slug: string | null;
      image_url: string | null;
      hot_score: number;
    };
    const seen = new Set<string>();
    const out: Out[] = [];

    for (const g of games) {
      const norm = normalizeCatalogTitle(g.name);
      if (!norm) continue;
      let match = catalogMap.get(norm);
      if (!match) {
        for (const [k, v] of catalogMap.entries()) {
          if (k === norm || k.startsWith(norm + ' ') || norm.startsWith(k + ' ')) {
            match = v;
            break;
          }
        }
      }
      if (!match) continue;
      if (seen.has(match.id)) continue;
      seen.add(match.id);

      const steamNorm = normalizeTitle(g.name);
      let isSteamTop = steamTop.has(steamNorm);
      if (!isSteamTop) {
        for (const s of steamTop) {
          if ((s.includes(steamNorm) || steamNorm.includes(s)) && Math.abs(s.length - steamNorm.length) < 8) {
            isSteamTop = true; break;
          }
        }
      }
      const ratingScore = (g.rating || 0) * 10;
      const addedScore = Math.min(40, Math.log10((g.added || 1) + 1) * 8);
      const metacriticBoost = g.metacritic ? (g.metacritic / 10) : 0;
      const steamBoost = isSteamTop ? 30 : 0;
      const hot_score = Math.round(ratingScore + addedScore + metacriticBoost + steamBoost);

      out.push({
        id: match.id,
        title: match.title,
        slug: match.slug,
        image_url: match.image_url,
        hot_score,
      });
    }

    out.sort((a, b) => b.hot_score - a.hot_score);
    const top = out.slice(0, 12);

    const payload = { games: top };
    cache = { ts: Date.now(), data: payload };
    return new Response(JSON.stringify(payload), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    const stack = err instanceof Error ? err.stack : '';
    console.error(`get-public-trending-catalog error at stage=${stage}:`, message, stack);
    return new Response(JSON.stringify({ error: message, games: [] }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});