import { AssetCategory, AutoEditResult, LibraryAsset, MemeResult, Style } from "../types";

const BASE_URL = "http://localhost:8472";

async function request<T>(
  method: string,
  path: string,
  body?: FormData | object
): Promise<T> {
  const init: RequestInit = { method };

  if (body instanceof FormData) {
    init.body = body;
  } else if (body) {
    init.headers = { "Content-Type": "application/json" };
    init.body = JSON.stringify(body);
  }

  const res = await fetch(`${BASE_URL}${path}`, init);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

function uploadRequest(
  path: string,
  file: File,
  params: Record<string, unknown> = {}
) {
  const fd = new FormData();
  fd.append("file", file);
  Object.entries(params).forEach(([k, v]) => fd.append(k, String(v)));
  return request<{ job_id: string; result: unknown }>("POST", path, fd);
}

// Timeline-path request: operate on the clip already on the Premiere timeline
// (its `mediaPath`, optionally sliced to in/out) instead of uploading a file.
function pathRequest(
  path: string,
  sourcePath: string,
  params: Record<string, unknown> = {},
  sourceStart?: number | null,
  sourceEnd?: number | null
) {
  const fd = new FormData();
  fd.append("source_path", sourcePath);
  Object.entries(params).forEach(([k, v]) => fd.append(k, String(v)));
  if (sourceStart != null) fd.append("source_start", String(sourceStart));
  if (sourceEnd != null) fd.append("source_end", String(sourceEnd));
  return request<{ job_id: string; result: unknown }>("POST", path, fd);
}

export interface TimelineSource {
  sourcePath: string;
  sourceStart?: number | null;
  sourceEnd?: number | null;
}

export const api = {
  health: () => request<{ status: string; app: string; version: string }>("GET", "/health"),

  analyze: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<Record<string, unknown>>("POST", "/analyze", fd);
  },

  silenceCut: (file: File, params: Record<string, unknown>) => {
    return uploadRequest("/silence-cut", file, params);
  },

  transcript: (file: File, params: Record<string, unknown>) => {
    return uploadRequest("/transcript", file, params);
  },

  beatSync: (file: File, params: Record<string, unknown>) => {
    return uploadRequest("/beat-sync", file, params);
  },

  sceneDetect: (file: File, params: Record<string, unknown>) => {
    return uploadRequest("/scene-detect", file, params);
  },

  autoColor: (file: File, params: Record<string, unknown>) => {
    return uploadRequest("/auto-color", file, params);
  },

  autoCaptions: (file: File, params: Record<string, unknown>) => uploadRequest("/auto-captions", file, params),
  autoZoom: (file: File, params: Record<string, unknown>) => uploadRequest("/auto-zoom", file, params),
  viralDetect: (file: File, params: Record<string, unknown>) => uploadRequest("/viral-detect", file, params),
  podcastMode: (file: File, params: Record<string, unknown>) => uploadRequest("/podcast-mode", file, params),
  repeatDetect: (file: File, params: Record<string, unknown>) => uploadRequest("/repeat-detect", file, params),
  profanityFilter: (file: File, params: Record<string, unknown>) => uploadRequest("/profanity-filter", file, params),
  autoChapters: (file: File, params: Record<string, unknown>) => uploadRequest("/auto-chapters", file, params),
  autoResize: (file: File, params: Record<string, unknown>) => uploadRequest("/auto-resize", file, params),
  brollSuggest: (file: File, params: Record<string, unknown>) => uploadRequest("/broll-suggest", file, params),

  // ── Timeline-path variants (default: edit the selected clip, no upload) ─────
  silenceCutPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/silence-cut-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  transcriptPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/transcript-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  beatSyncPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/beat-sync-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  sceneDetectPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/scene-detect-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  autoColorPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/auto-color-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  autoCaptionsPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/auto-captions-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  autoZoomPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/auto-zoom-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  viralDetectPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/viral-detect-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  podcastModePath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/podcast-mode-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  repeatDetectPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/repeat-detect-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  profanityFilterPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/profanity-filter-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  autoChaptersPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/auto-chapters-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  autoResizePath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/auto-resize-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),
  brollSuggestPath: (src: TimelineSource, params: Record<string, unknown>) =>
    pathRequest("/broll-suggest-path", src.sourcePath, params, src.sourceStart, src.sourceEnd),

  // ── Meme Finder ───────────────────────────────────────────────────────────
  memeFind: (params: {
    text?: string;
    file?: File | null;
    sources?: string;
    max_results?: number;
    generate?: boolean;
    model_name?: string;
    language?: string;
  }) => {
    const fd = new FormData();
    if (params.file) fd.append("file", params.file);
    if (params.text) fd.append("text", params.text);
    if (params.sources) fd.append("sources", params.sources);
    if (params.max_results != null) fd.append("max_results", String(params.max_results));
    if (params.generate != null) fd.append("generate", String(params.generate));
    if (params.model_name) fd.append("model_name", params.model_name);
    if (params.language) fd.append("language", params.language);
    return request<{ job_id: string; result: MemeResult }>("POST", "/meme-find", fd);
  },

  memeFindPath: (
    src: TimelineSource,
    params: {
      text?: string;
      sources?: string;
      max_results?: number;
      generate?: boolean;
      model_name?: string;
      language?: string;
    } = {}
  ) => {
    const fd = new FormData();
    fd.append("source_path", src.sourcePath);
    if (src.sourceStart != null) fd.append("source_start", String(src.sourceStart));
    if (src.sourceEnd != null) fd.append("source_end", String(src.sourceEnd));
    if (params.text) fd.append("text", params.text);
    if (params.sources) fd.append("sources", params.sources);
    if (params.max_results != null) fd.append("max_results", String(params.max_results));
    if (params.generate != null) fd.append("generate", String(params.generate));
    if (params.model_name) fd.append("model_name", params.model_name);
    if (params.language) fd.append("language", params.language);
    return request<{ job_id: string; result: MemeResult }>("POST", "/meme-find-path", fd);
  },

  memeImageUrl: (localPath: string) => `${BASE_URL}/meme-image?path=${encodeURIComponent(localPath)}`,

  // ── Auto Edit (orchestrator) ──────────────────────────────────────────────
  getStyles: () => request<Style[]>("GET", "/styles"),

  getLibraryCategories: () => request<AssetCategory[]>("GET", "/library/categories"),

  getLibraryAssets: (params: { category?: string; q?: string } = {}) => {
    const query = new URLSearchParams();
    if (params.category) query.set("category", params.category);
    if (params.q) query.set("q", params.q);
    const suffix = query.toString() ? `?${query.toString()}` : "";
    return request<LibraryAsset[]>("GET", `/library/assets${suffix}`);
  },

  autoEdit: (
    file: File,
    styleId: string,
    overrides: Record<string, unknown> = {},
    render = false
  ) => {
    const fd = new FormData();
    fd.append("file", file);
    fd.append("style_id", styleId);
    fd.append("overrides", JSON.stringify(overrides));
    fd.append("render", String(render));
    return request<{ job_id: string; result: AutoEditResult }>("POST", "/auto-edit", fd);
  },

  autoEditPath: (params: {
    sourcePath: string;
    styleId: string;
    overrides?: Record<string, unknown>;
    render?: boolean;
    sourceStart?: number | null;
    sourceEnd?: number | null;
  }) => {
    const fd = new FormData();
    fd.append("source_path", params.sourcePath);
    fd.append("style_id", params.styleId);
    fd.append("overrides", JSON.stringify(params.overrides || {}));
    fd.append("render", String(params.render ?? false));
    if (params.sourceStart != null) fd.append("source_start", String(params.sourceStart));
    if (params.sourceEnd != null) fd.append("source_end", String(params.sourceEnd));
    return request<{ job_id: string; result: AutoEditResult }>("POST", "/auto-edit-path", fd);
  },

  renderUrl: (jobId: string) => `${BASE_URL}/render/${jobId}`,

  getJobs: () => request<unknown[]>("GET", "/jobs"),
  getJob: (id: string) => request<unknown>("GET", `/jobs/${id}`),
  deleteJob: (id: string) => request<{ deleted: string }>("DELETE", `/jobs/${id}`),

  getPresets: () => request<unknown[]>("GET", "/presets"),
  createPreset: (data: object) => request<unknown>("POST", "/presets", data),
  deletePreset: (id: string) => request<{ deleted: string }>("DELETE", `/presets/${id}`),
};
