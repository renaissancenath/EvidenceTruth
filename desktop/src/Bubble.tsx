import { useEffect, useState } from "react";
import { EtIcon } from "@shared/icons";
import { et, type DesktopState } from "./bridge";

/* The floating circle (DESIGN_SYSTEM §6: the one place radius-round is allowed).
   Drag the ring to move it. Click (or Enter/Space) opens the panel. Right-click, the Menu key or Shift+F10 opens the
   menu with Check, Pause, Hide and Quit. */
export function Bubble() {
  const [s, setS] = useState<DesktopState | null>(null);
  useEffect(() => { void et().getState().then(setS); et().onState(setS); }, []);
  const ready = s?.status === "online" && s.run === "on";
  const label = !s ? "EvidenceTruth" : s.status !== "online" ? "EvidenceTruth: not connected" : s.run === "on" ? "EvidenceTruth: ready" : "EvidenceTruth: paused";
  return (
    <div className="bubble-wrap">
      <button
        className={`bubble ${ready ? "" : "is-paused"}`}
        aria-label={`${label}. Click to open, right-click for more`}
        aria-haspopup="menu"
        title={`${label}. Right-click for Check, Hide and Quit`}
        onClick={() => void et().togglePanel()}
        onContextMenu={(e) => { e.preventDefault(); void et().bubbleMenu(); }}
      >
        <EtIcon name={ready || !s ? "logo" : "paused"} size={24} />
      </button>
    </div>
  );
}
