import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const KINGUIN_API = 'https://gateway.kinguin.net/esa/api/v1';
const STRICT_TOKEN_TERMS = new Set([
  'us', 'eu', 'uk', 'ae', 'sa', 'qa', 'kw', 'bh', 'om', 'lb', 'jo', 'iq', 'eg',
  'usd', 'eur', 'gbp', 'aed', 'sar', 'qar', 'kwd', 'omr', 'bhd',
]);
const GENERIC_SEARCH_TERMS = new Set(['cd', 'key', 'keys', 'code', 'digital', 'online', 'edition', 'account', 'accounts']);
const PLATFORM_MODIFIER_TERMS = new Set(['series', 'xbox', 'playstation', 'ps4', 'ps5', 'steam', 'pc', 'switch', 'nintendo']);
const STOP_WORDS = new Set(['the', 'and', 'for', 'with', 'from', 'that', 'this', 'but', 'not', 'are', 'was', 'were', 'been', 'being', 'have', 'has', 'had', 'its']);

// Aliases for short region/currency codes to match full names in product titles
const TERM_ALIASES: Record<string, string[]> = {
  'us': ['united', 'states'],
  'uk': ['united', 'kingdom'],
  'eu': ['europe'],
  'sa': ['saudi', 'arabia'],
  'ae': ['uae'],
  'uae': ['ae'],
};

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\$/g, ' usd ')
    .replace(/€/g, ' eur ')
    .replace(/£/g, ' gbp ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchesTerm(normalizedName: string, tokenSet: Set<string>, term: string): boolean {
  if (!term) return true;
  if (term.length <= 2 || STRICT_TOKEN_TERMS.has(term)) {
    // Exact token match first
    if (tokenSet.has(term)) return true;
    // Try alias expansion (e.g. "us" → check for "united" + "states")
    const aliases = TERM_ALIASES[term];
    if (aliases) return aliases.every(a => normalizedName.includes(a));
    return false;
  }
  return tokenSet.has(term) || normalizedName.includes(term);
}

function matchesAllTerms(productName: string, terms: string[]): boolean {
  const normalizedName = normalizeSearchText(productName || '');
  if (!normalizedName) return false;
  const tokenSet = new Set(normalizedName.split(' ').filter(Boolean));
  return terms.every((term) => matchesTerm(normalizedName, tokenSet, term));
}

