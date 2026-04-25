import { createSignal, onMount, onCleanup, Show } from "solid-js";
import { X } from "~/components/icons";

declare global {
  interface Window {
    __pwaInstallPrompt: Event | null;
  }
}

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);
  const [show, setShow] = createSignal(false);
  const [installed, setInstalled] = createSignal(false);

  onMount(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    // index.html のインラインスクリプトで早期捕捉済みのイベントを回収
    if (window.__pwaInstallPrompt) {
      setDeferredPrompt(window.__pwaInstallPrompt);
      window.__pwaInstallPrompt = null;
      setShow(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    };
    const handleInstalled = () => {
      setInstalled(true);
      setTimeout(() => setShow(false), 3000);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstall);
    window.addEventListener("appinstalled", handleInstalled);

    onCleanup(() => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstall);
      window.removeEventListener("appinstalled", handleInstalled);
    });
  });

  const handleInstall = async () => {
    const prompt = deferredPrompt();
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem("pwa-install-dismissed", "1");
  };

  return (
    <Show when={show()}>
      <div class="fixed top-0 left-0 right-0 z-50 p-3 safe-area-pt">
        <div class="max-w-lg mx-auto bg-primary-600 text-white rounded-xl shadow-xl p-4">
          <Show when={!installed()} fallback={
            <div class="text-center text-sm font-medium">
              インストール完了！オフラインでも使えます
            </div>
          }>
            <div class="flex items-start gap-3">
              <div class="flex-1 min-w-0">
                <div class="font-bold text-sm">アプリをインストール</div>
                <p class="text-xs text-primary-100 mt-1">
                  ホーム画面に追加すると、会場のオフライン環境でもネット接続なしで購入チェックできます
                </p>
              </div>
              <button class="text-primary-200 hover:text-white p-2" aria-label="閉じる" onClick={handleDismiss}><X size={18} /></button>
            </div>
            <div class="flex gap-2 mt-3">
              <button
                class="flex-1 py-2 rounded-lg text-sm font-bold bg-white text-primary-700 hover:bg-primary-50 transition-colors"
                onClick={handleInstall}
              >
                インストール
              </button>
              <button
                class="px-4 py-2 rounded-lg text-sm text-primary-200 hover:text-white transition-colors"
                onClick={handleDismiss}
              >
                あとで
              </button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
}
