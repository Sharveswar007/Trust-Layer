export type Verdict = "correct" | "incorrect" | "unverifiable";

export interface Claim {
  text: string;
  verdict: Verdict;
  confidence: number | null;
  corrected: string;
  explanation: string;
  source: string;
  source_url: string;
}

export interface VerifyResponse {
  overall_trust_score: number | null;
  claims: Claim[];
  processing_time_ms: number;
}
