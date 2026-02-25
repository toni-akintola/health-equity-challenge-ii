"use client";

import { useCallback, useEffect, useState } from "react";
import { marked } from "marked";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/src/components/ui/dialog";
import { Button } from "@/src/components/ui/button";
import { ProposalMarkdown } from "@/src/components/ProposalMarkdown";
import { cn } from "@/src/lib/utils";

const WORKFLOW_STEPS = [
  "Aggregating county-level data",
  "Analyzing statewide risk patterns",
  "Searching NCSL for relevant legislation",
  "Drafting state-level policy recommendation",
] as const;

type StepStatus = "pending" | "active" | "done";

function StepRow({ label, status }: { label: string; status: StepStatus }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <span
        className={cn(
          "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-medium",
          status === "done" && "bg-emerald-100 text-emerald-700",
          status === "active" && "bg-slate-900 text-white animate-pulse",
          status === "pending" && "bg-slate-100 text-slate-400",
        )}
      >
        {status === "done" ? "✓" : status === "active" ? "..." : "—"}
      </span>
      <span
        className={cn(
          "text-sm",
          status === "done" && "text-slate-600",
          status === "active" && "font-medium text-slate-900",
          status === "pending" && "text-slate-400",
        )}
      >
        {label}
      </span>
    </div>
  );
}

type Props = {
  stateAbbrev: string;
  disabled?: boolean;
};

