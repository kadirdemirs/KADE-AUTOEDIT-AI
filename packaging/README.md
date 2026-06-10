# Installer Build Rehberi

KADE AutoEdit AI iki parçadan oluşur ve her birinin kendi paketleme yolu vardır:

| Parça | Çalıştığı yer | Paket |
|-------|---------------|-------|
| Backend (Python/FastAPI) | Kullanıcının makinesinde arka plan sunucu | Windows `.exe`, macOS `.dmg` |
| Panel (UXP eklentisi) | Premiere Pro'nun içinde | `.ccx` |

> **Önemli:** PyInstaller cross-compile yapmaz. Windows `.exe`'yi **Windows'ta**,
> macOS `.dmg`'yi **Mac'te** build edersiniz. `.ccx` platform-bağımsızdır.

## Ortak ön koşullar

- Backend bağımlılıkları kurulu bir Python ortamı (`backend/requirements.txt`) **+ pyinstaller**
  ```bash
  cd backend && python -m venv .venv
  # Windows: .venv\Scripts\activate   |  macOS/Linux: source .venv/bin/activate
  pip install -r requirements.txt pyinstaller
  ```
- Node.js + npm (panel derlemesi için)

## Windows (.exe)

Ek araç: [Inno Setup](https://jrsoftware.org/isdl.php) (`ISCC.exe` PATH'te olmalı).

```bat
packaging\windows\build.bat
```

Adımlar: ffmpeg indir → PyInstaller (`dist\kade-backend\`) → `.ccx` → Inno Setup.
Çıktı: `dist\installer\KADE-AutoEdit-Setup.exe`.

Tek tek de çalıştırılabilir:
```bat
python packaging\fetch_ffmpeg.py
pyinstaller packaging\kade-backend.spec --noconfirm --distpath dist --workpath build\pyi
python packaging\build_ccx.py
ISCC packaging\windows\installer.iss
```

## macOS (.dmg)

Ek araç (opsiyonel): `brew install create-dmg` (yoksa `hdiutil` kullanılır).

```bash
chmod +x packaging/macos/build.sh packaging/build_ccx.sh
./packaging/macos/build.sh
```

Çıktı: `dist/KADE-AutoEdit.dmg` (içinde `.app` + `.ccx`).

## Panel (.ccx) — tek başına

```bash
python packaging/build_ccx.py        # her iki platform
```
Çıktı: `dist/KADE-AutoEdit.ccx`. `npm run build`'i otomatik çağırır.

## İmzasız dağıtım notu

Installer'lar **imzasız**. İlk açılışta:

- **Windows:** SmartScreen → "Daha fazla bilgi" → "Yine de çalıştır".
- **macOS:** `.app`'e **sağ tık → Aç** (bir kez), ya da terminalden
  `xattr -dr com.apple.quarantine "/Applications/KADE AutoEdit AI.app"`.

İmzalama sonradan eklenebilir: Windows için OV/EV code-signing sertifikası +
`signtool`, macOS için Apple Developer ID + `codesign` & `notarytool`.

## FFmpeg

`fetch_ffmpeg.py` platforma uygun **statik** ffmpeg/ffprobe indirir
(`packaging/bin/<os>/`). İndirme başarısız olursa binary'leri elle o klasöre
koyabilirsiniz. Spec bunları paketin `bin/` klasörüne gömer; çalışma anında
`config.py` frozen modda oradan bulur (`FFMPEG_PATH` env ile override edilebilir).
