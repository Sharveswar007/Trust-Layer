import Groq from "groq-sdk";
import { scoreCheckworthy } from "@/lib/checkworthy";

const CHECKWORTHY_THRESHOLD = 0.5;

function sentenceCandidates(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);
}

function hasNumericSignal(sentence: string): boolean {
  return /\d/.test(sentence);
}

function parseClaimsPayload(content: string): string[] {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { claims?: unknown };
  if (!Array.isArray(parsed.claims)) {
    return [];
  }

  return parsed.claims.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

export async function extractClaims(text: string): Promise<string[]> {
  if (!text.trim()) {
    return [];
  }

  const cleanText = text.replace(/https?:\/\/\S+/g, "").trim();
  if (!cleanText) {
    return [];
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return [];
  }

  const groq = new Groq({ apiKey });

  try {
    const response = await groq.chat.completions.create({
      model: "llama-3.1-8b-instant",
      temperature: 0,
      seed: 42,
      messages: [
        {
          role: "system",
          content:
            "Extract only verifiable factual claims (statistics, dates, names, numbers, historical events). Ignore opinions and subjective statements. Return ONLY valid JSON with no preamble: {claims: [...]} Use strict JSON syntax with double quotes around keys and strings, for example: {\"claims\": [\"...\"]}. CRITICAL: each claim must be copied verbatim from the input text. Do not paraphrase, normalize, or correct numbers/dates/entities. Extract only UNIQUE atomic claims. Do not extract the same fact twice even if it appears in different parts of the text. Maximum 5 claims per input."
        },
        {
          role: "user",
          content: `Extract verifiable factual claims from the following text. Preserve exact wording from the input:\n\n${cleanText}`
        }
      ]
    });

    const content = response.choices?.[0]?.message?.content;
    if (!content) {
      return [];
    }

    const extractedClaims = parseClaimsPayload(content);
    const fallbackClaims = sentenceCandidates(cleanText);
    const mergedClaims = Array.from(new Set([...extractedClaims, ...fallbackClaims]));

    if (mergedClaims.length === 0) {
      return [];
    }

    const scored = await Promise.all(
      mergedClaims.map(async (claim) => {
        const result = await scoreCheckworthy(claim);
        return { claim, score: result?.score ?? 0 };
      })
    );

    return scored
      .filter((item) => item.score >= CHECKWORTHY_THRESHOLD || hasNumericSignal(item.claim))
      .map((item) => item.claim)
      .slice(0, 5);
  } catch {
    return [];
  }
}
