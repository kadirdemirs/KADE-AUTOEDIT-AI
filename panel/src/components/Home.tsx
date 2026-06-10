import React from "react";
import { useTheme } from "../theme";
import { MODULE_META, ModuleType } from "./moduleMeta";
import { Clip } from "../types";
import { TimelineClipCard } from "./ui";

// The AutoCut-style homepage: a grid of tool cards. Click a card → that tool's page.
// A persistent strip shows which timeline clip everything operates on.

export type HomeTarget = ModuleType | "autoedit" | "meme";

// Primary tools shown in the main grid (AutoCut's 10 + our one-tap Auto Edit + Meme).
const PRIMARY: HomeTarget[] = [
  "silence",
  "captions",
  "zoom",
  "viral",
  "podcast",
  "broll",
  "repeat",
  "profanity",
  "chapters",
  "resize",
];

// Technical analysis tools, tucked under an "Advanced" heading.
const ADVANCED: ModuleType[] = ["beat", "scene", "color", "whisper"];

interface CardMeta {
  icon: string;
  label: string;
  description: string;
  accent: string;
}

const SPECIAL: Record<"autoedit" | "meme", CardMeta> = {
  autoedit: {
    icon: "⚡",
    label: "Auto Edit",
    description: "Tek tuşla tam edit: boşluk + zoom + altyazı + b-roll.",
    accent: "#4a9eff",
  },
  meme: {
    icon: "😂",
    label: "Meme Bulucu",
    description: "Konuya veya transkripte göre meme / GIF önerir.",
    accent: "#ffca28",
  },
};

function metaFor(target: HomeTarget): CardMeta {
  if (target === "autoedit" || target === "meme") return SPECIAL[target];
  const m = MODULE_META[target];
  return { icon: m.icon, label: m.label, description: m.description, accent: m.accent };
}

const ToolCard: React.FC<{ target: HomeTarget; onClick: () => void; featured?: boolean }> = ({
  target,
  onClick,
  featured,
}) => {
  const { t } = useTheme();
  const meta = metaFor(target);
  return (
    <button
      onClick={onClick}
      style={{
        textAlign: "left",
        background: featured ? `linear-gradient(135deg, ${meta.accent}26, ${t.surface})` : t.surface,
        border: `1px solid ${featured ? meta.accent : t.border}`,
        borderRadius: 12,
        padding: 14,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 104,
        transition: "border-color 0.15s, transform 0.1s",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: 9,
          background: `${meta.accent}22`,
          color: meta.accent,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: 19,
        }}
      >
        {meta.icon}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>{meta.label}</div>
      <div style={{ fontSize: 10.5, color: t.textDim, lineHeight: 1.4 }}>{meta.description}</div>
    </button>
  );
};

interface Props {
  clip: Clip | null;
  refreshClip: () => void;
  refreshing: boolean;
  onOpen: (target: HomeTarget) => void;
}

export const Home: React.FC<Props> = ({ clip, refreshClip, refreshing, onOpen }) => {
  const { t } = useTheme();
  return (
    <div style={{ padding: 14 }}>
      {/* Persistent timeline-clip strip */}
      <div style={{ marginBottom: 16 }}>
        <TimelineClipCard
          clipName={clip?.name}
          mediaPath={clip?.mediaPath}
          start={clip?.start}
          end={clip?.end}
          sourceIn={clip?.sourceIn}
          sourceOut={clip?.sourceOut}
          onRefresh={refreshClip}
          refreshing={refreshing}
        />
      </div>

      {/* Featured: one-tap Auto Edit (full width) */}
      <ToolCard target="autoedit" featured onClick={() => onOpen("autoedit")} />

      <div style={{ height: 12 }} />

      {/* Primary tools grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {PRIMARY.map((target) => (
          <ToolCard key={target} target={target} onClick={() => onOpen(target)} />
        ))}
        <ToolCard target="meme" onClick={() => onOpen("meme")} />
      </div>

      {/* Advanced section */}
      <div style={{ fontSize: 12, fontWeight: 800, color: t.textDim, margin: "20px 0 10px", textTransform: "uppercase", letterSpacing: 0.5 }}>
        Gelişmiş Araçlar
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {ADVANCED.map((target) => (
          <ToolCard key={target} target={target} onClick={() => onOpen(target)} />
        ))}
      </div>
    </div>
  );
};
