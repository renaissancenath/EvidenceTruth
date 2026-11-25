/* UI copy. Rules: DESIGN_SYSTEM.md §1 (sentence case, no hype words, no em dashes). Checked by scripts/slop_check.py. */
import type { Label } from "./types";

export const LABEL_WORD: Record<Label, string> = {
  supported: "Supported",
  contradicted: "Contradicted",
  partially_supported: "Partially supported",
  misleading: "Misleading",
  outdated: "Outdated",
  unsubstantiated: "Unsubstantiated",
  insufficient_evidence: "Insufficient evidence",
  not_checkable: "Not a factual claim",
};

export const STRINGS = {
  tagline: "Checks AI answers against sources.",
  insufficient: "We couldn't find enough evidence to decide. That doesn't mean it's false.",
  unsubstantiated: "Sources cover this topic, but none of them confirms this claim.",
  partial: "Some sources didn't respond.",
  aiExplanation: "AI-written explanation",
  templateExplanation: "Explanation (template)",
  checking: "Checking",
  nextSteps: "What to check next",
  evidence: "Evidence",
  noEvidence: "No passage from your allowed sources was about this claim.",
};

export const PROVIDER_NAME: Record<string, string> = {
  wikipedia: "Wikipedia", crossref: "Crossref", semanticscholar: "Semantic Scholar", arxiv: "arXiv",
  registries: "PyPI and npm", links: "Opening cited links", user_doc: "Your documents",
};
