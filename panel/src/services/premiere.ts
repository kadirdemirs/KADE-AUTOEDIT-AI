import { Clip, CutPoint } from "../types";

// UXP/ExtendScript bridge for Premiere Pro
// These functions execute ExtendScript in the host application context.

declare const require: (module: string) => unknown;

function getUXP(): { host: { bringToFront: () => void } } | null {
  try {
    return (require as (m: string) => unknown)("uxp") as ReturnType<typeof getUXP>;
  } catch {
    return null;
  }
}

async function evalScript(script: string): Promise<string> {
  try {
    const uxp = getUXP();
    if (!uxp) throw new Error("UXP not available");
    // In UXP context, use csInterface or evalScript
    // This is a placeholder for the actual UXP ExtendScript bridge
    const result = await (window as unknown as {
      __adobe_cep__: { evalScript: (s: string, cb: (r: string) => void) => void };
    }).__adobe_cep__.evalScript(script, (r) => r);
    return String(result);
  } catch (err) {
    console.warn("ExtendScript eval failed:", err);
    return "null";
  }
}

export const premiereAPI = {
  async getActiveSequence(): Promise<{ name: string; duration: number } | null> {
    const result = await evalScript(`
      var seq = app.project.activeSequence;
      if (seq) JSON.stringify({ name: seq.name, duration: seq.end - seq.start });
      else 'null';
    `);
    try { return JSON.parse(result); } catch { return null; }
  },

  async getSelectedClips(): Promise<Clip[]> {
    const result = await evalScript(`
      var seq = app.project.activeSequence;
      var clips = [];
      if (seq) {
        for (var t = 0; t < seq.videoTracks.numTracks; t++) {
          var track = seq.videoTracks[t];
          for (var c = 0; c < track.clips.numItems; c++) {
            var clip = track.clips[c];
            if (clip.isSelected()) {
              clips.push({
                id: clip.nodeId,
                name: clip.name,
                start: clip.start.seconds,
                end: clip.end.seconds,
                duration: clip.duration.seconds,
                selected: true
              });
            }
          }
        }
      }
      JSON.stringify(clips);
    `);
    try { return JSON.parse(result) || []; } catch { return []; }
  },

  async applyEdits(cutPoints: CutPoint[]): Promise<void> {
    const encoded = JSON.stringify(cutPoints);
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

  async addMarker(timestamp: number, label: string): Promise<void> {
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

  isAvailable(): boolean {
    return typeof window !== "undefined" &&
      !!(window as unknown as Record<string, unknown>).__adobe_cep__;
  },
};
