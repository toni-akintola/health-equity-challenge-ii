import { NextResponse } from "next/server";
import OpenAI from "openai";
import { getTractById } from "@/src/lib/tract-data";
import { getShapForTract } from "@/src/lib/get-shap-for-tract";
import { searchNCSL } from "@/src/lib/ncsl-tool";
import { webSearch } from "@/src/lib/web-search";
import { getShapFeatureLabel } from "@/src/lib/shap-labels";

const NCSL_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "search_ncsl",
    description:
      "Search the NCSL (National Conference of State Legislatures) Environment & Natural Resources Legislation Database for state and local environmental policies. Use this to find existing legislation that can inspire your recommendation (e.g. air quality, diesel, traffic, lead, wastewater, environmental justice).",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search topic, e.g. 'diesel PM reduction', 'traffic proximity', 'air quality environmental justice', 'lead paint', 'state environmental legislation'",
        },
      },
      required: ["query"],
    },
  },
};

const WEB_SEARCH_TOOL: OpenAI.Chat.Completions.ChatCompletionTool = {
  type: "function",
  function: {
    name: "web_search",
    description:
      "Search the web for current information about state or local politics, demographics, recent environmental legislation, who controls the state legislature or governorship, and political context. Use this to tailor your recommendation to the state and county (e.g. '[State] state legislature environmental legislation 2024', '[State] governor environmental policy', '[County] [State] demographics', '[State] political control senate house').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query for state/county politics, demographics, or recent environmental policy (include state or county name for relevance)",
        },
      },
      required: ["query"],
    },
  },
};

function geoid11(id: string): string {
  const num = String(id).replace(/\D/g, "");
  return num.padStart(11, "0");
}

const DEMOGRAPHIC_LABELS: Record<string, string> = {
  P_LOWINCPCT: "Low-income population (percentile)",
  P_PEOPCOLORPCT: "People of color (percentile)",
};

