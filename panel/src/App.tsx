import React, { useEffect, useState } from "react";
import { CutPoint, TabId } from "./types";
import { TimelineViewer } from "./components/TimelineViewer";
import { AutoEditPanel } from "./components/AutoEditPanel";
import { ModuleCard, ModuleType } from "./components/ModuleCard";
import { MemeFinder } from "./components/MemeFinder";
import { AssetLibrary } from "./components/AssetLibrary";
import { PresetManager } from "./components/PresetManager";
import { JobQueue } from "./components/JobQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { api } from "./services/api";
import { useTheme } from "./theme";
import { Badge, Button, SectionHeader } from "./components/ui";

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: "autoedit", label: "Auto Edit", icon: "⚡" },
  { id: "library", label: "Library", icon: "📚" },
  { id: "modules", label: "Araçlar", icon: "🧰" },
  { id: "timeline", label: "Timeline", icon: "🎞️" },
  { id: "presets", label: "Preset", icon: "💾" },
  { id: "queue", label: "Kuyruk", icon: "📋" },
  { id: "settings", label: "Ayarlar", icon: "⚙️" },
];

const MODULES: ModuleType[] = [
  "silence",
  "whisper",
  "beat",
  "scene",
  "color",
  "captions",
  "zoom",
  "viral",
  "podcast",
  "repeat",
  "profanity",
  "chapters",
  "resize",
  "broll",
];

export const App: React.FC = () => {
  const { t, toggle } = useTheme();
  const [activeTab, setActiveTab] = useState<TabId>("autoedit");
  const [online, setOnline] = useState(false);
  const [pendingCuts, setPendingCuts] = useState<CutPoint[]>([]);
  const { isConnected } = useWebSocket();

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.health();
        setOnline(res.status === "ok");
      } catch {
        setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  const handleModuleResult = (cuts: CutPoint[]) => {
    if (cuts.length === 0) return;
    setPendingCuts(cuts);
    setActiveTab("timeline");
  };

  const isUp = online && isConnected;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        flex: 1,
        minHeight: 0,
        background: t.bg,
        color: t.text,
        fontFamily: "Inter, Segoe UI, Arial, sans-serif",
      }}
    >
      {/* Top bar */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "11px 14px",
          background: t.surface,
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              background: `linear-gradient(135deg, ${t.accent}, ${t.accent2})`,
              color: t.accentText,
              fontSize: 17,
              flexShrink: 0,
            }}
          >
            🎬
          </span>
          <div>
            <div style={{ fontWeight: 800, fontSize: 14, color: t.text, letterSpacing: 0 }}>KADE AutoEdit</div>
            <div style={{ fontSize: 9.5, color: t.textFaint, letterSpacing: 0, textTransform: "uppercase" }}>
              AI Video Editor
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            onClick={toggle}
            title="Tema değiştir"
            variant="secondary"
            style={{
              width: 34,
              height: 30,
              padding: 0,
              fontSize: 13,
              lineHeight: 1,
            }}
          >
            {t.name === "dark" ? "☀️" : "🌙"}
          </Button>

          <Badge color={isUp ? t.good : t.bad} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: isUp ? t.good : t.bad,
                display: "inline-block",
              }}
            />
            {isUp ? "Çevrimiçi" : "Çevrimdışı"}
          </Badge>
        </div>
      </div>

      {/* Offline helper banner */}
      {!isUp && (
        <div
          style={{
            background: "rgba(255,176,32,0.12)",
            color: t.warn,
            fontSize: 11,
            padding: "8px 14px",
            borderBottom: `1px solid ${t.border}`,
            lineHeight: 1.5,
          }}
        >
          ⚠️ Sunucuya bağlanılamıyor. <b>KADE-Baslat.bat</b>'ı çalıştırıp backend'in açık olduğundan emin olun.
        </div>
      )}

      {/* Tab bar */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "8px 10px",
          background: t.surface,
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
          overflowX: "auto",
        }}
      >
        {TABS.map((tab) => {
          const active = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                minWidth: 64,
                flex: 1,
                padding: "8px 7px",
                fontSize: 10.5,
                fontWeight: active ? 700 : 500,
                textAlign: "center",
                cursor: "pointer",
                color: active ? t.accent : t.textDim,
                background: active ? `${t.accent}16` : t.surface2,
                border: `1px solid ${active ? `${t.accent}66` : t.border}`,
                borderRadius: 8,
                transition: "color 0.15s, background 0.15s, border-color 0.15s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 3,
              }}
            >
              <span style={{ fontSize: 15 }}>{tab.icon}</span>
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {activeTab === "autoedit" && <AutoEditPanel />}
        {activeTab === "library" && <AssetLibrary />}
        {activeTab === "timeline" && <TimelineViewer pendingCuts={pendingCuts} />}

        {activeTab === "modules" && (
          <div style={{ padding: 14 }}>
            <SectionHeader
              icon="🧰"
              title="Araçlar"
              subtitle="Tek bir işlem yapmak istediğinde. Her araç videonu analiz eder ve öneri üretir; sonuçları Timeline'a gönderebilir veya Premiere'e uygulayabilirsin."
            />
            <MemeFinder />
            {MODULES.map((module) => (
              <ModuleCard key={module} type={module} onResult={handleModuleResult} />
            ))}
          </div>
        )}

        {activeTab === "presets" && <PresetManager />}
        {activeTab === "queue" && <JobQueue />}
        {activeTab === "settings" && <SettingsPanel />}
      </div>
    </div>
  );
};
