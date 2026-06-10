import React, { useState } from "react";
import { ProgressBar } from "./ProgressBar";
import {
  AutoCaptionsResult,
  AutoChaptersResult,
  AutoColorResult,
  AutoResizeResult,
  AutoZoomResult,
  BeatSyncResult,
  BRollResult,
  CutPoint,
  PodcastResult,
  ProfanityResult,
  RepeatDetectResult,
  SceneDetectResult,
  SilenceCutResult,
  TranscriptResult,
  ViralDetectResult,
} from "../types";
import { api } from "../services/api";
import { wsService } from "../services/websocket";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, Field, FilePicker, NumberInput, Select, Slider, Toggle } from "./ui";

export type ModuleType =
  | "silence"
  | "whisper"
  | "beat"
  | "scene"
  | "color"
  | "captions"
  | "zoom"
  | "viral"
  | "podcast"
  | "repeat"
  | "profanity"
  | "chapters"
  | "resize"
  | "broll";

interface Props {
  type: ModuleType;
  onResult?: (cuts: CutPoint[]) => void;
}

const MODULE_META: Record<
  ModuleType,
  { label: string; icon: string; accent: string; description: string; tag: string }
> = {
  silence: {
    label: "Sessizlik Kesici",
    icon: "✂️",
    accent: "#4a9eff",
    description: "Boşlukları, nefes aralarını ve gereksiz beklemeleri otomatik kesim noktalarına çevirir.",
    tag: "Kesim",
  },
  whisper: {
    label: "Whisper Transkript",
    icon: "📝",
    accent: "#7c4dff",
    description: "Konuşmayı yazıya döker; istersen dolgu kelimelerini timeline kesimi olarak önerir.",
    tag: "Metin",
  },
  beat: {
    label: "Beat Sync",
    icon: "🥁",
    accent: "#ff4081",
    description: "Müziğin BPM ve beat noktalarını çıkarır; montajı ritme oturtmak için analiz üretir.",
    tag: "Ritim",
  },
  scene: {
    label: "Sahne Tespiti",
    icon: "🎞️",
    accent: "#00acc1",
    description: "Görüntü değişimlerini yakalar ve uzun videoyu sahne parçalarına ayırır.",
    tag: "Analiz",
  },
  color: {
    label: "Otomatik Renk",
    icon: "🎨",
    accent: "#f59e0b",
    description: "Renk, LUT ve ses seviyesi önerileri üretir; hızlı teknik dengeleme için kullanılır.",
    tag: "Renk",
  },
  captions: {
    label: "Auto Captions",
    icon: "💬",
    accent: "#26a69a",
    description: "Transkriptten altyazı blokları üretir ve seçtiğin sosyal medya stiline hazırlar.",
    tag: "Altyazı",
  },
  zoom: {
    label: "Auto Zoom",
    icon: "🔍",
    accent: "#ec407a",
    description: "Konuşma veya vurgu anlarında dinamik zoom keyframe önerileri çıkarır.",
    tag: "Hareket",
  },
  viral: {
    label: "Viral Detector",
    icon: "🔥",
    accent: "#ff7043",
    description: "Uzun videodan kısa klip adayları bulur ve en güçlü bölümleri puanlar.",
    tag: "Shorts",
  },
  podcast: {
    label: "Podcast Mode",
    icon: "🎙️",
    accent: "#66bb6a",
    description: "Konuşmacı segmentlerini düzenler ve podcast kayıtları için temiz akış önerir.",
    tag: "Podcast",
  },
  repeat: {
    label: "Repeat Detector",
    icon: "🔁",
    accent: "#ab47bc",
    description: "Tekrar edilen cümleleri ve denemeleri gruplayıp korunacak en iyi take'i seçer.",
    tag: "Tekrar",
  },
  profanity: {
    label: "Profanity Filter",
    icon: "🛡️",
    accent: "#ef5350",
    description: "Küfür veya riskli kelimeleri bleep, beep ya da mute noktalarına dönüştürür.",
    tag: "Temizleme",
  },
  chapters: {
    label: "Auto Chapters",
    icon: "📚",
    accent: "#5c6bc0",
    description: "YouTube açıklaması için zaman kodlu bölüm başlıkları ve açıklama bloğu üretir.",
    tag: "Bölüm",
  },
  resize: {
    label: "Auto Resize",
    icon: "📐",
    accent: "#29b6f6",
    description: "Farklı sosyal medya oranları için merkez/crop önerileri hazırlar.",
    tag: "Format",
  },
  broll: {
    label: "B-Roll Suggest",
    icon: "🧩",
    accent: "#ffa726",
    description: "Transkripte göre b-roll arama sorguları ve yerleştirme zamanları önerir.",
    tag: "B-roll",
  },
};

