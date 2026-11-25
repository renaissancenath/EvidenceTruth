/* API types mirrored from backend/app/api/schemas.py (the OpenAPI spec is the contract). */
export type Label =
  | "supported" | "contradicted" | "partially_supported" | "misleading" | "outdated"
  | "unsubstantiated" | "insufficient_evidence" | "not_checkable";
export type ClaimType = "fact" | "opinion" | "prediction" | "hypothesis" | "subjective" | "math_technical";

export interface SourceRef {
  url: string | null; title: string | null; publisher: string | null; provider: string; trust_tier: string;
  published_at: string | null; updated_at: string | null; link_ok: boolean | null;
}
export interface Evidence {
  evidence_id: number; passage: string; location: string | null; stance: "supports" | "contradicts" | "neutral";
  score: number; is_decisive: boolean; source: SourceRef;
}
export interface ClaimResult {
  claim_id: number; parent_id: number | null; text: string; span: [number | null, number | null]; claim_type: ClaimType;
  status: "checking" | "done"; label: Label | null; confidence: number | null; abstained: boolean;
  partial_sources: boolean; evidence: Evidence[]; explanation: { text: string; model: string } | null;
  next_steps: string[]; verifier: string | null;
}
export interface Scan {
  scan_id: number; site: string; mode: string; status: "checking" | "done" | "error"; created_at: string;
  text: string; claims: ClaimResult[]; consent_needed: string[];
}
export interface User {
  user_id: number; email: string; display_name: string | null; plan: "free" | "pro";
  subscription_status: string | null; current_period_end: string | null; retention_days: number; onboarded: boolean;
  checks_used: number; checks_limit: number; documents_limit: number; is_admin: boolean;
}
export interface ApiErrorBody { code: string; message: string; hint: string | null; fields?: { field: string; message: string }[] }
