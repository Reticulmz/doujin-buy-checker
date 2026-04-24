import { createSignal, createMemo, For, Show } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type BuyListItem } from "~/db/schema";
import { updateCircle, deleteCircle } from "~/db/repositories/circles";
import { createItem, updateItem, togglePurchased, deleteItem } from "~/db/repositories/buyListItems";
import { validateSpace, normalizeSpace, inferM3Hall, EVENT_PRESETS } from "~/services/eventPresets";

export default function CircleDetailPage() {
  const params = useParams();
  const navigate = useNavigate();

  const event = useLiveQuery(() => db.events.get(params.eventId));
  const circle = useLiveQuery(() => db.circles.get(params.circleId));
  const items = useLiveQuery(() =>
    db.buyListItems.where("circleId").equals(params.circleId).toArray()
  );

  const eventType = () => event()?.eventType ?? "custom";
  const preset = () => EVENT_PRESETS[eventType()];

  const [editing, setEditing] = createSignal(false);
  const [showAddItem, setShowAddItem] = createSignal(false);

  // Circle edit fields
  const [name, setName] = createSignal("");
  const [author, setAuthor] = createSignal("");
  const [spaceNumber, setSpaceNumber] = createSignal("");
  const [hall, setHall] = createSignal("");
  const [genre, setGenre] = createSignal("");
  const [url, setUrl] = createSignal("");
  const [twitterUrl, setTwitterUrl] = createSignal("");
  const [description, setDescription] = createSignal("");

  // Item add fields
  const [itemName, setItemName] = createSignal("新刊");
  const [itemPrice, setItemPrice] = createSignal(1000);
  const [itemQuantity, setItemQuantity] = createSignal(1);
  const [itemPriority, setItemPriority] = createSignal<1 | 2 | 3>(1);
  const [itemNote, setItemNote] = createSignal("");

  const startEdit = () => {
    const c = circle();
    if (!c) return;
    setName(c.name);
    setAuthor(c.author);
    setSpaceNumber(c.spaceNumber);
    setHall(c.hall);
    setGenre(c.genre);
    setUrl(c.url);
    setTwitterUrl(c.twitterUrl);
    setDescription(c.description);
    setEditing(true);
  };

  const saveEdit = async () => {
    await updateCircle(params.circleId, {
      name: name().trim(),
      author: author().trim(),
      spaceNumber: spaceNumber().trim(),
      hall: hall().trim(),
      genre: genre().trim(),
      url: url().trim(),
      twitterUrl: twitterUrl().trim(),
      description: description().trim(),
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    if (confirm("このサークルを削除しますか？")) {
      await deleteCircle(params.circleId);
      navigate(`/event/${params.eventId}`, { replace: true });
    }
  };

  const handleAddItem = async (e: SubmitEvent) => {
    e.preventDefault();
    await createItem({
      eventId: params.eventId,
      circleId: params.circleId,
      itemName: itemName().trim(),
      price: itemPrice(),
      quantity: itemQuantity(),
      priority: itemPriority(),
      note: itemNote().trim(),
    });
    setItemName("新刊");
    setItemPrice(1000);
    setItemQuantity(1);
    setItemPriority(1);
    setItemNote("");
    setShowAddItem(false);
  };

  const handleDeleteItem = async (id: string) => {
    await deleteItem(id);
  };

  const priorityOptions = [
    { value: 1, label: "必須" },
    { value: 2, label: "欲しい" },
    { value: 3, label: "余裕があれば" },
  ];

  return (
    <div class="max-w-lg mx-auto">
      <Show when={circle()} fallback={<div class="p-4 text-center">読み込み中...</div>}>
        {(c) => (
          <>
            {/* Header */}
            <div class="px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-2">
                <A href={`/event/${params.eventId}`} class="text-gray-500 touch-target">
                  ←
                </A>
                <h1 class="text-lg font-bold truncate flex-1">{c().name}</h1>
                <button class="text-sm text-primary-600" onClick={startEdit}>
                  編集
                </button>
              </div>
              <div class="flex items-center gap-3 ml-10 text-sm text-gray-500">
                <Show when={c().spaceNumber}>
                  <span>📍 {c().spaceNumber}</span>
                </Show>
                <Show when={c().twitterUrl}>
                  <a
                    href={c().twitterUrl.startsWith("@") ? `https://x.com/${c().twitterUrl.slice(1)}` : c().twitterUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    {c().twitterUrl.startsWith("@") ? c().twitterUrl : "X"}
                  </a>
                </Show>
              </div>
            </div>

            {/* Edit form */}
            <Show when={editing()}>
              <div class="p-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 space-y-3">
                <div>
                  <label class="block text-sm font-medium mb-1">サークル名 *</label>
                  <input type="text" class="input-field" value={name()} onInput={(e) => setName(e.currentTarget.value)} />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">代表者名</label>
                  <input type="text" class="input-field" value={author()} onInput={(e) => setAuthor(e.currentTarget.value)} />
                </div>
                <div class="grid grid-cols-2 gap-2">
                  <div>
                    <label class="block text-sm font-medium mb-1">スペース番号</label>
                    <input
                      type="text"
                      class="input-field"
                      classList={{ "!border-red-400 !ring-red-400": !validateSpace(eventType(), spaceNumber()).valid }}
                      value={spaceNumber()}
                      onInput={(e) => {
                        setSpaceNumber(e.currentTarget.value);
                        if (eventType() === "m3") {
                          setHall(inferM3Hall(e.currentTarget.value));
                        }
                      }}
                      placeholder={preset().spacePlaceholder}
                    />
                    {(() => {
                      const result = validateSpace(eventType(), spaceNumber());
                      return !result.valid ? <p class="text-xs text-red-500 mt-1">{result.message}</p> : null;
                    })()}
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">ホール</label>
                    <Show when={eventType() === "m3"}>
                      <select class="input-field" value={hall()} onChange={(e) => setHall(e.currentTarget.value)}>
                        <option value="">自動判定</option>
                        {preset().halls.map((h) => <option value={h}>{h}</option>)}
                      </select>
                    </Show>
                    <Show when={eventType() !== "m3"}>
                      <input type="text" class="input-field" value={hall()} onInput={(e) => setHall(e.currentTarget.value)} />
                    </Show>
                  </div>
                </div>
                <Show when={eventType() === "m3"}>
                  <p class="text-xs text-gray-400">{preset().spaceHint}</p>
                </Show>
                <div>
                  <label class="block text-sm font-medium mb-1">ジャンル</label>
                  <input type="text" class="input-field" value={genre()} onInput={(e) => setGenre(e.currentTarget.value)} />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">URL</label>
                  <input type="url" class="input-field" value={url()} onInput={(e) => setUrl(e.currentTarget.value)} />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Twitter / X</label>
                  <input type="text" class="input-field" value={twitterUrl()} onInput={(e) => setTwitterUrl(e.currentTarget.value)} placeholder="@username or URL" />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">メモ</label>
                  <textarea class="input-field" rows={2} value={description()} onInput={(e) => setDescription(e.currentTarget.value)} />
                </div>
                <div class="flex gap-2">
                  <button class="btn-primary flex-1" onClick={saveEdit}>保存</button>
                  <button class="btn-secondary" onClick={() => setEditing(false)}>キャンセル</button>
                  <button class="btn-danger" onClick={handleDelete}>削除</button>
                </div>
              </div>
            </Show>

            {/* Items list */}
            <div class="p-4">
              <div class="flex items-center justify-between mb-3">
                <h2 class="font-bold">購入予定品</h2>
                <button class="btn-primary text-sm" onClick={() => setShowAddItem(!showAddItem())}>
                  {showAddItem() ? "閉じる" : "+ 追加"}
                </button>
              </div>

              <Show when={showAddItem()}>
                <form onSubmit={handleAddItem} class="card mb-4 space-y-3">
                  <div>
                    <label class="block text-sm font-medium mb-1">品名 *</label>
                    <input type="text" class="input-field" value={itemName()} onInput={(e) => setItemName(e.currentTarget.value)} required />
                  </div>
                  <div class="grid grid-cols-3 gap-2">
                    <div>
                      <label class="block text-sm font-medium mb-1">価格</label>
                      <input type="number" class="input-field" value={itemPrice()} onInput={(e) => setItemPrice(Number(e.currentTarget.value))} min="0" step="100" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">数量</label>
                      <input type="number" class="input-field" value={itemQuantity()} onInput={(e) => setItemQuantity(Number(e.currentTarget.value))} min="1" />
                    </div>
                    <div>
                      <label class="block text-sm font-medium mb-1">優先度</label>
                      <select class="input-field" value={itemPriority()} onChange={(e) => setItemPriority(Number(e.currentTarget.value) as 1 | 2 | 3)}>
                        {priorityOptions.map((o) => (
                          <option value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  </div>
                  <div>
                    <label class="block text-sm font-medium mb-1">メモ</label>
                    <input type="text" class="input-field" value={itemNote()} onInput={(e) => setItemNote(e.currentTarget.value)} />
                  </div>
                  <button type="submit" class="btn-primary w-full">追加</button>
                </form>
              </Show>

              <div class="space-y-2">
                <For each={items()}>
                  {(item) => (
                    <div
                      class="card !p-0 flex items-stretch overflow-hidden"
                      classList={{ "opacity-60": item.purchased }}
                    >
                      <button
                        class="w-12 shrink-0 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 touch-target"
                        classList={{
                          "bg-green-50 dark:bg-green-900/30": item.purchased,
                        }}
                        onClick={() => togglePurchased(item.id, !item.purchased)}
                      >
                        <span class="text-xl">{item.purchased ? "✅" : "⬜"}</span>
                      </button>
                      <div class="flex-1 p-3 min-w-0">
                        <div class="flex items-center gap-2">
                          <span class="font-medium truncate">{item.itemName}</span>
                          <PriorityBadge priority={item.priority} />
                        </div>
                        <div class="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                          ¥{item.price.toLocaleString()} × {item.quantity} = ¥
                          {(item.price * item.quantity).toLocaleString()}
                          <Show when={item.note}>
                            <span class="ml-2">📝 {item.note}</span>
                          </Show>
                        </div>
                      </div>
                      <button
                        class="px-3 text-gray-400 hover:text-red-500 touch-target"
                        onClick={() => handleDeleteItem(item.id)}
                      >
                        ✕
                      </button>
                    </div>
                  )}
                </For>
              </div>

              <Show when={items()?.length === 0 && !showAddItem()}>
                <div class="text-center text-gray-500 dark:text-gray-400 py-6">
                  <p class="text-sm">購入予定品がありません</p>
                </div>
              </Show>
            </div>
          </>
        )}
      </Show>
    </div>
  );
}

function PriorityBadge(props: { priority: 1 | 2 | 3 }) {
  const cls = () => {
    switch (props.priority) {
      case 1: return "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300";
      case 2: return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300";
      case 3: return "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300";
    }
  };
  const label = () => ({ 1: "必須", 2: "欲しい", 3: "余裕" }[props.priority]);

  return <span class={`text-xs px-1.5 py-0.5 rounded-full ${cls()}`}>{label()}</span>;
}
