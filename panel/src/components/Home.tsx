import React from "react";
import { useTheme } from "../theme";
import { MODULE_META, ModuleType } from "./moduleMeta";
import { Clip } from "../types";
import { TimelineClipCard } from "./ui";

// AutoCut-style homepage: animated boxes, each tool a card that explains itself.
export type HomeTarget = ModuleType | "autoedit" | "meme";

const PRIMARY: HomeTarget[] = [
  "silence", "captions", "zoom", "viral", "podcast",
  "broll", "repeat", "profanity", "chapters", "resize", "meme",
];
const ADVANCED: ModuleType[] = ["beat", "scene", "color", "whisper"];

interface CardMeta { icon: string; label: string; description: string; accent: string }

const SPECIAL: Record<"autoedit" | "meme", CardMeta> = {
  autoedit: { icon: "⚡", label: "Auto Edit", description: "Tek tuşla tam otomatik edit", accent: "#4a9eff" },
  meme: { icon: "😂", label: "Meme", description: "Konuya göre meme bulur", accent: "#ffca28" },
};

function metaFor(target: HomeTarget): CardMeta {
  if (target === "autoedit" || target === "meme") return SPECIAL[target];
  const m = MODULE_META[target];
  return { icon: m.icon, label: m.label, description: m.description, accent: m.accent };
}

const ToolCard: React.FC<{ target: HomeTarget; onClick: () => void; index: number }> = ({ target, onClick, index }) => {
  const { t } = useTheme();
  const meta = metaFor(target);
  return (
    <button
      className="kade-card"
      onClick={onClick}
      style={{
        textAlign: "center",
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 12,
        padding: "14px 10px 12px",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 7,
        animationDelay: `${index * 0.03}s`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.borderColor = meta.accent)}
      onMouseLeave={(e) => (e.currentTarget.style.borderColor = t.border)}
    >
      <span
        style={{
          width: 44, height: 44, borderRadius: 12,
          background: `${meta.accent}1f`, color: meta.accent,
          display: "flex", alignItems: "center", justifyContent: "center", fontSize: 23,
        }}
      >
        {meta.icon}
      </span>
      <span style={{ fontSize: 12.5, fontWeight: 700, color: t.text }}>{meta.label}</span>
      <span style={{ fontSize: 9.5, color: t.textDim, lineHeight: 1.35, minHeight: 26 }}>{meta.description}</span>
    </button>
  );
};

interface Props {
  clip: Clip | null;
  refreshClip: () => void;
  refreshing: boolean;
  diag?: string;
  onOpen: (target: HomeTarget) => void;
}

export const Home: React.FC<Props> = ({ clip, refreshClip, refreshing, diag, onOpen }) => {
  const { t } = useTheme();
  return (
    <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 14 }}>
      <TimelineClipCard
        clipName={clip?.name}
        mediaPath={clip?.mediaPath}
        start={clip?.start}
        end={clip?.end}
        sourceIn={clip?.sourceIn}
        sourceOut={clip?.sourceOut}
        onRefresh={refreshClip}
        refreshing={refreshing}
        diag={diag}
      />

      {/* Featured: Auto Edit */}
      <button
        className="kade-card"
        onClick={() => onOpen("autoedit")}
        style={{
          textAlign: "left",
          background: `linear-gradient(120deg, ${t.accent}, ${t.accent2})`,
          border: "none",
          borderRadius: 14,
          padding: "16px 18px",
          cursor: "pointer",
          color: "#fff",
          display: "flex",
          alignItems: "center",
          gap: 14,
        }}
      >
        <span style={{ fontSize: 30 }}>⚡</span>
        <div>
          <div style={{ fontSize: 16, fontWeight: 800 }}>Auto Edit</div>
          <div style={{ fontSize: 11.5, opacity: 0.92, marginTop: 2 }}>
            Tek tuşla: boşluk + zoom + altyazı + b-roll
          </div>
        </div>
      </button>

      {/* Primary grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRIMARY.map((target, i) => (
          <ToolCard key={target} target={target} index={i} onClick={() => onOpen(target)} />
        ))}
      </div>

      {/* Divider */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 2 }}>
        <div style={{ flex: 1, height: 1, background: t.border }} />
        <span style={{ fontSize: 10, fontWeight: 700, color: t.textFaint, textTransform: "uppercase", letterSpacing: 0.5 }}>
          Gelişmiş
        </span>
        <div style={{ flex: 1, height: 1, background: t.border }} />
      </div>

      {/* Advanced grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ADVANCED.map((target, i) => (
          <ToolCard key={target} target={target} index={PRIMARY.length + i} onClick={() => onOpen(target)} />
        ))}
      </div>
    </div>
  );
};
