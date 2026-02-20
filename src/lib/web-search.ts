/**
 * Web search via Exa API for the policy proposal LLM (state/county politics, recent legislation, etc.).
 * Set EXA_API_KEY in .env.local to enable. If unset, returns a message so the model can proceed without it.
 */

const EXA_SEARCH_URL = "https://api.exa.ai/search";

export async function webSearch(query: string): Promise<string> {
  const apiKey = process.env.EXA_API_KEY;
  if (!apiKey?.trim()) {
    return "[Web search is not configured (EXA_API_KEY missing). Proceed using only the tract data and NCSL tool. Do not mention web search.]";
  }

  try {
    const res = await fetch(EXA_SEARCH_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey.trim(),
      },
      body: JSON.stringify({
        query,
        type: "auto",
        numResults: 8,
        contents: { text: { maxCharacters: 1500 } },
      }),
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      const err = await res.text();
      return `[Web search failed (${res.status}): ${err.slice(0, 200)}. Proceed without web results.]`;
    }

    const data = (await res.json()) as {
      results?: {
        title: string;
        url: string;
        text?: string;
        highlights?: string[];
      }[];
    };
    const results = data.results ?? [];
    if (results.length === 0) {
      return `[No web results for: "${query}". Proceed with other context.]`;
    }

    const blocks = results.map((r, i) => {
      const content = r.text ?? (r.highlights ?? []).join(" ");
      return `[${i + 1}] ${r.title}\nURL: ${r.url}\n${content || "(No content)"}`;
    });
    return `Web search results for "${query}":\n\n${blocks.join("\n\n")}`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return `[Web search error: ${message.slice(0, 150)}. Proceed without web results.]`;
  }
}
