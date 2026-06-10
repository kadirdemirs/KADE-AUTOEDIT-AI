; Inno Setup script — KADE AutoEdit AI (Windows)
; Derle:  ISCC packaging\windows\installer.iss
; Once PyInstaller cikti uretilmeli: dist\kade-backend\

#define AppName "KADE AutoEdit AI"
#define AppVersion "1.0.0"
#define AppPublisher "Kade Media"
#define AppId "{{8F3C2A10-7B4E-4AE1-9B7C-A1E2D3C4B5A6}"
#define PluginId "com.kademedia.autoedit"
#define PluginFolder "com.kademedia.autoedit_1.0.0"

[Setup]
AppId={#AppId}
AppName={#AppName}
AppVersion={#AppVersion}
AppPublisher={#AppPublisher}
DefaultDirName={autopf}\KADE AutoEdit AI
DefaultGroupName=KADE AutoEdit AI
DisableProgramGroupPage=yes
OutputDir=..\..\dist\installer
OutputBaseFilename=KADE-AutoEdit-Setup
Compression=lzma2
SolidCompression=yes
ArchitecturesAllowed=x64compatible
ArchitecturesInstallIn64BitMode=x64compatible
WizardStyle=modern
; Kullanici "herkes icin" (admin) veya "sadece ben" (HKCU autostart dogru calisir) secebilsin.
PrivilegesRequired=lowest
PrivilegesRequiredOverridesAllowed=dialog
; Imzasiz: kullanici SmartScreen'de "Yine de calistir" demeli.

[Languages]
Name: "turkish"; MessagesFile: "compiler:Languages\Turkish.isl"
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
; Autostart ON by default: backend runs in the background on login, so the user
; never launches a server by hand. The panel also tries to start it on open.
Name: "autostart"; Description: "Windows baslangicinda KADE servisini otomatik baslat (onerilir)"; GroupDescription: "Secenekler:"
Name: "desktopicon"; Description: "Masaustu kisayolu olustur"; GroupDescription: "Kisayollar:"; Flags: unchecked

[Files]
; PyInstaller onedir ciktisinin tamami (arka plan servisi)
Source: "..\..\dist\kade-backend\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Panel .ccx — installer bunu UPIA ile Premiere'e sessizce kurar (asagida [Run]).
; (Elle External klasore kopyalamak Premiere 26'da ISE YARAMAZ: premierepro.json'a
;  yazilmasi gerek, bunu sadece UPIA/cift-tik yapabilir. Bu yuzden UPIA kullaniyoruz.)
Source: "..\..\dist\KADE-AutoEdit.ccx"; DestDir: "{app}"; Flags: ignoreversion

[Icons]
; Panel UPIA ile Premiere'e kalici kuruluyor (UXP Developer Tool gerekmez).
; Kullaniciya sadece: servisi gerekirse baslat + kaldir.
Name: "{group}\KADE AutoEdit AI Servisi (gerekirse baslat)"; Filename: "{app}\kade-backend.exe"
Name: "{group}\Paneli Premiere'e yeniden kur"; Filename: "{commoncf}\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"; Parameters: "/install ""{app}\KADE-AutoEdit.ccx"""; Flags: createonlyiffileexists
Name: "{group}\{cm:UninstallProgram,KADE AutoEdit AI}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\KADE AutoEdit AI"; Filename: "{app}\kade-backend.exe"; Tasks: desktopicon

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "KADEAutoEdit"; ValueData: """{app}\kade-backend.exe"""; \
  Tasks: autostart; Flags: uninsdeletevalue

[Run]
; 1) Paneli Premiere'e UPIA ile sessizce kur (Developer Tool YOK, cift-tik YOK).
;    UPIA Creative Cloud ile gelir; yolu Common Files altinda sabittir.
Filename: "{commoncf}\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"; \
  Parameters: "/install ""{app}\KADE-AutoEdit.ccx"""; \
  StatusMsg: "KADE paneli Premiere'e kuruluyor..."; \
  Flags: runhidden waituntilterminated skipifdoesntexist
; 2) Arka plan servisini hemen baslat (panel acilinca cevrimici olsun).
Filename: "{app}\kade-backend.exe"; Description: "KADE servisini simdi baslat"; \
  Flags: nowait postinstall

[UninstallRun]
; Kaldirirken paneli de UPIA ile temizle.
Filename: "{commoncf}\Adobe\Adobe Desktop Common\RemoteComponents\UPI\UnifiedPluginInstallerAgent\UnifiedPluginInstallerAgent.exe"; \
  Parameters: "/remove ""{#PluginId}"""; \
  Flags: runhidden skipifdoesntexist; RunOnceId: "RemoveKadePanel"