function buildTractContext(
  tract: Record<string, unknown>,
  shap: Awaited<ReturnType<typeof getShapForTract>>,
): string {
  const lines: string[] = [];
  const state = String(tract.ST_ABBREV ?? "");
  const county = String(tract.CNTY_NAME ?? "");
  lines.push(`Census tract: ${tract.ID} (${state}, ${county})`);
  lines.push("");

  lines.push("Demographics (use these to tailor equity and outreach):");
  for (const [key, label] of Object.entries(DEMOGRAPHIC_LABELS)) {
    const v = tract[key];
    if (v != null) lines.push(`  ${label}: ${v}`);
  }
  lines.push("");

  lines.push("Environmental indicators (percentiles):");
  const envVars = [
    "P_PM25",
    "P_OZONE",
    "P_DSLPM",
    "P_PTRAF",
    "P_LDPNT",
    "P_PNPL",
    "P_PRMP",
    "P_PTSDF",
    "P_UST",
    "P_PWDIS",
  ];
  for (const k of envVars) {
    const v = tract[k];
    if (v != null) lines.push(`  ${k}: ${v}`);
  }
  lines.push("");
  lines.push("Outcomes (risk indicators):");
  if (tract.P_CANCER != null)
    lines.push(`  P_CANCER (cancer risk): ${tract.P_CANCER}`);
  if (tract.P_RESP != null)
    lines.push(`  P_RESP (respiratory hazard): ${tract.P_RESP}`);
  lines.push("");

  if (shap) {
    lines.push(
      "Top environmental factors that INCREASE risk in this tract (from SHAP analysis):",
    );
    const cancerIncrease = shap.cancer
      .filter((e) => e.shap > 0)
      .map((e) => getShapFeatureLabel(e.feature));
    const respIncrease = shap.resp
      .filter((e) => e.shap > 0)
      .map((e) => getShapFeatureLabel(e.feature));
    if (cancerIncrease.length)
      lines.push(`  Cancer risk: ${cancerIncrease.join(", ")}`);
    if (respIncrease.length)
      lines.push(`  Respiratory risk: ${respIncrease.join(", ")}`);
    if (!cancerIncrease.length && !respIncrease.length)
      lines.push("  (None of the top factors increase risk in this tract.)");
  } else {
    lines.push("SHAP driver data not available for this tract.");
  }

  return lines.join("\n");
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  if (!id) {
    return NextResponse.json({ error: "Missing tract ID" }, { status: 400 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local." },
      { status: 503 },
    );
  }

  const tract = await getTractById(id);
  if (!tract) {
    return NextResponse.json({ error: "Tract not found." }, { status: 404 });
  }

  const stateAbbrev = tract.ST_ABBREV as string;
  const shap = await getShapForTract(id, stateAbbrev);
  const tractContext = buildTractContext(tract, shap);

  const systemContent = `You are a policy advisor focused on environmental justice and health equity. You produce short, actionable state-level or local-level policy proposals to reduce environmental health risks in specific census tracts.

**Emphasis: specificity, evidence, and uniqueness**
- Be **highly specific**: name this tract's risk drivers, geography, and demographics. Avoid generic boilerplate; every sentence should earn its place by tying to this tract or to cited evidence.
- **Policy evidence comes only from the NCSL database.** Use search_ncsl to find real state/local legislation. Do not cite policies, bills, or programs as evidence unless they appear in NCSL search results. Web search is for political context only—not for policy citations.
- When you cite a past policy as a model to build on or "riff off of," **check whether that policy worked.** If NCSL or the tool results include outcomes, evaluations, or success stories, use that as justification (e.g. "Similar measures in [state] were associated with …"). If you cannot determine effectiveness, either say so briefly or frame the citation as a structural precedent rather than an evidence-based one. Where there is evidence a cited policy worked well, use it explicitly to strengthen the recommendation.
- Make the proposal **robust and unique**: concrete actions, named programs or bill types, and reasoning that would not apply to any random tract. Avoid filler; prefer dense, tract-specific and evidence-based content.

**Data you receive:**
- **Demographics** for the tract (e.g. low-income percentile, people-of-color percentile). Use these to tailor equity, outreach, and language—e.g. prioritize community engagement and benefits for overburdened populations when those percentiles are high.
- **Environmental indicators and risk outcomes** (cancer and respiratory risk, and which factors most increase risk in this tract from SHAP analysis).

**Tools:**
1. **search_ncsl**: Queries the NCSL Environment & Natural Resources Legislation Database. This is your **only source for policy evidence**. Use it to find existing state/local legislation (diesel, traffic, air quality, lead, wastewater, environmental justice). Call it with relevant queries before drafting. Cite only legislation/results you find here when making policy arguments.
2. **web_search**: General web search. Use it **only** for **state and local politics** and context (e.g. who controls the legislature or governorship, recent environmental votes, political leanings, county demographics). Do not use web search results as citations for specific policies or legislation. If web search returns "not configured", proceed without it.

Given the tract's **location, demographics, environmental risk drivers, and (when available) political context**, write a bespoke policy proposal (1–2 pages) in Markdown that:
1. Summarizes the main risk drivers and, where relevant, the demographic context (e.g. overburdened communities) for **this** tract—by name and specifics.
2. Recommends concrete state or local actions that are feasible given the political context when you have it (e.g. bipartisan framing, existing committees, recent legislation). Ground recommendations in NCSL results; where you cite a prior policy as a model, note whether it worked and use that as justification when available.
3. Includes citations: a "References" or "Sources" section at the end; inline refs (e.g. "see [1]"); Markdown links **only** to NCSL and state/policy links returned by search_ncsl (and political-context links from web search if you mention politics). Do not cite policy from web search.

Write in clear, professional language. Be specific, evidence-based, and unique to this tract. Output only the proposal content in Markdown (no surrounding explanation).`;

  const userContent = `Generate a policy proposal for this census tract. Be specific to this tract; use only NCSL (search_ncsl) for policy evidence and citations. Use web_search only for state/county politics and context. When citing a past policy as a model, note whether it worked and use that as justification where possible. Then write your recommendation.\n\n---\n\n${tractContext}`;

  const client = new OpenAI({ apiKey });

  type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const messages: Message[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];

  const maxToolRounds = 5;
  let round = 0;
  let lastMessage: OpenAI.Chat.Completions.ChatCompletionMessage | null = null;

  const tools: OpenAI.Chat.Completions.ChatCompletionTool[] = [
    NCSL_TOOL,
    WEB_SEARCH_TOOL,
  ];

  while (round < maxToolRounds) {
    const completion = await client.chat.completions.create({
      model: "gpt-4o",
      messages,
      tools,
      max_completion_tokens: 16000,
      tool_choice: "auto",
    });

    lastMessage = completion.choices[0]?.message ?? null;
    if (!lastMessage) {
      return NextResponse.json(
        { error: "No response from model." },
        { status: 502 },
      );
    }

    messages.push(lastMessage);

    const toolCalls = lastMessage.tool_calls;
    if (!toolCalls?.length) {
      break;
    }

    for (const tc of toolCalls) {
      let args: { query?: string } = {};
      try {
        args = JSON.parse(tc.function?.arguments ?? "{}");
      } catch {
        args = { query: "" };
      }
      const query = args.query ?? "";
      const name = tc.function?.name ?? "";
      const result =
        name === "search_ncsl"
          ? await searchNCSL(query || "environmental legislation")
          : name === "web_search"
            ? await webSearch(query || "state environmental policy")
            : "[Unknown tool.]";
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: result,
      });
    }
    round++;
  }

  const proposal = lastMessage?.content ?? "";
  return NextResponse.json({
    proposal: proposal.trim(),
    tractId: geoid11(id),
    state: stateAbbrev,
    county: tract.CNTY_NAME,
  });
}
