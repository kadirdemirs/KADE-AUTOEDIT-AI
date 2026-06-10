import React, { useEffect, useMemo, useState } from "react";
import { AssetCategory, LibraryAsset } from "../types";
import { api } from "../services/api";
import { premiereAPI } from "../services/premiere";
import { useTheme } from "../theme";
import { Badge, Banner, Button, Card, Chip, EmptyState, SectionHeader, TextInput } from "./ui";

const KIND_LABEL: Record<string, string> = {
  mogrt: "MOGRT",
  video: "Video",
  image: "Image",
  audio: "Audio",
  lut: "LUT",
  preset: "Preset",
  unknown: "Asset",
};

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AssetLibrary: React.FC = () => {
  const { t } = useTheme();
  const [categories, setCategories] = useState<AssetCategory[]>([]);
  const [assets, setAssets] = useState<LibraryAsset[]>([]);
  const [category, setCategory] = useState("all");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ kind: "info" | "error"; text: string } | null>(null);

  const selectedCategory = useMemo(
    () => categories.find((item) => item.id === category),
    [categories, category],
  );

  const load = async () => {
    setLoading(true);
    setMessage(null);
    try {
      const [catData, assetData] = await Promise.all([
        api.getLibraryCategories(),
        api.getLibraryAssets({ category, q: query }),
      ]);
      setCategories(catData);
      setAssets(assetData);
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [category]);

  const handleSearch = () => {
    load();
  };

  const handleApply = async (asset: LibraryAsset) => {
    setMessage(null);
    if (!premiereAPI.isAvailable()) {
      setMessage({ kind: "error", text: "Premiere bağlantısı yok. Asset eklemek için paneli Premiere içinde aç." });
      return;
    }
    try {
      await premiereAPI.importAsset(asset.path, asset.kind);
      const verb = asset.kind === "mogrt" ? "playhead'e eklendi" : "projeye import edildi";
      setMessage({ kind: "info", text: `${asset.title} ${verb}.` });
    } catch (err) {
      setMessage({ kind: "error", text: err instanceof Error ? err.message : String(err) });
    }
  };

  return (
    <div style={{ padding: 14 }}>
      <SectionHeader
        icon="📚"
        title="Library"
        subtitle="Spunkram tarzı yerel asset paneli. Kendi lisanslı MOGRT, overlay, transition, LUT ve seslerini klasöre koy; KADE burada kategorili gösterir."
      />

      <Card style={{ padding: 12 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 10 }}>
          <TextInput
            value={query}
            onChange={setQuery}
            placeholder="Asset ara: lower third, glitch, phone, whoosh..."
            onKeyDown={(event) => {
              if (event.key === "Enter") handleSearch();
            }}
          />
          <Button variant="secondary" onClick={handleSearch} disabled={loading} style={{ padding: "8px 10px" }}>
            Ara
          </Button>
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Chip active={category === "all"} onClick={() => setCategory("all")}>
            All
          </Chip>
          {categories.map((item) => (
            <Chip key={item.id} active={category === item.id} onClick={() => setCategory(item.id)}>
              {item.icon} {item.label}
            </Chip>
          ))}
        </div>

        <div style={{ fontSize: 11, color: t.textDim, lineHeight: 1.45, marginTop: 10 }}>
          {selectedCategory
            ? selectedCategory.description
            : "Tüm kategorilerdeki kullanılabilir assetleri listeler."}
        </div>
      </Card>

      {message && <Banner kind={message.kind}>{message.text}</Banner>}

      {assets.length === 0 && !loading && (
        <EmptyState
          icon="📁"
          title="Library boş"
          hint="backend/assets/library içine kategori klasörleri açıp kendi .mogrt, .mp4, .png, .wav veya .cube dosyalarını koy."
        />
      )}

      {loading && <div style={{ fontSize: 12, color: t.textDim, padding: 12 }}>Library taranıyor...</div>}

      {assets.map((asset) => (
        <Card key={asset.id} style={{ padding: 14 }}>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div
              style={{
                width: 40,
                height: 40,
                borderRadius: 8,
                background: `${t.accent}18`,
                color: t.accent,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 12,
                fontWeight: 900,
                flexShrink: 0,
              }}
            >
              {KIND_LABEL[asset.kind] || "Asset"}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <div
                  style={{
                    fontSize: 13.5,
                    fontWeight: 800,
                    color: t.text,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {asset.title}
                </div>
                <Badge>{asset.extension}</Badge>
              </div>
              <div style={{ fontSize: 11.5, color: t.textDim, lineHeight: 1.45 }}>
                {asset.description}
              </div>
              <div style={{ fontSize: 10.5, color: t.textFaint, marginTop: 6 }}>
                {asset.category} · {formatSize(asset.size_bytes)}
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 8 }}>
                {asset.tags.slice(0, 5).map((tag) => (
                  <span
                    key={tag}
                    style={{
                      fontSize: 9,
                      color: t.textFaint,
                      background: t.surface2,
                      padding: "2px 6px",
                      borderRadius: 4,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>

            <Button variant="secondary" onClick={() => handleApply(asset)} style={{ padding: "8px 10px" }}>
              {asset.kind === "mogrt" ? "Ekle" : "Import"}
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
};
