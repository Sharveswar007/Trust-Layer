"use client";

import type { TrustDimension } from "@/lib/types";

interface TrustMatrixProps {
  dimensions: TrustDimension[];
  overallScore: number | null;
  riskLabel: string;
  reasoningPoints: string[];
}

function getRiskEmoji(riskLabel: string): string {
  if (riskLabel.includes("High Risk")) return "🔴";
  if (riskLabel.includes("Medium Risk")) return "🟡";
  return "🟢";
}

export function TrustMatrix({
  dimensions,
  overallScore,
  riskLabel,
  reasoningPoints
}: TrustMatrixProps) {
  const riskEmoji = getRiskEmoji(riskLabel);

  return (
    <section
      style={{
        marginTop: "1.5rem",
        border: "1px solid #e2e8f0",
        borderRadius: "14px",
        background: "#ffffff",
        padding: "1.2rem"
      }}
    >
      <h2 style={{ margin: "0 0 1rem", fontSize: "1.1rem", color: "#0f172a", fontWeight: 700 }}>
        🧾 Final Trust Score
      </h2>

      {/* Dimension Grid */}
      <div
        style={{
          display: "grid",
          gap: "0.7rem",
          marginBottom: "1.2rem",
          borderBottom: "1px solid #e5e7eb",
          paddingBottom: "1rem"
        }}
      >
        {dimensions.map((dim) => (
          <div
            key={dim.name}
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 60px",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem"
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#0f172a", fontWeight: 600, fontSize: "0.95rem" }}>
                {dim.name}
              </p>
              <p
                style={{
                  margin: "0.25rem 0 0",
                  color: "#64748b",
                  fontSize: "0.8rem",
                  fontStyle: "italic"
                }}
              >
                {dim.reason}
              </p>
            </div>
            <div
              style={{
                fontWeight: 700,
                fontSize: "0.95rem",
                color: dim.score >= 6 ? "#059669" : dim.score >= 4 ? "#d97706" : "#dc2626",
                textAlign: "right"
              }}
            >
              {dim.score}/{dim.max}
            </div>
          </div>
        ))}
      </div>

      {/* Overall Score Card */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr auto",
          alignItems: "center",
          gap: "1rem",
          background: "#f8fafc",
          padding: "1rem",
          borderRadius: "10px",
          marginBottom: "1rem",
          border: overallScore !== null && overallScore < 4 ? "2px solid #dc2626" : "1px solid #e2e8f0"
        }}
      >
        <div>
          <p style={{ margin: 0, color: "#0f172a", fontWeight: 700, fontSize: "1rem" }}>
            Overall Document Trust
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <p
            style={{
              margin: 0,
              fontSize: "1.4rem",
              fontWeight: 700,
              color: overallScore !== null && overallScore >= 6 ? "#059669" : overallScore !== null && overallScore >= 4 ? "#d97706" : "#dc2626"
            }}
          >
            {overallScore !== null ? `${overallScore.toFixed(1)}/10` : "—"}
          </p>
          <p
            style={{
              margin: "0.25rem 0 0",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: riskLabel.includes("High") ? "#dc2626" : riskLabel.includes("Medium") ? "#d97706" : "#059669"
            }}
          >
            {riskEmoji} {riskLabel}
          </p>
        </div>
      </div>

      {/* Reasoning Points */}
      {reasoningPoints.length > 0 && (
        <div>
          <h3 style={{ margin: "0 0 0.5rem", fontSize: "0.95rem", color: "#0f172a", fontWeight: 700 }}>
            Key Findings:
          </h3>
          <ul
            style={{
              margin: "0.5rem 0 0",
              paddingLeft: "20px",
              listStyle: "none",
              display: "grid",
              gap: "0.35rem"
            }}
          >
            {reasoningPoints.map((point, index) => (
              <li
                key={index}
                style={{
                  color: "#475569",
                  fontSize: "0.9rem",
                  lineHeight: "1.4",
                  borderLeft: "3px solid #cbd5e1",
                  paddingLeft: "0.75rem"
                }}
              >
                {point}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
