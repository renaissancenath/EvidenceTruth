/* Finds the latest AI answer on known chat sites, or uses the user's selection. DOM text only (innerText),
   never form fields, password inputs or screenshots. Selectors can change when sites update; generic fallback is the selection. */
export const ANSWER_SELECTORS: Record<string, string[]> = {
  "chatgpt.com": ['[data-message-author-role="assistant"]'],
  "chat.openai.com": ['[data-message-author-role="assistant"]'],
  "claude.ai": ['[data-testid="assistant-message"]', ".font-claude-message", ".font-claude-response"],
  "gemini.google.com": ["message-content", ".model-response-text"],
  "www.perplexity.ai": [".prose"],
  "perplexity.ai": [".prose"],
  "copilot.microsoft.com": ['[data-content="ai-message"]'],
};

export function selectionText(doc: Document): string {
  const sel = doc.getSelection();
  if (!sel || sel.isCollapsed) return "";
  const node = sel.anchorNode?.parentElement;
  if (node && node.closest("input, textarea, [contenteditable='true'], [type='password']")) return "";
  return sel.toString().trim();
}

export function latestAnswer(doc: Document, host: string): Element | null {
  // known site first, then every known selector (self-hosted chat UIs often reuse the same markup)
  const sels = [...(ANSWER_SELECTORS[host] ?? []), ...new Set(Object.values(ANSWER_SELECTORS).flat())];
  for (const s of sels) {
    const all = doc.querySelectorAll(s);
    if (all.length) return all[all.length - 1];
  }
  return null;
}
