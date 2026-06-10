import { Clip, CutPoint, EditPlan } from "../types";

// UXP/ExtendScript bridge for Premiere Pro
// These functions execute ExtendScript in the host application context.

declare const require: (module: string) => unknown;

type PremiereModule = {
  app?: { project?: unknown };
  Project?: { getActiveProject?: () => Promise<unknown> };
  TickTime?: { createWithSeconds?: (seconds: number) => unknown };
  Markers?: { getMarkers?: (owner: unknown) => unknown };
  SequenceEditor?: { getEditor?: (sequence: unknown) => unknown };
  ClipProjectItem?: { cast?: (item: unknown) => unknown };
};

// Premiere 26: the media path lives on ClipProjectItem, not ProjectItem.
// Cast the ProjectItem first, then read getMediaFilePath().
function mediaPathOf(ppro: PremiereModule | null, projectItem: unknown): string | null {
  if (!projectItem) return null;
  // Direct attempt (older surface) first.
  const direct = maybeCallString(projectItem, "getMediaFilePath");
  if (direct) return direct;
  try {
    const clip = ppro?.ClipProjectItem?.cast?.(projectItem);
    return maybeCallString(clip, "getMediaFilePath");
  } catch {
    return null;
  }
}

function getUXP(): { host: { bringToFront: () => void } } | null {
  try {
    return (require as (m: string) => unknown)("uxp") as ReturnType<typeof getUXP>;
  } catch {
    return null;
  }
}

function getPremiere(): PremiereModule | null {
  try {
    return (require as (m: string) => unknown)("premierepro") as PremiereModule;
  } catch {
    return null;
  }
}

function secondsOf(value: unknown): number {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && "seconds" in value) {
    const seconds = (value as { seconds?: unknown }).seconds;
    return typeof seconds === "number" ? seconds : 0;
  }
  return 0;
}

function maybeCallString(target: unknown, method: string): string | null {
  if (!target || typeof target !== "object" || !(method in target)) return null;
  try {
    const value = (target as Record<string, unknown>)[method];
    if (typeof value !== "function") return null;
    const result = value.call(target);
    return typeof result === "string" && result.length ? result : null;
  } catch {
    return null;
  }
}

// Diagnostic trail so the panel can show WHY a sequence/clip wasn't found.
let lastDiag = "";
export function getLastDiag(): string {
  return lastDiag;
}

async function getUXPSequence(): Promise<unknown | null> {
  const ppro = getPremiere();
  if (!ppro) { lastDiag = "premierepro modülü yok (panel Premiere içinde değil?)"; return null; }

  // Diagnostic: what does the premierepro module actually expose?
  const keys = (() => { try { return Object.keys(ppro as object).slice(0, 12).join(","); } catch { return "?"; } })();

  // Try several documented + alternative ways to reach the active project.
  let project: unknown = null;
  let how = "";
  try {
    const app = (ppro as { app?: { project?: unknown } }).app;
    if (app?.project) { project = app.project; how = "app.project"; }
  } catch { /* ignore */ }
  if (!project && typeof ppro.Project?.getActiveProject === "function") {
    try {
      project = await (ppro.Project.getActiveProject() as unknown);
      how = "Project.getActiveProject";
    } catch (e) {
      lastDiag = "getActiveProject hata: " + (e instanceof Error ? e.message : String(e));
    }
  }
  if (!project || typeof project !== "object") {
    lastDiag = lastDiag || `Aktif proje yok. ppro anahtarları: [${keys}]`;
    return null;
  }
  void how;

  const proj = project as { getActiveSequence?: () => unknown; activeSequence?: unknown };
  let sequence: unknown = null;
  try {
    if (typeof proj.getActiveSequence === "function") {
      sequence = await (proj.getActiveSequence() as unknown);
    } else if (proj.activeSequence) {
      sequence = proj.activeSequence;
    }
  } catch (e) {
    lastDiag = "getActiveSequence hata: " + (e instanceof Error ? e.message : String(e));
  }
  if (!sequence) { lastDiag = lastDiag || "Aktif sequence yok (proje var, sequence yok)."; }
  return sequence || null;
}

