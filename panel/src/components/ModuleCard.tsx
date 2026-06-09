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

const MODULE_META: Record<ModuleType, { label: string; color: string }> = {
  silence: { label: "Sessizlik Kesici", color: "#4a9eff" },
  whisper: { label: "Whisper Transkript", color: "#7c4dff" },
  beat: { label: "Beat Sync", color: "#ff4081" },
  scene: { label: "Sahne Tespiti", color: "#00bcd4" },
  color: { label: "Otomatik Renk", color: "#ff9800" },
  captions: { label: "Auto Captions", color: "#26a69a" },
  zoom: { label: "Auto Zoom", color: "#ec407a" },
  viral: { label: "Viral Detector", color: "#ff7043" },
  podcast: { label: "Podcast Mode", color: "#66bb6a" },
  repeat: { label: "Repeat Detector", color: "#ab47bc" },
  profanity: { label: "Profanity Filter", color: "#ef5350" },
  chapters: { label: "Auto Chapters", color: "#5c6bc0" },
  resize: { label: "Auto Resize", color: "#29b6f6" },
  broll: { label: "B-Roll Suggest", color: "#ffa726" },
};

const s: Record<string, React.CSSProperties> = {
  card: { background: "#222", borderRadius: 8, padding: 12, marginBottom: 10 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontWeight: 600, fontSize: 13 },
  label: { fontSize: 11, color: "#aaa", display: "block", marginBottom: 4 },
  row: { display: "flex", gap: 8, alignItems: "center", marginBottom: 8 },
  runBtn: { width: "100%", padding: "7px 0", color: "#fff", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12, fontWeight: 600 },
  fileBtn: { flex: 1, padding: "5px 8px", background: "#2a2a2a", border: "1px solid #444", color: "#ccc", borderRadius: 4, cursor: "pointer", fontSize: 11, textAlign: "center" },
  resultBox: { background: "#1a1a1a", borderRadius: 4, padding: 8, marginTop: 8, fontSize: 11, color: "#aaa", maxHeight: 100, overflowY: "auto" },
  toggle: { display: "flex", gap: 6, alignItems: "center", marginBottom: 8 },
  checkbox: { width: 14, height: 14, cursor: "pointer" },
  selectEl: { flex: 1, width: "100%", padding: "4px 8px", background: "#333", border: "1px solid #444", color: "#eee", borderRadius: 4, fontSize: 12, marginBottom: 8 },
  numberInput: { width: 72, padding: "4px 8px", background: "#333", border: "1px solid #444", color: "#eee", borderRadius: 4, fontSize: 12 },
};

const modelOptions = ["tiny", "base", "small", "medium", "large"];

