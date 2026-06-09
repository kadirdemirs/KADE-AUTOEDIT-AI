export type JobStatus = "PENDING" | "PROCESSING" | "DONE" | "FAILED";
export type JobType =
  | "SILENCE_CUT"
  | "TRANSCRIPT"
  | "BEAT_SYNC"
  | "SCENE_DETECT"
  | "AUTO_COLOR"
  | "AUTO_CAPTIONS"
  | "AUTO_ZOOM"
  | "VIRAL_DETECT"
  | "PODCAST_MODE"
  | "REPEAT_DETECT"
  | "PROFANITY_FILTER"
  | "AUTO_CHAPTERS"
  | "AUTO_RESIZE"
  | "BROLL_SUGGEST"
  | "ANALYZE";

export interface Job {
  id: string;
  status: JobStatus;
  type: JobType;
  progress: number | string;
  input_file?: string;
  output_data?: unknown;
  error_message?: string;
  created_at?: string;
}

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

export interface ColorSettings {
  brightness: number;
  contrast: number;
  saturation: number;
  temperature: number;
  tint: number;
  lut_suggestion: string;
}

export interface AudioSettings {
  current_lufs: number;
  target_lufs: number;
  gain_db: number;
  denoise_suggested: boolean;
}

export interface AutoColorResult {
  color_settings: ColorSettings;
  audio_settings: AudioSettings;
  histogram_data: Record<string, number[]>;
}

export interface CaptionWord {
  word: string;
  start: number;
  end: number;
}

export interface Caption {
  index: number;
  start: number;
  end: number;
  text: string;
  words: CaptionWord[];
}

export interface AutoCaptionsResult {
  captions: Caption[];
  total_captions: number;
  srt_content: string;
  style: string;
  language: string;
}

export interface ZoomKeyframe {
  time: number;
  scale: number;
  center_x: number;
  center_y: number;
  duration: number;
}

export interface AutoZoomResult {
  keyframes: ZoomKeyframe[];
  total_zooms: number;
  avg_scale: number;
}

export interface ViralSegment {
  start: number;
  end: number;
  duration: number;
  score: number;
  reason: string;
  thumbnail_time: number;
}

export interface ViralDetectResult {
  segments: ViralSegment[];
  best_segment?: ViralSegment | null;
  total_candidates: number;
}

export interface SpeakerSegment {
  speaker_id: string;
  start: number;
  end: number;
  duration: number;
  channel: number;
}

export interface PodcastResult {
  segments: SpeakerSegment[];
  total_speakers: number;
  speaker_durations: Record<string, number>;
  cut_points: CutPoint[];
}

export interface RepeatSegment {
  start: number;
  end: number;
  text: string;
  rms_score: number;
  is_best_take: boolean;
}

export interface RepeatGroup {
  group_id: number;
  segments: RepeatSegment[];
  best_take: RepeatSegment;
}

export interface RepeatDetectResult {
  groups: RepeatGroup[];
  total_groups: number;
  cuts_suggested: CutPoint[];
  time_saved: number;
}

export interface BleepPoint {
  start: number;
  end: number;
  word: string;
  replacement: string;
}

export interface ProfanityResult {
  bleep_points: BleepPoint[];
  total_found: number;
  words_found: string[];
  clean_transcript: string;
}

export interface Chapter {
  index: number;
  title: string;
  start: number;
  end: number;
  duration: number;
  keywords: string[];
}

export interface AutoChaptersResult {
  chapters: Chapter[];
  total_chapters: number;
  youtube_format: string;
  description_block: string;
}

export interface ResizeFormat {
  name: string;
  ratio_w: number;
  ratio_h: number;
  crop_x: number;
  crop_y: number;
  crop_width: number;
  crop_height: number;
  scale: number;
}

export interface AutoResizeResult {
  original_resolution: string;
  formats: ResizeFormat[];
  subject_detected: boolean;
  subject_center_x: number;
  subject_center_y: number;
}

export interface BRollSuggestion {
  start: number;
  end: number;
  duration: number;
  keyword: string;
  search_query: string;
  type: string;
  priority: number;
}

export interface BRollResult {
  suggestions: BRollSuggestion[];
  total_suggestions: number;
  total_broll_duration: number;
}

export interface Preset {
  id: string;
  name: string;
  module: string;
  settings: Record<string, unknown>;
  created_at?: string;
}

export interface PresetCreate {
  name: string;
  module: string;
  settings: Record<string, unknown>;
}

export interface WebSocketEvent {
  event:
    | "job_start"
    | "job_done"
    | "job_failed"
    | "progress"
    | "pong";
  job_id?: string;
  type?: string;
  progress?: number;
  message?: string;
  error?: string;
  processing_time?: number;
}

export type TabId = "timeline" | "modules" | "presets" | "queue" | "settings";

export interface Clip {
  id: string;
  name: string;
  start: number;
  end: number;
  duration: number;
  selected: boolean;
}
