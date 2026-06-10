import React, { useEffect, useState } from "react";
import { Preset } from "../types";
import { api } from "../services/api";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, EmptyState, Field, SectionHeader, Select, TextInput } from "./ui";

const MODULES = [
  { value: "silence", label: "Sessizlik Kesici" },
  { value: "whisper", label: "Whisper Transkript" },
  { value: "beat", label: "Beat Sync" },
  { value: "scene", label: "Sahne Tespiti" },
  { value: "color", label: "Otomatik Renk" },
];

export const PresetManager: React.FC = () => {
  const { t } = useTheme();
  const [presets, setPresets] = useState<Preset[]>([]);
  const [name, setName] = useState("");
  const [module, setModule] = useState("silence");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const load = async () => {
    try {
      const data = await api.getPresets();
      setPresets(data as Preset[]);
    } catch {
      setMessage({ kind: "error", text: "Preset listesi yüklenemedi." });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const save = async () => {
    if (!name.trim()) {
      setMessage({ kind: "error", text: "Preset adı boş olamaz." });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await api.createPreset({ name: name.trim(), module, settings: {} });
      setName("");
      await load();
      setMessage({ kind: "info", text: "Preset kaydedildi." });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    setMessage(null);
    try {
      await api.deletePreset(id);
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      setMessage({ kind: "error", text: "Preset silinemedi." });
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <SectionHeader
        icon="💾"
        title="Preset Yönetimi"
        subtitle="Sık kullandığın araç ayarlarını isimlendirip tekrar kullanılabilir hale getir."
      />

      <Card>
        <Field label="Preset adı" hint="Kısa ve hatırlanır bir ad seç; örneğin 'Podcast temiz kesim'.">
          <TextInput
            placeholder="Preset adı..."
            value={name}
            onChange={setName}
            onKeyDown={(e) => {
              if (e.key === "Enter") save();
            }}
          />
        </Field>

        <Field label="Modül" hint="Bu preset hangi araç ailesi için kaydedilecek?">
          <Select value={module} onChange={setModule} options={MODULES} />
        </Field>

        <Button full onClick={save} disabled={saving}>
          {saving ? "Kaydediliyor..." : "Preset Kaydet"}
        </Button>
      </Card>

      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      {presets.length === 0 && (
        <EmptyState
          icon="📦"
          title="Kayıtlı preset yok"
          hint="İlk presetini oluşturunca bu listede görünecek."
        />
      )}

      {presets.map((p: Preset) => (
        <Card key={p.id} style={{ padding: "12px 14px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontSize: 13,
                  fontWeight: 800,
                  color: t.text,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {p.name}
              </div>
              <div style={{ marginTop: 4 }}>
                <Badge>{p.module}</Badge>
              </div>
            </div>
            <Button
              variant="secondary"
              onClick={() => remove(p.id)}
              style={{ color: t.bad, padding: "8px 10px", flexShrink: 0 }}
            >
              Sil
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
