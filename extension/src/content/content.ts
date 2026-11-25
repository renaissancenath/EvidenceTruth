/* Injected only into a tab the user chose to scan, on a site they allowed (chrome.scripting + optional host permission).
   Reads text, sends it to the service worker, then underlines checked sentences with the CSS Custom Highlight API
   (no changes to the page's DOM, no background tint). Page text is never interpreted as instructions. */
import { latestAnswer, selectionText } from "../shared/extract";

type Label = "supported" | "contradicted" | "partially_supported" | "misleading" | "outdated" | "unsubstantiated" | "insufficient_evidence" | "not_checkable";
const AMBER = "#8A5300", GREY = "#4A4F57";
const COLORS: Record<Label, string> = { supported: "#1E6B4A", contradicted: "#B42318", partially_supported: AMBER, misleading: AMBER, outdated: AMBER,
  unsubstantiated: AMBER, insufficient_evidence: GREY, not_checkable: GREY };

declare global { interface Window { __etInstalled?: boolean } }

function installStyles() {
  if (document.getElementById("et-highlight-style")) return;
  const style = document.createElement("style");
  style.id = "et-highlight-style";
  style.textContent = (Object.keys(COLORS) as Label[]).map((l) =>
    `::highlight(et-${l}){text-decoration:underline 2px ${COLORS[l]};text-underline-offset:3px;}`).join("\n");
  document.documentElement.appendChild(style);
}

function findRanges(root: Element, needle: string): Range[] {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  const nodes: Text[] = [];
  let full = "";
  for (let n = walker.nextNode(); n; n = walker.nextNode()) { nodes.push(n as Text); full += (n as Text).data; }
  const idx = full.indexOf(needle.slice(0, 120));
  if (idx < 0) return [];
  const end = idx + Math.min(needle.length, full.length - idx);
  const range = document.createRange();
  let pos = 0;
  for (const t of nodes) {
    const next = pos + t.data.length;
    if (idx >= pos && idx < next) range.setStart(t, idx - pos);
    if (end > pos && end <= next) { range.setEnd(t, end - pos); break; }
    pos = next;
  }
  return [range];
}

function underline(claims: { text: string; label: Label | null }[], scope: Element) {
  if (!("highlights" in CSS)) return;
  installStyles();
  const byLabel = new Map<Label, Range[]>();
  for (const c of claims) {
    if (!c.label || c.label === "not_checkable") continue;
    byLabel.set(c.label, [...(byLabel.get(c.label) ?? []), ...findRanges(scope, c.text)]);
  }
  for (const l of Object.keys(COLORS) as Label[]) CSS.highlights.delete(`et-${l}`);
  for (const [l, ranges] of byLabel) CSS.highlights.set(`et-${l}`, new Highlight(...ranges));
}

let scope: Element = document.body;

if (!window.__etInstalled) {
  window.__etInstalled = true;
  chrome.runtime.onMessage.addListener((msg: unknown, sender) => {
    if (sender.id !== chrome.runtime.id || !msg || typeof msg !== "object") return;
    const m = msg as { type?: string; mode?: string; claims?: { text: string; label: Label | null }[] };
    if (m.type === "collect") {
      const sel = selectionText(document);
      let text = sel;
      let mode: "answer" | "selection" = "selection";
      if (!sel && m.mode !== "selection") {
        const el = latestAnswer(document, location.hostname);
        if (el) { scope = el; text = (el as HTMLElement).innerText.trim(); mode = "answer"; }
      } else {
        scope = document.getSelection()?.anchorNode?.parentElement?.closest("article, main, section, div") ?? document.body;
      }
      void chrome.runtime.sendMessage({ type: "page-text", text: text.slice(0, 60000), site: location.hostname, mode });
    }
    if (m.type === "underline" && Array.isArray(m.claims)) underline(m.claims, scope);
  });
}
