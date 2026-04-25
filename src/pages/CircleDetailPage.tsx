import { createSignal, createResource, For, Show } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type BuyListItem } from "~/db/schema";
import { updateCircle, deleteCircle } from "~/db/repositories/circles";
import { createItem, updateItem, togglePurchased, deleteItem } from "~/db/repositories/buyListItems";
import { validateSpace, inferM3Hall, EVENT_PRESETS } from "~/services/eventPresets";
import { QuickAddItemForm, ITEM_TYPES } from "~/components/QuickAddItemForm";
import { confirm } from "~/components/ConfirmDialog";
import { showToast } from "~/components/Toast";
import { ArrowLeft, MapPin, Pencil, SquareCheckBig, Square, StickyNote, X } from "~/components/icons";
import { ListSkeleton } from "~/components/Skeleton";
import { ItemTypeBadge, NewBadge } from "~/components/ItemBadges";

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

  // Load catalog circle data for sync display
  const [catalogCircle] = createResource(
    () => ({ catalogId: circle()?.catalogSourceId, externalId: circle()?.externalId }),
    async ({ catalogId, externalId }) => {
      if (!catalogId || !externalId) return null;
      const stored = await db.storedCatalogs.get(catalogId);
      if (!stored) return null;
      try {
        const data = JSON.parse(stored.data);
        return (data.circles ?? []).find((c: any) => c.id === externalId) ?? null;
      } catch { return null; }
    }
  );

  const [editing, setEditing] = createSignal(false);
  const [showAddItem, setShowAddItem] = createSignal(false);

  // Circle edit fields
  const [name, setName] = createSignal("");
  const [author, setAuthor] = createSignal("");
  const [spaceNumber, setSpaceNumber] = createSignal("");
  const [hall, setHall] = createSignal("");
  const [genre, setGenre] = createSignal("");
  const [websiteUrl, setWebsiteUrl] = createSignal("");
  const [twitterUrl, setTwitterUrl] = createSignal("");
  const [description, setDescription] = createSignal("");

  // Item edit state
  const [editingItemId, setEditingItemId] = createSignal<string | null>(null);
  const [editItemName, setEditItemName] = createSignal("");
  const [editPrice, setEditPrice] = createSignal(0);
  const [editQuantity, setEditQuantity] = createSignal(1);
  const [editItemType, setEditItemType] = createSignal("");
  const [editIsNew, setEditIsNew] = createSignal(false);
  const [editRequestedBy, setEditRequestedBy] = createSignal("");
  const [editNote, setEditNote] = createSignal("");

  const startEditItem = (item: BuyListItem) => {
    setEditingItemId(item.id);
    setEditItemName(item.itemName);
    setEditPrice(item.price);
    setEditQuantity(item.quantity);
    setEditItemType(item.itemType);
    setEditIsNew(item.isNew);
    setEditRequestedBy(item.requestedBy);
    setEditNote(item.note);
  };

  const saveEditItem = async () => {
    const id = editingItemId();
    if (!id) return;
    await updateItem(id, {
      itemName: editItemName().trim(),
      price: editPrice(),
      quantity: editQuantity(),
      itemType: editItemType(),
      isNew: editIsNew(),
      requestedBy: editRequestedBy().trim(),
      note: editNote().trim(),
    });
    setEditingItemId(null);
  };

  // Item add fields managed by QuickAddItemForm

  const startEdit = () => {
    const c = circle();
    if (!c) return;
    setName(c.name);
    setAuthor(c.author);
    setSpaceNumber(c.spaceNumber);
    setHall(c.hall);
    setGenre(c.genre);
    setWebsiteUrl(c.websiteUrl);
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
      websiteUrl: websiteUrl().trim(),
      twitterUrl: twitterUrl().trim(),
      description: description().trim(),
    });
    setEditing(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "サークルを削除",
      description: "このサークルと関連する購入予定品をすべて削除しますか？",
      confirmLabel: "削除",
      variant: "danger",
    });
    if (ok) {
      await deleteCircle(params.circleId);
      navigate(`/event/${params.eventId}`, { replace: true });
    }
  };

  const handleAddItem = async (item: { itemName: string; price: number; itemType: string; isNew: boolean; priority: 1 | 2 | 3; requestedBy: string }) => {
    await createItem({
      eventId: params.eventId,
      circleId: params.circleId,
      itemName: item.itemName,
      itemType: item.itemType,
      isNew: item.isNew,
      price: item.price,
      quantity: 1,
      priority: item.priority,
      note: "",
      requestedBy: item.requestedBy,
    });
    setShowAddItem(false);
  };

  const handleDeleteItem = async (id: string, name: string) => {
    const ok = await confirm({
      title: "頒布物を削除",
      description: `「${name}」を削除しますか？`,
      confirmLabel: "削除",
      variant: "danger",
    });
    if (!ok) return;
    await deleteItem(id);
  };

  return (
    <div class="max-w-lg mx-auto">
      <Show when={circle()} fallback={<ListSkeleton />}>
        {(c) => (
          <>
            {/* Header */}
            <div class="sticky top-0 glass z-10 px-4 pt-3 pb-2">
              <div class="flex items-center gap-2">
                <A href={`/event/${params.eventId}`} class="text-gray-500 touch-target" aria-label="戻る">
                  <ArrowLeft size={20} />
                </A>
                <h1 class="text-lg font-bold truncate flex-1">{c().name}</h1>
                <button class="text-sm text-primary-600" onClick={startEdit}>
                  編集
                </button>
              </div>
              <div class="flex items-center gap-3 ml-10 text-sm text-gray-500">
                <Show when={c().spaceNumber}>
                  <span class="flex items-center gap-0.5"><MapPin size={14} /> {c().spaceNumber}</span>
                </Show>
                <Show when={c().websiteUrl}>
                  <a
                    href={c().websiteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Web
                  </a>
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

            {/* Catalog info */}
            <Show when={catalogCircle() && !editing()}>
              {(cat) => (
                <div class="px-4 py-3 border-b border-gray-200 dark:border-gray-700 bg-gray-50/50 dark:bg-gray-800/30 space-y-2">
                  <Show when={cat().description}>
                    <p class="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{cat().description}</p>
                  </Show>
                  <Show when={cat().items?.length > 0}>
                    <div>
                      <p class="text-xs font-medium text-gray-500 mb-1">カタログ頒布物（タップで追加）</p>
                      <div class="flex flex-wrap gap-1.5">
                        <For each={cat().items}>
                          {(item: any) => {
                            const isAdded = () => items()?.some((i) => i.itemName === item.name) ?? false;
                            return (
                              <button
                                class="text-xs px-2 py-0.5 rounded-full border transition-colors"
                                classList={{
                                  "bg-primary-100 dark:bg-primary-900/40 border-primary-300 dark:border-primary-700 text-primary-700 dark:text-primary-300": isAdded(),
                                  "bg-white dark:bg-gray-700 border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:border-primary-400 hover:text-primary-600": !isAdded(),
                                }}
                                onClick={async () => {
                                  if (isAdded()) return;
                                  await createItem({
                                    eventId: params.eventId,
                                    circleId: params.circleId,
                                    itemName: item.name,
                                    itemType: item.type ?? "",
                                    isNew: item.isNew ?? false,
                                    price: item.price ?? 0,
                                    quantity: 1,
                                    priority: 2,
                                    note: "",
                                  });
                                }}
                              >
                                <Show when={isAdded()}>
                                  <span class="mr-0.5">✓</span>
                                </Show>
                                {item.name}
                                <Show when={item.price}>
                                  <span class="opacity-60 ml-1">¥{item.price.toLocaleString()}</span>
                                </Show>
                              </button>
                            );
                          }}
                        </For>
                      </div>
                    </div>
                  </Show>
                  <Show when={cat().genre || cat().tags?.length > 0}>
                    <div class="flex flex-wrap gap-1">
                      <Show when={cat().genre}>
                        <span class="text-xs px-1.5 py-0.5 rounded bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300">{cat().genre}</span>
                      </Show>
                      <For each={(cat().tags ?? []).slice(1)}>
                        {(tag: string) => (
                          <span class="text-xs px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-400">{tag}</span>
                        )}
                      </For>
                    </div>
                  </Show>
                  <div class="text-xs text-gray-500">カタログから同期</div>
                </div>
              )}
            </Show>

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
                  <p class="text-xs text-gray-500">{preset().spaceHint}</p>
                </Show>
                <div>
                  <label class="block text-sm font-medium mb-1">ジャンル</label>
                  <input type="text" class="input-field" value={genre()} onInput={(e) => setGenre(e.currentTarget.value)} />
                </div>
                <div>
                  <label class="block text-sm font-medium mb-1">Webサイト</label>
                  <input type="url" class="input-field" value={websiteUrl()} onInput={(e) => setWebsiteUrl(e.currentTarget.value)} placeholder="https://..." />
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
                <div class="card mb-4">
                  <QuickAddItemForm
                    defaults={{ priority: 1 }}
                    onAdd={handleAddItem}
                    onClose={() => setShowAddItem(false)}
                  />
                </div>
              </Show>

              <div class="space-y-2">
                <For each={items()}>
                  {(item) => (
                    <Show when={editingItemId() === item.id} fallback={
                      <div
                        class="card !p-0 flex items-stretch overflow-hidden"
                        classList={{ "opacity-60": item.purchased }}
                      >
                        <button
                          class="w-12 shrink-0 flex items-center justify-center border-r border-gray-200 dark:border-gray-700 touch-target select-none active:scale-95"
                          classList={{
                            "bg-green-50 dark:bg-green-900/30": item.purchased,
                          }}
                          onClick={() => togglePurchased(item.id, !item.purchased)}
                        >
                          {item.purchased
                            ? <SquareCheckBig size={22} class="text-green-600 dark:text-green-400" />
                            : <Square size={22} class="text-gray-400 dark:text-gray-500" />
                          }
                        </button>
                        <div
                          class="flex-1 p-3 min-w-0 cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700/20 transition-colors"
                          onClick={() => startEditItem(item)}
                        >
                          <div class="flex items-center gap-2">
                            <span class="font-medium truncate">{item.itemName}</span>
                            <ItemTypeBadge type={item.itemType} />
                            <Show when={item.isNew}><NewBadge /></Show>
                            <PrioritySelect priority={item.priority} onChange={(p) => updateItem(item.id, { priority: p })} />
                            <Show when={item.requestedBy}>
                              <span class="text-xs px-1.5 py-0.5 rounded-full bg-errand-muted dark:bg-errand-dark-muted text-errand dark:text-errand-dark-text font-medium">{item.requestedBy}</span>
                            </Show>
                          </div>
                          <div class="text-sm text-gray-500 dark:text-gray-400 mt-0.5 tabular-nums">
                            ¥{item.price.toLocaleString()} × {item.quantity} = ¥
                            {(item.price * item.quantity).toLocaleString()}
                            <Show when={item.note}>
                              <span class="ml-2 inline-flex items-center gap-0.5"><StickyNote size={13} /> {item.note}</span>
                            </Show>
                          </div>
                        </div>
                        <button
                          class="px-3 text-gray-500 hover:text-red-500 touch-target"
                          aria-label="削除"
                          onClick={() => handleDeleteItem(item.id, item.itemName)}
                        >
                          <X size={18} />
                        </button>
                      </div>
                    }>
                      {/* Inline edit form */}
                      <div class="card space-y-2">
                        <div class="flex gap-2">
                          <input
                            type="text"
                            class="input-field flex-1 text-sm !py-1.5"
                            placeholder="品名"
                            value={editItemName()}
                            onInput={(e) => setEditItemName(e.currentTarget.value)}
                            autofocus
                          />
                          <div class="flex items-center gap-1">
                            <span class="text-xs text-gray-500">¥</span>
                            <input
                              type="number"
                              class="input-field !w-20 text-sm !py-1.5 tabular-nums text-right"
                              value={editPrice()}
                              onInput={(e) => setEditPrice(Number(e.currentTarget.value) || 0)}
                              min="0"
                              step="100"
                            />
                          </div>
                          <div class="flex items-center gap-1">
                            <span class="text-xs text-gray-500">×</span>
                            <input
                              type="number"
                              class="input-field !w-12 text-sm !py-1.5 tabular-nums text-center"
                              value={editQuantity()}
                              onInput={(e) => setEditQuantity(Number(e.currentTarget.value) || 1)}
                              min="1"
                            />
                          </div>
                        </div>
                        <div class="flex items-center gap-2 flex-wrap">
                          <select
                            class="input-field !py-1 text-xs !w-auto"
                            value={editItemType()}
                            onChange={(e) => setEditItemType(e.currentTarget.value)}
                            aria-label="種別"
                          >
                            {ITEM_TYPES.map((t) => <option value={t.value}>{t.label}</option>)}
                          </select>
                          <label class="flex items-center gap-1 text-xs cursor-pointer select-none">
                            <input
                              type="checkbox"
                              class="w-3.5 h-3.5 rounded border-gray-300 text-primary-600 focus:ring-primary-500 cursor-pointer"
                              checked={editIsNew()}
                              onChange={(e) => setEditIsNew(e.currentTarget.checked)}
                            />
                            <span class="text-danger font-bold">NEW</span>
                          </label>
                          <input
                            type="text"
                            class="input-field !py-1 text-xs !w-16"
                            placeholder="依頼者"
                            aria-label="依頼者"
                            value={editRequestedBy()}
                            onInput={(e) => setEditRequestedBy(e.currentTarget.value)}
                          />
                        </div>
                        <input
                          type="text"
                          class="input-field text-sm !py-1.5 w-full"
                          placeholder="メモ"
                          value={editNote()}
                          onInput={(e) => setEditNote(e.currentTarget.value)}
                        />
                        <div class="flex gap-2">
                          <button class="btn-primary text-xs !px-3 !py-1.5" onClick={saveEditItem}>保存</button>
                          <button class="text-xs text-gray-500 hover:text-gray-700 px-2 py-1" onClick={() => setEditingItemId(null)}>キャンセル</button>
                        </div>
                      </div>
                    </Show>
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

function priorityCls(p: 1 | 2 | 3) {
  return { 1: "badge-priority-1", 2: "badge-priority-2", 3: "badge-priority-3" }[p];
}

function PrioritySelect(props: { priority: 1 | 2 | 3; onChange: (p: 1 | 2 | 3) => void }) {
  return (
    <select
      class={`border-0 cursor-pointer min-h-7 ${priorityCls(props.priority)}`}
      value={props.priority}
      onChange={(e) => props.onChange(Number(e.currentTarget.value) as 1 | 2 | 3)}
    >
      <option value={1}>必須</option>
      <option value={2}>欲しい</option>
      <option value={3}>余裕</option>
    </select>
  );
}
