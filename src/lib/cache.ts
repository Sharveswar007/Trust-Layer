import type { VerifyResponse } from "@/lib/types";

const cache = new Map<string, VerifyResponse>();

function cacheKey(text: string): string {
  return text.trim().toLowerCase().slice(0, 200);
}

export function getCached(text: string): VerifyResponse | null {
  return cache.get(cacheKey(text)) ?? null;
}

export function setCached(text: string, result: VerifyResponse): void {
  cache.set(cacheKey(text), result);
}