// Kinguin sorts the catalog by updatedAt while we page through it, so a
// product whose stock/price gets touched mid-scan can shift pages and land
// in two of our page fetches — same productId, duplicated in the merged list.
function dedupeByProductId(products: any[]): any[] {
  const seen = new Set<string>();
  const out: any[] = [];
  for (const p of products) {
    const id = p?.productId || (p?.kinguinId != null ? String(p.kinguinId) : '');
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(p);
  }
  return out;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const KINGUIN_API_KEY = Deno.env.get('KINGUIN_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!KINGUIN_API_KEY) throw new Error('KINGUIN_API_KEY not configured');
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error('Backend auth secrets are not configured');
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Not authenticated' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();

    const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: { headers: { Authorization: authHeader } },
    });

    const adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let userId: string | null = null;
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    if (claimsError || !claimsData?.claims?.sub) {
      // Fallback to getUser if getClaims fails (TLS issues)
      const adminClient2 = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      const { data: userData, error: userError } = await adminClient2.auth.getUser(token);
      if (userError || !userData?.user) {
        console.error('JWT validation failed:', claimsError?.message ?? userError?.message ?? 'Missing claims');
        return new Response(JSON.stringify({ error: 'Not authenticated' }), {
          status: 401,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      userId = userData.user.id;
    } else {
      userId = claimsData.claims.sub as string;
    }

    const { data: roleRows, error: roleError } = await adminClient
      .from('user_roles')
      .select('role')
      .eq('user_id', userId)
      .in('role', ['admin', 'super_admin']);

    if (roleError) {
      console.error('Role lookup failed:', roleError.message);
      throw new Error('Failed to verify admin access');
    }

    if (!roleRows?.length) {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { searchParams } = new URL(req.url);
    const body = req.method === 'POST' ? await req.json().catch(() => ({})) : {};
    const query = body.query ?? searchParams.get('query') ?? '';
    const page = String(body.page ?? searchParams.get('page') ?? '1');
    const limit = String(body.limit ?? searchParams.get('limit') ?? '50');
    const tagsParam = body.tags ?? searchParams.get('tags') ?? '';
    const platformParam = body.platform ?? searchParams.get('platform') ?? '';
    const fullScan = (body.fullScan ?? searchParams.get('fullScan')) === true || (body.fullScan ?? searchParams.get('fullScan')) === 'true';
    const rawSortBy = body.sortBy ?? searchParams.get('sortBy') ?? 'updatedAt';
    // Kinguin API v1 only accepts kinguinId or updatedAt for sortBy.
    const apiSortBy = (rawSortBy === 'kinguinId' || rawSortBy === 'updatedAt') ? rawSortBy : 'updatedAt';
    const apiSortType = body.sortType ?? searchParams.get('sortType') ?? 'desc';

    const normalizedQuery = normalizeSearchText(query);

    // Single-char tokens are noise (e.g. "x" and "s" from "X|S") — drop them entirely
    const words = normalizedQuery.split(/\s+/).filter(w => w.length > 1 || /^\d+$/.test(w));
    // Numeric terms (like "6" or "3") go to the API even if short — they narrow results significantly
    // Stop words (the, and, for...) are excluded from API queries but kept for post-filtering
    const apiWords = words.filter(w => ((w.length > 2 && !STRICT_TOKEN_TERMS.has(w)) || /^\d+$/.test(w)) && !STOP_WORDS.has(w));
    const filterWords = words.filter(w => !apiWords.includes(w));

    const buildApiQueryCandidates = (tokens: string[], originalQuery: string) => {
      const candidates: string[] = [];
      const pushCandidate = (parts: string[] | string) => {
        const candidate = Array.isArray(parts) ? parts.join(' ').trim() : parts.trim();
        if (candidate && candidate.length >= 3 && !candidates.includes(candidate)) candidates.push(candidate);
      };

      // Try the original raw query first (preserves $, €, etc. that Kinguin API understands)
      const rawCleaned = originalQuery.trim().replace(/[^a-zA-Z0-9$€£\s]/g, ' ').replace(/\s+/g, ' ').trim();
      if (rawCleaned.length >= 3) pushCandidate(rawCleaned);

      // Full normalized query
      pushCandidate(tokens);
      // Without generic terms
      const noGeneric = tokens.filter((token) => !GENERIC_SEARCH_TERMS.has(token));
      pushCandidate(noGeneric);
      // Without generic + platform
      const core = noGeneric.filter((token) => !PLATFORM_MODIFIER_TERMS.has(token));
      pushCandidate(core);
      // First 3 core tokens
      pushCandidate(core.filter((token) => /^\d+$/.test(token) || true).slice(0, 3));

      // Consecutive pairs (e.g. "tomb raider" from ["shadow", "tomb", "raider"])
      for (let i = 0; i < core.length - 1; i++) {
        pushCandidate([core[i], core[i + 1]]);
      }

      // Individual words sorted by length desc (longer = more specific = better)
      const singles = [...core].sort((a, b) => b.length - a.length);
      for (const word of singles) {
        pushCandidate([word]);
      }

      return candidates;
    };

    const apiQueryCandidates = buildApiQueryCandidates(apiWords, query);
    // Force multi-word scanning when we have filter words OR when the query has 2+ api words
    // (Kinguin API phrase matching is strict, so we always need client-side filtering for multi-word)
    const isMultiWord = filterWords.length > 0 || apiWords.length > 1;
    const scanLimit = fullScan ? '100' : '';

    const fetchPage = async (queryText: string, p: number): Promise<any> => {
      // Kinguin API requires name to be at least 3 characters
      const safeName = queryText && queryText.length >= 3 ? queryText : '';
      const params = new URLSearchParams();
      if (safeName) params.set('name', safeName);
      params.set('page', String(p));
      params.set('limit', scanLimit || limit);
      params.set('sortBy', apiSortBy);
      params.set('sortType', apiSortType);
      if (tagsParam) params.set('tags', tagsParam);
      if (platformParam) params.set('platform', platformParam);
      const url = `${KINGUIN_API}/products?${params.toString()}`;

      const response = await fetch(url, {
        headers: {
          'X-Api-Key': KINGUIN_API_KEY.trim(),
          'Accept': 'application/json',
        },
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(`Kinguin API error [${response.status}]: ${text}`);
      }

      return response.json();
    };

    const fetchBestFirstPage = async () => {
      if (!apiQueryCandidates.length) {
        return { queryText: '', data: await fetchPage('', 1) };
      }

      let fallbackResult: any = null;
      let fallbackQuery = apiQueryCandidates[0];

      for (const candidate of apiQueryCandidates) {
        const data = await fetchPage(candidate, 1);
        if (!fallbackResult) {
          fallbackResult = data;
          fallbackQuery = candidate;
        }
        if ((data.item_count || 0) > 0 || (data.results?.length || 0) > 0) {
          return { queryText: candidate, data };
        }
      }

      return { queryText: fallbackQuery, data: fallbackResult ?? { results: [], item_count: 0 } };
    };

    // Full scan mode: load all pages for cross-page sorting/filtering
    if (fullScan) {
      const firstPage = await fetchPage('', 1);
      const totalCount = firstPage.item_count || 0;
      const MAX_PAGES = 50; // Cap at 50 pages × 100 = 5000 products
      const pageLimit = parseInt(scanLimit || limit);
      const totalPages = Math.min(Math.ceil(totalCount / pageLimit), MAX_PAGES);

      console.log(`Full scan: total items: ${totalCount}, pages to fetch: ${totalPages}`);

      let allResults = firstPage.results || [];

      const BATCH_SIZE = 5;
      for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        const pages = [];
        for (let p = batchStart; p <= batchEnd; p++) pages.push(p);

        const batchResults = await Promise.all(
          pages.map(p => fetchPage('', p).catch(err => {
            console.error(`Failed to fetch page ${p}: ${err.message}`);
            return { results: [] };
          }))
        );

        for (const result of batchResults) {
          if (result.results) allResults.push(...result.results);
        }

        if (batchEnd < totalPages) {
          await new Promise(r => setTimeout(r, 150));
        }
      }

      allResults = dedupeByProductId(allResults);

      console.log(`Full scan complete: ${allResults.length} products loaded`);

      return new Response(JSON.stringify({
        results: allResults,
        item_count: allResults.length,
        total_scanned: allResults.length,
        full_scan: true,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (isMultiWord) {
      const { queryText: selectedApiQuery, data: firstPage } = await fetchBestFirstPage();
      const totalCount = firstPage.item_count || 0;
      const MAX_PAGES = 8; // Reduced from 20 for speed
      const pageLimit = parseInt(limit);
      const totalPages = Math.min(Math.ceil(totalCount / pageLimit), MAX_PAGES);
      const TARGET_MATCHES = 80; // Stop early when we have enough matches

      console.log(`Multi-word search: "${query}" → API query "${selectedApiQuery}", filter words: [${filterWords.join(', ')}], total items: ${totalCount}, pages: ${totalPages}`);

      let allResults = firstPage.results || [];
      const allSearchWords = words;
      
      // Check first page matches immediately
      let filtered = allResults.filter((product: any) => matchesAllTerms(product.name || '', allSearchWords));

      // Fetch remaining pages in parallel batches, with early termination
      const BATCH_SIZE = 4;
      for (let batchStart = 2; batchStart <= totalPages; batchStart += BATCH_SIZE) {
        if (filtered.length >= TARGET_MATCHES) break; // Early termination
        
        const batchEnd = Math.min(batchStart + BATCH_SIZE - 1, totalPages);
        const pages = [];
        for (let p = batchStart; p <= batchEnd; p++) pages.push(p);

        const batchResults = await Promise.all(
          pages.map(p => fetchPage(selectedApiQuery, p).catch(err => {
            console.error(`Failed to fetch page ${p}: ${err.message}`);
            return { results: [] };
          }))
        );

        for (const result of batchResults) {
          if (result.results) {
            allResults.push(...result.results);
            // Filter incrementally
            const newMatches = result.results.filter((product: any) => matchesAllTerms(product.name || '', allSearchWords));
            filtered.push(...newMatches);
          }
        }
      }

      filtered = dedupeByProductId(filtered);

      console.log(`Scanned ${allResults.length} products, found ${filtered.length} matches`);

      return new Response(JSON.stringify({
        results: filtered,
        item_count: filtered.length,
        total_scanned: allResults.length,
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const pageNum = parseInt(page);
    if (pageNum > 1) {
      // For subsequent pages, use the best API query from page 1 logic but fetch the requested page
      const { queryText: selectedApiQuery } = await fetchBestFirstPage();
      const data = await fetchPage(selectedApiQuery, pageNum);
      console.log(`Single-word search: "${selectedApiQuery}", page ${pageNum}, results: ${data.results?.length ?? 0}`);
      return new Response(JSON.stringify(data), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { queryText: selectedApiQuery, data } = await fetchBestFirstPage();

    console.log(`Single-word search: "${selectedApiQuery}", page 1, results: ${data.results?.length ?? 0}`);

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
