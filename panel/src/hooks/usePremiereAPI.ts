import { useCallback, useEffect, useState } from "react";
import { Clip } from "../types";
import { premiereAPI } from "../services/premiere";

interface UsePremiereAPIReturn {
  isAvailable: boolean;
  selectedClips: Clip[];
  sequenceName: string | null;
  refreshClips: () => Promise<void>;
}

export function usePremiereAPI(): UsePremiereAPIReturn {
  const [isAvailable] = useState(() => premiereAPI.isAvailable());
  const [selectedClips, setSelectedClips] = useState<Clip[]>([]);
  const [sequenceName, setSequenceName] = useState<string | null>(null);

  const refreshClips = useCallback(async () => {
    if (!isAvailable) return;
    try {
      const [clips, seq] = await Promise.all([
        premiereAPI.getSelectedClips(),
        premiereAPI.getActiveSequence(),
      ]);
      setSelectedClips(clips);
      setSequenceName(seq?.name ?? null);
    } catch (err) {
      console.warn("Failed to refresh clips:", err);
    }
  }, [isAvailable]);

  useEffect(() => {
    refreshClips();
  }, [refreshClips]);

  return { isAvailable, selectedClips, sequenceName, refreshClips };
}
