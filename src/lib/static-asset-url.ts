/**
 * Base URL for loading public assets at runtime (e.g. on Vercel serverless).
 * When set, data loaders should fetch from this URL instead of reading from fs.
 */
export function getStaticAssetBaseUrl(): string | null {
  const url = process.env.VERCEL_URL;
  if (!url) return null;
  return `https://${url}`;
}

/**
 * Load JSON from either filesystem (when baseUrl is null) or from the app's own URL.
 */
export async function loadJsonFromStaticAsset(
  baseUrl: string | null,
  publicPath: string,
  fsRead: () => Promise<string>,
): Promise<string> {
  if (baseUrl) {
    const res = await fetch(`${baseUrl}${publicPath.startsWith("/") ? "" : "/"}${publicPath}`);
    if (!res.ok) throw new Error(`Static asset fetch failed: ${res.status} ${publicPath}`);
    return res.text();
  }
  return fsRead();
}
