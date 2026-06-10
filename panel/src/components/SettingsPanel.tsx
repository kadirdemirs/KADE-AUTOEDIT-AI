import React, { useEffect, useState } from "react";
import { api } from "../services/api";
import { useTheme } from "../theme";
import { Badge, Card, Field, SectionHeader, Select, TextInput } from "./ui";

export const SettingsPanel: React.FC = () => {
  const { t } = useTheme();
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
    <div style={{ padding: 14 }}>
      <SectionHeader
        icon="⚙️"
        title="Ayarlar"
        subtitle="Backend bağlantısını izle ve panelde kullanılacak varsayılan tercihleri ayarla."
      />

      <Card>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: online ? t.good : t.bad,
                flexShrink: 0,
              }}
            />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: t.text }}>Backend Bağlantısı</div>
              <div
                style={{
                  fontSize: 11,
                  color: t.textDim,
                  marginTop: 3,
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  whiteSpace: "nowrap",
                }}
              >
                {online ? backendUrl : "Bağlanamıyor"}
              </div>
            </div>
          </div>
          <Badge color={online ? t.good : t.bad}>{online ? "Bağlı" : "Kapalı"}</Badge>
        </div>
      </Card>

      <Card>
        <Field
          label="Backend URL"
          hint="Panel şu an yerel backend'e istek atar; paketli kullanımda bu adresin açık olması gerekir."
        >
          <TextInput value={backendUrl} onChange={setBackendUrl} placeholder="http://localhost:8472" />
        </Field>

        <Field label="Varsayılan Whisper modeli" hint="Transkript tabanlı araçlarda başlangıç modeli olarak kullanılır.">
          <Select
            value={whisperModel}
            onChange={setWhisperModel}
            options={["tiny", "base", "small", "medium", "large"].map((m) => ({ value: m, label: m }))}
          />
        </Field>
      </Card>

      <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 16, textAlign: "center" }}>
        KADE AutoEdit AI v1.0.0
        {serverVersion && ` · Backend ${serverVersion}`}
      </div>
    </div>
  );
};
