import { createSignal, onMount, Show } from "solid-js";

export function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = createSignal<any>(null);
  const [show, setShow] = createSignal(false);
  const [installed, setInstalled] = createSignal(false);

  onMount(() => {
    if (localStorage.getItem("pwa-install-dismissed")) return;
    if (window.matchMedia("(display-mode: standalone)").matches) return;

    window.addEventListener("beforeinstallprompt", (e) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShow(true);
    });

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setTimeout(() => setShow(false), 3000);
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
              <button class="text-primary-200 hover:text-white p-1" onClick={handleDismiss}>✕</button>
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
