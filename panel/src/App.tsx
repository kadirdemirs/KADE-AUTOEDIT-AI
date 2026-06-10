import React, { useEffect, useState } from "react";
import { AutoEditPanel } from "./components/AutoEditPanel";
import { MemeFinder } from "./components/MemeFinder";
import { AssetLibrary } from "./components/AssetLibrary";
import { PresetManager } from "./components/PresetManager";
import { JobQueue } from "./components/JobQueue";
import { SettingsPanel } from "./components/SettingsPanel";
import { Home, HomeTarget } from "./components/Home";
import { ToolView } from "./components/ToolView";
import { ModuleType } from "./components/moduleMeta";
import { useWebSocket } from "./hooks/useWebSocket";
import { useTimelineClip } from "./hooks/useTimelineClip";
import { api } from "./services/api";
import { ensureBackendRunning } from "./services/backendLauncher";
import { useTheme } from "./theme";
import { Badge, Button, BackButton } from "./components/ui";

// Top-bar utility views (AutoCut keeps these as small icons, not main cards).
type UtilView = "library" | "presets" | "queue" | "settings";
type View = "home" | HomeTarget | UtilView;

const UTIL_BUTTONS: { id: UtilView; icon: string; label: string }[] = [
  { id: "library", icon: "📚", label: "Library" },
  { id: "presets", icon: "💾", label: "Preset" },
  { id: "queue", icon: "📋", label: "Kuyruk" },
  { id: "settings", icon: "⚙️", label: "Ayarlar" },
];

const UTIL_TITLES: Record<UtilView, string> = {
  library: "Library",
  presets: "Preset",
  queue: "İş Kuyruğu",
  settings: "Ayarlar",
};

const MODULE_TYPES: ModuleType[] = [
  "silence", "whisper", "beat", "scene", "color", "captions", "zoom",
  "viral", "podcast", "repeat", "profanity", "chapters", "resize", "broll",
];

const isModule = (v: View): v is ModuleType => MODULE_TYPES.includes(v as ModuleType);
const isUtil = (v: View): v is UtilView =>
  v === "library" || v === "presets" || v === "queue" || v === "settings";

export const App: React.FC = () => {
  const { t, toggle } = useTheme();
  const [view, setView] = useState<View>("home");
  const [online, setOnline] = useState(false);
  const [starting, setStarting] = useState(true);
  const { isConnected } = useWebSocket();
  const timeline = useTimelineClip();

  // On mount: make sure the backend is running (auto-start), then poll health.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const ok = await ensureBackendRunning();
      if (!cancelled) {
        setOnline(ok);
        setStarting(false);
      }
    })();

    const interval = setInterval(async () => {
      try {
        const res = await api.health();
        if (!cancelled) setOnline(res.status === "ok");
      } catch {
        if (!cancelled) setOnline(false);
      }
    }, 5000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const isUp = online && isConnected;
  const goHome = () => setView("home");

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
        <button
          onClick={goHome}
          style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, background: "transparent", border: "none", cursor: "pointer", padding: 0 }}
          title="Ana sayfa"
        >
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
          <div style={{ textAlign: "left" }}>
            <div style={{ fontWeight: 800, fontSize: 14, color: t.text }}>KADE AutoEdit</div>
            <div style={{ fontSize: 9.5, color: t.textFaint, textTransform: "uppercase" }}>AI Video Editor</div>
          </div>
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <Button
            onClick={toggle}
            title="Tema değiştir"
            variant="secondary"
            style={{ width: 34, height: 30, padding: 0, fontSize: 13, lineHeight: 1 }}
          >
            {t.name === "dark" ? "☀️" : "🌙"}
          </Button>
          <Badge color={isUp ? t.good : t.bad} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: isUp ? t.good : t.bad, display: "inline-block" }} />
            {isUp ? "Çevrimiçi" : starting ? "Başlatılıyor…" : "Çevrimdışı"}
          </Badge>
        </div>
      </div>

      {/* Utility icon row */}
      <div
        style={{
          display: "flex",
          gap: 6,
          padding: "7px 10px",
          background: t.surface,
          borderBottom: `1px solid ${t.border}`,
          flexShrink: 0,
        }}
      >
        {UTIL_BUTTONS.map((b) => {
          const active = view === b.id;
          return (
            <button
              key={b.id}
              onClick={() => setView(b.id)}
              title={b.label}
              style={{
                flex: 1,
                padding: "6px 4px",
                fontSize: 10,
                fontWeight: active ? 700 : 500,
                color: active ? t.accent : t.textDim,
                background: active ? `${t.accent}16` : "transparent",
                border: `1px solid ${active ? `${t.accent}55` : "transparent"}`,
                borderRadius: 8,
                cursor: "pointer",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 2,
              }}
            >
              <span style={{ fontSize: 14 }}>{b.icon}</span>
              {b.label}
            </button>
          );
        })}
      </div>

      {/* Offline helper */}
      {!isUp && !starting && (
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
          ⚠️ Sunucuya bağlanılamıyor. KADE arka plan servisinin kurulu ve açık olduğundan emin
          olun (kurulumdan sonra otomatik başlar). <b>Ayarlar</b>'dan tekrar deneyebilirsiniz.
        </div>
      )}

      {/* Content */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        {view === "home" && (
          <Home
            clip={timeline.clip}
            refreshClip={timeline.refresh}
            refreshing={timeline.refreshing}
            onOpen={(target) => setView(target)}
          />
        )}

        {view === "autoedit" && <AutoEditPanel onBack={goHome} />}

        {isModule(view) && <ToolView type={view} onBack={goHome} />}

        {view === "meme" && (
          <div style={{ padding: 14 }}>
            <BackButton onClick={goHome} label="Ana sayfa" />
            <MemeFinder />
          </div>
        )}

        {isUtil(view) && (
          <div style={{ padding: 14 }}>
            <BackButton onClick={goHome} label="Ana sayfa" />
            <div style={{ fontSize: 16, fontWeight: 800, color: t.text, marginBottom: 12 }}>
              {UTIL_TITLES[view]}
            </div>
            {view === "library" && <AssetLibrary />}
            {view === "presets" && <PresetManager />}
            {view === "queue" && <JobQueue />}
            {view === "settings" && <SettingsPanel />}
          </div>
        )}
      </div>
    </div>
  );
};
