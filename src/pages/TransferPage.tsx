import { createSignal, For, Show } from "solid-js";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db } from "~/db/schema";

export default function TransferPage() {
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray());
  const [mode, setMode] = createSignal<"send" | "receive">("send");
  const [selectedEventId, setSelectedEventId] = createSignal("");
  const [transferCode, setTransferCode] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [receiveCode, setReceiveCode] = createSignal("");

  const handleSend = async () => {
    const eventId = selectedEventId();
    if (!eventId) return;

    setStatus("データを準備中...");
    try {
      const event = await db.events.get(eventId);
      const circles = await db.circles.where("eventId").equals(eventId).toArray();
      const items = await db.buyListItems.where("eventId").equals(eventId).toArray();

      const payload = { event, circles, items };
      const json = JSON.stringify(payload);

      // For now, use a simple base64 approach for local transfer
      // TODO: integrate CF Workers when available
      const encoded = btoa(unescape(encodeURIComponent(json)));

      // Generate a short code (simulated)
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();

      // Store in localStorage temporarily
      localStorage.setItem(`transfer_${code}`, encoded);

      setTransferCode(code);
      setStatus("転送コードが生成されました");
    } catch (err) {
      setStatus(`エラー: ${String(err)}`);
    }
  };

  const handleReceive = async () => {
    const code = receiveCode().toUpperCase().trim();
    if (!code) return;

    setStatus("データを取得中...");
    try {
      // Check localStorage first (same device transfer)
      const encoded = localStorage.getItem(`transfer_${code}`);
      if (!encoded) {
        setStatus("コードが見つかりません。有効期限が切れたか、無効なコードです。");
        return;
      }

      const json = decodeURIComponent(escape(atob(encoded)));
      const payload = JSON.parse(json);

      // Import data
      await db.transaction("rw", [db.events, db.circles, db.buyListItems], async () => {
        if (payload.event) {
          await db.events.put(payload.event);
        }
        if (payload.circles?.length) {
          await db.circles.bulkPut(payload.circles);
        }
        if (payload.items?.length) {
          await db.buyListItems.bulkPut(payload.items);
        }
      });

      setStatus(`取り込み完了！イベント「${payload.event?.name}」のデータを復元しました。`);
      localStorage.removeItem(`transfer_${code}`);
    } catch (err) {
      setStatus(`エラー: ${String(err)}`);
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">データ転送</h1>

      {/* Mode tabs */}
      <div class="flex rounded-lg overflow-hidden border border-gray-200 dark:border-gray-700 mb-4">
        <button
          class="flex-1 py-2 text-sm font-medium transition-colors"
          classList={{
            "bg-primary-600 text-white": mode() === "send",
            "bg-white dark:bg-gray-800": mode() !== "send",
          }}
          onClick={() => { setMode("send"); setStatus(""); }}
        >
          送信（PC）
        </button>
        <button
          class="flex-1 py-2 text-sm font-medium transition-colors"
          classList={{
            "bg-primary-600 text-white": mode() === "receive",
            "bg-white dark:bg-gray-800": mode() !== "receive",
          }}
          onClick={() => { setMode("receive"); setStatus(""); }}
        >
          受信（スマホ）
        </button>
      </div>

      <Show when={mode() === "send"}>
        <div class="card space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">転送するイベント</label>
            <select
              class="input-field"
              value={selectedEventId()}
              onChange={(e) => setSelectedEventId(e.currentTarget.value)}
            >
              <option value="">選択してください</option>
              <For each={events()}>
                {(ev) => <option value={ev.id}>{ev.name} ({ev.date})</option>}
              </For>
            </select>
          </div>
          <button
            class="btn-primary w-full"
            onClick={handleSend}
            disabled={!selectedEventId()}
          >
            転送コードを生成
          </button>

          <Show when={transferCode()}>
            <div class="text-center p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
              <div class="text-sm text-gray-500 mb-2">転送コード</div>
              <div class="text-3xl font-mono font-bold tracking-wider text-primary-600">
                {transferCode()}
              </div>
              <div class="text-xs text-gray-500 mt-2">
                受信側でこのコードを入力してください
              </div>
            </div>
          </Show>
        </div>
      </Show>

      <Show when={mode() === "receive"}>
        <div class="card space-y-3">
          <div>
            <label class="block text-sm font-medium mb-1">転送コード</label>
            <input
              type="text"
              class="input-field text-center font-mono text-lg tracking-wider uppercase"
              maxLength={6}
              placeholder="A3F8K2"
              value={receiveCode()}
              onInput={(e) => setReceiveCode(e.currentTarget.value)}
            />
          </div>
          <button
            class="btn-primary w-full"
            onClick={handleReceive}
            disabled={receiveCode().trim().length < 4}
          >
            受信
          </button>
        </div>
      </Show>

      <Show when={status()}>
        <div class="mt-4 p-3 rounded-lg bg-gray-100 dark:bg-gray-800 text-sm">
          {status()}
        </div>
      </Show>
    </div>
  );
}
