"use client";

import { AlertTriangle, CircleCheck, ShieldAlert } from "lucide-react";
import type { TrustDimension } from "@/lib/types";

interface TrustMatrixProps {
  dimensions: TrustDimension[];
  overallScore: number | null;
  riskLabel: string;
  reasoningPoints: string[];
}

function getRiskIcon(riskLabel: string) {
  if (riskLabel.includes("High")) return ShieldAlert;
  if (riskLabel.includes("Medium")) return AlertTriangle;
  return CircleCheck;
}

function getRiskTone(riskLabel: string): string {
  if (riskLabel.includes("High")) return "text-neutral-100 border-neutral-500 bg-neutral-900";
  if (riskLabel.includes("Medium")) return "text-neutral-200 border-neutral-600 bg-neutral-900";
  return "text-neutral-300 border-neutral-700 bg-neutral-900";
}

export function TrustMatrix({ dimensions, overallScore, riskLabel, reasoningPoints }: TrustMatrixProps) {
  const RiskIcon = getRiskIcon(riskLabel);
  const tone = getRiskTone(riskLabel);

  return (
    <section className="panel p-4 md:p-5">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <h2 className="text-lg md:text-xl font-semibold tracking-tight text-white">Final Trust Score</h2>
        <span className="rounded-full border border-neutral-700 bg-neutral-900 px-3 py-1 text-xs tracking-[0.12em] uppercase text-neutral-300">
          Matrix View
        </span>
      </div>

      <div className="grid gap-2.5">
        {dimensions.map((dim) => (
          <div
            key={dim.name}
            className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 rounded-xl border border-neutral-800 bg-black/35 px-3 py-2.5"
          >
            <div className="min-w-0">
              <p className="m-0 text-sm md:text-[0.95rem] font-medium text-neutral-100 break-words">{dim.name}</p>
              <p className="m-0 mt-1 text-xs md:text-sm text-neutral-400 break-words">{dim.reason}</p>
            </div>
            <div className="shrink-0 text-right text-sm font-semibold text-neutral-200">
              {dim.score}/{dim.max}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 rounded-xl border border-neutral-800 bg-neutral-950 p-3.5 md:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="m-0 text-sm md:text-base font-semibold text-neutral-100">Overall Document Trust</p>
          <p className="m-0 text-xl md:text-2xl font-semibold text-white">
            {overallScore !== null ? `${overallScore.toFixed(1)}/10` : "-"}
          </p>
        </div>
        <div className={`mt-2 inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs md:text-sm font-medium ${tone}`}>
          <RiskIcon size={15} />
          {riskLabel}
        </div>
      </div>

      {reasoningPoints.length > 0 ? (
        <section className="mt-4 border-t border-neutral-800 pt-3">
          <h3 className="m-0 text-sm md:text-base font-semibold text-neutral-100">Reasons</h3>
          <ul className="m-0 mt-2 list-disc pl-5 text-sm text-neutral-300 space-y-1.5">
            {reasoningPoints.map((point, index) => (
              <li key={index} className="break-words">{point}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </section>
  );
}
