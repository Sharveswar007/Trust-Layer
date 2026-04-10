import Groq from "groq-sdk";
import type { Verdict } from "@/lib/types";

export type VerdictEvidence = {
  webSnippets: string[];
  wikidata: string | null;
  factcheck: { rating: string; source: string; url: string } | null;
};

export type VerdictResult = {
  verdict: Verdict;
  confidence: number | null;
  corrected: string;
  explanation: string;
  source: string;
  source_url: string;
};

function stripCodeFence(content: string): string {
  return content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();
}

function normalizeVerdict(value: unknown): Verdict {
  if (value === "correct" || value === "incorrect" || value === "unverifiable") {
    return value;
  }
  return "unverifiable";
}

function bucketConfidence(score: number): number {
  if (score >= 85) return 90;
  if (score >= 65) return 75;
  if (score >= 45) return 55;
  if (score >= 25) return 35;
  return 15;
}

function normalizeConfidence(value: unknown, verdict: Verdict): number | null {
  if (verdict === "unverifiable") {
    return null;
  }

  const parsed = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(parsed)) {
    return 0;
  }
  const clamped = Math.max(0, Math.min(100, Math.round(parsed)));
  return bucketConfidence(clamped);
}

function fallbackVerdict(): VerdictResult {
  return {
    verdict: "unverifiable",
    confidence: null,
    corrected: "",
    explanation: "Unable to synthesize verdict from available evidence.",
    source: "",
    source_url: ""
  };
}

export async function synthesizeVerdict(claim: string, evidence: VerdictEvidence): Promise<VerdictResult> {
  const text = claim.trim();
  if (!text) {
    return fallbackVerdict();
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return fallbackVerdict();
  }

  const groq = new Groq({ apiKey });
  const prompt = `
You are a factual verification engine.
Given one claim and supporting evidence, return ONLY strict JSON with this exact shape:
{
  "verdict": "correct" | "incorrect" | "unverifiable",
  "confidence": 0-100 | null,
  "corrected": "string",
  "explanation": "string",
  "source": "string",
  "source_url": "string"
}

Rules:
- Use "correct" only if evidence clearly supports the claim.
- Use "incorrect" only if evidence clearly contradicts the claim and provide corrected text.
- Use "unverifiable" if evidence is insufficient/conflicting.
- confidence is the truth confidence of the original claim (not model certainty).
- For "incorrect", confidence should usually be low (0-30).
- For "correct", confidence should usually be high (70-100).
- If verdict is "unverifiable", set confidence to null, not 0.
- source should be the strongest evidence origin.
- source_url should be an empty string when unavailable.
- No markdown, no extra keys, no preamble.

Claim: ${JSON.stringify(text)}
Web snippets: ${JSON.stringify(evidence.webSnippets)}
Wikidata: ${JSON.stringify(evidence.wikidata)}
FactCheck: ${JSON.stringify(evidence.factcheck)}
`;

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      seed: 42,
      messages: [
        {
          role: "user",
          content: prompt
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return fallbackVerdict();
    }

    const parsed = JSON.parse(stripCodeFence(content)) as {
      verdict?: unknown;
      confidence?: unknown;
      corrected?: unknown;
      explanation?: unknown;
      source?: unknown;
      source_url?: unknown;
    };

    const verdict = normalizeVerdict(parsed.verdict);

    return {
      verdict,
      confidence: normalizeConfidence(parsed.confidence, verdict),
      corrected: typeof parsed.corrected === "string" ? parsed.corrected.trim() : "",
      explanation:
        typeof parsed.explanation === "string" && parsed.explanation.trim().length > 0
          ? parsed.explanation.trim()
          : "No explanation provided.",
      source: typeof parsed.source === "string" ? parsed.source.trim() : "",
      source_url: typeof parsed.source_url === "string" ? parsed.source_url.trim() : ""
    };
  } catch {
    return fallbackVerdict();
  }
}
