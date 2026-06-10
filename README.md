# KADE AutoEdit AI

AI destekli otomatik video duzenleme paneli. Backend FastAPI ile calisir, panel React + TypeScript ile Adobe Premiere Pro icinde UXP panel olarak yuklenir.

## Mimari

```text
kade-autoedit-ai/
  backend/        FastAPI sunucusu
  panel/          Adobe UXP paneli
  shared/         Ortak tip tanimlari
  packaging/      Installer build (.exe / .dmg / .ccx)
```

## Kurulum (son kullanıcı — çift tıkla)

Hazır installer'la Python/FFmpeg bilmenize gerek yok:

1. **Sunucuyu kurun:**
   - **Windows:** `KADE-AutoEdit-Setup.exe` → çift tıkla. SmartScreen çıkarsa
     "Daha fazla bilgi" → "Yine de çalıştır" (installer imzasız).
   - **macOS:** `KADE-AutoEdit.dmg` → aç → `.app`'i Applications'a sürükle. İlk açılışta
     `.app`'e **sağ tık → Aç** (Gatekeeper, imzasız).
2. **"KADE AutoEdit AI Sunucu"yu başlatın** (kısayol/uygulama). Arka planda
   `localhost:8472`'de çalışır.
3. **Paneli Premiere'e kurun:** installer/dmg ile gelen `KADE-AutoEdit.ccx`'e çift tıklayın
   (Creative Cloud kurar) ya da Premiere'de `Eklentiler` menüsünden açın.
4. Premiere'de paneli açın → sağ üstte **"Çevrimiçi"** yazıyorsa hazır.

> Installer'ları kendiniz build etmek için: [packaging/README.md](packaging/README.md).

## Geliştirici Kurulumu

## Gereksinimler

- **Python 3.10–3.12 önerilir** (3.13/3.14 de çalışır; bazı paketler kaynaktan derlenebilir)
- Node.js 18+ ve npm
- FFmpeg (PATH'e ekli)
- Adobe Premiere Pro 24.0+
- Adobe UXP Developer Tool

### FFmpeg ve Python kurulumu

**macOS (Apple Silicon / Intel):** [Homebrew](https://brew.sh) ile

```bash
brew install ffmpeg python@3.12 node
```

**Windows:** Python'u [python.org](https://www.python.org/downloads/), Node'u
[nodejs.org](https://nodejs.org) üzerinden kurun. FFmpeg için
[ffmpeg.org](https://ffmpeg.org/download.html) → indir ve `bin` klasörünü PATH'e ekle
(veya `winget install Gyan.FFmpeg`).

`ffmpeg -version` ve `python --version` komutlarının çalıştığını doğrulayın.

## Hızlı Kurulum (tek script)

Backend bağımlılıkları (sanal ortam dahil) + panel derlemesini tek seferde yapar:

**macOS / Linux:**

```bash
chmod +x setup.sh start_server.sh   # ilk seferde
./setup.sh
```

**Windows:**

```bat
setup.bat
```

Script `backend/.venv` altında izole bir sanal ortam oluşturur, bağımlılıkları kurar
ve paneli derler.

## Manuel Kurulum

**Backend (macOS / Linux):**

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python main.py
```

**Backend (Windows):**

```bat
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

Sunucu `http://localhost:8472` adresinde başlar.

**Panel (her iki platform):**

```bash
cd panel
npm install
npm run build
```

## Çalıştırma

1. Backend'i başlatın:

   - macOS / Linux: `./start_server.sh`
   - Windows: `start_server.bat`

2. Paneli derleyin (yukarıdaki "Panel" adımı).

3. Adobe UXP Developer Tool'u açın.

4. `Add Plugin` ile `panel/manifest.json` dosyasını seçin.

5. Premiere Pro'yu açın.

6. UXP Developer Tool'dan KADE AutoEdit AI pluginini `Load` edin.

7. **Auto Edit** sekmesinde bir dosya + stil seçip tek tuşla tam edit çıkarın,
   veya **Moduller** sekmesinden tek tek modül çalıştırın.

## Kullanim Mantigi

### Auto Edit (tek tuş — AutoCut / spunkram tarzı)

`Auto Edit` sekmesinde bir **stil** seçersin (Talking Head, Viral Short, Beat
Montage, Podcast, Cinematic), tek tuşa basarsın; backend doğru modülleri doğru
sırayla zincirler ve tek bir **EditPlan** üretir: atılacak boşluklar, dinamik
zoom'lar, kelime-kelime animasyonlu altyazılar, b-roll/bölüm markerları.

- **Premiere'e Uygula** — aktif sequence'i keser, zoom keyframe'leri, caption
  graphic'leri ve markerları ekler.
- **MP4 İndir** — panel olmadan da çalışan, altyazıları yakılı standalone render
  (FFmpeg ile kesim + reframe + ses normalizasyon + `.ass` karaoke burn-in).

### Meme Bulucu

`Moduller` sekmesindeki **Meme Bulucu** ile bir yazı/konu girip (ör. "pazartesi
sendromu") veya bir video yükleyip transkriptinden otomatik meme önerisi alırsın.
Kaynaklar (seçilebilir):

- **Üret (offline)** — impact-font üst/alt yazılı klasik meme, API'siz, her zaman çalışır.
- **Imgflip** — popüler şablon arşivinden eşleşen meme (anahtarsız).
- **Tenor / Giphy** — GIF arama (config'e `TENOR_API_KEY` / `GIPHY_API_KEY` girilirse).

TR/EN otomatik algılanır. Video modunda her öneriye bir zaman damgası gelir
(timeline'a yerleştirme için).

### Modüller (tek tek)

- Backend dosyayi analiz eder ve sonucu job olarak kaydeder.
- Panel WebSocket ile ilerleme bilgisini gosterir.
- Silence, transcript filler, podcast ve repeat gibi moduller kesim onerisi uretirse Timeline sekmesine gonderilir.
- Timeline sekmesindeki `Premiere'e Uygula` butonu aktif sequence uzerinde kesim noktalarini uygular.
- Captions, chapters, resize, viral ve b-roll gibi moduller analiz/oneriler uretir.

## Opsiyonel Ayarlar (.env)

Meme Bulucu'nun GIF kaynakları için `backend/.env` dosyasına (opsiyonel) anahtar girin:

```env
TENOR_API_KEY=...
GIPHY_API_KEY=...
```

Anahtar yoksa o kaynak sessizce atlanır; offline üretim ve Imgflip anahtarsız çalışır.
FFmpeg yolu gerekirse `FFMPEG_PATH` / `FFPROBE_PATH` ile override edilebilir.

## API Endpoints

| Method | Path | Aciklama |
|--------|------|----------|
| GET | /health | Sunucu durumu |
| GET | /styles | Auto Edit stilleri |
| POST | /auto-edit | Tek tuş orkestratör (stil → EditPlan, ops. render) |
| GET | /render/{job_id} | Render edilen MP4'ü indir |
| POST | /meme-find | Yazı/konu veya transkriptten meme bul & üret (TR/EN) |
| GET | /meme-image | Üretilen meme PNG'sini servis et |
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
