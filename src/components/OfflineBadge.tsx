import { createSignal, onMount, onCleanup, Show } from "solid-js";

export function OfflineBadge() {
  const [offline, setOffline] = createSignal(!navigator.onLine);

  onMount(() => {
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    onCleanup(() => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    });
  });

  return (
    <Show when={offline()}>
      <div class="bg-warning-muted text-warning-emphasis dark:bg-warning-dark-muted dark:text-warning-dark-text text-xs text-center py-1 px-2 font-medium">
        オフライン — ローカルデータで動作中
      </div>
    </Show>
  );
}
