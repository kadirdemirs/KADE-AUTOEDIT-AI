import { useCallback, useEffect, useState } from "react";
import { Job, WebSocketEvent } from "../types";
import { api } from "../services/api";
import { wsService } from "../services/websocket";

export function useJobQueue() {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchJobs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.getJobs();
      setJobs(data as Job[]);
    } catch {
      // silently ignore fetch errors
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchJobs();

    const unsub = wsService.onMessage((event: WebSocketEvent) => {
      if (event.event === "job_start") {
        setJobs((prev) => {
          const exists = prev.find((j) => j.id === event.job_id);
          if (exists) return prev;
          return [
            {
              id: event.job_id!,
              status: "PROCESSING",
              type: event.type as Job["type"],
              progress: 0,
            },
            ...prev,
          ];
        });
      }

      if (event.event === "progress" && event.job_id) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === event.job_id
              ? { ...j, progress: event.progress ?? j.progress }
              : j
          )
        );
      }

      if (event.event === "job_done" && event.job_id) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === event.job_id ? { ...j, status: "DONE", progress: 100 } : j
          )
        );
      }

      if (event.event === "job_failed" && event.job_id) {
        setJobs((prev) =>
          prev.map((j) =>
            j.id === event.job_id
              ? { ...j, status: "FAILED", error_message: event.error }
              : j
          )
        );
      }
    });

    return unsub;
  }, [fetchJobs]);

  const removeJob = useCallback(async (id: string) => {
    await api.deleteJob(id);
    setJobs((prev) => prev.filter((j) => j.id !== id));
  }, []);

  return { jobs, loading, fetchJobs, removeJob };
}
