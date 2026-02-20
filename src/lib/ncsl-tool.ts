/**
 * Tool for the LLM to search the NCSL Environment & Natural Resources Legislation Database.
 * Fetches the database page (and optional topic/search) and returns cleaned text for context.
 * @see https://www.ncsl.org/environment-and-natural-resources/environment-and-natural-resources-legislation-database
 */

const NCSL_BASE =
  "https://www.ncsl.org/environment-and-natural-resources/environment-and-natural-resources-legislation-database";
const MAX_TEXT_CHARS = 12_000;

function stripHtml(html: string): string {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, " ")
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export async function searchNCSL(query: string): Promise<string> {
  const url = NCSL_BASE;
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; HealthEquityBot/1.0; +https://github.com/health-equity)",
        Accept: "text/html",
      },
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return `[NCSL database returned ${res.status}. Use the database for inspiration: ${NCSL_BASE}. Focus on state legislation related to: ${query}.]`;
    }
    const html = await res.text();
    const text = stripHtml(html);
    const truncated =
      text.length > MAX_TEXT_CHARS
        ? text.slice(0, MAX_TEXT_CHARS) + "\n\n[Content truncated.]"
        : text;
    return `NCSL Environment & Natural Resources Legislation Database (query: "${query}"):\n\n${truncated}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `[Could not fetch NCSL database (${message}). Recommend policies inspired by state and local environmental legislation. Search manually: ${NCSL_BASE}. Relevant topics: ${query}.]`;
  }
}
