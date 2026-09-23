type CarouselProduct = {
  id: string;
  title: string;
  image_url: string | null;
};

const BLOCKED_PATTERNS = [
  /\bdlc\b/i,
  /top\s*up/i,
  /gift\s*card/i,
  /prepaid/i,
  /wallet/i,
  /subscription/i,
  /season\s*pass/i,
  /currency/i,
  /v-bucks/i,
  /bundle/i,
  /expansion/i,
  /\badd-?on\b/i,
  /mystery/i,
  /skins?\s*\/?\s*items?/i,
  /voucher/i,
  /\bcoin(s)?\b/i,
  /\bpoint(s)?\b/i,
  /legends?\s*pack/i,
  /starter\s*pack/i,
  /founder'?s\s*pack/i,
  /credits?/i,
  /shards?/i,
  /battle\s*pass/i,
];

const TITLE_NOISE_PATTERNS = [
  /\s*[-–—:]\s*(pc|xbox|xbox one|xbox series x\|s|xbox series|playstation|ps4|ps5|nintendo switch|switch|gog|steam|ea app|epic games?|ubisoft connect).*$/i,
  /\b(deluxe|ultimate|gold|complete|collector'?s|premium|pro|elite|goty|game of the year|standard|bundle|edition)\b/gi,
  /\b(cd key|key|account|global|eu|na|usa|uk|row)\b/gi,
  /\([^)]*\)/g,
  /\[[^\]]*\]/g,
];

export function getCarouselWeekKey(date = new Date()) {
  const utcDate = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const day = utcDate.getUTCDay() || 7;
  utcDate.setUTCDate(utcDate.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(utcDate.getUTCFullYear(), 0, 1));
  const weekNumber = Math.ceil((((utcDate.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${utcDate.getUTCFullYear()}-${weekNumber}`;
}

function hashString(value: string) {
  let hash = 2166136261;

  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

export function isFullGameTitle(title: string) {
  return !BLOCKED_PATTERNS.some((pattern) => pattern.test(title));
}

export function normalizeCarouselTitle(title: string) {
  let normalized = title.toLowerCase();

  for (const pattern of TITLE_NOISE_PATTERNS) {
    normalized = normalized.replace(pattern, " ");
  }

  return normalized
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(the|and|for|of|edition|remastered|remake)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizeImageUrl(imageUrl: string | null) {
  return (imageUrl || "")
    .split("?")[0]
    .replace(/\/$/, "")
    .toLowerCase();
}

function normalizeImageAssetKey(imageUrl: string | null) {
  const normalizedUrl = normalizeImageUrl(imageUrl);

  if (!normalizedUrl) return "";

  const fileName = normalizedUrl.split("/").pop() || "";

  return fileName
    .replace(/\.[a-z0-9]+$/i, "")
    .replace(/(?:-|_)?(?:800|700|111|big|large|main|cover)$/gi, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function selectWeeklyCarouselProducts(products: CarouselProduct[], limit = 6) {
  const weekKey = getCarouselWeekKey();
  const seenTitles = new Set<string>();
  const seenImages = new Set<string>();
  const seenImageAssets = new Set<string>();

  const ranked = [...products]
    .filter((product) => product.image_url && isFullGameTitle(product.title))
    .sort((a, b) => {
      const rankA = hashString(`${weekKey}:${normalizeCarouselTitle(a.title)}:${a.id}`);
      const rankB = hashString(`${weekKey}:${normalizeCarouselTitle(b.title)}:${b.id}`);
      if (rankA !== rankB) return rankA - rankB;

      return a.id.localeCompare(b.id);
    });

  const selected: CarouselProduct[] = [];

  for (const product of ranked) {
    const normalizedTitle = normalizeCarouselTitle(product.title);
    const normalizedImage = normalizeImageUrl(product.image_url);
    const normalizedImageAsset = normalizeImageAssetKey(product.image_url);

    if (!normalizedTitle || !normalizedImage) continue;
    if (seenTitles.has(normalizedTitle) || seenImages.has(normalizedImage)) continue;
    if (normalizedImageAsset && seenImageAssets.has(normalizedImageAsset)) continue;

    seenTitles.add(normalizedTitle);
    seenImages.add(normalizedImage);
    if (normalizedImageAsset) seenImageAssets.add(normalizedImageAsset);
    selected.push(product);

    if (selected.length >= limit) break;
  }

  return selected;
}