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
Name: "desktopicon"; Description: "Masaustu kisayolu olustur"; GroupDescription: "Kisayollar:"
Name: "autostart"; Description: "Windows baslangicinda sunucuyu otomatik baslat"; GroupDescription: "Secenekler:"; Flags: unchecked
Name: "openextensions"; Description: "Kurulumdan sonra Adobe Extensions klasorunu ac"; GroupDescription: "Secenekler:"; Flags: checkedonce

[Files]
; PyInstaller onedir ciktisinin tamami
Source: "..\..\dist\kade-backend\*"; DestDir: "{app}"; Flags: recursesubdirs createallsubdirs ignoreversion
; Panel .ccx (varsa) — kullanici Premiere'e cift tiklayip kurar
Source: "..\..\dist\KADE-AutoEdit.ccx"; DestDir: "{app}"; Flags: skipifsourcedoesntexist
; Panel klasoru — installer calisinca Premiere UXP External Extensions altina kalici kopyalanir
Source: "..\..\panel\dist\*"; DestDir: "{userappdata}\Adobe\UXP\Plugins\External\{#PluginFolder}"; Flags: recursesubdirs createallsubdirs ignoreversion

[Icons]
Name: "{group}\KADE AutoEdit AI Sunucu"; Filename: "{app}\kade-backend.exe"
Name: "{group}\Panel'i Premiere'e Kur (.ccx)"; Filename: "{app}\KADE-AutoEdit.ccx"; Flags: createonlyiffileexists
Name: "{group}\Adobe Extensions Klasorunu Ac"; Filename: "{sys}\explorer.exe"; Parameters: """{userappdata}\Adobe\UXP\Plugins\External"""
Name: "{group}\{cm:UninstallProgram,KADE AutoEdit AI}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\KADE AutoEdit AI"; Filename: "{app}\kade-backend.exe"; Tasks: desktopicon

[InstallDelete]
Type: filesandordirs; Name: "{userappdata}\Adobe\UXP\Plugins\External\{#PluginFolder}"

[UninstallDelete]
Type: filesandordirs; Name: "{userappdata}\Adobe\UXP\Plugins\External\{#PluginFolder}"

[Registry]
Root: HKCU; Subkey: "Software\Microsoft\Windows\CurrentVersion\Run"; \
  ValueType: string; ValueName: "KADEAutoEdit"; ValueData: """{app}\kade-backend.exe"""; \
  Tasks: autostart; Flags: uninsdeletevalue

[Run]
Filename: "{app}\kade-backend.exe"; Description: "Sunucuyu simdi baslat"; \
  Flags: nowait postinstall skipifsilent
Filename: "{sys}\explorer.exe"; Parameters: """{userappdata}\Adobe\UXP\Plugins\External"""; \
  Description: "Adobe Extensions klasorunu ac"; Tasks: openextensions; Flags: postinstall skipifsilent nowait
