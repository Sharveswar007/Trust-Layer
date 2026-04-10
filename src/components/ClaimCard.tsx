"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, HelpCircle, XCircle } from "lucide-react";
import type { Claim } from "@/lib/types";

type ClaimCardProps = {
  claim: Claim;
};

function getVerdictMeta(verdict: Claim["verdict"]) {
  if (verdict === "correct") {
    return {
      label: "Correct",
      color: "#0f9d58",
      Icon: CheckCircle2
    };
  }

  if (verdict === "incorrect") {
    return {
      label: "Incorrect",
      color: "#d93025",
      Icon: XCircle
    };
  }

  return {
    label: "Unverifiable",
    color: "#5f6368",
    Icon: HelpCircle
  };
}

export function ClaimCard({ claim }: ClaimCardProps) {
  const [expanded, setExpanded] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  const meta = useMemo(() => getVerdictMeta(claim.verdict), [claim.verdict]);

  return (
    <article
      style={{
        border: "1px solid #e5e7eb",
        borderRadius: "14px",
        background: "#ffffff",
        padding: "0.95rem",
        boxShadow: "0 2px 8px rgba(0,0,0,0.06)",
        opacity: mounted ? 1 : 0,
        transform: mounted ? "translateY(0)" : "translateY(8px)",
        transition: "opacity 280ms ease, transform 280ms ease"
      }}
    >
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.8rem",
          background: "transparent",
          border: "none",
          padding: 0,
          textAlign: "left"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0 }}>
          <meta.Icon size={20} color={meta.color} aria-hidden="true" />
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              fontWeight: 600,
              color: "#111827",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis"
            }}
            title={claim.text}
          >
            {claim.text}
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.55rem" }}>
          <span
            style={{
              borderRadius: "999px",
              background: "#f3f4f6",
              color: "#111827",
              padding: "0.25rem 0.55rem",
              fontSize: "0.75rem",
              fontWeight: 700
            }}
          >
            {claim.verdict === "unverifiable" ? "— Unverifiable" : `${claim.confidence ?? 0}%`}
          </span>
          {expanded ? <ChevronUp size={18} color="#6b7280" /> : <ChevronDown size={18} color="#6b7280" />}
        </div>
      </button>

      <div
        style={{
          maxHeight: expanded ? "360px" : "0px",
          overflow: "hidden",
          transition: "max-height 260ms ease",
          marginTop: expanded ? "0.8rem" : "0"
        }}
      >
        <div style={{ borderTop: "1px solid #f0f0f0", paddingTop: "0.7rem", fontSize: "0.9rem", color: "#374151" }}>
          <p style={{ margin: "0 0 0.45rem" }}>
            <strong>Verdict:</strong> <span style={{ color: meta.color }}>{meta.label}</span>
          </p>
          <p style={{ margin: "0 0 0.45rem" }}>
            <strong>Correction:</strong> {claim.corrected || "No correction needed."}
          </p>
          <p style={{ margin: "0 0 0.45rem" }}>
            <strong>Explanation:</strong> {claim.explanation}
          </p>
          <p style={{ margin: 0 }}>
            <strong>Source:</strong>{" "}
            {claim.source_url ? (
              <a href={claim.source_url} target="_blank" rel="noreferrer" style={{ color: "#2563eb" }}>
                {claim.source || claim.source_url}
              </a>
            ) : (
              <span>{claim.source || "Unknown"}</span>
            )}
          </p>
        </div>
      </div>
    </article>
  );
}
