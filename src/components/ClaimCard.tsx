"use client";

import { useMemo, useState } from "react";
import { ChevronDown, ChevronUp, CircleAlert, CircleCheck, CircleHelp } from "lucide-react";
import type { Claim } from "@/lib/types";

type ClaimCardProps = {
  claim: Claim;
};

function getVerdictMeta(verdict: Claim["verdict"]) {
  if (verdict === "correct") {
    return {
      label: "Correct",
      icon: CircleCheck,
      tone: "text-neutral-200 border-neutral-600 bg-neutral-900"
    };
  }

  if (verdict === "incorrect") {
    return {
      label: "Incorrect",
      icon: CircleAlert,
      tone: "text-neutral-200 border-neutral-600 bg-neutral-900"
    };
  }

  return {
    label: "Unverifiable",
    icon: CircleHelp,
    tone: "text-neutral-300 border-neutral-700 bg-neutral-900"
  };
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);
  const meta = useMemo(() => getVerdictMeta(claim.verdict), [claim.verdict]);
  const Icon = meta.icon;

  return (
    <article className="panel p-3.5 md:p-4">
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        className="w-full flex items-start justify-between gap-3 bg-transparent border-0 p-0 text-left"
      >
        <div className="min-w-0 flex items-start gap-2.5">
          <Icon size={18} className="text-neutral-200 mt-0.5 shrink-0" aria-hidden="true" />
          <p className="m-0 text-sm md:text-[0.95rem] font-medium text-neutral-100 break-words">
            {claim.text}
          </p>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <span className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${meta.tone}`}>
            {claim.verdict === "unverifiable" ? "Unverifiable" : `${claim.confidence ?? 0}%`}
          </span>
          {expanded ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
        </div>
      </button>

      {expanded ? (
        <div className="mt-3 border-t border-neutral-800 pt-3 text-sm text-neutral-300 space-y-2">
          <p className="m-0 break-words">
            <span className="text-neutral-100 font-semibold">Verdict:</span> {meta.label}
          </p>
          <p className="m-0 break-words">
            <span className="text-neutral-100 font-semibold">Correction:</span> {claim.corrected || "No correction needed."}
          </p>
          <p className="m-0 break-words">
            <span className="text-neutral-100 font-semibold">Explanation:</span> {claim.explanation}
          </p>
          <p className="m-0 break-words">
            <span className="text-neutral-100 font-semibold">Source:</span>{" "}
            {claim.source_url ? (
              <a href={claim.source_url} target="_blank" rel="noreferrer" className="underline underline-offset-2 text-neutral-200 break-all">
                {claim.source || claim.source_url}
              </a>
            ) : (
              <span>{claim.source || "Unknown"}</span>
            )}
          </p>
        </div>
      ) : null}
    </article>
  );
}
