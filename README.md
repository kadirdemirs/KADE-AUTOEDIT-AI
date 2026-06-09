# KADE AutoEdit AI

Adobe Premiere Pro için yapay zeka destekli otomatik video düzenleme uygulaması.

## Mimari

```
kade-autoedit-ai/
├── backend/        FastAPI sunucusu (Python)
├── panel/          UXP panel (React + TypeScript)
└── shared/         Ortak tip tanımları
```

## Backend Kurulum

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Sunucu `http://localhost:8472` adresinde başlar.

### Gereksinimler

- Python 3.10+
- FFmpeg (PATH'te olmalı)
- CUDA (opsiyonel, Whisper için)

## Panel Kurulum

```bash
cd panel
npm install
npm run build
```

Üretilen `dist/` klasörünü Adobe UXP Developer Tool ile yükleyin.

## API Endpoints

| Method | Path | Açıklama |
|--------|------|----------|
| GET | /health | Sunucu durumu |
| POST | /analyze | Video analizi |
| POST | /silence-cut | Sessizlik kesme |
| POST | /transcript | Whisper transkript |
| POST | /beat-sync | Beat senkronizasyon |
| POST | /scene-detect | Sahne tespiti |
| POST | /auto-color | Renk/ses analizi |
| GET | /jobs | Tüm işler |
| GET | /jobs/{id} | İş durumu |
| DELETE | /jobs/{id} | İş sil |
| GET | /presets | Preset listesi |
| POST | /presets | Preset kaydet |
| DELETE | /presets/{id} | Preset sil |
| WS | /ws | Gerçek zamanlı ilerleme |

## Modüller

### Sessizlik Kesici
RMS tabanlı sessizlik tespiti. J-cut ve L-cut desteği.
- `threshold_db`: Sessizlik eşiği (varsayılan: -40 dB)
- `min_silence_ms`: Minimum sessizlik süresi (varsayılan: 500ms)

### Whisper Transkript
OpenAI Whisper ile kelime seviyesinde zaman damgalı transkript.
- Türkçe ve İngilizce doldurma kelime tespiti
- Dil seçimi: tr / en / auto

### Beat Sync
librosa ile BPM ve beat frame tespiti.
- `sensitivity`: Beat hassasiyeti (0.1–1.0)

### Sahne Tespiti
PySceneDetect ile otomatik sahne sınırı tespiti.
- `threshold`: ContentDetector eşiği (varsayılan: 30.0)

### Otomatik Renk
OpenCV histogram analizi + pyloudnorm LUFS normalizasyonu.
- LUT önerisi: warm / cool / neutral
- `target_lufs`: Hedef ses seviyesi (varsayılan: -14 LUFS)

## Testler

```bash
cd backend
pytest tests/ -v
```

## Lisans

MIT
