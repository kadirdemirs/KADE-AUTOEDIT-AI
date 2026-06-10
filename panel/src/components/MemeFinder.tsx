import React, { useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { MemeResult, MemeSuggestion } from "../types";
import { api } from "../services/api";
import { wsService } from "../services/websocket";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, Chip, EmptyState, Field, FilePicker, TextInput } from "./ui";

const ALL_SOURCES = [
  { id: "generated", label: "Üret", hint: "offline" },
  { id: "imgflip", label: "Imgflip", hint: "template" },
  { id: "tenor", label: "Tenor", hint: "gif" },
  { id: "giphy", label: "Giphy", hint: "gif" },
];

const MEME_ACCENT = "#ffca28";

export const MemeFinder: React.FC = () => {
  const { t } = useTheme();
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [sources, setSources] = useState<string[]>(["generated", "imgflip"]);
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<MemeResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const toggleSource = (id: string) =>
    setSources((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));

  const handleRun = async () => {
    if (!text.trim() && !file) {
      setError("Bir konu yaz veya video/ses dosyası seç.");
      return;
    }
    if (sources.length === 0) {
      setError("En az bir kaynak seç.");
      return;
    }
    setRunning(true);
    setProgress(0);
    setError(null);
    setResult(null);

    const unsub = wsService.onMessage((e) => {
      if (e.event === "progress") setProgress(e.progress ?? 0);
      if (e.event === "job_done") setProgress(100);
    });

    try {
      const data = await api.memeFind({
        text: text.trim() || undefined,
        file,
        sources: sources.join(","),
        generate: sources.includes("generated"),
      });
      setResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unsub();
      setRunning(false);
    }
  };

  const imgSrc = (m: MemeSuggestion): string | null => {
    if (m.url) return m.url;
    if (m.local_path) return api.memeImageUrl(m.local_path);
    return null;
  };

  return (
    <Card style={{ padding: 14, borderColor: `${MEME_ACCENT}44` }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: `${MEME_ACCENT}22`,
            color: MEME_ACCENT,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          😂
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: t.text }}>Meme Bulucu</div>
            <Badge color={MEME_ACCENT}>TR/EN</Badge>
          </div>
          <div style={{ fontSize: 11.5, color: t.textDim, lineHeight: 1.45, marginTop: 4 }}>
            Yazıdan veya videonun transkriptinden meme/gif önerileri bulur; gerekirse offline görsel üretir.
          </div>
        </div>
      </div>

      <Field label="Konu" hint="Kısa ve net yaz: duygu, olay veya reaksiyon kelimeleri daha iyi sonuç verir.">
        <TextInput
          placeholder="ör: pazartesi sendromu, deadline stresi..."
          value={text}
          onChange={setText}
        />
      </Field>

      <Field label="Video veya ses" hint="Konu boşsa dosyanın transkriptinden otomatik arama terimleri çıkarılır.">
        <FilePicker file={file} onPick={setFile} placeholder="Video / ses dosyası seç..." />
      </Field>

      <Field label="Kaynaklar" hint="Birden fazla kaynak seçebilirsin; GIF servisleri internet erişimi gerektirir.">
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          {ALL_SOURCES.map((src) => (
            <Chip
              key={src.id}
              active={sources.includes(src.id)}
              color={MEME_ACCENT}
              onClick={() => toggleSource(src.id)}
            >
              {src.label} · {src.hint}
            </Chip>
          ))}
        </div>
      </Field>

      {running && <ProgressBar value={progress} label="Meme aranıyor..." color={MEME_ACCENT} />}

      <Button
        full
        onClick={handleRun}
        disabled={running}
        style={{ marginTop: 8, background: running ? t.surface2 : MEME_ACCENT, color: "#241f0b" }}
      >
        {running ? "Aranıyor..." : "Meme Bul"}
      </Button>

      {error && <Banner kind="error">{error}</Banner>}

      {result && (
        <div style={{ marginTop: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 10 }}>
            <div style={{ fontSize: 11.5, color: t.textDim }}>
              {result.total} sonuç · kaynaklar: {result.sources_used.join(", ") || "yok"}
              {result.mode === "transcript" && " · transkriptten"}
            </div>
          </div>

          {result.suggestions.length === 0 && (
            <EmptyState title="Sonuç yok" hint="Konu metnini biraz daha açık yazıp tekrar deneyebilirsin." />
          )}

          {result.suggestions.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {result.suggestions.map((m, i) => {
                const src = imgSrc(m);
                return (
                  <div
                    key={`${m.source}-${m.title}-${i}`}
                    style={{
                      background: t.surface2,
                      borderRadius: 8,
                      overflow: "hidden",
                      border: `1px solid ${t.border}`,
                    }}
                  >
                    {src ? (
                      <img
                        style={{ width: "100%", height: 92, objectFit: "cover", display: "block", background: "#000" }}
                        src={src}
                        alt={m.title}
                      />
                    ) : (
                      <div
                        style={{
                          height: 92,
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          color: t.textDim,
                          fontSize: 11,
                          background: t.bg,
                        }}
                      >
                        Önizleme yok
                      </div>
                    )}
                    <div style={{ padding: "7px 8px" }}>
                      <div style={{ fontSize: 9, fontWeight: 800, color: MEME_ACCENT, textTransform: "uppercase" }}>
                        {m.source} · {m.media_type}
                      </div>
                      <div
                        style={{
                          fontSize: 11,
                          color: t.text,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                          marginTop: 2,
                        }}
                      >
                        {m.title}
                      </div>
                      {m.placement != null && (
                        <div style={{ fontSize: 10, color: t.textFaint, marginTop: 2 }}>
                          Zaman: {m.placement.toFixed(1)}s
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </Card>
  );
};
