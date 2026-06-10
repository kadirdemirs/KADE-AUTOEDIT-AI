import React, { useState } from "react";
import { ProgressBar } from "./ProgressBar";
import { Job } from "../types";
import { useJobQueue } from "../hooks/useJobQueue";
import { premiereAPI } from "../services/premiere";
import { api } from "../services/api";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, EmptyState, SectionHeader } from "./ui";

function timeSince(iso?: string): string {
  if (!iso) return "";
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return `${diff}s önce`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m önce`;
  return `${Math.floor(diff / 3600)}h önce`;
}

function jobLabel(type: string): string {
  return type.replace(/_/g, " ").toLowerCase();
}

export const JobQueue: React.FC = () => {
  const { t } = useTheme();
  const { jobs, loading, fetchJobs, removeJob } = useJobQueue();
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const statusColor: Record<string, string> = {
    PENDING: t.textDim,
    PROCESSING: t.accent,
    DONE: t.good,
    FAILED: t.bad,
  };

  const handleApplyToPremiere = async (job: Job) => {
    setMessage(null);
    if (!premiereAPI.isAvailable()) {
      setMessage({ kind: "error", text: "Premiere Pro bağlantısı yok." });
      return;
    }
    try {
      const detail = (await api.getJob(job.id)) as { output_data?: { cut_points?: unknown[] } };
      const cuts = detail.output_data?.cut_points;
      if (cuts?.length) {
        await premiereAPI.applyEdits(cuts as Parameters<typeof premiereAPI.applyEdits>[0]);
        setMessage({ kind: "info", text: "Kesimler Premiere'e uygulandı." });
      } else {
        setMessage({ kind: "error", text: "Bu işte uygulanabilir kesim yok." });
      }
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  const handleRemove = async (id: string) => {
    setMessage(null);
    try {
      await removeJob(id);
    } catch {
      setMessage({ kind: "error", text: "İş silinemedi." });
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
        <SectionHeader
          icon="📋"
          title="İş Kuyruğu"
          subtitle="Çalışan ve tamamlanan analizleri takip et; uygun sonuçları Premiere timeline'a uygula."
        />
        <Button variant="secondary" onClick={fetchJobs} disabled={loading} style={{ padding: "8px 10px", flexShrink: 0 }}>
          {loading ? "..." : "Yenile"}
        </Button>
      </div>

      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      {jobs.length === 0 && !loading && (
        <EmptyState icon="🧾" title="Henüz işlem yok" hint="Auto Edit veya araçlardan biri çalışınca işler burada listelenir." />
      )}

      {jobs.map((job: Job) => {
        const color = statusColor[job.status] || t.textDim;
        return (
          <Card key={job.id} style={{ padding: "12px 14px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 13,
                    fontWeight: 800,
                    color: t.text,
                    textTransform: "capitalize",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {jobLabel(job.type)}
                </div>
                <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 3 }}>
                  {timeSince(job.created_at)} · {job.id.slice(0, 8)}
                </div>
              </div>
              <Badge color={color}>{job.status}</Badge>
            </div>

            {job.status === "PROCESSING" && (
              <div style={{ marginTop: 10 }}>
                <ProgressBar value={Number(job.progress)} color={t.accent} />
              </div>
            )}

            {job.error_message && (
              <div style={{ fontSize: 10.5, color: t.bad, marginTop: 8, lineHeight: 1.4 }}>{job.error_message}</div>
            )}

            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {job.status === "DONE" && (
                <Button variant="secondary" full onClick={() => handleApplyToPremiere(job)}>
                  Premiere'e Uygula
                </Button>
              )}
              <Button
                variant="secondary"
                full
                onClick={() => handleRemove(job.id)}
                style={{ color: t.bad, flex: job.status === "DONE" ? 1 : undefined }}
              >
                Sil
              </Button>
            </div>
          </Card>
        );
      })}
    </div>
  );
};