const modelOptions = ["tiny", "base", "small", "medium", "large"];
const languageOptions = [
  { value: "tr", label: "Türkçe" },
  { value: "en", label: "English" },
  { value: "auto", label: "Otomatik" },
];

export const ModuleCard: React.FC<Props> = ({ type, onResult }) => {
  const { t } = useTheme();
  const meta = MODULE_META[type];
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(-40);
  const [minSilenceMs, setMinSilenceMs] = useState(500);
  const [keepPaddingMs, setKeepPaddingMs] = useState(100);
  const [fade, setFade] = useState(true);
  const [whisperModel, setWhisperModel] = useState("base");
  const [language, setLanguage] = useState("tr");
  const [detectFillers, setDetectFillers] = useState(true);
  const [sensitivity, setSensitivity] = useState(0.8);
  const [sceneThreshold, setSceneThreshold] = useState(30);
  const [targetLufs, setTargetLufs] = useState(-14);
  const [denoise, setDenoise] = useState(false);
  const [captionStyle, setCaptionStyle] = useState("youtube");
  const [minScale, setMinScale] = useState(1.15);
  const [maxScale, setMaxScale] = useState(1.4);
  const [clipDuration, setClipDuration] = useState(60);
  const [topN, setTopN] = useState(3);
  const [minSegmentDuration, setMinSegmentDuration] = useState(1);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.65);
  const [replacement, setReplacement] = useState("bleep");
  const [minChapterDuration, setMinChapterDuration] = useState(30);
  const [maxChapters, setMaxChapters] = useState(12);
  const [maxSuggestions, setMaxSuggestions] = useState(20);

  const handleRun = async () => {
    if (!file) {
      setError("Lütfen bir video veya ses dosyası seç.");
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
      const data = await runModule(file);
      setModuleResult(data.result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      unsub();
      setRunning(false);
    }
  };

  const runModule = (targetFile: File) => {
    switch (type) {
      case "silence":
        return api.silenceCut(targetFile, {
          threshold_db: threshold,
          min_silence_ms: minSilenceMs,
          keep_padding_ms: keepPaddingMs,
          fade_ms: fade ? 50 : 0,
        });
      case "whisper":
        return api.transcript(targetFile, { model_name: whisperModel, language, detect_fillers: detectFillers });
      case "beat":
        return api.beatSync(targetFile, { sensitivity });
      case "scene":
        return api.sceneDetect(targetFile, { threshold: sceneThreshold });
      case "color":
        return api.autoColor(targetFile, { target_lufs: targetLufs, denoise });
      case "captions":
        return api.autoCaptions(targetFile, { model_name: whisperModel, language, style: captionStyle });
      case "zoom":
        return api.autoZoom(targetFile, { min_scale: minScale, max_scale: maxScale, sensitivity });
      case "viral":
        return api.viralDetect(targetFile, {
          clip_duration: clipDuration,
          top_n: topN,
          min_duration: Math.min(20, clipDuration),
        });
      case "podcast":
        return api.podcastMode(targetFile, { min_segment_duration: minSegmentDuration });
      case "repeat":
        return api.repeatDetect(targetFile, {
          model_name: whisperModel,
          language,
          similarity_threshold: similarityThreshold,
        });
      case "profanity":
        return api.profanityFilter(targetFile, { model_name: whisperModel, language, replacement });
      case "chapters":
        return api.autoChapters(targetFile, {
          model_name: whisperModel,
          language,
          min_chapter_duration: minChapterDuration,
          max_chapters: maxChapters,
        });
      case "resize":
        return api.autoResize(targetFile, {});
      case "broll":
        return api.brollSuggest(targetFile, {
          model_name: whisperModel,
          language,
          min_duration: minSegmentDuration,
          max_suggestions: maxSuggestions,
        });
    }
  };

  const setModuleResult = (payload: unknown) => {
    switch (type) {
      case "silence": {
        const res = payload as SilenceCutResult;
        setResult(`${res.cuts_count} kesim bulundu. Sessizlik: ${res.total_silence_duration.toFixed(1)}s`);
        onResult?.(res.cut_points);
        break;
      }
      case "whisper": {
        const res = payload as TranscriptResult;
        setResult(`"${res.text.slice(0, 120)}..." - ${res.filler_words_found.length} dolgu kelime`);
        onResult?.(res.filler_cut_points);
        break;
      }
      case "beat": {
        const res = payload as BeatSyncResult;
        setResult(`BPM: ${res.bpm} | ${res.total_beats} beat`);
        break;
      }
      case "scene": {
        const res = payload as SceneDetectResult;
        setResult(`${res.total_scenes} sahne. Ortalama süre: ${res.avg_scene_duration.toFixed(1)}s`);
        break;
      }
      case "color": {
        const res = payload as AutoColorResult;
        setResult(
          `LUT: ${res.color_settings.lut_suggestion} | LUFS: ${res.audio_settings.current_lufs.toFixed(1)} -> ${res.audio_settings.target_lufs}`,
        );
        break;
      }
      case "captions": {
        const res = payload as AutoCaptionsResult;
        setResult(`${res.total_captions} altyazı hazır. Stil: ${res.style}, dil: ${res.language}`);
        break;
      }
      case "zoom": {
        const res = payload as AutoZoomResult;
        setResult(`${res.total_zooms} zoom keyframe. Ortalama scale: ${res.avg_scale}`);
        break;
      }
      case "viral": {
        const res = payload as ViralDetectResult;
        const best = res.best_segment ? `${res.best_segment.start}s-${res.best_segment.end}s` : "yok";
        setResult(`${res.total_candidates} viral aday. En iyi: ${best}`);
        break;
      }
      case "podcast": {
        const res = payload as PodcastResult;
        setResult(`${res.total_speakers} konuşmacı, ${res.segments.length} segment`);
        onResult?.(res.cut_points);
        break;
      }
      case "repeat": {
        const res = payload as RepeatDetectResult;
        setResult(`${res.total_groups} tekrar grubu. Kazanılan süre: ${res.time_saved.toFixed(1)}s`);
        onResult?.(res.cuts_suggested);
        break;
      }
      case "profanity": {
        const res = payload as ProfanityResult;
        setResult(`${res.total_found} riskli kelime bulundu: ${res.words_found.join(", ") || "temiz"}`);
        break;
      }
      case "chapters": {
        const res = payload as AutoChaptersResult;
        setResult(`${res.total_chapters} bölüm hazır.\n${res.youtube_format.slice(0, 160)}`);
        break;
      }
      case "resize": {
        const res = payload as AutoResizeResult;
        setResult(
          `${res.original_resolution} -> ${res.formats.length} format. Subject: ${
            res.subject_detected ? "bulundu" : "merkez"
          }`,
        );
        break;
      }
      case "broll": {
        const res = payload as BRollResult;
        setResult(`${res.total_suggestions} B-roll önerisi. Toplam: ${res.total_broll_duration.toFixed(1)}s`);
        break;
      }
    }
  };

  return (
    <Card style={{ padding: 14 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "flex-start", marginBottom: 12 }}>
        <div
          style={{
            width: 34,
            height: 34,
            borderRadius: 8,
            background: `${meta.accent}22`,
            color: meta.accent,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 18,
            flexShrink: 0,
          }}
        >
          {meta.icon}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ fontSize: 13.5, fontWeight: 800, color: t.text }}>{meta.label}</div>
            <Badge color={meta.accent}>{meta.tag}</Badge>
          </div>
          <div style={{ fontSize: 11.5, color: t.textDim, lineHeight: 1.45, marginTop: 4 }}>
            {meta.description}
          </div>
        </div>
      </div>

      <Field label="Dosya" hint="Analiz edilecek video veya ses dosyası. Sonuçlar araç tipine göre timeline kesimi, metin veya ayar önerisi üretir.">
        <FilePicker file={file} onPick={setFile} placeholder="Video / ses dosyası seç..." />
      </Field>

      {renderControls()}

      {running && <ProgressBar value={progress} label="İşleniyor..." color={meta.accent} />}

      <Button
        full
        onClick={handleRun}
        disabled={running}
        style={{ marginTop: 8, background: running ? t.surface2 : meta.accent }}
      >
        {running ? "İşleniyor..." : "Çalıştır"}
      </Button>

      {result && (
        <div
          style={{
            background: t.surface2,
            border: `1px solid ${t.border}`,
            borderRadius: 8,
            padding: 10,
            marginTop: 10,
            fontSize: 11.5,
            color: t.text,
            lineHeight: 1.45,
            whiteSpace: "pre-wrap",
            maxHeight: 130,
            overflowY: "auto",
          }}
        >
          {result}
        </div>
      )}
      {error && <Banner kind="error">{error}</Banner>}
    </Card>
  );

  function renderControls() {
    return (
      <>
        {renderTranscriptControls()}

        {type === "silence" && (
          <>
            <Slider
              label="Eşik"
              hint="Daha düşük değer daha sessiz bölümleri yakalar; konuşma kesiliyorsa değeri yükselt."
              value={threshold}
              min={-70}
              max={-10}
              unit=" dB"
              onChange={setThreshold}
            />
            <Slider
              label="Minimum sessizlik"
              hint="Kısa nefesleri korumak için artır; agresif temizlik için azalt."
              value={minSilenceMs}
              min={100}
              max={3000}
              step={100}
              unit=" ms"
              onChange={setMinSilenceMs}
            />
            <Slider
              label="Konuşma tamponu"
              hint="Kesimlerin iki yanında bırakılacak güvenli pay. Kelimeler kırpılıyorsa artır."
              value={keepPaddingMs}
              min={0}
              max={500}
              step={10}
              unit=" ms"
              onChange={setKeepPaddingMs}
            />
            <Toggle
              checked={fade}
              onChange={setFade}
              label="Fade geçişi ekle"
              hint="Kesimlerin kulağa daha yumuşak gelmesi için kısa fade uygular."
            />
          </>
        )}

        {(type === "beat" || type === "zoom") && (
          <Slider
            label="Hassasiyet"
            hint="Yüksek değer daha fazla vurgu noktası üretir; düşük değer daha sakin sonuç verir."
            value={sensitivity}
            min={0.1}
            max={1}
            step={0.1}
            onChange={setSensitivity}
          />
        )}

        {type === "scene" && (
          <Slider
            label="Sahne eşiği"
            hint="Yüksek değer yalnızca belirgin geçişleri yakalar; düşük değer daha çok sahne çıkarır."
            value={sceneThreshold}
            min={5}
            max={100}
            onChange={setSceneThreshold}
          />
        )}

        {type === "color" && (
          <>
            <Slider
              label="Hedef LUFS"
              hint="Sosyal medya için -14 LUFS genelde güvenli başlangıçtır."
              value={targetLufs}
              min={-30}
              max={-6}
              unit=" LUFS"
              onChange={setTargetLufs}
            />
            <Toggle
              checked={denoise}
              onChange={setDenoise}
              label="Gürültü azaltma öner"
              hint="Arka plan uğultusu olan kayıtlar için ses temizleme adımı üretir."
            />
          </>
        )}

        {type === "captions" && (
          <Field label="Caption stili" hint="Altyazı bloklarının hedef platforma göre ritmini ve görünüm adını belirler.">
            <Select
              value={captionStyle}
              onChange={setCaptionStyle}
              options={["youtube", "tiktok", "podcast", "minimal"].map((style) => ({ value: style, label: style }))}
            />
          </Field>
        )}

        {type === "zoom" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <NumberInput label="Min scale" value={minScale} min={1} max={3} step={0.05} onChange={setMinScale} />
            <NumberInput label="Max scale" value={maxScale} min={1} max={3} step={0.05} onChange={setMaxScale} />
          </div>
        )}

        {type === "viral" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <NumberInput label="Clip saniye" value={clipDuration} min={10} max={180} onChange={setClipDuration} />
            <NumberInput label="Top aday" value={topN} min={1} max={10} onChange={setTopN} />
          </div>
        )}

        {(type === "podcast" || type === "broll") && (
          <Slider
            label="Minimum segment"
            hint="Çok kısa konuşma parçalarını elemek için segment süresini artır."
            value={minSegmentDuration}
            min={0.5}
            max={10}
            step={0.5}
            unit=" sn"
            onChange={setMinSegmentDuration}
          />
        )}

        {type === "repeat" && (
          <Slider
            label="Benzerlik"
            hint="Yüksek değer yalnızca çok benzer tekrarları gruplar; düşük değer daha agresif tarar."
            value={similarityThreshold}
            min={0.1}
            max={0.95}
            step={0.05}
            onChange={setSimilarityThreshold}
          />
        )}

        {type === "profanity" && (
          <Field label="Değiştirme modu" hint="Riskli kelimede bleep tonu, beep etiketi veya sessize alma noktası üretir.">
            <Select
              value={replacement}
              onChange={setReplacement}
              options={["bleep", "beep", "mute"].map((mode) => ({ value: mode, label: mode }))}
            />
          </Field>
        )}

        {type === "chapters" && (
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            <NumberInput
              label="Min bölüm sn"
              value={minChapterDuration}
              min={10}
              max={300}
              onChange={setMinChapterDuration}
            />
            <NumberInput label="Max bölüm" value={maxChapters} min={1} max={40} onChange={setMaxChapters} />
          </div>
        )}

        {type === "broll" && (
          <Slider
            label="Maksimum öneri"
            hint="Daha kısa listeler için azalt; detaylı b-roll planı için artır."
            value={maxSuggestions}
            min={5}
            max={50}
            step={1}
            onChange={setMaxSuggestions}
          />
        )}
      </>
    );
  }

  function renderTranscriptControls() {
    if (!["whisper", "captions", "repeat", "profanity", "chapters", "broll"].includes(type)) {
      return null;
    }

    return (
      <>
        <Field label="Model" hint="Küçük modeller hızlıdır; büyük modeller daha isabetli transkript üretir.">
          <Select
            value={whisperModel}
            onChange={setWhisperModel}
            options={modelOptions.map((model) => ({ value: model, label: model }))}
          />
        </Field>
        <Field label="Dil" hint="Dil netse seç; karışık kayıtlarda otomatik algılama daha esnek olur.">
          <Select value={language} onChange={setLanguage} options={languageOptions} />
        </Field>
        {type === "whisper" && (
          <Toggle
            checked={detectFillers}
            onChange={setDetectFillers}
            label="Dolgu kelimeleri kesim olarak öner"
            hint="'ıı', 'yani', 'şey' gibi tekrarları timeline kesim noktalarına dönüştürür."
          />
        )}
      </>
    );
  }
};