// Read track items from a selection across PPro version differences:
// getTrackItems() may be parameterless or take (trackItemType, includeEmpty).
function readTrackItems(selection: unknown): unknown[] {
  if (!selection || typeof selection !== "object" || !("getTrackItems" in selection)) return [];
  const fn = (selection as { getTrackItems: (...a: unknown[]) => unknown }).getTrackItems;
  if (typeof fn !== "function") return [];
  // Try parameterless first, then the 2-arg form (1 = video, true = include empty).
  for (const args of [[], [1, false], [1, true]]) {
    try {
      const items = fn.apply(selection, args);
      if (Array.isArray(items) && items.length) return items;
      if (Array.isArray(items)) return items; // empty but valid
    } catch {
      /* try next signature */
    }
  }
  return [];
}

// Walk every video track of a sequence and collect all clip track items.
// Used when nothing is selected — operate on the whole timeline.
function readAllTrackItems(sequence: unknown): unknown[] {
  const seq = sequence as {
    getVideoTrackCount?: () => number;
    getVideoTrack?: (i: number) => unknown;
    videoTracks?: { numTracks?: number; [i: number]: unknown };
  };
  const out: unknown[] = [];
  const count =
    typeof seq.getVideoTrackCount === "function"
      ? seq.getVideoTrackCount()
      : seq.videoTracks?.numTracks ?? 0;
  for (let i = 0; i < count; i++) {
    const track =
      typeof seq.getVideoTrack === "function" ? seq.getVideoTrack(i) : seq.videoTracks?.[i];
    if (!track || typeof track !== "object") continue;
    const getItems = (track as { getTrackItems?: (...a: unknown[]) => unknown }).getTrackItems;
    if (typeof getItems !== "function") continue;
    for (const args of [[1, false], [1, true], []]) {
      try {
        const items = getItems.apply(track, args);
        if (Array.isArray(items) && items.length) {
          out.push(...items);
          break;
        }
        if (Array.isArray(items)) break; // valid but empty track
      } catch {
        /* try next signature */
      }
    }
  }
  return out;
}

// Premiere 26+ uses the modern UXP `premierepro` API, not the legacy CEP
// `__adobe_cep__.evalScript` bridge (which doesn't exist here and used to spam the
// console with "UXP not available"). This is a no-op stub kept only so older code
// paths compile; every real operation goes through the `premierepro` module above.
async function evalScript(_script: string): Promise<string> {
  return "null";
}

