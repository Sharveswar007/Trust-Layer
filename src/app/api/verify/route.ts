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

function hasVettedEvidence(wikidata: string | null, factcheck: { rating: string; source: string; url: string } | null): boolean {
  return Boolean(wikidata || factcheck);
}

function isHistoricallySensitiveClaim(claim: string): boolean {
  const normalized = claim.toLowerCase();
  return /\b(originally|first|earliest|ancient|historic|historical|dynasty|century|constructed|built|founded|reigned|reign|era|medieval|qin|ming|han|tang|song)\b/.test(
    normalized
  );
}

function shouldDowngradeWebOnlyHistoricalClaim(
  claim: string,
  evidence: { webSnippets: string[]; wikidata: string | null; factcheck: { rating: string; source: string; url: string } | null }
): boolean {
  if (!isHistoricallySensitiveClaim(claim)) {
    return false;
  }

  return evidence.webSnippets.length > 0 && !hasVettedEvidence(evidence.wikidata, evidence.factcheck);
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

  // Telemetry tracking
  const telemetry = {
    claimsExtracted: 0,
    claimsAfterDedup: 0,
    sourcesHit: { web: 0, wikidata: 0, factcheck: 0 },
    fallbackResolves: 0,
    unverifiableFinal: 0
  };

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
    telemetry.claimsExtracted = claims.length;

    const verifiedClaims: Claim[] = await mapWithConcurrency(
      claims,
      VERIFY_CONCURRENCY,
      async (claimText) => {
        const [webSnippets, wikidata, factcheck] = await Promise.all([
          safeSearchWeb(claimText),
          safeQueryWikidata(claimText),
          safeCheckFacts(claimText)
        ]);

        if (webSnippets.length > 0) telemetry.sourcesHit.web++;
        if (wikidata) telemetry.sourcesHit.wikidata++;
        if (factcheck) telemetry.sourcesHit.factcheck++;

        let verdict = await synthesizeVerdict(claimText, {
          webSnippets,
          wikidata,
          factcheck
        });

        if (verdict.verdict === "unverifiable") {
          telemetry.fallbackResolves++;
          verdict = await forceResolveVerdict(
            claimText,
            { webSnippets, wikidata, factcheck },
            verdict.explanation
          );
        }

        if (shouldDowngradeWebOnlyHistoricalClaim(claimText, { webSnippets, wikidata, factcheck })) {
          verdict = {
            verdict: "unverifiable",
            confidence: null,
            corrected: "",
            explanation:
              "Historical claim could not be grounded in vetted evidence. Web snippets alone are insufficient for a confident verdict.",
            source: "evidence-gate",
            source_url: ""
          };
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

    // Track unverifiable claims
    telemetry.unverifiableFinal = unverifiableClaims.length;

    // Log telemetry for debugging (available in server logs)
    console.log(`[TruthLayer Telemetry] Extracted: ${telemetry.claimsExtracted}, Sources: Web=${telemetry.sourcesHit.web} Wikidata=${telemetry.sourcesHit.wikidata} FactCheck=${telemetry.sourcesHit.factcheck}, Fallback resolves: ${telemetry.fallbackResolves}, Final unverifiable: ${telemetry.unverifiableFinal}`);

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
