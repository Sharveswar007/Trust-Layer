export type Verdict = "correct" | "incorrect" | "unverifiable";
export type ContentType = "FINANCIAL" | "MEDICAL" | "LEGAL" | "TECHNICAL" | "GENERAL";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH";

export interface TrustDimension {
  name: string;
  score: number;
  max: number;
  reason: string;
}

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
  content_type: ContentType;
  dimensions: TrustDimension[];
  overall_trust_score: number | null;
  risk_level: RiskLevel;
  risk_label: string;
  reasoning_points: string[];
  claims: Claim[];
  processing_time_ms: number;
}
