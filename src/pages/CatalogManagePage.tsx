import { createSignal, For, Show } from "solid-js";
import { A, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type StoredCatalog } from "~/db/schema";
import { ulid } from "ulidx";
import { Pencil, RefreshCw, Trash2 } from "~/components/icons";
import { confirm } from "~/components/ConfirmDialog";

export default function CatalogManagePage() {
  const navigate = useNavigate();
  const catalogs = useLiveQuery(() => db.storedCatalogs.orderBy("updatedAt").reverse().toArray());
  const [importing, setImporting] = createSignal(false);
  const [urlInput, setUrlInput] = createSignal("");
  const [showUrlForm, setShowUrlForm] = createSignal(false);

  const importFromFile = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        await saveCatalog(text, null);
      } catch {
        alert("JSONの読み込みに失敗しました");
      }
    };
    input.click();
  };

  const importFromUrl = async () => {
    const url = urlInput().trim();
    if (!url) return;
    setImporting(true);
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      await saveCatalog(text, url);
      setUrlInput("");
      setShowUrlForm(false);
    } catch (err) {
      alert(`取得エラー: ${String(err)}`);
    } finally {
      setImporting(false);
    }
  };

  const saveCatalog = async (jsonText: string, sourceUrl: string | null) => {
    const data = JSON.parse(jsonText);
    if (!data.circles || !Array.isArray(data.circles)) {
      throw new Error("カタログJSON形式が不正です");
    }
    const now = new Date().toISOString();
    const catalog: StoredCatalog = {
      id: ulid(),
      name: data.catalog?.name ?? data.event?.name ?? "無題",
      eventName: data.event?.name ?? "",
      eventDate: data.event?.date ?? "",
      eventVenue: data.event?.venue ?? "",
      eventType: data.event?.venue?.includes("流通センター") ? "m3" as const : "custom" as const,
      circleCount: data.circles.length,
      data: jsonText,
      isDraft: false,
      sourceUrl,
      createdAt: now,
      updatedAt: now,
    };
    await db.storedCatalogs.add(catalog);
  };

  const deleteCatalog = async (id: string) => {
    const ok = await confirm({
      title: "カタログを削除",
      description: "このカタログを削除しますか？",
      confirmLabel: "削除",
      variant: "danger",
    });
    if (ok) await db.storedCatalogs.delete(id);
  };

  const refreshFromUrl = async (catalog: StoredCatalog) => {
    if (!catalog.sourceUrl) return;
    try {
      const res = await fetch(catalog.sourceUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const data = JSON.parse(text);
      await db.storedCatalogs.update(catalog.id, {
        name: data.catalog?.name ?? data.event?.name ?? catalog.name,
        eventName: data.event?.name ?? catalog.eventName,
        eventDate: data.event?.date ?? catalog.eventDate,
        eventVenue: data.event?.venue ?? catalog.eventVenue,
        circleCount: data.circles?.length ?? catalog.circleCount,
        data: text,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      alert(`更新エラー: ${String(err)}`);
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">カタログ</h1>

      {/* Import actions */}
      <div class="flex gap-2 mb-4">
        <button class="btn-primary flex-1 text-sm" onClick={importFromFile}>
          JSONから追加
        </button>
        <button class="btn-secondary flex-1 text-sm" onClick={() => setShowUrlForm(!showUrlForm())}>
          {showUrlForm() ? "閉じる" : "URLから追加"}
        </button>
      </div>

      <Show when={showUrlForm()}>
        <div class="card mb-4 space-y-2">
          <input
            type="url"
            class="input-field text-sm"
            placeholder="https://example.com/catalog.json"
            value={urlInput()}
            onInput={(e) => setUrlInput(e.currentTarget.value)}
          />
          <button
            class="btn-primary w-full text-sm"
            onClick={importFromUrl}
            disabled={!urlInput().trim() || importing()}
          >
            {importing() ? "取得中..." : "取得して追加"}
          </button>
        </div>
      </Show>

      {/* Stored catalogs */}
      <Show when={catalogs() && catalogs()!.length > 0}>
        <h2 class="font-bold text-sm mb-2 text-gray-500">保存済みカタログ</h2>
        <div class="space-y-2 mb-6">
          <For each={catalogs()}>
            {(catalog) => (
              <div class="card !p-0 overflow-hidden">
                <div class="flex items-stretch">
                  <button
                    class="flex-1 p-3 text-left min-w-0 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                    onClick={() => navigate(`/catalog-browse?id=${catalog.id}`)}
                  >
                    <div class="font-bold truncate">{catalog.name}</div>
                    <div class="text-xs text-gray-500 mt-1 space-y-0.5">
                      <div>{catalog.eventName} / {catalog.eventDate}</div>
                      <div>{catalog.circleCount} サークル</div>
                      <div class="text-gray-500">
                        更新: {new Date(catalog.updatedAt).toLocaleString("ja-JP")}
                      </div>
                    </div>
                  </button>
                  <div class="flex flex-col border-l border-gray-200 dark:border-gray-700">
                    <button
                      class="flex-1 px-4 min-h-11 text-sm text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                      onClick={() => navigate(`/catalog-editor?id=${catalog.id}`)}
                      title="編集"
                    >
                      <Pencil size={16} />
                    </button>
                    <Show when={catalog.sourceUrl}>
                      <button
                        class="flex-1 px-4 min-h-11 text-sm text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-t border-gray-200 dark:border-gray-700"
                        onClick={() => refreshFromUrl(catalog)}
                        title="URLから更新"
                      >
                        <RefreshCw size={16} />
                      </button>
                    </Show>
                    <button
                      class="flex-1 px-4 min-h-11 text-sm text-gray-500 hover:text-red-500 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors border-t border-gray-200 dark:border-gray-700"
                      onClick={() => deleteCatalog(catalog.id)}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>

      {/* Editor link */}
      <A href="/catalog-editor" class="block text-center text-sm text-primary-600 dark:text-primary-400 hover:underline mt-4">
        カタログを新規作成する →
      </A>

      <Show when={(!catalogs() || catalogs()!.length === 0) && !showUrlForm()}>
        <div class="text-center text-gray-500 py-8 mt-4">
          <p>保存済みカタログはありません</p>
          <p class="text-sm mt-1">JSONファイルやURLからカタログを追加しましょう</p>
        </div>
      </Show>
    </div>
  );
}
