import { NextResponse } from "next/server";
import { extractClaims } from "@/lib/extractor";
import { searchWeb } from "@/lib/sources/serper";
import { queryWikidata } from "@/lib/sources/wikidata";
import { checkFacts } from "@/lib/sources/factcheck";
import { synthesizeVerdict } from "@/lib/verdict";
import { getCached, setCached } from "@/lib/cache";
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

    const confidenceValues = verifiedClaims
      .map((claim) => claim.confidence)
      .filter((value): value is number => typeof value === "number");

    const overallTrustScore =
      confidenceValues.length > 0
        ? Math.round(confidenceValues.reduce((sum, value) => sum + value, 0) / confidenceValues.length)
        : null;

    const response: VerifyResponse = {
      overall_trust_score: overallTrustScore,
      claims: verifiedClaims,
      processing_time_ms: Date.now() - startedAt
    };

    setCached(normalizedText, response);

    return NextResponse.json(response);
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }
}
