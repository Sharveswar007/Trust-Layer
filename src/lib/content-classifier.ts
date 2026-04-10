import type { ContentType } from "@/lib/types";

const KEYWORD_MAP: Record<ContentType, string[]> = {
  FINANCIAL: [
    "price",
    "revenue",
    "profit",
    "investment",
    "stock",
    "market",
    "financial",
    "dividend",
    "earnings",
    "valuation",
    "budget",
    "capital",
    "loan",
    "mortgage",
    "interest",
    "rate",
    "dollar",
    "expense",
    "income",
    "cash",
    "balance"
  ],
  MEDICAL: [
    "disease",
    "treatment",
    "medication",
    "symptom",
    "diagnosis",
    "patient",
    "doctor",
    "hospital",
    "medical",
    "health",
    "vaccine",
    "drug",
    "clinical",
    "therapy",
    "surgery",
    "disease",
    "virus",
    "bacteria",
    "infection",
    "side effect",
    "prescription"
  ],
  LEGAL: [
    "law",
    "statute",
    "court",
    "legal",
    "regulation",
    "compliance",
    "jurisdiction",
    "precedent",
    "contract",
    "agreement",
    "clause",
    "liable",
    "defendant",
    "plaintiff",
    "attorney",
    "jurisdiction",
    "constitutional",
    "legislative",
    "enforcement"
  ],
  TECHNICAL: [
    "software",
    "code",
    "database",
    "server",
    "api",
    "version",
    "framework",
    "library",
    "repository",
    "algorithm",
    "encryption",
    "security",
    "vulnerability",
    "patch",
    "deployment",
    "configuration",
    "authentication",
    "protocol",
    "technical"
  ],
  GENERAL: []
};

export function classifyContent(text: string, claimTexts: string[]): ContentType {
  const combinedText = (text + " " + claimTexts.join(" ")).toLowerCase();

  const scores: Record<ContentType, number> = {
    FINANCIAL: 0,
    MEDICAL: 0,
    LEGAL: 0,
    TECHNICAL: 0,
    GENERAL: 0
  };

  for (const [contentType, keywords] of Object.entries(KEYWORD_MAP)) {
    for (const keyword of keywords) {
      const count = (combinedText.match(new RegExp(keyword, "gi")) || []).length;
      scores[contentType as ContentType] += count;
    }
  }

  // Find the type with highest score, default to GENERAL if no matches
  let maxScore = 0;
  let bestType: ContentType = "GENERAL";

  for (const [contentType, score] of Object.entries(scores)) {
    if (score > maxScore) {
      maxScore = score;
      bestType = contentType as ContentType;
    }
  }

  // GENERAL is fallback only
  if (bestType === "GENERAL" && maxScore === 0) {
    return "GENERAL";
  }

  return bestType !== "GENERAL" ? bestType : "GENERAL";
}
