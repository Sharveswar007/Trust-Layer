import Groq from "groq-sdk";
import type { Claim, ContentType, TrustDimension } from "@/lib/types";

const DIMENSION_MAP: Record<ContentType, string[]> = {
  FINANCIAL: [
    "Data Accuracy",
    "Financial Reasoning",
    "Regulatory Awareness",
    "Action Safety Gating",
    "Human Oversight Compliance"
  ],
  MEDICAL: [
    "Data Accuracy",
    "Clinical Evidence",
    "Safety Warnings",
    "Regulatory Compliance",
    "Source Credibility"
  ],
  LEGAL: [
    "Data Accuracy",
    "Statutory Accuracy",
    "Jurisdictional Awareness",
    "Precedent Validity",
    "Risk Disclosure"
  ],
  TECHNICAL: [
    "Data Accuracy",
    "Technical Precision",
    "Version Currency",
    "Security Awareness",
    "Implementation Safety"
  ],
  GENERAL: [
    "Data Accuracy",
    "Source Quality",
    "Claim Consistency",
    "Recency",
    "Verifiability Rate"
  ]
};

// Non-factual dimensions that need semantic understanding
const NON_FACTUAL_DIMENSIONS = [
  "Human Oversight Compliance",
  "Action Safety Gating",
  "Risk Disclosure",
  "Safety Warnings",
  "Implementation Safety"
];

function calculateSourceCredibilityScore(claim: Claim): number {
  // Simple heuristic: FactCheck/Wikidata/Wikipedia sources = 9, others = 6
  const credibleSources = ["factcheck", "wikidata", "wikipedia"];
  const sourceScore = credibleSources.some((s) => claim.source.toLowerCase().includes(s))
    ? 9
    : 6;
  return sourceScore;
}

function calculateDataAccuracy(claims: Claim[]): number {
  if (claims.length === 0) return 5;

  const correctCount = claims.filter((c) => c.verdict === "correct").length;
  const incorrectCount = claims.filter((c) => c.verdict === "incorrect").length;
  const unverifiableCount = claims.filter((c) => c.verdict === "unverifiable").length;

  // Base score: (correct / total) * 10
  let score = (correctCount / claims.length) * 10;

  // Unverifiable penalty: 3 points per unverifiable ratio
  const unverifiableRate = unverifiableCount / claims.length;
  score -= Math.round(unverifiableRate * 3);

  // Clamp to 0-10
  return Math.max(0, Math.min(10, score));
}

function calculateSourceQuality(claims: Claim[]): number {
  if (claims.length === 0) return 5;
  const avgCredibility = claims.reduce((sum, c) => sum + calculateSourceCredibilityScore(c), 0) / claims.length;
  // Scale from 6-9 range to 0-10 range
  return Math.round((avgCredibility / 10) * 10);
}

function calculateClaimConsistency(claims: Claim[]): number {
  if (claims.length <= 1) return 8;

  // Simple heuristic: if all verdicts are same type, high consistency
  const verdictTypes = new Set(claims.map((c) => c.verdict));
  const consistency = 11 - verdictTypes.size * 3; // Max 10, min ~2
  return Math.max(2, Math.min(10, consistency));
}

function calculateVerifiabilityRate(claims: Claim[]): number {
  if (claims.length === 0) return 5;
  const verifiableClaims = claims.filter((c) => c.verdict !== "unverifiable").length;
  return Math.round((verifiableClaims / claims.length) * 10);
}

