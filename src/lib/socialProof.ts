type SocialProofLike = {
  id?: string | null;
  title?: string | null;
  platform?: string | null;
  store?: string | null;
  region?: string | null;
  created_at?: string | null;
  sold_count?: number | null;
  wishlist_count?: number | null;
  badges?: string[] | null;
};

type ScopedIndex<T extends SocialProofLike> = {
  all: T[];
  byNormalizedTitle: Map<string, T[]>;
  byToken: Map<string, T[]>;
};

export type SocialProofIndex<T extends SocialProofLike> = {
  all: T[];
  byId: Map<string, T>;
  byScope: Map<string, ScopedIndex<T>>;
};

const TITLE_STOP_WORDS = new Set([
  "a",
  "an",
  "and",
  "card",
  "code",
  "digital",
  "for",
  "game",
  "gift",
  "global",
  "key",
  "online",
  "store",
  "the",
  "voucher",
]);

const normalizeTitle = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

const getTokens = (value?: string | null) =>
  normalizeTitle(value)
    .split(" ")
    .filter((token) => token && !TITLE_STOP_WORDS.has(token));

const getScopeKeys = (platform?: string | null, store?: string | null) => {
  const normalizedPlatform = (platform || "*").toLowerCase();
  const normalizedStore = (store || "*").toLowerCase();

  return [
    `${normalizedPlatform}|||${normalizedStore}`,
    `${normalizedPlatform}|||*`,
    `*|||${normalizedStore}`,
    `*|||*`,
  ];
};

const getOrCreateScopedIndex = <T extends SocialProofLike>(
  byScope: Map<string, ScopedIndex<T>>,
  key: string
) => {
  const existing = byScope.get(key);
  if (existing) return existing;

  const created: ScopedIndex<T> = {
    all: [],
    byNormalizedTitle: new Map(),
    byToken: new Map(),
  };
  byScope.set(key, created);
  return created;
};

const pushUnique = <T>(list: T[], value: T) => {
  if (!list.includes(value)) list.push(value);
};

export const buildSocialProofIndex = <T extends SocialProofLike>(allowedProducts: T[]): SocialProofIndex<T> => {
  const byId = new Map<string, T>();
  const byScope = new Map<string, ScopedIndex<T>>();

  allowedProducts.forEach((product) => {
    if (product.id) byId.set(product.id, product);

    getScopeKeys(product.platform, product.store).forEach((scopeKey) => {
      const scope = getOrCreateScopedIndex(byScope, scopeKey);
      scope.all.push(product);

      const normalizedTitle = normalizeTitle(product.title);
      if (normalizedTitle) {
        const titleMatches = scope.byNormalizedTitle.get(normalizedTitle) || [];
        titleMatches.push(product);
        scope.byNormalizedTitle.set(normalizedTitle, titleMatches);
      }

      getTokens(product.title).forEach((token) => {
        const tokenMatches = scope.byToken.get(token) || [];
        pushUnique(tokenMatches, product);
        scope.byToken.set(token, tokenMatches);
      });
    });
  });

  return { all: allowedProducts, byId, byScope };
};

const getMatchScore = (target: SocialProofLike, candidate: SocialProofLike) => {
  if (!target.title || !candidate.title) return 0;
  if (target.platform && candidate.platform && target.platform !== candidate.platform) return 0;
  if (target.store && candidate.store && target.store !== candidate.store) return 0;
  if (target.id && candidate.id && target.id === candidate.id) return 1000;

  const targetTitle = normalizeTitle(target.title);
  const candidateTitle = normalizeTitle(candidate.title);

  if (!targetTitle || !candidateTitle) return 0;
  if (targetTitle === candidateTitle) return 900;
  if (targetTitle.includes(candidateTitle) || candidateTitle.includes(targetTitle)) {
    return 700 - Math.abs(targetTitle.length - candidateTitle.length);
  }

  const targetTokens = getTokens(target.title);
  const candidateTokens = getTokens(candidate.title);
  if (targetTokens.length === 0 || candidateTokens.length === 0) return 0;

  const targetSet = new Set(targetTokens);
  const commonTokens = candidateTokens.filter((token) => targetSet.has(token));

  if (commonTokens.length === 0) return 0;

  const uniqueCommonTokens = new Set(commonTokens);
  const firstTokenBonus = targetTokens[0] === candidateTokens[0] ? 40 : 0;
  const densityBonus = uniqueCommonTokens.size >= 2 ? 120 : 0;
  const coverageBonus = Math.round((uniqueCommonTokens.size / Math.max(targetSet.size, candidateTokens.length)) * 100);

  return uniqueCommonTokens.size * 120 + densityBonus + coverageBonus + firstTokenBonus;
};

export const getAllowedProductMatches = <T extends SocialProofLike>(
  target: SocialProofLike,
  socialProofIndex: SocialProofIndex<T>
) => {
  if (target.id && socialProofIndex.byId.has(target.id)) {
    return [socialProofIndex.byId.get(target.id)!];
  }

  const normalizedTitle = normalizeTitle(target.title);
  const scopeCandidates = getScopeKeys(target.platform, target.store)
    .map((scopeKey) => socialProofIndex.byScope.get(scopeKey))
    .filter(Boolean) as ScopedIndex<T>[];

  for (const scope of scopeCandidates) {
    const exactMatches = scope.byNormalizedTitle.get(normalizedTitle);
    if (exactMatches?.length) return exactMatches;
  }

  const candidateMap = new Map<T, number>();
  const targetTokens = getTokens(target.title);

  scopeCandidates.forEach((scope) => {
    targetTokens.forEach((token) => {
      const tokenMatches = scope.byToken.get(token) || [];
      tokenMatches.forEach((candidate) => {
        candidateMap.set(candidate, (candidateMap.get(candidate) || 0) + 1);
      });
    });
  });

  const candidates = candidateMap.size > 0
    ? Array.from(candidateMap.keys())
    : (scopeCandidates[0]?.all || socialProofIndex.all);

  const scored = candidates
    .map((candidate) => ({ candidate, score: getMatchScore(target, candidate) }))
    .filter(({ score }) => score >= 180)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) return [] as T[];

  const bestScore = scored[0].score;
  return scored
    .filter(({ score }) => score >= Math.max(180, bestScore - 120))
    .map(({ candidate }) => candidate);
};

export const findBestAllowedProduct = <T extends SocialProofLike>(
  target: SocialProofLike,
  socialProofIndex: SocialProofIndex<T>
) => getAllowedProductMatches(target, socialProofIndex)[0];

export const resolveSocialProof = <T extends SocialProofLike>(
  target: SocialProofLike,
  socialProofIndex: SocialProofIndex<T>
) => {
  const matches = getAllowedProductMatches(target, socialProofIndex);
  const bestMatch = matches[0];

  return {
    bestMatch,
    matches,
    soldCount: matches.reduce((max, item) => Math.max(max, Number(item.sold_count) || 0), 0),
    wishlistCount: matches.reduce((max, item) => Math.max(max, Number(item.wishlist_count) || 0), 0),
    region: bestMatch?.region || null,
    createdAt: bestMatch?.created_at || null,
  };
};