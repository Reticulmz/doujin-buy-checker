import { createSignal, For, Show } from "solid-js";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type CatalogSubscription } from "~/db/schema";
import { createEvent } from "~/db/repositories/events";
import { ulid } from "ulidx";
import { parseCatalogJson, importCatalogToEvent, type ImportResult } from "~/services/catalogImporter";

export default function CatalogManagePage() {
  const subscriptions = useLiveQuery(() => db.catalogSubscriptions.toArray());
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray());

  const [showAdd, setShowAdd] = createSignal(false);
  const [newUrl, setNewUrl] = createSignal("");
  const [newName, setNewName] = createSignal("");
  const [importStatus, setImportStatus] = createSignal("");
  const [importResult, setImportResult] = createSignal<ImportResult | null>(null);

  const handleAdd = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!newUrl().trim()) return;
    const sub: CatalogSubscription = {
      id: ulid(),
      url: newUrl().trim(),
      name: newName().trim() || newUrl().trim(),
      lastFetchedAt: null,
      lastHash: null,
      status: "ok",
      errorMessage: null,
      createdAt: new Date().toISOString(),
    };
    await db.catalogSubscriptions.add(sub);
    setNewUrl("");
    setNewName("");
    setShowAdd(false);
  };

  const handleDelete = async (id: string) => {
    if (confirm("このカタログを削除しますか？")) {
      await db.catalogSubscriptions.delete(id);
    }
  };

  const handleFetch = async (sub: CatalogSubscription) => {
    await db.catalogSubscriptions.update(sub.id, { status: "fetching" });
    try {
      const res = await fetch(sub.url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      const catalog = parseCatalogJson(text);
      await db.catalogSubscriptions.update(sub.id, {
        status: "ok",
        lastFetchedAt: new Date().toISOString(),
        errorMessage: null,
      });
      await promptImport(catalog, sub.id);
    } catch (err) {
      await db.catalogSubscriptions.update(sub.id, {
        status: "error",
        errorMessage: String(err),
      });
      setImportStatus(`エラー: ${String(err)}`);
    }
  };

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const catalog = parseCatalogJson(text);
        await promptImport(catalog, null);
      } catch (err) {
        setImportStatus(`エラー: ${String(err)}`);
        setImportResult(null);
      }
    };
    input.click();
  };

  const promptImport = async (catalog: ReturnType<typeof parseCatalogJson> extends infer T ? T : never, sourceId: string | null) => {
    const evts = events() ?? [];

    // If matching event exists by name, use it; otherwise create new
    let eventId: string;
    const match = evts.find(
      (e) => e.name === catalog.event.name || e.date === catalog.event.date,
    );

    if (match) {
      const use = confirm(
        `既存イベント「${match.name}」(${match.date}) に取り込みますか？\nキャンセルで新規イベント作成`,
      );
      if (use) {
        eventId = match.id;
      } else {
        const ev = await createEvent({
          name: catalog.event.name,
          date: catalog.event.date,
          venue: catalog.event.venue ?? "",
          budget: 0,
          eventType: "custom",
        });
        eventId = ev.id;
      }
    } else {
      const ev = await createEvent({
        name: catalog.event.name,
        date: catalog.event.date,
        venue: catalog.event.venue ?? "",
        budget: 0,
      });
      eventId = ev.id;
    }

    const result = await importCatalogToEvent(catalog, eventId, sourceId ?? `file-${ulid()}`);
    setImportResult(result);
    setImportStatus("");
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <div class="flex items-center justify-between mb-4">
        <h1 class="text-xl font-bold">カタログ管理</h1>
        <button class="btn-primary text-sm" onClick={() => setShowAdd(!showAdd())}>
          {showAdd() ? "キャンセル" : "+ URL追加"}
        </button>
      </div>

      {/* File upload */}
      <div class="card mb-4">
        <h2 class="font-bold mb-2">ファイルから取り込み</h2>
        <p class="text-sm text-gray-500 dark:text-gray-400 mb-3">
          カタログJSON（v1）をアップロードしてサークルを取り込みます
        </p>
        <button class="btn-primary w-full" onClick={handleFileUpload}>
          JSONファイルを選択
        </button>
      </div>

      {/* Import result */}
      <Show when={importResult()}>
        {(r) => (
          <div class="card mb-4 bg-green-50 dark:bg-green-900/20 border-green-300 dark:border-green-700">
            <div class="font-bold text-green-700 dark:text-green-300 mb-1">取り込み完了</div>
            <div class="text-sm space-y-0.5">
              <div>カタログ: {r().catalogName}</div>
              <div>イベント: {r().eventName} ({r().eventDate})</div>
              <div>サークル数: {r().totalCircles}（新規 {r().newCircles} / 更新 {r().updatedCircles}）</div>
            </div>
            <button
              class="text-xs text-gray-500 mt-2"
              onClick={() => setImportResult(null)}
            >
              閉じる
            </button>
          </div>
        )}
      </Show>

      <Show when={importStatus()}>
        <div class="card mb-4 bg-red-50 dark:bg-red-900/20 border-red-300 dark:border-red-700 text-sm text-red-700 dark:text-red-300">
          {importStatus()}
          <button class="text-xs text-gray-500 ml-2" onClick={() => setImportStatus("")}>
            閉じる
          </button>
        </div>
      </Show>

      {/* URL subscription form */}
      <Show when={showAdd()}>
        <form onSubmit={handleAdd} class="card mb-4 space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">フィードURL *</label>
            <input type="url" class="input-field" value={newUrl()} onInput={(e) => setNewUrl(e.currentTarget.value)} placeholder="https://..." required />
          </div>
          <div>
            <label class="block text-sm font-medium mb-1">表示名</label>
            <input type="text" class="input-field" value={newName()} onInput={(e) => setNewName(e.currentTarget.value)} />
          </div>
          <button type="submit" class="btn-primary w-full">登録</button>
        </form>
      </Show>

      {/* Subscription list */}
      <Show when={subscriptions() && subscriptions()!.length > 0}>
        <h2 class="font-bold mb-2 mt-4">URL購読</h2>
        <div class="space-y-3">
          <For each={subscriptions()}>
            {(sub) => (
              <div class="card">
                <div class="flex items-start justify-between">
                  <div class="min-w-0 flex-1">
                    <div class="font-bold truncate">{sub.name}</div>
                    <div class="text-xs text-gray-500 truncate">{sub.url}</div>
                    <div class="text-xs text-gray-500 mt-1">
                      <Show when={sub.lastFetchedAt} fallback="未取得">
                        最終取得: {new Date(sub.lastFetchedAt!).toLocaleString("ja-JP")}
                      </Show>
                      {" "}
                      <Show when={sub.status === "error"}>
                        <span class="text-red-500">エラー: {sub.errorMessage}</span>
                      </Show>
                    </div>
                  </div>
                  <div class="flex gap-1 ml-2">
                    <button
                      class="btn-secondary text-xs !px-2 !py-1"
                      onClick={() => handleFetch(sub)}
                      disabled={sub.status === "fetching"}
                    >
                      {sub.status === "fetching" ? "取得中..." : "取得"}
                    </button>
                    <button
                      class="text-gray-400 hover:text-red-500 p-1"
                      onClick={() => handleDelete(sub.id)}
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </div>
            )}
          </For>
        </div>
      </Show>
    </div>
  );
}
