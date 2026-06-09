import React, { useEffect, useState } from "react";
import { Preset } from "../types";
import { api } from "../services/api";

const s: Record<string, React.CSSProperties> = {
  container: { padding: 12 },
  header: { fontWeight: 600, fontSize: 13, color: "#e0e0e0", marginBottom: 10 },
  row: { display: "flex", gap: 6, marginBottom: 10 },
  input: { flex: 1, padding: "4px 8px", background: "#333", border: "1px solid #444", color: "#eee", borderRadius: 4, fontSize: 12 },
  select: { flex: 1, padding: "4px 8px", background: "#333", border: "1px solid #444", color: "#eee", borderRadius: 4, fontSize: 12 },
  btn: { padding: "4px 10px", background: "#4a9eff", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 },
  card: { background: "#222", borderRadius: 6, padding: 10, marginBottom: 6, display: "flex", justifyContent: "space-between", alignItems: "center" },
  presetName: { fontSize: 12, fontWeight: 600, color: "#ddd" },
  presetModule: { fontSize: 10, color: "#888" },
  delBtn: { padding: "3px 8px", background: "transparent", border: "1px solid #444", color: "#f44336", borderRadius: 4, cursor: "pointer", fontSize: 11 },
  empty: { color: "#666", fontSize: 12, textAlign: "center", padding: 24 },
};

const MODULES = ["silence", "whisper", "beat", "scene", "color"];

export const PresetManager: React.FC = () => {
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [module, setModule] = useState("silence");
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      const data = await api.getPresets();
      setPresets(data as Preset[]);
    } catch { /* ignore */ }
  };

  useEffect(() => { load(); }, []);

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await api.createPreset({ name: name.trim(), module, settings: {} });
      setName("");
      await load();
    } catch (err) {
      alert(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch { /* ignore */ }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>Preset Yönetimi</div>

      <div style={s.row}>
        <input
          style={s.input}
          placeholder="Preset adı..."
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && save()}
        />
        <select style={s.select} value={module} onChange={(e) => setModule(e.target.value)}>
          {MODULES.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <button style={s.btn} onClick={save} disabled={saving}>
          {saving ? "..." : "Kaydet"}
        </button>
      </div>

      {presets.length === 0 && <div style={s.empty}>Kayıtlı preset yok.</div>}

      {presets.map((p: Preset) => (
        <div key={p.id} style={s.card}>
          <div>
            <div style={s.presetName}>{p.name}</div>
            <div style={s.presetModule}>{p.module}</div>
          </div>
          <button style={s.delBtn} onClick={() => remove(p.id)}>Sil</button>
        </div>
      ))}
    </div>
  );
};
