interface ImageTransformOptions {
  width?: number;
  height?: number;
  fit?: "contain" | "cover" | "scale-down" | "crop" | "pad";
  quality?: number;
}

// Kinguin serves product art through Cloudflare's Image Resizing
// (.../cdn-cgi/image/<params>/<path>) — rewriting the <params> segment lets
// us ask for a size appropriate to where the image is actually rendered and
// forces format=auto, so the browser gets WebP/AVIF instead of whatever the
// original happened to be. URLs not already behind cdn-cgi (Cloudflare has
// to own the origin to resize it) are returned unchanged.
export function standardizeImageUrl(
  url: string | null | undefined,
  { width = 600, height = 800, fit = "contain", quality = 85 }: ImageTransformOptions = {}
): string | null {
  if (!url) return null;
  try {
    const cfMatch = url.match(/^(https?:\/\/[^/]+)\/cdn-cgi\/image\/([^/]+)\/(.+)$/);
    if (cfMatch) {
      const [, origin, , imagePath] = cfMatch;
      return `${origin}/cdn-cgi/image/width=${width},height=${height},fit=${fit},format=auto,quality=${quality}/${imagePath}`;
    }
    return url;
  } catch {
    return url;
  }
}
