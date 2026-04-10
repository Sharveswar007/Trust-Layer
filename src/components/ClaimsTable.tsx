"use client";

import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { Claim, Verdict } from "@/lib/types";

type ClaimsTableProps = {
  claims: Claim[];
};

const PAGE_SIZE = 8;

type TabKey = "correct" | "incorrect" | "unverifiable";

const TAB_LABELS: Record<TabKey, string> = {
  correct: "Correct",
  incorrect: "Wrong",
  unverifiable: "Unverifiable"
};

function filterByVerdict(claims: Claim[], verdict: Verdict): Claim[] {
  return claims.filter((claim) => claim.verdict === verdict);
}

export function ClaimsTable({ claims }: ClaimsTableProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("correct");
  const [page, setPage] = useState(1);

  const grouped = useMemo(
    () => ({
      correct: filterByVerdict(claims, "correct"),
      incorrect: filterByVerdict(claims, "incorrect"),
      unverifiable: filterByVerdict(claims, "unverifiable")
    }),
    [claims]
  );

  const availableTabs = (Object.keys(TAB_LABELS) as TabKey[]).filter(
    (tab) => tab !== "unverifiable" || grouped.unverifiable.length > 0
  );

  const safeActiveTab = availableTabs.includes(activeTab) ? activeTab : availableTabs[0];
  const activeClaims = grouped[safeActiveTab];
  const totalPages = Math.max(1, Math.ceil(activeClaims.length / PAGE_SIZE));
  const start = (page - 1) * PAGE_SIZE;
  const pageClaims = activeClaims.slice(start, start + PAGE_SIZE);

  function changeTab(next: TabKey) {
    setActiveTab(next);
    setPage(1);
  }

  return (
    <section className="panel mt-4 p-4 md:p-5">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 pb-3">
        <h3 className="m-0 text-sm md:text-base font-semibold text-neutral-100">Claim Outcomes</h3>
        <p className="m-0 text-xs md:text-sm text-neutral-400">Detailed results table</p>
      </div>

      <div className="mb-3 flex flex-wrap gap-2">
        {availableTabs.map((tab) => {
          const isActive = tab === safeActiveTab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => changeTab(tab)}
              className={`rounded-md border px-3 py-1.5 text-sm transition ${
                isActive
                  ? "border-neutral-500 bg-neutral-800 text-neutral-100"
                  : "border-neutral-700 bg-neutral-900 text-neutral-300"
              }`}
            >
              {TAB_LABELS[tab]} ({grouped[tab].length})
            </button>
          );
        })}
      </div>

      <div className="overflow-x-auto rounded-lg border border-neutral-800">
        <table className="w-full min-w-[720px] border-collapse text-sm text-neutral-200">
          <thead className="bg-neutral-900/70 text-neutral-300">
            <tr>
              <th className="border-b border-neutral-800 px-3 py-2 text-left font-medium">#</th>
              <th className="border-b border-neutral-800 px-3 py-2 text-left font-medium">Claim</th>
              <th className="border-b border-neutral-800 px-3 py-2 text-left font-medium">Confidence</th>
              <th className="border-b border-neutral-800 px-3 py-2 text-left font-medium">Source</th>
            </tr>
          </thead>
          <tbody>
            {pageClaims.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-3 py-6 text-center text-neutral-400">
                  No {TAB_LABELS[safeActiveTab].toLowerCase()} claims found.
                </td>
              </tr>
            ) : (
              pageClaims.map((claim, idx) => (
                <tr key={`${claim.text}-${start + idx}`} className="odd:bg-black/20 even:bg-black/35">
                  <td className="border-b border-neutral-900 px-3 py-2 align-top text-neutral-400">{start + idx + 1}</td>
                  <td className="border-b border-neutral-900 px-3 py-2 align-top break-words">{claim.text}</td>
                  <td className="border-b border-neutral-900 px-3 py-2 align-top">
                    {claim.verdict === "unverifiable" ? "N/A" : `${claim.confidence ?? 0}%`}
                  </td>
                  <td className="border-b border-neutral-900 px-3 py-2 align-top break-words">
                    {claim.source || "Unknown"}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          disabled={page === 1}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 disabled:opacity-40"
        >
          <ChevronLeft size={14} />
          Prev
        </button>
        <span className="text-sm text-neutral-400">Page {page} / {totalPages}</span>
        <button
          type="button"
          onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={page === totalPages}
          className="inline-flex items-center gap-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-sm text-neutral-200 disabled:opacity-40"
        >
          Next
          <ChevronRight size={14} />
        </button>
      </div>
    </section>
  );
}
