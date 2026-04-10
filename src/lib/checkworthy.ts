import Groq from "groq-sdk";

export type CheckworthyType = "FACTUAL" | "OPINION" | "FILLER";

export type CheckworthyResult = {
  score: number;
  type: CheckworthyType;
};

function parseCheckworthyPayload(content: string): CheckworthyResult | null {
  const cleaned = content
    .replace(/^```json\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/```$/i, "")
    .trim();

  const parsed = JSON.parse(cleaned) as { score?: unknown; type?: unknown };
  const score = typeof parsed.score === "number" ? parsed.score : Number(parsed.score);
  const type = parsed.type;

  if (!Number.isFinite(score)) {
    return null;
  }

  if (type !== "FACTUAL" && type !== "OPINION" && type !== "FILLER") {
    return null;
  }

  const normalizedScore = Math.max(0, Math.min(1, score));
  return { score: normalizedScore, type };
}

export async function scoreCheckworthy(sentence: string): Promise<CheckworthyResult | null> {
  const text = sentence.trim();
  if (!text) {
    return null;
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }

  const groq = new Groq({ apiKey });
  const prompt = `
Score how check-worthy this sentence is (0.0 to 1.0).
0.0 = pure opinion / filler / subjective
1.0 = verifiable factual claim (date, number, statistic, named fact)
  A verifiable claim must contain a specific fact: a date, number, named entity, statistic, or stated capability that can be confirmed or denied by an external source. Opinions, benefits, process descriptions, and URLs are NOT verifiable claims. Score them 0.

Sentence: "${text}"
Return ONLY a JSON: { "score": 0.0-1.0, "type": "FACTUAL"|"OPINION"|"FILLER" }
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
      return null;
    }

    return parseCheckworthyPayload(content);
  } catch {
    return null;
  }
}