async function downloadProposalAsPdf(
  proposalMarkdown: string,
  stateLabel: string,
) {
  const htmlContent = await marked.parse(proposalMarkdown);
  const title = `State policy proposal – ${stateLabel}`;
  const doc = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${title.replace(/</g, "&lt;")}</title>
  <style>
    body { font-family: system-ui, sans-serif; max-width: 65ch; margin: 2rem auto; padding: 0 2.5rem; color: #1e293b; line-height: 1.6; }
    h1 { font-size: 1.25rem; margin-top: 1.5rem; }
    h2 { font-size: 1.1rem; margin-top: 1.25rem; }
    h3 { font-size: 1rem; margin-top: 1rem; }
    p { margin: 0.5rem 0; }
    a { color: #2563eb; }
    ul, ol { margin: 0.5rem 0; padding-left: 1.5rem; }
    .header { font-size: 0.875rem; color: #64748b; margin-bottom: 1.5rem; }
    @media print { body { margin: 1.5rem 3rem; padding: 0 2rem; } }
  </style>
</head>
<body>
  <p class="header">State: ${stateLabel}</p>
  <div>${htmlContent}</div>
  <script>window.onload = function() { window.print(); window.onafterprint = function() { window.close(); }; }</script>
</body>
</html>`;
  const blob = new Blob([doc], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const w = window.open(url, "_blank", "noopener");
  if (w) w.onafterprint = () => URL.revokeObjectURL(url);
  else URL.revokeObjectURL(url);
}

export function StateProposalDialog({ stateAbbrev, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const [phase, setPhase] = useState<"idle" | "generating" | "done" | "error">(
    "idle",
  );
  const [stepIndex, setStepIndex] = useState(0);
  const [proposal, setProposal] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [meta, setMeta] = useState<{
    countyCount?: number;
    tractCount?: number;
  } | null>(null);
  const [proposalTextSize, setProposalTextSize] = useState<"small" | "normal">(
    "small",
  );

  const startGenerate = useCallback(() => {
    setPhase("generating");
    setStepIndex(0);
    setProposal(null);
    setError(null);
  }, []);

  useEffect(() => {
    if (!open || phase !== "generating") return;

    const timer = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, WORKFLOW_STEPS.length - 1));
    }, 4000);
    return () => clearInterval(timer);
  }, [open, phase]);

  useEffect(() => {
    if (!open || phase !== "generating") return;

    const controller = new AbortController();
    fetch(`/api/state/${stateAbbrev}/policy-proposal`, {
      method: "POST",
      signal: controller.signal,
    })
      .then((res) => {
        if (!res.ok) {
          return res.json().then((body) => {
            throw new Error(body?.error ?? `Request failed (${res.status})`);
          });
        }
        return res.json();
      })
      .then(
        (data: {
          proposal?: string;
          state?: string;
          countyCount?: number;
          tractCount?: number;
        }) => {
          setStepIndex(WORKFLOW_STEPS.length);
          setProposal(data.proposal ?? "");
          setMeta({
            countyCount: data.countyCount,
            tractCount: data.tractCount,
          });
          setPhase("done");
        },
      )
      .catch((err) => {
        if (err.name === "AbortError") return;
        setError(err instanceof Error ? err.message : String(err));
        setPhase("error");
      });

    return () => controller.abort();
  }, [open, stateAbbrev, phase]);

  const handleOpenChange = useCallback((next: boolean) => {
    if (!next) {
      setPhase("idle");
      setStepIndex(0);
      setProposal(null);
      setError(null);
      setMeta(null);
    }
    setOpen(next);
  }, []);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="default" size="sm" disabled={disabled}>
          Generate state policy proposal
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] flex flex-col max-w-3xl w-[95vw]">
        <DialogHeader>
          <DialogTitle>State policy proposal: {stateAbbrev}</DialogTitle>
          <DialogDescription>
            Generate a state-level policy recommendation based on county-level
            environmental data and the NCSL legislation database.
          </DialogDescription>
        </DialogHeader>

        {phase === "idle" && (
          <div className="py-4">
            <p className="text-sm text-slate-600 mb-4">
              This will aggregate all census tracts in {stateAbbrev} by county,
              analyze statewide risk patterns and SHAP drivers, query the NCSL
              Environment & Natural Resources Legislation Database, and draft a
              state-level policy proposal.
            </p>
            <Button onClick={startGenerate}>Generate</Button>
          </div>
        )}

        {(phase === "generating" || phase === "done") && (
          <div className="space-y-1 border-t border-slate-100 pt-4">
            {WORKFLOW_STEPS.map((label, i) => (
              <StepRow
                key={label}
                label={label}
                status={
                  phase === "done"
                    ? "done"
                    : i < stepIndex
                      ? "done"
                      : i === stepIndex
                        ? "active"
                        : "pending"
                }
              />
            ))}
          </div>
        )}

        {phase === "done" && proposal && (
          <div className="flex-1 min-h-0 border-t border-slate-100 pt-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
              <p className="text-sm font-medium text-slate-700">
                Recommendation
                {meta && (
                  <span className="ml-2 text-xs font-normal text-slate-500">
                    ({meta.countyCount} counties, {meta.tractCount} tracts)
                  </span>
                )}
              </p>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-500">Text size:</span>
                <Button
                  variant={proposalTextSize === "small" ? "secondary" : "ghost"}
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setProposalTextSize("small")}
                >
                  Smaller
                </Button>
                <Button
                  variant={
                    proposalTextSize === "normal" ? "secondary" : "ghost"
                  }
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => setProposalTextSize("normal")}
                >
                  Normal
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => downloadProposalAsPdf(proposal, stateAbbrev)}
                >
                  Download PDF
                </Button>
              </div>
            </div>
            <div className="flex-1 min-h-[320px] max-h-[70vh] overflow-y-auto rounded-md border border-slate-200 bg-slate-50 p-5">
              <ProposalMarkdown
                content={proposal}
                compact={proposalTextSize === "small"}
              />
            </div>
          </div>
        )}

        {phase === "error" && (
          <div className="border-t border-slate-100 pt-4">
            <p className="text-sm font-medium text-red-700 mb-1">
              Something went wrong
            </p>
            <p className="text-sm text-slate-600">{error}</p>
          </div>
        )}

        <DialogFooter className="border-t border-slate-100 pt-4">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
