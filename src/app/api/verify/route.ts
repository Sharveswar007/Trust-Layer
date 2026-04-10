import { NextResponse } from "next/server";
import { extractClaims } from "@/lib/extractor";
import { searchWeb } from "@/lib/sources/serper";
import { queryWikidata } from "@/lib/sources/wikidata";
import { checkFacts } from "@/lib/sources/factcheck";
import { forceResolveVerdict, synthesizeVerdict } from "@/lib/verdict";
import { getCached, setCached } from "@/lib/cache";
import { classifyContent } from "@/lib/content-classifier";
import { scoreDimensions, computeOverallScore, getRiskLevel } from "@/lib/dimension-scorer";
import type { Claim, VerifyResponse } from "@/lib/types";

type VerifyRequestBody = {
  text?: string;
};

const VERIFY_CONCURRENCY = 4;

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker(): Promise<void> {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) {
        return;
      }
      results[index] = await worker(items[index], index);
    }
  }

  const workers = Array.from(
    { length: Math.max(1, Math.min(concurrency, items.length || 1)) },
    () => runWorker()
  );
  await Promise.all(workers);
  return results;
}

function formatClaimGroup(label: string, claims: Claim[]): string | null {
  if (claims.length === 0) {
    return null;
  }

  return `${label}: ${claims.length} claim(s)`;
}

async function safeSearchWeb(claim: string): Promise<string[]> {
  try {
    return await searchWeb(claim);
  } catch {
    return [];
  }
}

async function safeQueryWikidata(claim: string): Promise<string | null> {
  try {
    return await queryWikidata(claim);
  } catch {
    return null;
  }
}

async function safeCheckFacts(
  claim: string
): Promise<{ rating: string; source: string; url: string } | null> {
  try {
    return await checkFacts(claim);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();

  try {
    const body = (await request.json()) as VerifyRequestBody;

    if (typeof body.text !== "string") {
      return NextResponse.json({ error: "'text' must be a string" }, { status: 400 });
    }

    const normalizedText = body.text.trim();
    if (normalizedText.length < 10) {
      return NextResponse.json(
        { error: "'text' must be at least 10 characters" },
        { status: 400 }
      );
    }

    const cached = getCached(normalizedText);
    if (cached) {
      return NextResponse.json(cached);
    }

    const claims = await extractClaims(normalizedText);

    const verifiedClaims: Claim[] = await mapWithConcurrency(
      claims,
      VERIFY_CONCURRENCY,
      async (claimText) => {
        const [webSnippets, wikidata, factcheck] = await Promise.all([
          safeSearchWeb(claimText),
          safeQueryWikidata(claimText),
          safeCheckFacts(claimText)
        ]);

        let verdict = await synthesizeVerdict(claimText, {
          webSnippets,
          wikidata,
          factcheck
        });

        if (verdict.verdict === "unverifiable") {
          verdict = await forceResolveVerdict(
            claimText,
            { webSnippets, wikidata, factcheck },
            verdict.explanation
          );
        }

        return {
          text: claimText,
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          corrected: verdict.corrected,
          explanation: verdict.explanation,
          source: verdict.source,
          source_url: verdict.source_url
        };
      }
    );

    const contentType = classifyContent(normalizedText, verifiedClaims.map((c) => c.text));
    const dimensions = await scoreDimensions(verifiedClaims, contentType, normalizedText);
    const overallTrustScore = computeOverallScore(dimensions);
    const { level: riskLevel, label: riskLabel } = getRiskLevel(overallTrustScore);

    const reasoningPoints: string[] = [];

    for (const dim of dimensions) {
      reasoningPoints.push(`${dim.name}: ${dim.score}/10 — ${dim.reason}`);
    }

    const correctClaims = verifiedClaims.filter((c) => c.verdict === "correct");
    const incorrectClaims = verifiedClaims.filter((c) => c.verdict === "incorrect");
    const unverifiableClaims = verifiedClaims.filter((c) => c.verdict === "unverifiable");

    const correctSummary = formatClaimGroup("Correct claims", correctClaims);
    const incorrectSummary = formatClaimGroup("Wrong claims", incorrectClaims);
    const unverifiableSummary = formatClaimGroup("Unverifiable claims", unverifiableClaims);

    if (correctSummary) {
      reasoningPoints.push(`- ${correctSummary}`);
    }
    if (incorrectSummary) {
      reasoningPoints.push(`- ${incorrectSummary}`);
    }
    if (unverifiableSummary) {
      reasoningPoints.push(`- ${unverifiableSummary}`);
    }

    const autoResolvedCount = claims.length > 0 ? unverifiableClaims.length : 0;
    if (autoResolvedCount === 0) {
      reasoningPoints.push("- All claims were resolved to correct/incorrect via primary+fallback verification.");
    }

    const unvettedSources = verifiedClaims.filter(
      (c) => !["factcheck", "wikidata", "wikipedia"].some((s) => c.source.toLowerCase().includes(s))
    ).length;
    if (verifiedClaims.length > 0 && unvettedSources > verifiedClaims.length * 0.5) {
      reasoningPoints.push(
        `- Heavy reliance on unvetted web snippets (${unvettedSources}/${verifiedClaims.length})`
      );
    }

    if (verifiedClaims.length === 0) {
      reasoningPoints.push("- No verifiable claims extracted from input");
    }

    const response: VerifyResponse = {
      content_type: contentType,
      dimensions,
      overall_trust_score: overallTrustScore,
      risk_level: riskLevel,
      risk_label: riskLabel,
      reasoning_points: reasoningPoints,
      claims: verifiedClaims,
      processing_time_ms: Date.now() - startedAt
    };

    setCached(normalizedText, response);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
