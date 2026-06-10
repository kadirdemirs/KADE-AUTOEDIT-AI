// Shared module metadata (icon, label, one-line description) used by both the
// homepage grid (Home.tsx) and each tool detail page (ToolView.tsx). Kept in one
// place so a tool's card and its page never drift apart.

export type ModuleType =
  | "silence"
  | "whisper"
  | "beat"
  | "scene"
  | "color"
  | "captions"
  | "zoom"
  | "viral"
  | "podcast"
  | "repeat"
  | "profanity"
  | "chapters"
  | "resize"
  | "broll";

export interface ModuleMeta {
  label: string;
  icon: string;
  accent: string;
  description: string;
  tag: string;
}

export const MODULE_META: Record<ModuleType, ModuleMeta> = {
  silence: {
    label: "Sessizlik Kesici",
    icon: "✂️",
    accent: "#4a9eff",
    description: "Boşlukları ve nefes aralarını otomatik kesip atar.",
    tag: "Kesim",
  },
  whisper: {
    label: "Transkript",
    icon: "📝",
    accent: "#7c4dff",
    description: "Konuşmayı yazıya döker, dolgu kelimeleri kesim önerir.",
    tag: "Metin",
  },
  beat: {
    label: "Beat Sync",
    icon: "🥁",
    accent: "#ff4081",
    description: "Müziğin BPM ve beat noktalarını çıkarır.",
    tag: "Ritim",
  },
  scene: {
    label: "Sahne Tespiti",
    icon: "🎞️",
    accent: "#00acc1",
    description: "Görüntü değişimlerini yakalar, sahnelere ayırır.",
    tag: "Analiz",
  },
  color: {
    label: "Otomatik Renk",
    icon: "🎨",
    accent: "#f59e0b",
    description: "Renk, LUT ve ses seviyesi önerileri üretir.",
    tag: "Renk",
  },
  captions: {
    label: "Auto Captions",
    icon: "💬",
    accent: "#26a69a",
    description: "AI ile animasyonlu altyazı üretir.",
    tag: "Altyazı",
  },
  zoom: {
    label: "Auto Zoom",
    icon: "🔍",
    accent: "#ec407a",
    description: "Vurgu anlarında dinamik zoom ekler.",
    tag: "Hareket",
  },
  viral: {
    label: "Viral Klip",
    icon: "🔥",
    accent: "#ff7043",
    description: "Uzun videodan en iyi kısa klipleri çıkarır.",
    tag: "Shorts",
  },
  podcast: {
    label: "Podcast",
    icon: "🎙️",
    accent: "#66bb6a",
    description: "Konuşmacı segmentleri + boşluk temizliği.",
    tag: "Podcast",
  },
  repeat: {
    label: "Tekrar Temizleyici",
    icon: "🔁",
    accent: "#ab47bc",
    description: "Tekrar eden take'leri bulur, en iyisini bırakır.",
    tag: "Tekrar",
  },
  profanity: {
    label: "Küfür Filtresi",
    icon: "🛡️",
    accent: "#ef5350",
    description: "Küfürleri bleep / beep / mute ile sansürler.",
    tag: "Temizleme",
  },
  chapters: {
    label: "Auto Chapters",
    icon: "📚",
    accent: "#5c6bc0",
    description: "YouTube için zaman kodlu bölüm başlıkları üretir.",
    tag: "Bölüm",
  },
  resize: {
    label: "Auto Resize",
    icon: "📐",
    accent: "#29b6f6",
    description: "Sosyal medya oranlarına özneyi merkezde tutarak kırpar.",
    tag: "Format",
  },
  broll: {
    label: "B-Roll Önerici",
    icon: "🧩",
    accent: "#ffa726",
    description: "Transkripte göre b-roll arama önerileri çıkarır.",
    tag: "B-roll",
  },
};
