import { useCallback, useEffect, useState } from "react";
import { Clip } from "../types";
import { premiereAPI } from "../services/premiere";

// Single source of truth for "which clip on the Premiere timeline are we editing".
// Every tool (Auto Edit + each module) reads the currently selected clip from here
// instead of asking the user to upload a file. Picks the first selected clip whose
// media path is readable (falls back to the first selection).
export function useTimelineClip() {
  const [available] = useState(() => premiereAPI.isAvailable());
  const [clip, setClip] = useState<Clip | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    if (!premiereAPI.isAvailable()) {
      setClip(null);
      return;
    }
    setRefreshing(true);
    try {
      const clips = await premiereAPI.getSelectedClips();
      const withMedia = clips.find((c) => !!c.mediaPath) || clips[0] || null;
      setClip(withMedia);
    } catch (err) {
      console.warn("Timeline clip read failed:", err);
      setClip(null);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasMedia = !!clip?.mediaPath;
  return { available, clip, hasMedia, refresh, refreshing };
}
