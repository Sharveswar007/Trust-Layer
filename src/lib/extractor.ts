import Groq from "groq-sdk";
import { scoreCheckworthy } from "@/lib/checkworthy";

const CHECKWORTHY_THRESHOLD = 0.5;
const MAX_CHUNK_CHARS = 2500;
const CHECKWORTHY_CONCURRENCY = 8;

function sentenceCandidates(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length >= 8);
}

function hasNumericSignal(sentence: string): boolean {
  return /\d/.test(sentence);
}

function calculateSimilarity(a: string, b: string): number {
  const aLower = a.toLowerCase();
  const bLower = b.toLowerCase();
  
  if (aLower === bLower) return 1.0;
  
  const aWords = new Set(aLower.split(/\s+/).filter(w => w.length > 2));
  const bWords = new Set(bLower.split(/\s+/).filter(w => w.length > 2));
  
  if (aWords.size === 0 || bWords.size === 0) return 0;
  
  const intersection = [...aWords].filter(w => bWords.has(w)).length;
  const union = new Set([...aWords, ...bWords]).size;
  
  return union > 0 ? intersection / union : 0;
}

function deduplicateClaims(claims: string[], threshold: number = 0.75): string[] {
  if (claims.length <= 1) return claims;
  
  const kept: string[] = [];
  
  for (const claim of claims) {
    const hasDuplicate = kept.some(keptClaim => calculateSimilarity(claim, keptClaim) >= threshold);
    if (!hasDuplicate) {
      kept.push(claim);
    }
  }
  
  return kept;
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

  return parsed.claims
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function splitIntoChunks(text: string, maxChars: number): string[] {
  const sentences = sentenceCandidates(text);
  if (sentences.length === 0) {
    return [text];
  }

  const chunks: string[] = [];
  let current = "";

  for (const sentence of sentences) {
    const next = current ? `${current} ${sentence}` : sentence;
    if (next.length <= maxChars) {
      current = next;
      continue;
    }

    if (current) {
      chunks.push(current);
    }

    if (sentence.length > maxChars) {
      // If a single sentence is too large, split it hard by character count.
      for (let i = 0; i < sentence.length; i += maxChars) {
        chunks.push(sentence.slice(i, i + maxChars));
      }
      current = "";
    } else {
      current = sentence;
    }
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

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

async function extractChunkClaims(groq: Groq, chunkText: string): Promise<string[]> {
  const response = await groq.chat.completions.create({
    model: "llama-3.1-8b-instant",
    temperature: 0,
    seed: 42,
    messages: [
      {
        role: "system",
        content:
          "Extract only verifiable factual claims (statistics, dates, names, numbers, historical events). Ignore opinions and subjective statements. Return ONLY valid JSON with no preamble: {claims: [...]} Use strict JSON syntax with double quotes around keys and strings, for example: {\"claims\": [\"...\"]}. CRITICAL: each claim must be copied verbatim from the input text. Do not paraphrase, normalize, or correct numbers/dates/entities. Extract only UNIQUE atomic claims. Do not extract the same fact twice even if it appears in different parts of the text."
      },
      {
        role: "user",
        content: `Extract verifiable factual claims from the following text. Preserve exact wording from the input:\n\n${chunkText}`
      }
    ]
  });

  const content = response.choices?.[0]?.message?.content;
  if (!content) {
    return [];
  }

  return parseClaimsPayload(content);
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
    const chunks = splitIntoChunks(cleanText, MAX_CHUNK_CHARS);

    const extractedClaims: string[] = [];
    for (const chunk of chunks) {
      const chunkClaims = await extractChunkClaims(groq, chunk);
      extractedClaims.push(...chunkClaims);
    }

    const fallbackClaims = sentenceCandidates(cleanText);
    const mergedClaims = Array.from(new Set([...extractedClaims, ...fallbackClaims]));
    
    // Deduplicate semantically similar claims
    const deduplicatedClaims = deduplicateClaims(mergedClaims, 0.75);

    if (deduplicatedClaims.length === 0) {
      return [];
    }

    const scored = await mapWithConcurrency(
      deduplicatedClaims,
      CHECKWORTHY_CONCURRENCY,
      async (claim) => {
        const result = await scoreCheckworthy(claim);
        return { claim, score: result?.score ?? 0 };
      }
    );

    return scored
      .filter((item) => item.score >= CHECKWORTHY_THRESHOLD || hasNumericSignal(item.claim))
      .map((item) => item.claim);
  } catch {
    return [];
  }
}

