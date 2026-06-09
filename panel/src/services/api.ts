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

  getJobs: () => request<unknown[]>("GET", "/jobs"),
  getJob: (id: string) => request<unknown>("GET", `/jobs/${id}`),
  deleteJob: (id: string) => request<{ deleted: string }>("DELETE", `/jobs/${id}`),

  getPresets: () => request<unknown[]>("GET", "/presets"),
  createPreset: (data: object) => request<unknown>("POST", "/presets", data),
  deletePreset: (id: string) => request<{ deleted: string }>("DELETE", `/presets/${id}`),
};
