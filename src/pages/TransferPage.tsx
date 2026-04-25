import { createSignal, For, Show } from "solid-js";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db } from "~/db/schema";

async function apiShare(data: string): Promise<{ code: string; expiresAt: string }> {
  const res = await fetch("/api/share", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }
  return res.json();
}

async function apiGet(code: string): Promise<string> {
  const res = await fetch(`/api/share/${code}`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error((err as any).error || `HTTP ${res.status}`);
  }
  const json = await res.json() as { data: string };
  return json.data;
}

export default function TransferPage() {
  const events = useLiveQuery(() => db.events.orderBy("date").reverse().toArray());
  const [mode, setMode] = createSignal<"send" | "receive">("send");
  const [selectedEventId, setSelectedEventId] = createSignal("");
  const [transferCode, setTransferCode] = createSignal("");
  const [status, setStatus] = createSignal("");
  const [receiveCode, setReceiveCode] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [receiving, setReceiving] = createSignal(false);

  const handleSend = async () => {
    const eventId = selectedEventId();
    if (!eventId) return;

    setSending(true);
    setStatus("データを準備中...");
    try {
      const event = await db.events.get(eventId);
      const circles = await db.circles.where("eventId").equals(eventId).toArray();
      const items = await db.buyListItems.where("eventId").equals(eventId).toArray();

      const payload = { event, circles, items };
      const encoded = btoa(new TextEncoder().encode(JSON.stringify(payload)).reduce((s, b) => s + String.fromCharCode(b), ""));

      try {
        // API経由で転送
        const result = await apiShare(encoded);
        setTransferCode(result.code);
        setStatus(`転送コードが生成されました（有効期限: 24時間）`);
      } catch {
        // APIが使えない場合はlocalStorage fallback
        const code = Math.random().toString(36).substring(2, 8).toUpperCase();
        localStorage.setItem(`transfer_${code}`, encoded);
        setTransferCode(code);
        setStatus("転送コードが生成されました（ローカルモード: 同一デバイスのみ）");
      }
    } catch (err) {
      setStatus(`エラー: ${String(err)}`);
    } finally {
      setSending(false);
    }
  };

  const handleReceive = async () => {
    const code = receiveCode().toUpperCase().trim();
    if (!code) return;

    setReceiving(true);
    setStatus("データを取得中...");
    try {
      let encoded: string | null = null;

      try {
        // API経由で取得
        encoded = await apiGet(code);
      } catch {
        // APIが使えない場合はlocalStorage fallback
        encoded = localStorage.getItem(`transfer_${code}`);
      }

      if (!encoded) {
        setStatus("コードが見つかりません。有効期限が切れたか、無効なコードです。");
        return;
      }

      let payload: any;
      try {
        const binary = atob(encoded);
        const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
        const json = new TextDecoder().decode(bytes);
        payload = JSON.parse(json);
      } catch {
        setStatus("データの復号に失敗しました。コードが正しいか確認してください。");
        return;
      }

      await db.transaction("rw", [db.events, db.circles, db.buyListItems], async () => {
        if (payload.event) await db.events.put(payload.event);
        if (payload.circles?.length) await db.circles.bulkPut(payload.circles);
        if (payload.items?.length) await db.buyListItems.bulkPut(payload.items);
      });

      setStatus(`取り込み完了！イベント「${payload.event?.name}」のデータを復元しました。`);
      localStorage.removeItem(`transfer_${code}`);
    } catch (err) {
      setStatus(`エラー: ${String(err)}`);
    } finally {
      setReceiving(false);
    }
  };

  return (
    <div class="p-4 max-w-lg mx-auto">
      <h1 class="text-xl font-bold mb-4">データ転送</h1>

      {/* Mode tabs */}
      <div class="flex gap-2 p-1 rounded-2xl bg-gray-100 dark:bg-gray-800 mb-4">
        <button
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          classList={{
            "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm": mode() === "send",
            "text-gray-500 dark:text-gray-400": mode() !== "send",
          }}
          onClick={() => { setMode("send"); setStatus(""); }}
        >
          送信（PC）
        </button>
        <button
          class="flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all"
          classList={{
            "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm": mode() === "receive",
            "text-gray-500 dark:text-gray-400": mode() !== "receive",
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
            disabled={!selectedEventId() || sending()}
          >
            {sending() ? "生成中..." : "転送コードを生成"}
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
            disabled={receiveCode().trim().length < 4 || receiving()}
          >
            {receiving() ? "受信中..." : "受信"}
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
