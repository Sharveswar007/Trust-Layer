"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { ClaimCard } from "@/components/ClaimCard";
import { HighlightedText } from "@/components/HighlightedText";
import { ScoreRing } from "@/components/ScoreRing";
import type { VerifyResponse } from "@/lib/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [submittedText, setSubmittedText] = useState("");
  const [pipelineStage, setPipelineStage] = useState(0);

  const pipelineSteps = useMemo(
    () => ["Extracting claims...", "Searching sources...", "Computing verdicts..."],
    []
  );

  useEffect(() => {
    if (!loading) {
      setPipelineStage(0);
      return;
    }

    setPipelineStage(0);
    const timeouts = [
      setTimeout(() => setPipelineStage(1), 750),
      setTimeout(() => setPipelineStage(2), 1600)
    ];

    return () => {
      for (const timeout of timeouts) {
        clearTimeout(timeout);
      }
    };
  }, [loading]);

  const canSubmit = useMemo(() => input.trim().length >= 10 && !loading, [input, loading]);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setResult(null);

    if (input.trim().length < 10) {
      setError("Enter at least 10 characters before verifying.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ text: input })
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(typeof payload?.error === "string" ? payload.error : "Verification failed.");
      }

      setResult(payload as VerifyResponse);
      setSubmittedText(input);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while verifying.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: "860px", margin: "0 auto", padding: "2rem 1rem 3rem" }}>
      <h1 style={{ margin: 0, fontSize: "2rem", color: "#ffffff" }}>TruthLayer Verify</h1>
      <p style={{ marginTop: "0.5rem", color: "#ffffff" }}>
        Paste text, verify claims with multi-source evidence, and inspect verdict confidence.
      </p>

      <form onSubmit={onSubmit} style={{ marginTop: "1rem", display: "grid", gap: "0.8rem" }}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text to verify (10-5000 chars)..."
          rows={6}
          style={{
            width: "100%",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            padding: "0.8rem",
            fontSize: "0.95rem",
            resize: "vertical"
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <button
            type="submit"
            disabled={!canSubmit}
            style={{
              border: "none",
              borderRadius: "999px",
              background: canSubmit ? "#0f766e" : "#94a3b8",
              color: "#ffffff",
              padding: "0.55rem 1rem",
              fontWeight: 700,
              cursor: canSubmit ? "pointer" : "not-allowed"
            }}
          >
            Verify
          </button>

          {loading ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", color: "#334155" }}>
              <span
                style={{
                  width: "16px",
                  height: "16px",
                  borderRadius: "999px",
                  border: "2px solid #94a3b8",
                  borderTopColor: "#0f766e",
                  display: "inline-block",
                  animation: "spin 0.8s linear infinite"
                }}
              />
              Verifying...
            </div>
          ) : null}
        </div>
      </form>

      {loading ? (
        <section
          style={{
            marginTop: "1rem",
            border: "1px solid #e2e8f0",
            borderRadius: "12px",
            background: "#ffffff",
            padding: "0.85rem 0.9rem",
            display: "grid",
            gap: "0.75rem"
          }}
        >
          {pipelineSteps.map((step, index) => {
            const isCurrent = pipelineStage === index;
            const isDone = pipelineStage > index;
            const width = isDone ? "100%" : isCurrent ? "68%" : "0%";

            return (
              <div key={step} style={{ display: "grid", gap: "0.35rem" }}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    color: isDone || isCurrent ? "#0f172a" : "#64748b",
                    fontWeight: isCurrent ? 700 : 600,
                    fontSize: "0.9rem"
                  }}
                >
                  <span>{step}</span>
                  <span style={{ fontSize: "0.78rem" }}>{isDone ? "Done" : isCurrent ? "Running" : "Pending"}</span>
                </div>

                <div
                  style={{
                    height: "8px",
                    width: "100%",
                    borderRadius: "999px",
                    background: "#e5e7eb",
                    overflow: "hidden"
                  }}
                >
                  <div
                    style={{
                      height: "100%",
                      width,
                      borderRadius: "999px",
                      background: isDone ? "#10b981" : "#0f766e",
                      transition: "width 520ms ease"
                    }}
                  />
                </div>
              </div>
            );
          })}
        </section>
      ) : null}

      {error ? (
        <div
          role="alert"
          style={{
            marginTop: "1rem",
            border: "1px solid #fecaca",
            background: "#fef2f2",
            color: "#b91c1c",
            borderRadius: "12px",
            padding: "0.75rem"
          }}
        >
          {error}
        </div>
      ) : null}

      {result ? (
        <section style={{ marginTop: "1.3rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              border: "1px solid #e2e8f0",
              borderRadius: "14px",
              background: "#ffffff",
              padding: "0.9rem 1rem"
            }}
          >
            <div>
              <p style={{ margin: 0, color: "#0f172a", fontWeight: 700 }}>Overall Trust Score</p>
              <p style={{ margin: "0.25rem 0 0", color: "#64748b", fontSize: "0.9rem" }}>
                Processed in {result.processing_time_ms}ms
              </p>
            </div>
            {typeof result.overall_trust_score === "number" ? (
              <ScoreRing score={result.overall_trust_score} />
            ) : (
              <div
                style={{
                  width: "92px",
                  height: "92px",
                  borderRadius: "999px",
                  border: "2px solid #e5e7eb",
                  display: "grid",
                  placeItems: "center",
                  color: "#64748b",
                  fontSize: "1.6rem",
                  fontWeight: 700
                }}
                aria-label="Trust score unavailable"
              >
                -
              </div>
            )}
          </div>

          <HighlightedText originalText={submittedText} claims={result.claims} />

          <div style={{ marginTop: "1rem", display: "grid", gap: "0.75rem" }}>
            {result.claims.map((claim, index) => (
              <div
                key={`${claim.text}-${index}`}
                style={{
                  opacity: 0,
                  transform: "translateY(10px)",
                  animation: `claimStagger 380ms ease forwards`,
                  animationDelay: `${index * 90}ms`
                }}
              >
                <ClaimCard claim={claim} />
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <style jsx global>{`
        @keyframes spin {
          to {
            transform: rotate(360deg);
          }
        }
        @keyframes claimStagger {
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </main>
  );
}