export const ModuleCard: React.FC<Props> = ({ type, onResult }) => {
  const meta = MODULE_META[type];
  const [file, setFile] = useState<File | null>(null);
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [threshold, setThreshold] = useState(-40);
  const [minSilenceMs, setMinSilenceMs] = useState(500);
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
      setError("Lutfen bir dosya secin.");
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
        return api.silenceCut(targetFile, { threshold_db: threshold, min_silence_ms: minSilenceMs, fade_ms: fade ? 50 : 0 });
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
        return api.viralDetect(targetFile, { clip_duration: clipDuration, top_n: topN, min_duration: Math.min(20, clipDuration) });
      case "podcast":
        return api.podcastMode(targetFile, { min_segment_duration: minSegmentDuration });
      case "repeat":
        return api.repeatDetect(targetFile, { model_name: whisperModel, language, similarity_threshold: similarityThreshold });
      case "profanity":
        return api.profanityFilter(targetFile, { model_name: whisperModel, language, replacement });
      case "chapters":
        return api.autoChapters(targetFile, { model_name: whisperModel, language, min_chapter_duration: minChapterDuration, max_chapters: maxChapters });
      case "resize":
        return api.autoResize(targetFile, {});
      case "broll":
        return api.brollSuggest(targetFile, { model_name: whisperModel, language, min_duration: minSegmentDuration, max_suggestions: maxSuggestions });
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
        setResult(`${res.total_scenes} sahne. Ort. sure: ${res.avg_scene_duration.toFixed(1)}s`);
        break;
      }
      case "color": {
        const res = payload as AutoColorResult;
        setResult(`LUT: ${res.color_settings.lut_suggestion} | LUFS: ${res.audio_settings.current_lufs.toFixed(1)} -> ${res.audio_settings.target_lufs}`);
        break;
      }
      case "captions": {
        const res = payload as AutoCaptionsResult;
        setResult(`${res.total_captions} caption hazir. Stil: ${res.style}, dil: ${res.language}`);
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
        setResult(`${res.total_speakers} konusmaci, ${res.segments.length} segment`);
        onResult?.(res.cut_points);
        break;
      }
      case "repeat": {
        const res = payload as RepeatDetectResult;
        setResult(`${res.total_groups} tekrar grubu. Kazanilan sure: ${res.time_saved.toFixed(1)}s`);
        onResult?.(res.cuts_suggested);
        break;
      }
      case "profanity": {
        const res = payload as ProfanityResult;
        setResult(`${res.total_found} kufur bulundu: ${res.words_found.join(", ") || "temiz"}`);
        break;
      }
      case "chapters": {
        const res = payload as AutoChaptersResult;
        setResult(`${res.total_chapters} bolum hazir.\n${res.youtube_format.slice(0, 160)}`);
        break;
      }
      case "resize": {
        const res = payload as AutoResizeResult;
        setResult(`${res.original_resolution} -> ${res.formats.length} format. Subject: ${res.subject_detected ? "bulundu" : "merkez"}`);
        break;
      }
      case "broll": {
        const res = payload as BRollResult;
        setResult(`${res.total_suggestions} B-roll onerisi. Toplam: ${res.total_broll_duration.toFixed(1)}s`);
        break;
      }
    }
  };

  return (
    <div style={s.card}>
      <div style={s.header}>
        <span style={{ ...s.title, color: meta.color }}>{meta.label}</span>
      </div>

      <div style={s.row}>
        <label style={{ ...s.fileBtn, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {file ? file.name : "Dosya sec..."}
          <input
            type="file"
            accept="video/*,audio/*"
            style={{ display: "none" }}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </label>
      </div>

      {renderControls()}

      {running && <ProgressBar value={progress} label="Isleniyor..." color={meta.color} />}

      <button
        style={{ ...s.runBtn, background: running ? "#444" : meta.color, marginTop: 8 }}
        onClick={handleRun}
        disabled={running}
      >
        {running ? "Isleniyor..." : "Calistir"}
      </button>

      {result && <div style={{ ...s.resultBox, whiteSpace: "pre-wrap" }}>{result}</div>}
      {error && <div style={{ ...s.resultBox, color: "#ff5252" }}>{error}</div>}
    </div>
  );

  function renderControls() {
    return (
      <>
        {renderTranscriptControls()}
        {type === "silence" && (
          <>
            <label style={s.label}>Esik (dB): {threshold}</label>
            <input type="range" min={-70} max={-10} value={threshold} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setThreshold(Number(e.target.value))} />
            <label style={s.label}>Min. sessizlik (ms): {minSilenceMs}</label>
            <input type="range" min={100} max={3000} step={100} value={minSilenceMs} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setMinSilenceMs(Number(e.target.value))} />
            <div style={s.toggle}>
              <input type="checkbox" style={s.checkbox} checked={fade} onChange={(e) => setFade(e.target.checked)} />
              <span style={{ fontSize: 12, color: "#ccc" }}>Fade efekti</span>
            </div>
          </>
        )}

        {(type === "beat" || type === "zoom") && (
          <>
            <label style={s.label}>Hassasiyet: {sensitivity.toFixed(1)}</label>
            <input type="range" min={0.1} max={1.0} step={0.1} value={sensitivity} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setSensitivity(Number(e.target.value))} />
          </>
        )}

        {type === "scene" && (
          <>
            <label style={s.label}>Esik: {sceneThreshold}</label>
            <input type="range" min={5} max={100} value={sceneThreshold} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setSceneThreshold(Number(e.target.value))} />
          </>
        )}

        {type === "color" && (
          <>
            <label style={s.label}>Hedef LUFS: {targetLufs}</label>
            <input type="range" min={-30} max={-6} value={targetLufs} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setTargetLufs(Number(e.target.value))} />
            <div style={s.toggle}>
              <input type="checkbox" style={s.checkbox} checked={denoise} onChange={(e) => setDenoise(e.target.checked)} />
              <span style={{ fontSize: 12, color: "#ccc" }}>Gurultu azaltma</span>
            </div>
          </>
        )}

        {type === "captions" && (
          <>
            <label style={s.label}>Caption stili</label>
            <select style={s.selectEl} value={captionStyle} onChange={(e) => setCaptionStyle(e.target.value)}>
              {["youtube", "tiktok", "podcast", "minimal"].map((style) => <option key={style} value={style}>{style}</option>)}
            </select>
          </>
        )}

        {type === "zoom" && (
          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>Min scale <input style={s.numberInput} type="number" min={1} max={3} step={0.05} value={minScale} onChange={(e) => setMinScale(Number(e.target.value))} /></label>
            <label style={{ ...s.label, flex: 1 }}>Max scale <input style={s.numberInput} type="number" min={1} max={3} step={0.05} value={maxScale} onChange={(e) => setMaxScale(Number(e.target.value))} /></label>
          </div>
        )}

        {type === "viral" && (
          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>Clip sn <input style={s.numberInput} type="number" min={10} max={180} value={clipDuration} onChange={(e) => setClipDuration(Number(e.target.value))} /></label>
            <label style={{ ...s.label, flex: 1 }}>Top <input style={s.numberInput} type="number" min={1} max={10} value={topN} onChange={(e) => setTopN(Number(e.target.value))} /></label>
          </div>
        )}

        {(type === "podcast" || type === "broll") && (
          <label style={s.label}>
            Min. segment (sn): {minSegmentDuration.toFixed(1)}
            <input type="range" min={0.5} max={10} step={0.5} value={minSegmentDuration} style={{ width: "100%", marginTop: 4, marginBottom: 8 }} onChange={(e) => setMinSegmentDuration(Number(e.target.value))} />
          </label>
        )}

        {type === "repeat" && (
          <>
            <label style={s.label}>Benzerlik: {similarityThreshold.toFixed(2)}</label>
            <input type="range" min={0.1} max={0.95} step={0.05} value={similarityThreshold} style={{ width: "100%", marginBottom: 8 }} onChange={(e) => setSimilarityThreshold(Number(e.target.value))} />
          </>
        )}

        {type === "profanity" && (
          <>
            <label style={s.label}>Degistirme</label>
            <select style={s.selectEl} value={replacement} onChange={(e) => setReplacement(e.target.value)}>
              {["bleep", "beep", "mute"].map((mode) => <option key={mode} value={mode}>{mode}</option>)}
            </select>
          </>
        )}

        {type === "chapters" && (
          <div style={s.row}>
            <label style={{ ...s.label, flex: 1 }}>Min sn <input style={s.numberInput} type="number" min={10} max={300} value={minChapterDuration} onChange={(e) => setMinChapterDuration(Number(e.target.value))} /></label>
            <label style={{ ...s.label, flex: 1 }}>Max <input style={s.numberInput} type="number" min={1} max={40} value={maxChapters} onChange={(e) => setMaxChapters(Number(e.target.value))} /></label>
          </div>
        )}

        {type === "broll" && (
          <label style={s.label}>Max oneriler: {maxSuggestions}</label>
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
        <label style={s.label}>Model</label>
        <select style={s.selectEl} value={whisperModel} onChange={(e) => setWhisperModel(e.target.value)}>
          {modelOptions.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <label style={s.label}>Dil</label>
        <select style={s.selectEl} value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option value="tr">Turkce</option>
          <option value="en">English</option>
          <option value="auto">Otomatik</option>
        </select>
        {type === "whisper" && (
          <div style={s.toggle}>
            <input type="checkbox" style={s.checkbox} checked={detectFillers} onChange={(e) => setDetectFillers(e.target.checked)} />
            <span style={{ fontSize: 12, color: "#ccc" }}>Dolgu kelimeleri kes</span>
          </div>
        )}
      </>
    );
  }
};