async function scoreNonFactualDimensions(
  text: string,
  claim_text: string,
  contentType: ContentType
): Promise<Record<string, number>> {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    // Fallback: return neutral scores
    return {
      "Human Oversight Compliance": 5,
      "Action Safety Gating": 5,
      "Risk Disclosure": 5,
      "Safety Warnings": 5,
      "Implementation Safety": 5
    };
  }

  const relevantDimensions = DIMENSION_MAP[contentType];
  const nonFactualDims = relevantDimensions.filter((d) => NON_FACTUAL_DIMENSIONS.includes(d));

  if (nonFactualDims.length === 0) {
    return {};
  }

  const groq = new Groq({ apiKey });
  const prompt = `You are scoring a document's compliance and safety across multiple dimensions. Return ONLY valid JSON with no markdown, preamble, or explanation.

Document context:
${text.substring(0, 500)}

Example claim extracted:
${claim_text}

Return JSON with scores (0-10) for these dimensions (only include dimensions relevant to the document):
${nonFactualDims.map((d) => `"${d}": <0-10 number>`).join(",\n")}

Rules:
- "Human Oversight Compliance": does the document suggest human review is needed before action? 0=none, 10=explicit
- "Action Safety Gating": are there safety checks or gates to prevent harm? 0=none, 10=explicit
- "Risk Disclosure": does it clearly disclose risks? 0=none, 10=explicit
- "Safety Warnings": are safety warnings present and clear? 0=none, 10=explicit
- "Implementation Safety": is the implementation approach safe? 0=unsafe, 10=very safe

Return only valid JSON object with numeric scores.`;

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
      return {};
    }

    const parsed = JSON.parse(content) as Record<string, number>;
    // Clamp all scores to 0-10
    const clamped: Record<string, number> = {};
    for (const [key, value] of Object.entries(parsed)) {
      clamped[key] = Math.max(0, Math.min(10, typeof value === "number" ? value : 5));
    }
    return clamped;
  } catch {
    // Fallback on error
    return {};
  }
}

