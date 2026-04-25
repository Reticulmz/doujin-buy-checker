import { createSignal } from "solid-js";

declare global {
  interface Window {
    __pwaInstallPrompt: Event | null;
  }
}

const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);
const [isInstalled, setIsInstalled] = createSignal(
  window.matchMedia("(display-mode: standalone)").matches
);

// 早期捕捉済みイベントの回収
if (window.__pwaInstallPrompt) {
  setDeferredPrompt(window.__pwaInstallPrompt);
  window.__pwaInstallPrompt = null;
}

window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  setDeferredPrompt(e);
});

window.addEventListener("appinstalled", () => {
  setIsInstalled(true);
  setDeferredPrompt(null);
});

export const canInstall = () => !!deferredPrompt() && !isInstalled();
export const pwaInstalled = isInstalled;

export async function promptInstall(): Promise<boolean> {
  const prompt = deferredPrompt();
  if (!prompt) return false;
  prompt.prompt();
  const result = await prompt.userChoice;
  if (result.outcome === "accepted") {
    setDeferredPrompt(null);
    return true;
  }
  return false;
}
