import React, { useEffect, useState } from "react";
import { CutPoint, TabId } from "./types";
import { TimelineViewer } from "./components/TimelineViewer";
import { ModuleCard, ModuleType } from "./components/ModuleCard";
import { PresetManager } from "./components/PresetManager";
import { JobQueue } from "./components/JobQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { useWebSocket } from "./hooks/useWebSocket";
import { api } from "./services/api";

const TABS: { id: TabId; label: string }[] = [
  { id: "timeline", label: "Timeline" },
  { id: "modules", label: "Moduller" },
  { id: "presets", label: "Presets" },
  { id: "queue", label: "Kuyruk" },
  { id: "settings", label: "Ayarlar" },
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

const s: Record<string, React.CSSProperties> = {
  app: { display: "flex", flexDirection: "column", height: "100vh", background: "#1a1a1a", color: "#e0e0e0" },
  topBar: { display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", background: "#111", borderBottom: "1px solid #2a2a2a", flexShrink: 0 },
  appTitle: { fontWeight: 700, fontSize: 13, color: "#fff", letterSpacing: 0.5 },
  statusLabel: { fontSize: 10, color: "#888" },
  tabBar: { display: "flex", background: "#111", borderBottom: "1px solid #2a2a2a", flexShrink: 0 },
  content: { flex: 1, overflowY: "auto" },
};

const statusDotStyle = (online: boolean): React.CSSProperties => ({
  width: 7,
  height: 7,
  borderRadius: "50%",
  background: online ? "#4caf50" : "#f44336",
  display: "inline-block",
  marginRight: 5,
});

const tabStyle = (active: boolean): React.CSSProperties => ({
  flex: 1,
  padding: "8px 2px",
  fontSize: 11,
  textAlign: "center",
  cursor: "pointer",
  color: active ? "#4a9eff" : "#888",
  background: "transparent",
  border: "none",
  borderBottomStyle: "solid",
  borderBottomWidth: 2,
  borderBottomColor: active ? "#4a9eff" : "transparent",
  transition: "color 0.15s",
});

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<TabId>("modules");
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

  return (
    <div style={s.app}>
      <div style={s.topBar}>
        <span style={s.appTitle}>KADE AutoEdit AI</span>
        <span>
          <span style={statusDotStyle(online && isConnected)} />
          <span style={s.statusLabel}>
            {online && isConnected ? "Cevrimici" : "Cevrimdisi"}
          </span>
        </span>
      </div>

      <div style={s.tabBar}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            style={tabStyle(activeTab === tab.id)}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {activeTab === "timeline" && <TimelineViewer pendingCuts={pendingCuts} />}

        {activeTab === "modules" && (
          <div style={{ padding: 8 }}>
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
