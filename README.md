# KADE AutoEdit AI

AI destekli otomatik video duzenleme paneli. Backend FastAPI ile calisir, panel React + TypeScript ile Adobe Premiere Pro icinde UXP panel olarak yuklenir.

## Mimari

```text
kade-autoedit-ai/
  backend/        FastAPI sunucusu
  panel/          Adobe UXP paneli
  shared/         Ortak tip tanimlari
```

## Gereksinimler

- Python 3.10+
- Node.js + npm
- FFmpeg, PATH'e eklenmis olmali
- Adobe Premiere Pro 24.0+
- Adobe UXP Developer Tool

## Backend Kurulum

```bash
cd backend
pip install -r requirements.txt
python main.py
```

Sunucu `http://localhost:8472` adresinde baslar.

## Panel Kurulum

```bash
cd panel
npm install
npm run build
```

Adobe UXP Developer Tool ile `panel/manifest.json` dosyasini yukleyin.

## Calistirma

1. Backend'i baslatin:

```bash
start_server.bat
```

Alternatif:

```bash
cd backend
python main.py
```

2. Panel'i derleyin:

```bash
cd panel
npm install
npm run build
```

3. Adobe UXP Developer Tool'u acin.

4. `Add Plugin` ile `panel/manifest.json` dosyasini secin.

5. Premiere Pro'yu acin.

6. UXP Developer Tool'dan KADE AutoEdit AI pluginini `Load` edin.

7. Panelde bir video/audio dosyasi secin ve modul calistirin.

## Kullanim Mantigi

- Backend dosyayi analiz eder ve sonucu job olarak kaydeder.
- Panel WebSocket ile ilerleme bilgisini gosterir.
- Silence, transcript filler, podcast ve repeat gibi moduller kesim onerisi uretirse Timeline sekmesine gonderilir.
- Timeline sekmesindeki `Premiere'e Uygula` butonu aktif sequence uzerinde kesim noktalarini uygular.
- Captions, chapters, resize, viral ve b-roll gibi moduller analiz/oneriler uretir.

## API Endpoints

| Method | Path | Aciklama |
|--------|------|----------|
| GET | /health | Sunucu durumu |
| POST | /analyze | Video analizi |
| POST | /silence-cut | Sessizlik kesme |
| POST | /transcript | Whisper transkript |
| POST | /beat-sync | Beat senkronizasyon |
| POST | /scene-detect | Sahne tespiti |
| POST | /auto-color | Renk/ses analizi |
| POST | /auto-captions | Caption uretimi |
| POST | /auto-zoom | Zoom keyframe onerileri |
| POST | /viral-detect | Viral klip adaylari |
| POST | /podcast-mode | Konusmaci segmentleri |
| POST | /repeat-detect | Tekrarli take tespiti |
| POST | /profanity-filter | Kufur tespiti |
| POST | /auto-chapters | Bolum/chapter uretimi |
| POST | /auto-resize | Sosyal medya oranlari icin reframe |
| POST | /broll-suggest | B-roll onerileri |
| GET | /jobs | Tum isler |
| GET | /jobs/{id} | Is durumu |
| DELETE | /jobs/{id} | Is sil |
| GET | /presets | Preset listesi |
| POST | /presets | Preset kaydet |
| DELETE | /presets/{id} | Preset sil |
| WS | /ws | Gercek zamanli ilerleme |

## Testler

```bash
cd backend
python -m pytest -q
```

```bash
cd panel
npm run type-check
npm run build
```

## Lisans

MIT
