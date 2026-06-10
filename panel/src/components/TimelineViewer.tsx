import React, { useState } from "react";
import { Clip, CutPoint } from "../types";
import { usePremiereAPI } from "../hooks/usePremiereAPI";
import { premiereAPI } from "../services/premiere";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, EmptyState, SectionHeader } from "./ui";

function fmtTime(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = (sec % 60).toFixed(1).padStart(4, "0");
  return `${m}:${s}`;
}

interface Props {
  pendingCuts?: CutPoint[];
}

export const TimelineViewer: React.FC<Props> = ({ pendingCuts }) => {
  const { t } = useTheme();
  const { selectedClips, sequenceName, refreshClips, isAvailable } = usePremiereAPI();
  const [applying, setApplying] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const handleApply = async () => {
    if (!pendingCuts?.length) return;
    setApplying(true);
    setMessage(null);
    try {
      await premiereAPI.applyEdits(pendingCuts);
      setMessage({ kind: "info", text: "Bekleyen kesimler Premiere timeline'a uygulandı." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setApplying(false);
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <SectionHeader
          icon="🎞️"
          title="Timeline"
          subtitle={
            sequenceName
              ? `Aktif sequence: ${sequenceName}`
              : "Premiere seçimini ve araçlardan gelen kesim önerilerini burada gör."
          }
        />
        <Button variant="secondary" onClick={refreshClips} style={{ padding: "8px 10px", flexShrink: 0 }}>
          Yenile
        </Button>
      </div>

      {!isAvailable && (
        <EmptyState
          icon="⚠️"
          title="Premiere bağlantısı yok"
          hint="Paneli Premiere Pro içinden açınca aktif sequence ve seçili klipler burada görünür."
        />
      )}

      {isAvailable && selectedClips.length === 0 && (
        <EmptyState
          icon="🎬"
          title="Seçili klip yok"
          hint="Premiere timeline'da bir veya daha fazla klip seçip yenileyebilirsin."
        />
      )}

      {isAvailable && selectedClips.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>Seçili klipler</div>
            <Badge>{selectedClips.length} clip</Badge>
          </div>
          {selectedClips.map((clip: Clip) => (
            <Card key={clip.id} active={clip.selected} style={{ padding: "10px 12px", marginBottom: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 8,
                    height: 34,
                    borderRadius: 999,
                    background: clip.selected ? t.accent : t.border,
                    flexShrink: 0,
                  }}
                />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 12.5,
                      fontWeight: 700,
                      color: t.text,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {clip.name}
                  </div>
                  <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 2 }}>
                    {fmtTime(clip.start)} - {fmtTime(clip.end)}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {pendingCuts && pendingCuts.length > 0 && (
        <div style={{ marginTop: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, color: t.text }}>Bekleyen kesimler</div>
            <Badge color={t.warn}>{pendingCuts.length} öneri</Badge>
          </div>

          {pendingCuts.slice(0, 5).map((cp, i) => {
            const cutColor = cp.type === "filler" ? t.warn : t.accent;
            return (
              <Card key={`${cp.start}-${cp.end}-${i}`} style={{ padding: "10px 12px", marginBottom: 8 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div
                    style={{
                      width: 8,
                      height: 34,
                      borderRadius: 999,
                      background: cutColor,
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{cp.label ?? cp.type}</div>
                    <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 2 }}>
                      {fmtTime(cp.start)} - {fmtTime(cp.end)}
                    </div>
                  </div>
                  <Badge color={cutColor}>{cp.type}</Badge>
                </div>
              </Card>
            );
          })}

          {pendingCuts.length > 5 && (
            <div style={{ fontSize: 10.5, color: t.textFaint, textAlign: "center", margin: "6px 0 10px" }}>
              +{pendingCuts.length - 5} öneri daha
            </div>
          )}

          <Button full onClick={handleApply} disabled={applying}>
            {applying ? "Uygulanıyor..." : "Premiere'e Uygula"}
          </Button>
        </div>
      )}

      {message && <Banner kind={message.kind}>{message.text}</Banner>}
    </div>
  );
};
