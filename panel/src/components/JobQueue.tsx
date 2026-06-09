import React from "react";
import { ProgressBar } from "./ProgressBar";
import { Job } from "../types";
import { useJobQueue } from "../hooks/useJobQueue";
import { premiereAPI } from "../services/premiere";
import { api } from "../services/api";

const STATUS_COLOR: Record<string, string> = {
  PENDING: "#aaa",
  PROCESSING: "#4a9eff",
  DONE: "#4caf50",
  FAILED: "#f44336",
};

const s: Record<string, React.CSSProperties> = {
  container: { padding: 12 },
  header: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  title: { fontWeight: 600, fontSize: 13, color: "#e0e0e0" },
  refreshBtn: { fontSize: 11, background: "#2a2a2a", border: "1px solid #444", color: "#ccc", padding: "3px 8px", borderRadius: 4, cursor: "pointer" },
  card: { background: "#222", borderRadius: 6, padding: 10, marginBottom: 8 },
  row: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 },
  jobName: { fontSize: 12, fontWeight: 600, color: "#ddd" },
  statusBadge: { fontSize: 10, padding: "2px 6px", borderRadius: 10 },
  time: { fontSize: 10, color: "#666" },
  btnRow: { display: "flex", gap: 6, marginTop: 6 },
  btn: { flex: 1, padding: "4px 0", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 11 },
  empty: { color: "#666", fontSize: 12, textAlign: "center", padding: 24 },
};

function timeSince(iso?: string): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m önce`;
  return `${Math.floor(diff / 3600)}h önce`;
}

export const JobQueue: React.FC = () => {
  const { jobs, loading, fetchJobs, removeJob } = useJobQueue();

  const handleApplyToPremiere = async (job: Job) => {
    if (!premiereAPI.isAvailable()) {
      alert("Premiere Pro bağlantısı yok.");
      return;
    }
    try {
      const detail = await api.getJob(job.id) as { output_data?: { cut_points?: unknown[] } };
      const cuts = detail.output_data?.cut_points;
      if (cuts?.length) {
        await premiereAPI.applyEdits(cuts as Parameters<typeof premiereAPI.applyEdits>[0]);
        alert("Kesimler Premiere'e uygulandı.");
      } else {
        alert("Bu job'da uygulanabilir kesim yok.");
      }
    } catch (err) {
      alert(`Hata: ${err instanceof Error ? err.message : err}`);
    }
  };

  return (
    <div style={s.container}>
      <div style={s.header}>
        <span style={s.title}>İş Kuyruğu</span>
        <button style={s.refreshBtn} onClick={fetchJobs} disabled={loading}>
          {loading ? "..." : "Yenile"}
        </button>
      </div>

      {jobs.length === 0 && !loading && (
        <div style={s.empty}>Henüz işlem yok.</div>
      )}

      {jobs.map((job: Job) => (
        <div key={job.id} style={s.card}>
          <div style={s.row}>
            <span style={s.jobName}>{job.type.replace("_", " ")}</span>
            <span style={{ ...s.statusBadge, background: STATUS_COLOR[job.status] + "33", color: STATUS_COLOR[job.status] }}>
              {job.status}
            </span>
          </div>

          {job.status === "PROCESSING" && (
            <ProgressBar value={Number(job.progress)} color="#4a9eff" />
          )}

          <div style={s.time}>{timeSince(job.created_at)} · {job.id.slice(0, 8)}</div>

          {job.error_message && (
            <div style={{ fontSize: 10, color: "#f44336", marginTop: 4 }}>{job.error_message}</div>
          )}

          <div style={s.btnRow}>
            {job.status === "DONE" && (
              <button
                style={{ ...s.btn, background: "#1e3a5f", color: "#4a9eff" }}
                onClick={() => handleApplyToPremiere(job)}
              >
                Premiere'e Uygula
              </button>
            )}
            <button
              style={{ ...s.btn, background: "#3a1a1a", color: "#f44336" }}
              onClick={() => removeJob(job.id)}
            >
              Sil
            </button>
          </div>
        </div>
      ))}
    </div>
  );
};
