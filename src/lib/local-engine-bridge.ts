export type LocalEngineConfigField = { value: string; configured: boolean };
export type LocalEngineConfig = Record<string, LocalEngineConfigField>;
export type LocalEngineStatus = {
  running: boolean;
  status?: string;
  workerName?: string;
  workerId?: string;
  jobId?: string;
  jobType?: string;
  error?: string;
  updated_at?: string;
};

type MyincLocalBridge = {
  isDesktopApp: true;
  getEngineConfig: () => Promise<LocalEngineConfig>;
  saveEngineConfig: (patch: Record<string, string>) => Promise<{ ok: true }>;
  getEngineStatus: () => Promise<LocalEngineStatus>;
  restartEngine: () => Promise<{ ok: true }>;
  pauseEngine: () => Promise<{ ok: true }>;
  resumeEngine: () => Promise<{ ok: true }>;
};

declare global {
  interface Window {
    myincLocal?: MyincLocalBridge;
  }
}

export function isDesktopApp() {
  return typeof window !== "undefined" && Boolean(window.myincLocal?.isDesktopApp);
}

export function getEngineConfig() {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.getEngineConfig();
}

export function saveEngineConfig(patch: Record<string, string>) {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.saveEngineConfig(patch);
}

export function getEngineStatus() {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.getEngineStatus();
}

export function restartEngine() {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.restartEngine();
}

export function pauseEngine() {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.pauseEngine();
}

export function resumeEngine() {
  if (!isDesktopApp()) throw new Error("Disponível apenas no app desktop MYINC.");
  return window.myincLocal!.resumeEngine();
}
