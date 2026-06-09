import React, { useState } from "react";
import { Clip, CutPoint } from "../types";
import { usePremiereAPI } from "../hooks/usePremiereAPI";
import { premiereAPI } from "../services/premiere";

const s: Record<string, React.CSSProperties> = {
  container: { padding: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontWeight: 600, fontSize: 13, color: "#e0e0e0" },
  badge: { fontSize: 10, background: "#333", padding: "2px 6px", borderRadius: 10, color: "#aaa" },
  refreshBtn: { fontSize: 11, background: "#2a2a2a", border: "1px solid #444", color: "#ccc", padding: "3px 8px", borderRadius: 4, cursor: "pointer" },
  clip: { display: "flex", alignItems: "center", padding: "6px 8px", background: "#222", borderRadius: 4, marginBottom: 4, cursor: "pointer" },
  clipSelected: { borderLeft: "3px solid #4a9eff" },
  clipName: { flex: 1, fontSize: 12, color: "#ddd", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
  clipTime: { fontSize: 10, color: "#888", marginLeft: 8, flexShrink: 0 },
  empty: { color: "#666", fontSize: 12, textAlign: "center", padding: 24 },
  applyBtn: { width: "100%", padding: "7px 0", background: "#4a9eff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600, marginTop: 10 },
};

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

interface Props {
  pendingCuts?: CutPoint[];
}

export const TimelineViewer: React.FC<Props> = ({ pendingCuts }) => {
  const { selectedClips, sequenceName, refreshClips, isAvailable } = usePremiereAPI();
  const [applying, setApplying] = useState(false);

  const handleApply = async () => {
    if (!pendingCuts?.length) return;
    setApplying(true);
    try {
      await premiereAPI.applyEdits(pendingCuts);
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <div>
          <div style={s.title}>Timeline</div>
          {sequenceName && <div style={{ fontSize: 10, color: "#888", marginTop: 2 }}>{sequenceName}</div>}
        </div>
        <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
          <span style={s.badge}>{selectedClips.length} clip</span>
          <button style={s.refreshBtn} onClick={refreshClips}>Refresh</button>
        </div>
      </div>

      {!isAvailable && (
        <div style={{ ...s.empty, color: "#f5a623" }}>
          Premiere Pro baglantisi yok.<br />Panel icinden calistirin.
        </div>
      )}

      {isAvailable && selectedClips.length === 0 && (
        <div style={s.empty}>Secili clip yok.<br />Premiere'de clip secin.</div>
      )}

      {selectedClips.map((clip: Clip) => (
        <div key={clip.id} style={{ ...s.clip, ...(clip.selected ? s.clipSelected : {}) }}>
          <div style={s.clipName}>{clip.name}</div>
          <div style={s.clipTime}>
            {fmtTime(clip.start)} – {fmtTime(clip.end)}
          </div>
        </div>
      ))}

      {pendingCuts && pendingCuts.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#aaa", marginTop: 10, marginBottom: 4 }}>
            Bekleyen kesimler: {pendingCuts.length}
          </div>
          {pendingCuts.slice(0, 5).map((cp, i) => (
            <div key={i} style={{ ...s.clip, borderLeft: `3px solid ${cp.type === "filler" ? "#f5a623" : "#4a9eff"}` }}>
              <div style={s.clipName}>{cp.label ?? cp.type}</div>
              <div style={s.clipTime}>{fmtTime(cp.start)} – {fmtTime(cp.end)}</div>
            </div>
          ))}
          {pendingCuts.length > 5 && (
            <div style={{ fontSize: 10, color: "#666", textAlign: "center" }}>
              +{pendingCuts.length - 5} daha
            </div>
          )}
          <button style={s.applyBtn} onClick={handleApply} disabled={applying}>
            {applying ? "Uygulanıyor..." : "Premiere'e Uygula"}
          </button>
        </div>
      )}
    </div>
  );
};