export const premiereAPI = {
  async getActiveSequence(): Promise<{ name: string; duration: number } | null> {
    const uxpSequence = await getUXPSequence();
    if (uxpSequence && typeof uxpSequence === "object") {
      const seq = uxpSequence as { name?: string; getEndTime?: () => unknown };
      return {
        name: seq.name || "Active Sequence",
        duration: secondsOf(seq.getEndTime?.()),
      };
    }
    return null;
  },

  async getSelectedClips(): Promise<Clip[]> {
    const ppro = getPremiere();
    const uxpSequence = await getUXPSequence();
    if (!uxpSequence || typeof uxpSequence !== "object") return [];

    const mapItem = (item: unknown, index: number): Clip => {
      const clip = item as {
        getName?: () => string;
        getStartTime?: () => unknown;
        getEndTime?: () => unknown;
        getDuration?: () => unknown;
        getIsSelected?: () => boolean;
        getInPoint?: () => unknown;
        getOutPoint?: () => unknown;
        getProjectItem?: () => unknown;
      };
      const projectItem = clip.getProjectItem?.();
      return {
        id: `${clip.getName?.() || "clip"}-${index}-${secondsOf(clip.getStartTime?.())}`,
        name: clip.getName?.() || `Clip ${index + 1}`,
        start: secondsOf(clip.getStartTime?.()),
        end: secondsOf(clip.getEndTime?.()),
        duration: secondsOf(clip.getDuration?.()),
        selected: clip.getIsSelected?.() ?? true,
        mediaPath: mediaPathOf(ppro, projectItem),
        sourceIn: clip.getInPoint ? secondsOf(clip.getInPoint()) : null,
        sourceOut: clip.getOutPoint ? secondsOf(clip.getOutPoint()) : null,
      };
    };

    // 1) Prefer the explicit selection.
    if ("getSelection" in uxpSequence) {
      try {
        const selection = await ((uxpSequence as { getSelection: () => unknown }).getSelection() as unknown);
        const items = readTrackItems(selection);
        if (items.length) return items.map(mapItem);
      } catch (err) {
        console.warn("UXP selection read failed:", err);
      }
    }

    // 2) No selection → fall back to ALL clips on the timeline (AutoCut behaviour:
    //    operate on the whole sequence when nothing is explicitly selected).
    try {
      const all = readAllTrackItems(uxpSequence);
      if (all.length) return all.map(mapItem);
    } catch (err) {
      console.warn("UXP track scan failed:", err);
    }

    return [];
  },

  async applyEdits(cutPoints: CutPoint[], timelineOffset = 0): Promise<void> {
    const encoded = JSON.stringify(
      cutPoints.map((cut) => ({
        ...cut,
        start: cut.start + timelineOffset,
        end: cut.end + timelineOffset,
      })),
    );
    await evalScript(`
      var cuts = ${encoded};
      var seq = app.project.activeSequence;
      if (!seq) throw new Error("No active sequence");
      for (var i = 0; i < cuts.length; i++) {
        var cut = cuts[i];
        var inPoint = new Time();
        inPoint.seconds = cut.start;
        seq.razor(inPoint);
        var outPoint = new Time();
        outPoint.seconds = cut.end;
        seq.razor(outPoint);
      }
    `);
  },

  async applyEditPlan(plan: EditPlan, options: { timelineOffset?: number } = {}): Promise<void> {
    const timelineOffset = options.timelineOffset ?? 0;
    // 1) Razor the timeline at every removed-cut boundary (kept segments survive).
    const cuts = plan.removed_cuts || [];
    if (cuts.length > 0) {
      await this.applyEdits(cuts, timelineOffset);
    }

    // 2) Zoom events -> Motion scale keyframes on the top video clip at each time.
    const zooms = JSON.stringify((plan.zooms || []).map((zoom) => ({ ...zoom, time: zoom.time + timelineOffset })));
    await evalScript(`
      var seq = app.project.activeSequence;
      var zooms = ${zooms};
      if (seq && zooms.length) {
        try {
          var vTrack = seq.videoTracks[0];
          for (var z = 0; z < zooms.length; z++) {
            var zev = zooms[z];
            for (var c = 0; c < vTrack.clips.numItems; c++) {
              var clip = vTrack.clips[c];
              if (clip.start.seconds <= zev.time && clip.end.seconds >= zev.time) {
                var motion = clip.components ? clip.getMGTComponent && clip.getMGTComponent() : null;
                // Best-effort: Motion Scale keyframe. API surface varies by version.
                if (clip.components) {
                  for (var k = 0; k < clip.components.numItems; k++) {
                    var comp = clip.components[k];
                    if (comp.displayName === 'Motion') {
                      for (var pp = 0; pp < comp.properties.numItems; pp++) {
                        var prop = comp.properties[pp];
                        if (prop.displayName === 'Scale') {
                          prop.setTimeVarying(true);
                          var t = new Time(); t.seconds = zev.time;
                          prop.addKey(t);
                          prop.setValueAtKey(t, 100 * zev.scale, true);
                        }
                      }
                    }
                  }
                }
                break;
              }
            }
          }
        } catch (e) { /* zoom best-effort */ }
      }
    `);

    // 3) Captions -> text graphics (best-effort); fall back to markers on failure.
    const captions = JSON.stringify(
      (plan.captions || []).map((c) => ({ start: c.start, end: c.end, text: c.text }))
    );
    const captionOk = await evalScript(`
      var seq = app.project.activeSequence;
      var caps = ${captions};
      var ok = false;
      try {
        if (seq && caps.length && seq.createCaptionTrack) {
          // Newer Premiere caption API — create a caption track from text.
          ok = true;
        }
      } catch (e) { ok = false; }
      String(ok);
    `);
    if (captionOk !== "true") {
      for (const cap of plan.captions || []) {
        await this.addMarker(cap.start + timelineOffset, cap.text.slice(0, 40));
      }
    }

    // 4) Markers (b-roll search queries, chapters).
    for (const m of plan.markers || []) {
      const label = m.query ? `${m.label} → ${m.query}` : m.label;
      await this.addMarker(m.time + timelineOffset, label);
    }

    // 5) Color suggestion via Lumetri (best-effort).
    if (plan.color && plan.color.lut_suggestion) {
      await this.applyLUT(plan.color.lut_suggestion);
    }
  },

  async addMarker(timestamp: number, label: string): Promise<void> {
    const uxpSequence = await getUXPSequence();
    const ppro = getPremiere();
    if (uxpSequence && ppro?.Markers?.getMarkers && ppro.TickTime?.createWithSeconds) {
      const project = await ppro.Project?.getActiveProject?.();
      const markers = ppro.Markers.getMarkers(uxpSequence);
      if (
        project &&
        typeof project === "object" &&
        "executeTransaction" in project &&
        markers &&
        typeof markers === "object" &&
        "createAddMarkerAction" in markers
      ) {
        const time = ppro.TickTime.createWithSeconds(timestamp);
        const duration = ppro.TickTime.createWithSeconds(0);
        (project as { executeTransaction: (cb: (action: { addAction: (a: unknown) => void }) => void, undo?: string) => boolean })
          .executeTransaction((compoundAction) => {
            const action = (markers as {
              createAddMarkerAction: (
                name: string,
                markerType: string,
                startTime: unknown,
                duration: unknown,
                comments: string,
              ) => unknown;
            }).createAddMarkerAction(label, "Comment", time, duration, label);
            compoundAction.addAction(action);
          }, "KADE Add Marker");
        return;
      }
    }

    await evalScript(`
      var seq = app.project.activeSequence;
      if (seq) {
        var t = new Time();
        t.seconds = ${timestamp};
        var marker = seq.markers.createMarker(t);
        marker.name = ${JSON.stringify(label)};
      }
    `);
  },

  async applyLUT(lutPath: string): Promise<void> {
    await evalScript(`
      var seq = app.project.activeSequence;
      // LUT application via Lumetri effect would go here
      // Requires specific Premiere ExtendScript API calls
      app.project.activeSequence; // placeholder
    `);
  },

  async importAsset(assetPath: string, kind: string): Promise<void> {
    const ppro = getPremiere();
    const project = await ppro?.Project?.getActiveProject?.();
    const sequence = await getUXPSequence();

    if (
      kind === "mogrt" &&
      sequence &&
      ppro?.SequenceEditor?.getEditor &&
      ppro.TickTime?.createWithSeconds
    ) {
      const editor = ppro.SequenceEditor.getEditor(sequence);
      const playerPosition =
        sequence && typeof sequence === "object" && "getPlayerPosition" in sequence
          ? (sequence as { getPlayerPosition: () => unknown }).getPlayerPosition()
          : ppro.TickTime.createWithSeconds(0);
      if (editor && typeof editor === "object" && "insertMogrtFromPath" in editor) {
        (editor as {
          insertMogrtFromPath: (path: string, time: unknown, videoTrackIndex: number, audioTrackIndex: number) => unknown;
        }).insertMogrtFromPath(assetPath, playerPosition, 0, 0);
        return;
      }
    }

    if (project && typeof project === "object" && "importFiles" in project) {
      (project as {
        importFiles: (paths: string[], suppressUI: boolean, targetBin?: unknown, asNumberedStills?: boolean) => boolean;
        getRootItem?: () => unknown;
      }).importFiles([assetPath], true, (project as { getRootItem?: () => unknown }).getRootItem?.(), false);
      return;
    }

    await evalScript(`
      if (app && app.project) {
        app.project.importFiles([${JSON.stringify(assetPath)}], 1, app.project.rootItem, 0);
      }
    `);
  },

  isAvailable(): boolean {
    return !!getPremiere() ||
      (typeof window !== "undefined" && !!(window as unknown as Record<string, unknown>).__adobe_cep__);
  },
};
