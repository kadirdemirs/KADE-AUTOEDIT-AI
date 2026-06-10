import React, { useEffect, useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { AutoEditResult, Clip, EditPlan, Style } from "../types";
import { api } from "../services/api";
import { wsService } from "../services/websocket";
import { premiereAPI } from "../services/premiere";
import { useTheme } from "../theme";
import { SectionHeader, Field, Select, Toggle, Button, FilePicker, Banner, Chip, Slider, TimelineClipCard, Accordion, BackButton } from "./ui";

// Icon + extra one-liner per style so each card explains itself (AutoCut style).
const STYLE_META: Record<string, { icon: string; tag: string }> = {
  talking_head: { icon: "🎤", tag: "Konuşan kafa · viral klip" },
  viral_short: { icon: "🔥", tag: "TikTok/Reels · dikey" },
  beat_montage: { icon: "🥁", tag: "Müzik montajı" },
  podcast: { icon: "🎙️", tag: "Çok konuşmacı" },
  cinematic: { icon: "🎬", tag: "Sinematik · yavaş" },
};

const RATIOS = [
  { value: "", label: "Orijinal (değiştirme)" },
  { value: "9:16", label: "9:16 — Reels / TikTok / Shorts" },
  { value: "1:1", label: "1:1 — Instagram kare" },
  { value: "16:9", label: "16:9 — YouTube yatay" },
];

const SILENCE_PRESETS = [
  {
    id: "calm",
    label: "Calm",
    hint: "Doğal konuşma temposu",
    thresholdDb: -42,
    minSilenceMs: 700,
    keepPaddingMs: 160,
  },
  {
    id: "measured",
    label: "Measured",
    hint: "Dengeli YouTube edit",
    thresholdDb: -38,
    minSilenceMs: 450,
    keepPaddingMs: 100,
  },
  {
    id: "energetic",
    label: "Energetic",
    hint: "Hızlı short temposu",
    thresholdDb: -34,
    minSilenceMs: 260,
    keepPaddingMs: 60,
  },
  {
    id: "jumpy",
    label: "Jumpy",
    hint: "Çok agresif kesim",
    thresholdDb: -30,
    minSilenceMs: 160,
    keepPaddingMs: 30,
  },
];

export const AutoEditPanel: React.FC<{ onBack?: () => void }> = ({ onBack }) => {
  const { t } = useTheme();
  const [styles, setStyles] = useState<Style[]>([]);
  const [styleId, setStyleId] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [timelineClip, setTimelineClip] = useState<Clip | null>(null);
  const [sourceMode, setSourceMode] = useState<"timeline" | "file">("timeline");
  const [targetRatio, setTargetRatio] = useState("");
  const [renderMp4, setRenderMp4] = useState(true);
  const [silencePreset, setSilencePreset] = useState("measured");
  const [thresholdDb, setThresholdDb] = useState(-38);
  const [minSilenceMs, setMinSilenceMs] = useState(450);
  const [keepPaddingMs, setKeepPaddingMs] = useState(100);

  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState(0);
  const [progressMsg, setProgressMsg] = useState("");
  const [result, setResult] = useState<AutoEditResult | null>(null);
  const [lastJobId, setLastJobId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [applyMsg, setApplyMsg] = useState<string | null>(null);

  useEffect(() => {
    api
      .getStyles()
      .then((data) => {
        setStyles(data);
        if (data.length) setStyleId(data[0].id);
      })
      .catch((e) => setError(`Stiller yüklenemedi: ${e instanceof Error ? e.message : String(e)}`));
  }, []);

  const refreshTimelineClip = async () => {
    if (!premiereAPI.isAvailable()) {
      setTimelineClip(null);
      return;
    }
    const clips = await premiereAPI.getSelectedClips();
    const clipWithMedia = clips.find((clip) => !!clip.mediaPath) || clips[0] || null;
    setTimelineClip(clipWithMedia);
    if (clipWithMedia?.mediaPath) setSourceMode("timeline");
  };

  useEffect(() => {
    refreshTimelineClip();
  }, []);

  const selected = styles.find((st) => st.id === styleId) || null;

  const handleRun = async () => {
    const canUseTimeline = sourceMode === "timeline" && !!timelineClip?.mediaPath;
    if (!canUseTimeline && !file) return setError("Timeline'da medya yolu okunabilen bir klip seç veya fallback olarak dosya seç.");
    if (!styleId) return setError("Bir stil seç.");
    setRunning(true);
    setProgress(0);
    setProgressMsg("");
    setError(null);
    setResult(null);
    setApplyMsg(null);

    const unsub = wsService.onMessage((e) => {
      if (e.event === "progress") {
        setProgress(e.progress ?? 0);
        if (e.message) setProgressMsg(e.message);
      }
      if (e.event === "job_done") setProgress(100);
    });

    try {
      const overrides: Record<string, unknown> = {
        module_params: {
          silence: {
            threshold_db: thresholdDb,
            min_silence_ms: minSilenceMs,
            keep_padding_ms: keepPaddingMs,
          },
        },
      };
      if (targetRatio) overrides.target_ratio = targetRatio;
      const data = canUseTimeline
        ? await api.autoEditPath({
            sourcePath: timelineClip.mediaPath!,
            styleId,
            overrides,
            render: renderMp4,
            sourceStart: timelineClip.sourceIn,
            sourceEnd: timelineClip.sourceOut,
          })
        : await api.autoEdit(file!, styleId, overrides, renderMp4);
      setResult(data.result);
      setLastJobId(data.job_id);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unsub();
      setRunning(false);
    }
  };

  const applySilencePreset = (presetId: string) => {
    const preset = SILENCE_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;
    setSilencePreset(preset.id);
    setThresholdDb(preset.thresholdDb);
    setMinSilenceMs(preset.minSilenceMs);
    setKeepPaddingMs(preset.keepPaddingMs);
  };

  const handleApply = async () => {
    if (!result) return;
    setApplyMsg(null);
    if (!premiereAPI.isAvailable()) {
      setApplyMsg("Premiere bulunamadı (panel Premiere içinde değil).");
      return;
    }
    try {
      await premiereAPI.applyEditPlan(result.plan, {
        timelineOffset: sourceMode === "timeline" ? timelineClip?.start ?? 0 : 0,
      });
      setApplyMsg("Edit planı aktif sequence'e uygulandı ✓");
    } catch (err) {
      setApplyMsg(`Uygulama hatası: ${err instanceof Error ? err.message : String(err)}`);
    }
  };

  return (
    <div style={{ padding: 14 }}>
      {onBack && <BackButton onClick={onBack} label="Ana sayfa" />}
      <SectionHeader
        icon="⚡"
        title="Auto Edit"
        subtitle="Timeline'da klibi seç, stili belirle, tek tuşa bas. KADE boşlukları atar, dinamik zoom ekler, altyazı basar ve b-roll önerir."
      />

      <Field
        label="1. Kaynak — timeline klibi"
        hint="Premiere timeline'ında seçili klip üzerinde çalışır. Klibi değiştirdiysen Yenile'ye bas."
      >
        <TimelineClipCard
          clipName={timelineClip?.name}
          mediaPath={timelineClip?.mediaPath}
          start={timelineClip?.start}
          end={timelineClip?.end}
          sourceIn={timelineClip?.sourceIn}
          sourceOut={timelineClip?.sourceOut}
          onRefresh={() => {
            setSourceMode("timeline");
            refreshTimelineClip();
          }}
        />

        <Accordion title="Gelişmiş — dosyadan test (Premiere dışı)">
          <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.45, marginBottom: 8 }}>
            Sadece Premiere dışı test/fallback için. Dosya seçersen timeline yerine bu dosya
            kullanılır.
          </div>
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Button full variant={sourceMode === "timeline" ? "primary" : "secondary"} onClick={() => setSourceMode("timeline")}>
              Timeline kullan
            </Button>
            <Button full variant={sourceMode === "file" ? "primary" : "secondary"} onClick={() => setSourceMode("file")}>
              Dosya kullan
            </Button>
          </div>
          {sourceMode === "file" && (
            <FilePicker file={file} onPick={setFile} placeholder="Video / ses dosyası seç..." />
          )}
        </Accordion>
      </Field>

      {/* Step 2 — style cards */}
      <Field label="2. Stil seç" hint="Her stil farklı bir düzenleme zinciri çalıştırır. Ne yaptıkları aşağıda yazıyor.">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {styles.map((st) => {
            const meta = STYLE_META[st.id] || { icon: "🎞️", tag: "" };
            const active = st.id === styleId;
            return (
              <button
                key={st.id}
                onClick={() => setStyleId(st.id)}
                style={{
                  textAlign: "left",
                  padding: 12,
                  borderRadius: 8,
                  cursor: "pointer",
                  background: active ? "rgba(74,158,255,0.10)" : t.surface,
                  border: `1.5px solid ${active ? t.accent : t.border}`,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <span style={{ fontSize: 18 }}>{meta.icon}</span>
                  <span style={{ fontSize: 13.5, fontWeight: 700, color: t.text }}>{st.label}</span>
                  {meta.tag && (
                    <span
                      style={{
                        marginLeft: "auto",
                        fontSize: 9,
                        color: t.accent,
                        background: "rgba(74,158,255,0.12)",
                        padding: "2px 7px",
                        borderRadius: 8,
                      }}
                    >
                      {meta.tag}
                    </span>
                  )}
                </div>
                <div style={{ fontSize: 11.5, color: t.textDim, marginTop: 5, lineHeight: 1.5 }}>
                  {st.description}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                  {st.modules.map((m) => (
                    <span
                      key={m}
                      style={{
                        fontSize: 9,
                        color: t.textFaint,
                        background: t.surface2,
                        padding: "2px 6px",
                        borderRadius: 4,
                      }}
                    >
                      {m}
                    </span>
                  ))}
                </div>
              </button>
            );
          })}
        </div>
      </Field>

      {/* Step 3 — options */}
      <Field
        label="3. Sessizlik temizliği"
        hint="AutoCut mantığı: önce ses seviyesine göre boşluklar bulunur, sonra konuşmanın başı/sonu korunarak kesim planı çıkarılır."
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
          {SILENCE_PRESETS.map((preset) => (
            <Chip
              key={preset.id}
              active={silencePreset === preset.id}
              onClick={() => applySilencePreset(preset.id)}
            >
              {preset.label} · {preset.hint}
            </Chip>
          ))}
        </div>
        <Slider
          label="Gürültü eşiği"
          hint="Ses bu seviyenin altına düştüğünde sessizlik adayı sayılır. Ortam gürültülüyse değeri yükselt, sessizlikler kaçıyorsa düşür."
          value={thresholdDb}
          min={-70}
          max={-10}
          unit=" dB"
          onChange={(value) => {
            setSilencePreset("custom");
            setThresholdDb(value);
          }}
        />
        <Slider
          label="Kesilecek minimum sessizlik"
          hint="Bu süreden kısa duraklamalar korunur. Daha hızlı edit için azalt; doğal konuşma için artır."
          value={minSilenceMs}
          min={100}
          max={3000}
          step={50}
          unit=" ms"
          onChange={(value) => {
            setSilencePreset("custom");
            setMinSilenceMs(value);
          }}
        />
        <Slider
          label="Konuşma tamponu"
          hint="Kesimin iki yanında bırakılacak güvenli paydır. Kelimelerin başı/sonu kırpılıyorsa artır."
          value={keepPaddingMs}
          min={0}
          max={500}
          step={10}
          unit=" ms"
          onChange={(value) => {
            setSilencePreset("custom");
            setKeepPaddingMs(value);
          }}
        />
      </Field>

      <Field
        label="4. Hedef oran"
        hint="Videoyu sosyal medya için yeniden çerçeveler. 'Orijinal' seçersen oran değişmez."
      >
        <Select value={targetRatio} onChange={setTargetRatio} options={RATIOS} />
      </Field>

      <Toggle
        checked={renderMp4}
        onChange={setRenderMp4}
        label="MP4 olarak da render et"
        hint="Açıkken: Premiere'den bağımsız, altyazıları yakılı bitmiş bir .mp4 dosyası da üretilir (indirebilirsin). Kapalıyken sadece Premiere'e uygulanacak plan çıkar — daha hızlıdır."
      />

      {running && <ProgressBar value={progress} label={progressMsg || "İşleniyor..."} color={t.accent} />}

      <Button full disabled={running || (sourceMode === "timeline" ? !timelineClip?.mediaPath : !file)} onClick={handleRun} style={{ marginTop: 6 }}>
        {running ? "Edit çıkarılıyor..." : "🚀 Auto Edit Başlat"}
      </Button>

      {error && <Banner kind="error">{error}</Banner>}

      {result && (
        <ResultView
          plan={result.plan}
          jobId={lastJobId}
          hasRender={!!result.render_path}
          onApply={handleApply}
          applyMsg={applyMsg}
          styleLabel={selected?.label || result.plan.style_id}
          timelineOffset={sourceMode === "timeline" ? timelineClip?.start ?? 0 : 0}
        />
      )}
    </div>
  );
};

const ResultView: React.FC<{
  plan: EditPlan;
  jobId: string | null;
  hasRender: boolean;
  onApply: () => void;
  applyMsg: string | null;
  styleLabel: string;
  timelineOffset: number;
}> = ({ plan, jobId, hasRender, onApply, applyMsg, styleLabel, timelineOffset }) => {
  const { t } = useTheme();
  const stat = (k: string) => plan.stats[k] ?? 0;
  const fmt = (n: number) => `${n.toFixed(1)}s`;

  const stats: { label: string; value: string; hint: string }[] = [
    { label: "Çıktı süresi", value: fmt(plan.output_duration), hint: `${fmt(plan.source_duration)} kaynaktan` },
    { label: "Kazanılan", value: fmt(stat("time_saved")), hint: "atılan boşluk" },
    { label: "Kesim", value: String(stat("cuts")), hint: "boşluk/dolgu" },
    { label: "Zoom", value: String(stat("zooms")), hint: "dinamik" },
    { label: "Altyazı", value: String(stat("captions")), hint: "satır" },
    { label: "Marker", value: String(stat("markers")), hint: "b-roll/bölüm" },
  ];

  return (
    <div
      style={{
        background: t.surface,
        border: `1px solid ${t.border}`,
        borderRadius: 8,
        padding: 16,
        marginTop: 14,
      }}
    >
      <div style={{ fontSize: 13.5, fontWeight: 700, color: t.good, marginBottom: 12 }}>
        ✅ {styleLabel} hazır
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 14 }}>
        {stats.map((s) => (
          <div key={s.label} style={{ background: t.surface2, borderRadius: 8, padding: "8px 10px" }}>
            <div style={{ fontSize: 17, fontWeight: 800, color: t.text }}>{s.value}</div>
            <div style={{ fontSize: 10.5, fontWeight: 600, color: t.textDim }}>{s.label}</div>
            <div style={{ fontSize: 9, color: t.textFaint }}>{s.hint}</div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        <Button full onClick={onApply}>
          Premiere'e Uygula
        </Button>
        {hasRender && jobId && (
          <a
            href={api.renderUrl(jobId)}
            download
            style={{
              flex: 1,
              padding: "11px 16px",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              textAlign: "center",
              textDecoration: "none",
              background: t.surface2,
              color: t.text,
              border: `1px solid ${t.border}`,
            }}
          >
            ⬇ MP4 İndir
          </a>
        )}
      </div>

      <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 8, lineHeight: 1.4 }}>
        <b>Premiere'e Uygula:</b> aktif sequence'i keser, zoom ve markerları ekler.
        {timelineOffset > 0 && ` Zamanlar seçili klibin ${timelineOffset.toFixed(1)}s başlangıcına göre uygulanır.`}{" "}
        {hasRender && <><b>MP4 İndir:</b> bitmiş videoyu indirir.</>}
      </div>

      {applyMsg && <Banner kind="info">{applyMsg}</Banner>}
    </div>
  );
};
