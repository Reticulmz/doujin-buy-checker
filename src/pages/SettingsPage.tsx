import { createSignal, onMount } from "solid-js";
import { db } from "~/db/schema";

export default function SettingsPage() {
  const [theme, setTheme] = createSignal<"light" | "dark" | "system">("system");
  const [exportStatus, setExportStatus] = createSignal("");

  onMount(() => {
    const saved = localStorage.getItem("theme") as "light" | "dark" | "system" | null;
    if (saved) setTheme(saved);
  });

  const applyTheme = (t: "light" | "dark" | "system") => {
    setTheme(t);
    localStorage.setItem("theme", t);
    const isDark =
      t === "dark" || (t === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.classList.toggle("dark", isDark);
  };

  const handleExport = async () => {
    try {
      const events = await db.events.toArray();
      const circles = await db.circles.toArray();
      const items = await db.buyListItems.toArray();
      const subs = await db.catalogSubscriptions.toArray();

      const data = { version: 1, exportedAt: new Date().toISOString(), events, circles, buyListItems: items, catalogSubscriptions: subs };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `doujin-buy-checker-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      setExportStatus("エクスポート完了");
    } catch (err) {
      setExportStatus(`エラー: ${String(err)}`);
    }
  };

  const handleImport = async () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        await db.transaction("rw", [db.events, db.circles, db.buyListItems, db.catalogSubscriptions], async () => {
          if (data.events) await db.events.bulkPut(data.events);
          if (data.circles) await db.circles.bulkPut(data.circles);
          if (data.buyListItems) await db.buyListItems.bulkPut(data.buyListItems);
          if (data.catalogSubscriptions) await db.catalogSubscriptions.bulkPut(data.catalogSubscriptions);
        });
        setExportStatus("インポート完了");
      } catch (err) {
        setExportStatus(`エラー: ${String(err)}`);
      }
    };
    input.click();
  };

  const handleClearAll = async () => {
    if (confirm("すべてのデータを削除しますか？この操作は取り消せません。")) {
      await db.transaction("rw", [db.events, db.circles, db.buyListItems, db.catalogSubscriptions], async () => {
        await db.events.clear();
        await db.circles.clear();
        await db.buyListItems.clear();
        await db.catalogSubscriptions.clear();
      });
      setExportStatus("全データを削除しました");
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">設定</h1>

      <div class="space-y-4">
        {/* Theme */}
        <div class="card">
          <h2 class="font-bold mb-2">テーマ</h2>
          <div class="flex gap-2">
            {(["light", "dark", "system"] as const).map((t) => (
              <button
                class="flex-1 py-2 rounded-lg text-sm font-medium transition-colors"
                classList={{
                  "bg-primary-600 text-white": theme() === t,
                  "bg-gray-100 dark:bg-gray-700": theme() !== t,
                }}
                onClick={() => applyTheme(t)}
              >
                {t === "light" ? "ライト" : t === "dark" ? "ダーク" : "システム"}
              </button>
            ))}
          </div>
        </div>

        {/* Data management */}
        <div class="card space-y-3">
          <h2 class="font-bold">データ管理</h2>
          <button class="btn-secondary w-full text-sm" onClick={handleExport}>
            JSONエクスポート
          </button>
          <button class="btn-secondary w-full text-sm" onClick={handleImport}>
            JSONインポート
          </button>
          <button class="btn-danger w-full text-sm" onClick={handleClearAll}>
            全データ削除
          </button>
          {exportStatus() && (
            <div class="text-sm text-gray-500">{exportStatus()}</div>
          )}
        </div>

        {/* About */}
        <div class="card">
          <h2 class="font-bold mb-2">このアプリについて</h2>
          <p class="text-sm text-gray-500">
            同人即売会 購入チェッカー v1.0.0
          </p>
          <p class="text-sm text-gray-500 mt-1">
            オフラインファーストのPWAです。会場でネットワーク接続なしで動作します。
          </p>
        </div>
      </div>
    </div>
  );
}
