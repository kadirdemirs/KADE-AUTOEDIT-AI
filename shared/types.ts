// Shared types used by both backend (as documentation) and panel

export type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export type JobType =
  | "SILENCE_CUT"
  | "TRANSCRIPT"
  | "BEAT_SYNC"
  | "SCENE_DETECT"
  | "AUTO_COLOR"
  | "ANALYZE";

export interface CutPoint {
  start: number;
  end: number;
  type: "cut" | "j-cut" | "l-cut" | "filler";
  label?: string;
  confidence?: number;
}

export interface WordTimestamp {
  word: string;
  start: number;
  end: number;
  is_filler: boolean;
}

export interface Scene {
  start: number;
  end: number;
  score: number;
  frame_start: number;
  frame_end: number;
}

export interface SilenceCutResult {
  cut_points: CutPoint[];
  total_silence_duration: number;
  total_kept_duration: number;
  cuts_count: number;
}

export interface TranscriptResult {
  text: string;
  language: string;
  words: WordTimestamp[];
  filler_cut_points: CutPoint[];
  filler_words_found: string[];
  confidence: number;
}

export interface BeatSyncResult {
  bpm: number;
  beat_timestamps: number[];
  total_beats: number;
  beat_confidence: number;
}

export interface SceneDetectResult {
  scenes: Scene[];
  total_scenes: number;
  avg_scene_duration: number;
}

export interface AutoColorResult {
  color_settings: {
    brightness: number;
    contrast: number;
    saturation: number;
    temperature: number;
    tint: number;
    lut_suggestion: string;
  };
  audio_settings: {
    current_lufs: number;
    target_lufs: number;
    gain_db: number;
    denoise_suggested: boolean;
  };
  histogram_data: Record<string, number[]>;
}

// ── Auto Edit (orchestrator) ───────────────────────────────────────────────

export interface Style {
  id: string;
  label: string;
  description: string;
  zoom_enabled: boolean;
  snap_to_beat: boolean;
  target_ratio: string | null;
  captions_enabled: boolean;
  modules: string[];
}

export interface TimelineSegment {
  start: number;
  end: number;
  source_start: number;
  source_end: number;
  type: string;
}

export interface ZoomEvent {
  time: number;
  scale: number;
  center_x: number;
  center_y: number;
  duration: number;
}

export interface CaptionWordEvent {
  word: string;
  start: number;
  end: number;
}

export interface CaptionEvent {
  index: number;
  start: number;
  end: number;
  text: string;
  words: CaptionWordEvent[];
}

export interface MarkerEvent {
  time: number;
  label: string;
  kind: string;
  query?: string | null;
}

export interface EditPlan {
  style_id: string;
  source_duration: number;
  output_duration: number;
  target_ratio: string | null;
  segments: TimelineSegment[];
  zooms: ZoomEvent[];
  captions: CaptionEvent[];
  markers: MarkerEvent[];
  beat_grid?: { bpm: number; beats: number[] } | null;
  color?: Record<string, number | string> | null;
  audio_gain_db: number;
  removed_cuts: CutPoint[];
  stats: Record<string, number>;
}

export interface AutoEditResult {
  plan: EditPlan;
  render_path?: string | null;
  ass_path?: string | null;
}

export interface WebSocketProgressEvent {
  event: "job_start" | "job_done" | "job_failed" | "progress";
  job_id: string;
  type?: string;
  progress?: number;
  message?: string;
  error?: string;
  processing_time?: number;
}
