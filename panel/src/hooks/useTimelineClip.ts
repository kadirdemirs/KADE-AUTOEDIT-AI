import { useCallback, useEffect, useState } from "react";
import { Clip } from "../types";
import { premiereAPI, getLastDiag } from "../services/premiere";

// Single source of truth for "which clip on the Premiere timeline are we editing".
// Every tool reads the selected clip from here instead of asking for a file upload.
export function useTimelineClip() {
  const [available] = useState(() => premiereAPI.isAvailable());
  const [clip, setClip] = useState<Clip | null>(null);
  const [clips, setClips] = useState<Clip[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [diag, setDiag] = useState<string>("");

  const refresh = useCallback(async () => {
    if (!premiereAPI.isAvailable()) {
      setClip(null);
      setDiag("Premiere bulunamadı (panel Premiere içinde değil).");
      return;
    }
    setRefreshing(true);
    try {
      const seq = await premiereAPI.getActiveSequence();
      const found = await premiereAPI.getSelectedClips();
      setClips(found);
      const withMedia = found.find((c) => !!c.mediaPath) || found[0] || null;
      setClip(withMedia);

      if (!seq) {
        setDiag(getLastDiag() || "Aktif sequence yok. Bir sequence aç / timeline'a tıkla.");
      } else if (found.length === 0) {
        setDiag(`Sequence: "${seq.name}" — ama seçili klip yok. Timeline'da klibe tıkla.`);
      } else if (!withMedia?.mediaPath) {
        setDiag(`${found.length} klip seçili ama medya yolu okunamadı.`);
      } else {
        setDiag("");
      }
    } catch (err) {
      setClip(null);
      setDiag(`Okuma hatası: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const hasMedia = !!clip?.mediaPath;
  return { available, clip, clips, hasMedia, refresh, refreshing, diag };
}
