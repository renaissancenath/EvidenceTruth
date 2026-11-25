/* Hand-built SVG charts on our tokens. Single-series line (no legend; the title names it) and a bar chart whose
   identity is carried by position + icon + word, so colour is never the only cue (status colours fail CVD as a
   categorical palette, checked with the dataviz validator). Hover tooltips on every mark; a table view exists. */
import { useState } from "react";
import { EtIcon } from "@shared/icons";
import { LABEL_WORD } from "@shared/strings";
import type { Label } from "@shared/types";

const W = 640, H = 220, PAD = { l: 40, r: 16, t: 16, b: 32 };

function ticks(max: number): number[] {
  const step = max <= 4 ? 1 : Math.ceil(max / 4);
  return Array.from({ length: Math.floor(max / step) + 1 }, (_, i) => i * step);
}

export function LineChart({ points, title }: { points: { x: string; y: number }[]; title: string }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...points.map((p) => p.y));
  const top = ticks(max).at(-1)! || 1;
  const iw = W - PAD.l - PAD.r, ih = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (points.length <= 1 ? iw / 2 : (i / (points.length - 1)) * iw);
  const y = (v: number) => PAD.t + ih - (v / Math.max(top, max)) * ih;
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.y).toFixed(1)}`).join(" ");
  return (
    <figure style={{ position: "relative" }}>
      <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${title}. ${points.length} days, highest ${max}.`}>
        {ticks(top).map((t) => <g key={t}><line className="grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} /><text x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text></g>)}
        <line className="axis" x1={PAD.l} x2={W - PAD.r} y1={PAD.t + ih} y2={PAD.t + ih} />
        {points.length > 0 && <text x={x(0)} y={H - 8} textAnchor="start">{points[0].x.slice(5)}</text>}
        {points.length > 1 && <text x={x(points.length - 1)} y={H - 8} textAnchor="end">{points.at(-1)!.x.slice(5)}</text>}
        <path className="series" d={d} strokeLinejoin="round" strokeLinecap="round" />
        {/* markers only where something happened, or under the pointer: 30 zero-day dots would be noise */}
        {points.map((p, i) => (p.y > 0 || hover === i) && <circle key={p.x} cx={x(i)} cy={y(p.y)} r={hover === i ? 5 : 4} fill="var(--et-ink)" stroke="var(--et-surface)" strokeWidth={2} />)}
        {hover !== null && <line x1={x(hover)} x2={x(hover)} y1={PAD.t} y2={PAD.t + ih} stroke="var(--et-line)" strokeDasharray="2 2" />}
        {points.map((p, i) => (
          <rect key={"h" + p.x} className="hit" x={x(i) - Math.max(8, iw / points.length / 2)} y={PAD.t} width={Math.max(16, iw / points.length)} height={ih}
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (
        <div className="tip" style={{ left: `${(x(hover) / W) * 100}%`, top: 0, transform: "translateX(-50%)" }}>
          <span className="num">{points[hover].x}</span>: <strong className="num">{points[hover].y}</strong> claims
        </div>
      )}
    </figure>
  );
}

const LABELS: Label[] = ["supported", "contradicted", "partially_supported", "misleading", "outdated", "unsubstantiated", "insufficient_evidence", "not_checkable"];

export function LabelBars({ counts }: { counts: Record<string, number> }) {
  const [hover, setHover] = useState<Label | null>(null);
  const max = Math.max(1, ...LABELS.map((l) => counts[l] ?? 0));
  const total = LABELS.reduce((a, l) => a + (counts[l] ?? 0), 0);
  return (
    <div className="stack" role="list" aria-label="Claims by label">
      {LABELS.map((l) => {
        const v = counts[l] ?? 0;
        return (
          <div key={l} role="listitem" className="row" style={{ flexWrap: "nowrap", position: "relative" }}
            onMouseEnter={() => setHover(l)} onMouseLeave={() => setHover(null)}>
            <span className={`row s-${l}`} style={{ width: 176, flexShrink: 0 }}><EtIcon name={l} size={16} /><span style={{ color: "var(--et-ink)" }}>{LABEL_WORD[l]}</span></span>
            <span style={{ flex: 1, height: 16, background: "var(--et-line-soft)" }}>
              <span className={`s-${l}`} style={{ display: "block", height: 16, width: `${(v / max) * 100}%`, background: "currentColor",
                borderRadius: "0 var(--et-radius-2) var(--et-radius-2) 0", minWidth: v ? 4 : 0 }} />
            </span>
            <span className="num" style={{ width: 40, textAlign: "right" }}>{v}</span>
            {hover === l && <span className="tip" style={{ right: 48, top: -32 }}>{LABEL_WORD[l]}: <strong className="num">{v}</strong>{total ? ` (${Math.round((v / total) * 100)}%)` : ""}</span>}
          </div>
        );
      })}
    </div>
  );
}
