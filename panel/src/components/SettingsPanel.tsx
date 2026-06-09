import React, { useEffect, useState } from "react";
import { api } from "../services/api";

const s: Record<string, React.CSSProperties> = {
  container: { padding: 12 },
  section: { marginBottom: 16 },
  heading: { fontWeight: 600, fontSize: 12, color: "#aaa", textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 8 },
  label: { fontSize: 11, color: "#aaa", display: "block", marginBottom: 4 },
  input: { width: "100%", padding: "5px 8px", background: "#333", border: "1px solid #444", color: "#eee", borderRadius: 4, fontSize: 12, marginBottom: 8 },
  statusRow: { display: "flex", alignItems: "center", gap: 8, padding: "8px 10px", background: "#1e1e1e", borderRadius: 6 },
  statusText: { fontSize: 12, color: "#ccc" },
  versionText: { fontSize: 10, color: "#555", marginTop: 16, textAlign: "center" },
};

const dotStyle = (online: boolean): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: "50%",
  background: online ? "#4caf50" : "#f44336",
  flexShrink: 0,
});

export const SettingsPanel: React.FC = () => {
  const [backendUrl, setBackendUrl] = useState("http://localhost:8472");
  const [whisperModel, setWhisperModel] = useState("base");
  const [online, setOnline] = useState(false);
  const [serverVersion, setServerVersion] = useState("");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await api.health();
        setOnline(res.status === "ok");
        setServerVersion(res.version ?? "");
      } catch {
        setOnline(false);
      }
    };
    check();
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={s.container}>
      <div style={s.section}>
        <div style={s.heading}>Backend Bağlantısı</div>
        <div style={s.statusRow}>
          <div style={dotStyle(online)} />
          <span style={s.statusText}>
            {online ? `Bağlı — ${backendUrl}` : "Bağlanamıyor"}
          </span>
        </div>
      </div>

      <div style={s.section}>
        <div style={s.heading}>Backend URL</div>
        <label style={s.label}>API Adresi</label>
        <input
          style={s.input}
          value={backendUrl}
          onChange={(e) => setBackendUrl(e.target.value)}
          placeholder="http://localhost:8472"
        />
      </div>

      <div style={s.section}>
        <div style={s.heading}>Varsayılan Ayarlar</div>
        <label style={s.label}>Whisper Model</label>
        <select
          style={s.input}
          value={whisperModel}
          onChange={(e) => setWhisperModel(e.target.value)}
        >
          {["tiny", "base", "small", "medium", "large"].map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </div>

      <div style={s.versionText}>
        KADE AutoEdit AI v1.0.0
        {serverVersion && ` · Backend ${serverVersion}`}
      </div>
    </div>
  );
};
