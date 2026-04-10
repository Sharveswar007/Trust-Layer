"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";
import { ClaimsTable } from "@/components/ClaimsTable";
import { TrustMatrix } from "@/components/TrustMatrix";
import type { VerifyResponse } from "@/lib/types";

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pipelineStage, setPipelineStage] = useState(0);

  const pipelineSteps = useMemo(
    () => ["Extracting claims", "Checking evidence sources", "Computing trust matrix"],
    []
  );

  useEffect(() => {
    if (!loading) {
      setPipelineStage(0);
      return;
    }

    setPipelineStage(0);
    const t1 = setTimeout(() => setPipelineStage(1), 700);
    const t2 = setTimeout(() => setPipelineStage(2), 1500);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
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
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unexpected error while verifying.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="app-shell">
      <header className="mb-5 panel p-5 md:p-6 fade-in">
        <div className="flex items-center gap-2 text-neutral-200">
          <ShieldCheck size={18} />
          <span className="text-xs tracking-[0.16em] uppercase">TruthLayer Intelligence</span>
        </div>
        <h1 className="mt-3 mb-2 text-3xl md:text-4xl font-semibold tracking-tight text-white">
          Trust Document Verification
        </h1>
        <p className="soft-text leading-relaxed max-w-3xl">
          Submit text to evaluate factual reliability with a domain-specific trust matrix. Results include
          evidence-backed claims, risk level, and clear reasoning points.
        </p>
      </header>

      <section className="panel p-4 md:p-5 fade-in" style={{ animationDelay: "80ms" }}>
        <form onSubmit={onSubmit} className="grid gap-3">
          <label htmlFor="verify-input" className="text-sm font-medium text-neutral-200">
            Enter text
          </label>
          <textarea
            id="verify-input"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Enter text"
            rows={7}
            className="field-dark"
          />

          <div className="flex items-center gap-3">
            <button type="submit" disabled={!canSubmit} className="btn-dark">
              Verify
            </button>
            {loading ? (
              <div className="flex items-center gap-2 soft-text text-sm">
                <Loader2 size={16} className="animate-spin" />
                Running verification...
              </div>
            ) : null}
          </div>
        </form>
      </section>

      {loading ? (
        <section className="panel p-4 mt-4 fade-in">
          <div className="grid gap-3">
            {pipelineSteps.map((step, index) => {
              const isDone = pipelineStage > index;
              const isCurrent = pipelineStage === index;
              const width = isDone ? "100%" : isCurrent ? "65%" : "0%";

              return (
                <div key={step} className="grid gap-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className={isDone || isCurrent ? "text-neutral-100" : "caption-text"}>{step}</span>
                    <span className="caption-text">{isDone ? "Done" : isCurrent ? "Running" : "Pending"}</span>
                  </div>
                  <div className="h-2 rounded-full bg-[#1a1a1a] overflow-hidden border border-[#2c2c2c]">
                    <div
                      className="h-full rounded-full bg-neutral-200 transition-all duration-300"
                      style={{ width }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      ) : null}

      {error ? (
        <section className="mt-4 panel p-3 text-neutral-200 fade-in" role="alert">
          {error}
        </section>
      ) : null}

      {result ? (
        <section className="mt-5 fade-in">
          <TrustMatrix
            dimensions={result.dimensions}
            overallScore={result.overall_trust_score}
            riskLabel={result.risk_label}
            reasoningPoints={result.reasoning_points}
          />
          <ClaimsTable claims={result.claims} />
        </section>
      ) : null}
    </main>
  );
}
