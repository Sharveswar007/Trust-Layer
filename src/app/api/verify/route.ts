import { NextResponse } from "next/server";
import { extractClaims } from "@/lib/extractor";
import { searchWeb } from "@/lib/sources/serper";
import { queryWikidata } from "@/lib/sources/wikidata";
import { checkFacts } from "@/lib/sources/factcheck";
import { synthesizeVerdict } from "@/lib/verdict";
import { getCached, setCached } from "@/lib/cache";
import { classifyContent } from "@/lib/content-classifier";
import { scoreDimensions, computeOverallScore, getRiskLevel } from "@/lib/dimension-scorer";
import type { Claim, VerifyResponse } from "@/lib/types";

type VerifyRequestBody = {
  text?: string;
};

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
    if (normalizedText.length < 10 || normalizedText.length > 5000) {
      return NextResponse.json(
        { error: "'text' must be between 10 and 5000 characters" },
        { status: 400 }
      );
    }

    const cached = getCached(normalizedText);
    if (cached) {
      return NextResponse.json(cached);
    }

    const claims = await extractClaims(normalizedText);

    const verifiedClaims: Claim[] = await Promise.all(
      claims.map(async (claimText) => {
        const [webSnippets, wikidata, factcheck] = await Promise.all([
          safeSearchWeb(claimText),
          safeQueryWikidata(claimText),
          safeCheckFacts(claimText)
        ]);

        const verdict = await synthesizeVerdict(claimText, {
          webSnippets,
          wikidata,
          factcheck
        });

        return {
          text: claimText,
          verdict: verdict.verdict,
          confidence: verdict.confidence,
          corrected: verdict.corrected,
          explanation: verdict.explanation,
          source: verdict.source,
          source_url: verdict.source_url
        };
      })
    );

    // Classify content
    const contentType = classifyContent(normalizedText, verifiedClaims.map((c) => c.text));

    // Score dimensions
    const dimensions = await scoreDimensions(verifiedClaims, contentType, normalizedText);

    // Compute overall trust score (weighted average of dimensions)
    const overallTrustScore = computeOverallScore(dimensions);

    // Get risk level
    const { level: riskLevel, label: riskLabel } = getRiskLevel(overallTrustScore);

    // Generate reasoning points
    const reasoningPoints: string[] = [];

    // Add dimension-specific reasons
    for (const dim of dimensions) {
      reasoningPoints.push(`${dim.name}: ${dim.score}/10 — ${dim.reason}`);
    }

    // Add top issues/anomalies
    const correctCount = verifiedClaims.filter((c) => c.verdict === "correct").length;
    const incorrectCount = verifiedClaims.filter((c) => c.verdict === "incorrect").length;
    const unverifiableCount = verifiedClaims.filter((c) => c.verdict === "unverifiable").length;

    if (correctCount > 0) {
      reasoningPoints.push(`✓ ${correctCount} claim(s) verified with evidence`);
    }
    if (incorrectCount > 0) {
      reasoningPoints.push(`✗ ${incorrectCount} claim(s) contradicted by sources`);
    }
    if (unverifiableCount > 0) {
      const unverifiableRate = ((unverifiableCount / verifiedClaims.length) * 100).toFixed(0);
      reasoningPoints.push(
        `⚠️ ${unverifiableCount} claim(s) unverifiable (${unverifiableRate}% of total)`
      );
    }

    // Check for heavy reliance on unvetted sources
    const unvettedSources = verifiedClaims.filter((c) => !["factcheck", "wikidata", "wikipedia"].some((s) => c.source.toLowerCase().includes(s))).length;
    if (unvettedSources > verifiedClaims.length * 0.5) {
      reasoningPoints.push(
        `⚠️ Heavy reliance on unvetted web snippets (${unvettedSources}/${verifiedClaims.length})`
      );
    }

    // Check claim extraction quality
    if (verifiedClaims.length === 0) {
      reasoningPoints.push("ℹ️ No verifiable claims extracted from input");
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
