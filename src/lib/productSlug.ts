/**
 * Generate an SEO-friendly slug from a product title, platform, and region.
 * Example: "Monster Hunter Stories 3: Twisted Reflection - Xbox - Global"
 *   → "monster-hunter-stories-3-twisted-reflection-xbox-key-global"
 */
export function generateProductSlug(title: string, platform?: string, region?: string): string {
  // Try to extract platform/region from title suffix "- Platform - Region" if not provided
  const suffixMatch = title.match(/\s*-\s*([^-]+)\s*-\s*([^-]+)\s*$/);
  if (suffixMatch) {
    if (!platform) platform = suffixMatch[1].trim();
    if (!region) region = suffixMatch[2].trim();
  }

  // Strip the "- Platform - Region" suffix from base title
  let base = title.replace(/\s*-\s*[^-]+\s*-\s*[^-]+\s*$/, "").trim();
  
  let slug = base
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/(^-|-$)/g, "");

  // Append platform as "key" suffix
  if (platform) {
    const p = platform.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    slug += `-${p}-key`;
  } else {
    slug += "-key";
  }

  // Append region
  if (region) {
    const r = region.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    slug += `-${r}`;
  }

  return slug;
}

/**
 * Check if a string looks like a UUID
 */
export function isUUID(str: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}
