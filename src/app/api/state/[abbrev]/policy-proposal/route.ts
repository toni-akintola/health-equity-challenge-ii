import { NextResponse } from "next/server";
import OpenAI from "openai";
import { searchNCSL } from "@/src/lib/ncsl-tool";
import { webSearch } from "@/src/lib/web-search";
import { getStateSummary, buildStateContext } from "@/src/lib/state-summary";

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
      "Search the web for current information about state politics, who controls the legislature or governorship, recent environmental votes, and political context. Use this to tailor your recommendation to the state (e.g. '[State] legislature environmental policy 2024', '[State] governor environmental agenda', '[State] political control senate house').",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description:
            "Search query for state politics, legislature composition, governor, or recent environmental policy (include state name)",
        },
      },
      required: ["query"],
    },
  },
};

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ abbrev: string }> },
) {
  const { abbrev } = await params;
  if (!abbrev) {
    return NextResponse.json(
      { error: "Missing state abbreviation" },
      { status: 400 },
    );
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "OPENAI_API_KEY is not set. Add it to .env.local." },
      { status: 503 },
    );
  }

  const summary = await getStateSummary(abbrev);
  if (!summary) {
    return NextResponse.json(
      { error: `State not found or no data for: ${abbrev}` },
      { status: 404 },
    );
  }

  const stateContext = buildStateContext(summary);

  const systemContent = `You are a policy advisor focused on environmental justice and health equity. You produce **state-level** policy proposals to reduce environmental health risks across an entire state, informed by county-level data and statewide risk patterns.

**Emphasis: specificity, evidence, and uniqueness**
- Be **highly specific to this state**: reference real counties by name, cite the statewide risk drivers and demographic patterns from the data, and propose actions that fit the state's political and regulatory landscape.
- **Policy evidence comes only from the NCSL database.** Use search_ncsl to find real state legislation. Do not cite policies, bills, or programs as evidence unless they appear in NCSL search results. Web search is for political context only—not for policy citations.
- When you cite a past policy as a model to build on, **check whether that policy worked.** If NCSL results include outcomes, evaluations, or success stories, use that as justification (e.g. "Similar measures in [other state] were associated with …"). If you cannot determine effectiveness, either say so briefly or frame the citation as a structural precedent rather than an evidence-based one. Where there is evidence a cited policy worked well, use it explicitly to strengthen the recommendation.
- Make the proposal **robust and unique**: concrete legislative or executive actions, named programs or bill types, and reasoning that is tied specifically to this state's data and context. Avoid generic boilerplate; every sentence should earn its place.

**Data you receive:**
- **Statewide summary**: total tracts, total counties, average cancer and respiratory risk percentiles, demographic averages (low-income, people of color), and top statewide risk drivers from SHAP analysis (which environmental factors most frequently increase risk across tracts).
- **County-level breakdowns**: for the highest-risk counties, you receive tract counts, average risk percentiles, demographics, and top SHAP drivers. Use this to identify priority areas and county-specific needs.
- The data is based on EJSCREEN environmental indicators and SHAP analysis of a regression model predicting cancer and respiratory risk from environmental factors.

**Tools:**
1. **search_ncsl**: Queries the NCSL Environment & Natural Resources Legislation Database. This is your **only source for policy evidence**. Use it to find existing state legislation relevant to the statewide risk drivers (e.g. diesel PM, PM 2.5, ozone, traffic, lead, wastewater, environmental justice). Call it with relevant queries before drafting. Cite only legislation/results you find here when making policy arguments.
2. **web_search**: General web search. Use it **only** for **state-level political context** (e.g. which party controls the legislature, who the governor is, recent environmental votes or executive actions, state political leanings). Do not use web search results as citations for specific policies. If web search returns "not configured", proceed without it.

Given the state's **county-level data, statewide risk patterns, demographics, and (when available) political context**, write a state-level policy proposal (2–3 pages) in Markdown that:
1. Summarizes the statewide environmental health landscape: key risk drivers, high-risk counties, and demographic patterns (e.g. overburdened communities) based on the data provided.
2. Recommends concrete state-level actions (legislation, executive orders, agency rules, funding priorities) that are feasible given the political context when you have it (e.g. bipartisan framing, existing committees, recent legislation). Ground recommendations in NCSL results; where you cite a prior policy as a model, note whether it worked.
3. Identifies 2–4 priority counties by name and explains why they should be prioritized (based on the data).
4. Includes citations: a "References" or "Sources" section at the end; inline refs (e.g. "see [1]"); Markdown links **only** to NCSL results and any political-context links from web search. Do not cite policy from web search.

Write in clear, professional language. Be specific, evidence-based, and unique to this state. Output only the proposal content in Markdown (no surrounding explanation).`;

  const userContent = `Generate a state-level policy proposal for ${summary.stateAbbrev}. Use the county-level and statewide data below to identify patterns and priorities. Use only NCSL (search_ncsl) for policy evidence and citations. Use web_search only for state political context. When citing a past policy as a model, note whether it worked. Then write your recommendation.

---

${stateContext}`;

  const client = new OpenAI({ apiKey });

  type Message = OpenAI.Chat.Completions.ChatCompletionMessageParam;
  const messages: Message[] = [
    { role: "system", content: systemContent },
    { role: "user", content: userContent },
  ];

  const maxToolRounds = 6;
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
            ? await webSearch(
                query || `${summary.stateAbbrev} environmental policy`,
              )
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
    state: summary.stateAbbrev,
    countyCount: summary.countyCount,
    tractCount: summary.tractCount,
  });
}