export async function scoreDimensions(claims: Claim[], contentType: ContentType, text: string): Promise<TrustDimension[]> {
  const dimensions: TrustDimension[] = [];
  const dimensionNames = DIMENSION_MAP[contentType];

  // Get non-factual dimension scores from Groq (one call for all)
  const claimTexts = claims.map((c) => c.text).join("; ");
  const nonFactualScores = await scoreNonFactualDimensions(text, claimTexts.substring(0, 200), contentType);

  for (const dimensionName of dimensionNames) {
    let score = 5; // default
    let reason = "";

    if (dimensionName === "Data Accuracy") {
      score = calculateDataAccuracy(claims);
      const correctCount = claims.filter((c) => c.verdict === "correct").length;
      const incorrectCount = claims.filter((c) => c.verdict === "incorrect").length;
      const unverifiableCount = claims.filter((c) => c.verdict === "unverifiable").length;
      reason = `${correctCount} verified, ${incorrectCount} incorrect, ${unverifiableCount} unverifiable`;
    } else if (dimensionName === "Source Quality") {
      score = calculateSourceQuality(claims);
      reason = `Average source credibility: ${score}/10`;
    } else if (dimensionName === "Claim Consistency") {
      score = calculateClaimConsistency(claims);
      reason = `Consistency pattern across ${claims.length} claims`;
    } else if (dimensionName === "Verifiability Rate") {
      score = calculateVerifiabilityRate(claims);
      const verifiable = claims.filter((c) => c.verdict !== "unverifiable").length;
      reason = `${verifiable}/${claims.length} claims verifiable`;
    } else if (dimensionName === "Financial Reasoning") {
      // Heuristic: if Data Accuracy is high and have numeric claims, boost this
      const dataAccuracyScore = calculateDataAccuracy(claims);
      const numericClaimCount = claims.filter((c) => /\d+/.test(c.text)).length;
      score = Math.round(dataAccuracyScore * 0.8 + (numericClaimCount > 0 ? 2 : -2));
      score = Math.max(0, Math.min(10, score));
      reason = `Based on ${numericClaimCount} numeric claims and accuracy`;
    } else if (dimensionName === "Regulatory Awareness") {
      // Heuristic: keyword presence for regulatory terms
      const regulatoryKeywords = ["law", "regulation", "compliance", "statute", "mandatory"];
      const keywordMatches = regulatoryKeywords.filter((k) => text.toLowerCase().includes(k)).length;
      score = Math.round((keywordMatches / regulatoryKeywords.length) * 10);
      reason = `${keywordMatches} regulatory keyword(s) detected`;
    } else if (dimensionName === "Statutory Accuracy") {
      score = calculateDataAccuracy(claims);
      reason = `Legal claim verification: ${calculateDataAccuracy(claims)}/10`;
    } else if (dimensionName === "Technical Precision") {
      const technicalTerms = ["version", "api", "protocol", "server", "database", "code"];
      const matches = technicalTerms.filter((t) => text.toLowerCase().includes(t)).length;
      score = Math.round((matches / technicalTerms.length) * 10);
      reason = `${matches} technical terms detected`;
    } else if (dimensionName === "Version Currency") {
      // Check for version numbers and recency indicators
      const hasVersions = /v\d+|\d+\.\d+/.test(text);
      const isRecent = /2024|2025|2026/.test(text);
      score = hasVersions ? 7 : 4;
      if (isRecent) score += 2;
      score = Math.min(10, score);
      reason = `Version info: ${hasVersions ? "present" : "absent"}; Recency: ${isRecent ? "recent" : "unknown"}`;
    } else if (dimensionName === "Clinical Evidence") {
      // Medical-specific: evidence presence
      const evidenceMarkers = ["study", "trial", "research", "evidence", "data"];
      const evidenceCount = evidenceMarkers.filter((m) => text.toLowerCase().includes(m)).length;
      score = Math.round((evidenceCount / evidenceMarkers.length) * 10);
      reason = `${evidenceCount} evidence marker(s) detected`;
    } else if (dimensionName === "Regulatory Compliance") {
      // Medical/legal: compliance language
      const complianceTerms = ["approved", "fda", "certified", "compliant", "standard"];
      const complianceMatches = complianceTerms.filter((t) => text.toLowerCase().includes(t)).length;
      score = Math.round((complianceMatches / complianceTerms.length) * 10);
      reason = `${complianceMatches} compliance indicator(s) found`;
    } else if (dimensionName === "Source Credibility") {
      score = calculateSourceQuality(claims);
      reason = `Average source reliability score`;
    } else if (dimensionName === "Jurisdictional Awareness") {
      // Legal: jurisdiction keywords
      const jurisdictionTerms = ["state", "federal", "court", "jurisdiction", "district"];
      const jurisdictionMatches = jurisdictionTerms.filter((t) => text.toLowerCase().includes(t)).length;
      score = Math.round((jurisdictionMatches / jurisdictionTerms.length) * 10);
      reason = `${jurisdictionMatches} jurisdiction indicator(s) detected`;
    } else if (dimensionName === "Precedent Validity") {
      // Legal: case/precedent references
      const precedentTerms = ["precedent", "case", "ruling", "decision", "established"];
      const precedentMatches = precedentTerms.filter((t) => text.toLowerCase().includes(t)).length;
      score = Math.round((precedentMatches / precedentTerms.length) * 10);
      reason = `${precedentMatches} precedent reference(s) detected`;
    } else if (NON_FACTUAL_DIMENSIONS.includes(dimensionName)) {
      // Use Groq-scored non-factual dimension
      score = nonFactualScores[dimensionName] ?? 5;
      reason = `Scored by semantic analysis`;
    }

    dimensions.push({
      name: dimensionName,
      score: Math.max(0, Math.min(10, score)),
      max: 10,
      reason
    });
  }

  return dimensions;
}

export function computeOverallScore(dimensions: TrustDimension[]): number {
  if (dimensions.length === 0) return 5;

  // Data Accuracy weighted 2x, others 1x
  let totalWeight = 0;
  let weightedSum = 0;

  for (const dim of dimensions) {
    const weight = dim.name === "Data Accuracy" ? 2 : 1;
    weightedSum += dim.score * weight;
    totalWeight += weight;
  }

  return Math.round(weightedSum / totalWeight * 10) / 10;
}

export function getRiskLevel(overallScore: number): { level: "LOW" | "MEDIUM" | "HIGH"; label: string } {
  if (overallScore >= 6) {
    return { level: "LOW", label: "Low Risk — Generally Safe" };
  } else if (overallScore >= 4) {
    return { level: "MEDIUM", label: "Medium Risk — Review Recommended" };
  } else {
    return { level: "HIGH", label: "High Risk, Do Not Execute" };
  }
}
