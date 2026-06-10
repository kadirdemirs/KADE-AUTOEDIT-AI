// Backend auto-start: when the panel opens inside Premiere, silently launch the
// installed KADE backend if it isn't already answering on localhost. The user
// never starts a server or the UXP Developer Tool by hand.
//
// Two layers guarantee the backend is up (see plan §D):
//   1. This panel-side launcher tries to start the installed executable via UXP's
//      shell API the moment it sees /health failing.
//   2. The installer also registers the backend as a login item / autostart entry,
//      so even if UXP shell is sandboxed the backend is already running.
//
// All shell access is best-effort and wrapped in try/catch — if UXP forbids it we
// simply fall back to polling (layer 2 will have it running).

import { api } from "./api";

declare const require: (module: string) => unknown;

type UXPShell = {
  openPath?: (path: string) => Promise<unknown>;
  openExternal?: (url: string) => Promise<unknown>;
};

function getShell(): UXPShell | null {
  try {
    const uxp = require("uxp") as { shell?: UXPShell } | null;
    return uxp?.shell ?? null;
  } catch {
    return null;
  }
}

function isWindows(): boolean {
  // UXP exposes navigator.platform; Premiere on Windows reports "Win32".
  try {
    return /win/i.test(navigator.platform || "");
  } catch {
    return true;
  }
}

// UXP doesn't reliably expose process.env, but when it does these are the install
// defaults we look under. Best-effort, always returns a string.
function readEnv(name: string): string {
  try {
    const proc = (window as unknown as { process?: { env?: Record<string, string> } }).process;
    return proc?.env?.[name] ?? "";
  } catch {
    return "";
  }
}

// Known install locations the Windows installer / macOS .app writes the backend to.
// The installer's default {autopf}\KADE AutoEdit AI is the primary Windows target.
function candidateBackendPaths(): string[] {
  if (isWindows()) {
    const localAppData = readEnv("LOCALAPPDATA");
    const programFiles = readEnv("ProgramFiles") || "C:/Program Files";
    const paths = [
      `${programFiles}/KADE AutoEdit AI/kade-backend.exe`,
      `${programFiles}/KADE AutoEdit AI/dist/kade-backend/kade-backend.exe`,
    ];
    if (localAppData) {
      paths.push(`${localAppData}/Programs/KADE AutoEdit AI/kade-backend.exe`);
    }
    return paths;
  }
  // macOS: the .app bundle (the installer's login item also covers this).
  const home = readEnv("HOME");
  const macPaths = ["/Applications/KADE AutoEdit AI.app"];
  if (home) macPaths.push(`${home}/Applications/KADE AutoEdit AI.app`);
  return macPaths;
}

async function tryLaunch(): Promise<boolean> {
  const shell = getShell();
  if (!shell?.openPath) return false;
  for (const path of candidateBackendPaths()) {
    try {
      await shell.openPath(path);
      return true;
    } catch {
      // Path may not exist on this machine; try the next candidate.
    }
  }
  return false;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Ensure the backend is reachable. Returns true once /health answers.
 * 1) Quick health probe. 2) If down, attempt to launch the installed backend.
 * 3) Poll /health for up to ~`timeoutMs` ms.
 */
export async function ensureBackendRunning(timeoutMs = 18000): Promise<boolean> {
  const probe = async () => {
    try {
      const res = await api.health();
      return res.status === "ok";
    } catch {
      return false;
    }
  };

  if (await probe()) return true;

  await tryLaunch();

  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    await sleep(1000);
    if (await probe()) return true;
  }
  return false;
}

// Export for diagnostics / Settings panel.
export const backendLauncher = {
  ensureBackendRunning,
  canLaunch: () => !!getShell()?.openPath,
};
