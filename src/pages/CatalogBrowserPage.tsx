import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { ulid } from "ulidx";
import { db, type EventType } from "~/db/schema";
import { inferM3Hall } from "~/services/eventPresets";
import { ArrowLeft, X } from "~/components/icons";
import { QuickAddItemForm } from "~/components/QuickAddItemForm";
import { ItemTypeBadge, NewBadge } from "~/components/ItemBadges";

interface CatalogItem {
  name: string;
  price: number;
  type?: string;
  isNew?: boolean;
}

interface CatalogCircle {
  id: string;
  name: string;
  author?: string;
  space?: { raw?: string };
  genre?: string;
  description?: string;
  urls?: { website?: string; twitter?: string };
  items?: CatalogItem[];
}

interface CatalogData {
  catalog: { name: string };
  event: { name: string; date: string; venue?: string };
  circles: CatalogCircle[];
}

interface PickedItem {
  circleId: string;
  itemIndex: number | null;
  visitOnly?: boolean;
  priority: 1 | 2 | 3;
}

export default function CatalogBrowserPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalogMeta, setCatalogMeta] = createSignal<Omit<CatalogData, "circles"> | null>(null);
  const [circles, setCircles] = createStore<CatalogCircle[]>([]);
  const [storedId, setStoredId] = createSignal<string | null>(null);
  const [eventType, setEventType] = createSignal<EventType>("m3");
  const [picked, setPicked] = createStore<PickedItem[]>([]);
  const [budget, setBudget] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  const PAGE_SIZE = 50;
  const [page, setPage] = createSignal(0);
  const [expandedCircle, setExpandedCircle] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);
  const [addingItemCircle, setAddingItemCircle] = createSignal<string | null>(null);

  const catalog = () => {
    const meta = catalogMeta();
    if (!meta) return null;
    return { ...meta, circles: [...circles] } as CatalogData;
  };

  // Load from stored catalog if ID is provided
  onMount(async () => {
    const id = searchParams.id;
    if (!id) return;
    const stored = await db.storedCatalogs.get(id);
    if (stored) {
      const data = JSON.parse(stored.data) as CatalogData;
      setCatalogMeta({ catalog: data.catalog, event: data.event });
      setCircles(data.circles);
      setStoredId(id);
      if (stored.eventVenue.includes("流通センター")) setEventType("m3");
    }
  });

  const isPicked = (circleId: string, itemIndex: number) =>
    picked.some((p) => p.circleId === circleId && p.itemIndex === itemIndex && !p.visitOnly);

  const isVisitOnly = (circleId: string) =>
    picked.some((p) => p.circleId === circleId && p.visitOnly);

  const togglePick = (circleId: string, itemIndex: number) => {
    const idx = picked.findIndex((p) => p.circleId === circleId && p.itemIndex === itemIndex && !p.visitOnly);
    if (idx >= 0) {
      setPicked(produce((p) => p.splice(idx, 1)));
    } else {
      setPicked(produce((p) => p.push({ circleId, itemIndex, priority: 2 })));
    }
  };

  const toggleVisitOnly = (circleId: string) => {
    const idx = picked.findIndex((p) => p.circleId === circleId && p.visitOnly);
    if (idx >= 0) {
      setPicked(produce((p) => p.splice(idx, 1)));
    } else {
      setPicked(produce((p) => p.push({ circleId, itemIndex: null, visitOnly: true, priority: 2 })));
    }
  };

  const setPriority = (circleId: string, itemIndex: number, priority: 1 | 2 | 3) => {
    const idx = picked.findIndex((p) => p.circleId === circleId && p.itemIndex === itemIndex && !p.visitOnly);
    if (idx >= 0) {
      setPicked(idx, "priority", priority);
    }
  };

  const circleMap = createMemo(() => {
    const map = new Map<string, CatalogCircle>();
    for (const c of circles) map.set(c.id, c);
    return map;
  });

  const pickedTotal = createMemo(() => {
    if (!catalogMeta()) return { count: 0, price: 0 };
    const map = circleMap();
    let count = 0;
    let price = 0;
    for (const p of picked) {
      if (p.visitOnly || p.itemIndex === null) continue;
      const circle = map.get(p.circleId);
      const item = circle?.items?.[p.itemIndex];
      if (item) {
        count++;
        price += item.price ?? 0;
      }
    }
    return { count, price };
  });

  const filteredCircles = createMemo(() => {
    if (!catalogMeta()) return [];
    setPage(0); // reset page on filter change
    const q = searchQuery().toLowerCase();
    if (!q) return [...circles];
    return circles.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.author ?? "").toLowerCase().includes(q) ||
        (c.space?.raw ?? "").toLowerCase().includes(q) ||
        (c.genre ?? "").toLowerCase().includes(q)
    );
  });

  const totalPages = () => Math.ceil(filteredCircles().length / PAGE_SIZE);
  const pagedCircles = createMemo(() => {
    const start = page() * PAGE_SIZE;
    return filteredCircles().slice(start, start + PAGE_SIZE);
  });

  const handleFileUpload = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text()) as CatalogData;
        if (!data.circles || !Array.isArray(data.circles)) {
          alert("カタログJSON形式が不正です");
          return;
        }
        setCatalogMeta({ catalog: data.catalog, event: data.event });
        setCircles(data.circles);
        // Infer event type from venue
        if (data.event.venue?.includes("流通センター")) {
          setEventType("m3");
        }
      } catch {
        alert("JSONの読み込みに失敗しました");
      }
    };
    input.click();
  };

  const targetEventId = () => searchParams.eventId as string | undefined;
  const isAddMode = () => !!targetEventId();

  const createBuyList = async () => {
    const meta = catalogMeta();
    if (!meta || picked.length === 0) return;
    setCreating(true);

    try {
      const now = new Date().toISOString();
      const eventId = targetEventId() ?? ulid();
      const pickedCircleIds = new Set(picked.map((p) => p.circleId));

      await db.transaction("rw", [db.events, db.circles, db.buyListItems], async () => {
        if (!isAddMode()) {
          // Create new event
          await db.events.add({
            id: eventId,
            name: meta.event.name,
            date: meta.event.date,
            venue: meta.event.venue ?? "",
            budget: budget(),
            eventType: eventType(),
            sourceCatalogId: storedId(),
            createdAt: now,
            updatedAt: now,
          });
        }

        // Get existing circles for this event (to avoid duplicates)
        const existingCircles = await db.circles.where("eventId").equals(eventId).toArray();
        const existingByExternalId = new Map(existingCircles.filter((c) => c.externalId).map((c) => [c.externalId!, c]));

        for (const catCircle of circles) {
          if (!pickedCircleIds.has(catCircle.id)) continue;

          // Reuse existing circle or create new
          let circleId: string;
          const existing = existingByExternalId.get(catCircle.id);
          if (existing) {
            circleId = existing.id;
            // Update circle info from catalog
            await db.circles.update(circleId, {
              name: catCircle.name,
              author: catCircle.author ?? "",
              spaceNumber: catCircle.space?.raw ?? "",
              hall: eventType() === "m3" ? inferM3Hall(catCircle.space?.raw ?? "") : "",
              genre: catCircle.genre ?? "",
              websiteUrl: catCircle.urls?.website ?? "",
              twitterUrl: catCircle.urls?.twitter ?? "",
              updatedAt: now,
            });
          } else {
            circleId = ulid();
            const spaceRaw = catCircle.space?.raw ?? "";
            const isVisitOnly = picked.some((p) => p.circleId === catCircle.id && p.visitOnly);
            await db.circles.add({
              id: circleId,
              eventId,
              catalogSourceId: storedId(),
              externalId: catCircle.id,
              name: catCircle.name,
              author: catCircle.author ?? "",
              spaceNumber: spaceRaw,
              hall: eventType() === "m3" ? inferM3Hall(spaceRaw) : "",
              genre: catCircle.genre ?? "",
              websiteUrl: catCircle.urls?.website ?? "",
              twitterUrl: catCircle.urls?.twitter ?? "",
              description: catCircle.description ?? "",
              visited: isVisitOnly,
              createdAt: now,
              updatedAt: now,
            });
          }

          // Create buy list items (skip duplicates by checking existing items)
          const existingItems = await db.buyListItems.where("circleId").equals(circleId).toArray();
          const existingItemNames = new Set(existingItems.map((i) => i.itemName));

          const circlePickedItems = picked.filter((p) => p.circleId === catCircle.id);
          for (const p of circlePickedItems) {
            if (p.visitOnly || p.itemIndex === null) continue;
            const catItem = catCircle.items?.[p.itemIndex];
            if (!catItem || existingItemNames.has(catItem.name)) continue;
            await db.buyListItems.add({
              id: ulid(),
              eventId,
              circleId,
              itemName: catItem.name,
              itemType: catItem.type ?? "",
              isNew: catItem.isNew ?? false,
              price: catItem.price ?? 0,
              quantity: 1,
              priority: p.priority,
              purchased: false,
              purchasedAt: null,
              requestedBy: "",
              note: "",
              createdAt: now,
              updatedAt: now,
            });
          }
        }
      });

      navigate(`/event/${eventId}`);
    } catch (err) {
      alert(`エラー: ${String(err)}`);
    } finally {
      setCreating(false);
    }
  };

  // Sync all circles in an event with catalog data
  const syncCirclesFromCatalog = async () => {
    const evId = targetEventId();
    if (!evId) return;
    const now = new Date().toISOString();
    const existingCircles = await db.circles.where("eventId").equals(evId).toArray();
    let updated = 0;
    for (const dbCircle of existingCircles) {
      if (!dbCircle.externalId) continue;
      const catCircle = circles.find((c) => c.id === dbCircle.externalId);
      if (!catCircle) continue;
      await db.circles.update(dbCircle.id, {
        name: catCircle.name,
        author: catCircle.author ?? "",
        spaceNumber: catCircle.space?.raw ?? "",
        hall: eventType() === "m3" ? inferM3Hall(catCircle.space?.raw ?? "") : "",
        genre: catCircle.genre ?? "",
        websiteUrl: catCircle.urls?.website ?? "",
        twitterUrl: catCircle.urls?.twitter ?? "",
        updatedAt: now,
      });
      updated++;
    }
    alert(`${updated} 件のサークル情報を更新しました`);
  };

  const addItemToCircle = async (circleId: string, item: { itemName: string; price: number; itemType: string; isNew: boolean; priority: 1 | 2 | 3 }) => {
    const circleIndex = circles.findIndex((c) => c.id === circleId);
    if (circleIndex < 0) return;

    const newItem: CatalogItem = {
      name: item.itemName,
      price: item.price,
      type: item.itemType,
      isNew: item.isNew,
    };

    setCircles(circleIndex, "items", (items) => [...(items ?? []), newItem]);

    // Auto-pick the newly added item
    const newItemIndex = (circles[circleIndex].items?.length ?? 1) - 1;
    setPicked(produce((p) => p.push({ circleId, itemIndex: newItemIndex, priority: item.priority })));

    // Persist to StoredCatalog
    const id = storedId();
    if (id) {
      const cat = catalog();
      if (cat) {
        await db.storedCatalogs.update(id, {
          data: JSON.stringify(cat, null, 2),
          updatedAt: new Date().toISOString(),
        });
      }
    }

    setAddingItemCircle(null);
  };

  const removeItemFromCircle = async (circleId: string, itemIndex: number) => {
    const circleIndex = circles.findIndex((c) => c.id === circleId);
    if (circleIndex < 0) return;

    // Remove from picked if it was picked
    const pickedIdx = picked.findIndex((p) => p.circleId === circleId && p.itemIndex === itemIndex && !p.visitOnly);
    if (pickedIdx >= 0) setPicked(produce((p) => p.splice(pickedIdx, 1)));
    // Adjust picked indices > removed index
    for (let i = 0; i < picked.length; i++) {
      const pi = picked[i].itemIndex;
      if (picked[i].circleId === circleId && pi !== null && !picked[i].visitOnly && pi > itemIndex) {
        setPicked(i, "itemIndex", pi - 1);
      }
    }

    setCircles(circleIndex, "items", produce((items) => items!.splice(itemIndex, 1)));

    // Persist
    const id = storedId();
    if (id) {
      const cat = catalog();
      if (cat) {
        await db.storedCatalogs.update(id, {
          data: JSON.stringify(cat, null, 2),
          updatedAt: new Date().toISOString(),
        });
      }
    }
  };

  const priorityCls = (p: 1 | 2 | 3) => (
    { 1: "badge-priority-1", 2: "badge-priority-2", 3: "badge-priority-3" }[p]
  );

  return (
    <div class="max-w-lg mx-auto min-h-dvh flex flex-col pb-24">
      {/* No catalog loaded yet */}
      <Show when={!catalogMeta()}>
        <div class="p-4 space-y-6">
          <h1 class="text-xl font-bold">カタログから購入リスト作成</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            カタログJSONを読み込んで、欲しい頒布物をピックアップしましょう
          </p>

          <button class="btn-primary w-full py-4 text-base" onClick={handleFileUpload}>
            カタログJSONを選択
          </button>

          <div class="text-center text-gray-500 text-sm">
            <p>カタログがない場合は「作成」タブでカタログを作れます</p>
          </div>
        </div>
      </Show>

      {/* Catalog loaded */}
      <Show when={catalogMeta()}>
        {(cat) => (
          <>
            {/* Header */}
            <div class="sticky top-0 z-10 glass px-4 py-3">
              <div class="flex items-center gap-2 mb-2">
                <button class="text-gray-500 touch-target" aria-label="戻る" onClick={() => isAddMode() ? navigate(`/event/${targetEventId()}`) : searchParams.id ? navigate("/catalogs") : (setCatalogMeta(null), setCircles([]))}><ArrowLeft size={20} /></button>
                <div class="flex-1 min-w-0">
                  <h1 class="text-lg font-bold truncate">{cat().event.name}</h1>
                  <div class="text-xs text-gray-500">
                    {cat().event.date}
                    <Show when={cat().event.venue}>
                      <span class="ml-2">{cat().event.venue}</span>
                    </Show>
                    <span class="ml-2">{circles.length} サークル</span>
                  </div>
                </div>
                <Show when={isAddMode()}>
                  <button class="btn-secondary text-xs !px-2 !py-1" onClick={syncCirclesFromCatalog}>
                    同期
                  </button>
                </Show>
              </div>

              <input
                type="search"
                class="input-field text-sm"
                placeholder="サークル名・スペースで検索..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />
            </div>

            {/* Circle list */}
            <div class="flex-1 p-4 space-y-2">
              <Show when={filteredCircles().length > PAGE_SIZE}>
                <div class="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span>{filteredCircles().length} 件中 {page() * PAGE_SIZE + 1}–{Math.min((page() + 1) * PAGE_SIZE, filteredCircles().length)}</span>
                  <div class="flex gap-2">
                    <button class="btn-secondary !px-2 !py-1 text-xs" disabled={page() === 0} onClick={() => setPage((p) => p - 1)}>前</button>
                    <button class="btn-secondary !px-2 !py-1 text-xs" disabled={page() >= totalPages() - 1} onClick={() => setPage((p) => p + 1)}>次</button>
                  </div>
                </div>
              </Show>
              <For each={pagedCircles()}>
                {(circle) => {
                  const hasItems = () => (circle.items?.length ?? 0) > 0;
                  const isExpanded = () => expandedCircle() === circle.id;
                  const circlePickedCount = () =>
                    picked.filter((p) => p.circleId === circle.id).length;

                  return (
                    <div class="bg-white dark:bg-gray-800 rounded-2xl border border-gray-100 dark:border-gray-700 overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                      {/* Circle header */}
                      <button
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        onClick={() => setExpandedCircle(isExpanded() ? null : circle.id)}
                      >
                        <span class="text-xs text-gray-500 transition-transform" classList={{ "rotate-90": isExpanded() }}>
                          ▶
                        </span>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-sm truncate">{circle.name}</span>
                            <Show when={circlePickedCount() > 0}>
                              <span class="text-xs px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                                {circlePickedCount()}
                              </span>
                            </Show>
                          </div>
                          <div class="text-xs text-gray-500 flex items-center gap-2 mt-0.5 flex-wrap">
                            <Show when={circle.space?.raw}>
                              <span class="font-mono bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-xs">
                                {circle.space!.raw}
                              </span>
                            </Show>
                            <Show when={circle.author}>
                              <span>{circle.author}</span>
                            </Show>
                            <Show when={circle.genre}>
                              <span>{circle.genre}</span>
                            </Show>
                            <Show when={circle.urls?.website}>
                              <a
                                href={circle.urls!.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary-600 dark:text-primary-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                Web
                              </a>
                            </Show>
                            <Show when={circle.urls?.twitter}>
                              <a
                                href={circle.urls!.twitter!.startsWith("@") ? `https://x.com/${circle.urls!.twitter!.slice(1)}` : circle.urls!.twitter!}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary-600 dark:text-primary-400 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {circle.urls!.twitter!.startsWith("@") ? circle.urls!.twitter : "X"}
                              </a>
                            </Show>
                          </div>
                        </div>
                        <Show when={hasItems()}>
                          <span class="text-xs text-gray-500">{circle.items!.length} 品</span>
                        </Show>
                      </button>

                      {/* Expanded items */}
                      <Show when={isExpanded()}>
                        <div class="border-t border-gray-200 dark:border-gray-700">
                          <Show when={circle.description}>
                            <div class="px-3 py-2 text-sm text-gray-600 dark:text-gray-400 border-b border-gray-100 dark:border-gray-800 leading-relaxed">
                              {circle.description}
                            </div>
                          </Show>

                          {/* Item list */}
                          <Show when={hasItems()}>
                            <div class="divide-y divide-gray-100 dark:divide-gray-800">
                              <For each={circle.items!}>
                                {(item, idx) => {
                                  const checked = () => isPicked(circle.id, idx());
                                  const pickData = () => picked.find((p) => p.circleId === circle.id && p.itemIndex === idx());

                                  return (
                                    <div
                                      class="flex items-center gap-3 px-3 py-3 min-h-11 transition-colors cursor-pointer"
                                      classList={{
                                        "bg-primary-50/50 dark:bg-primary-900/15": checked(),
                                        "hover:bg-gray-50 dark:hover:bg-gray-700/20": !checked(),
                                      }}
                                      onClick={() => togglePick(circle.id, idx())}
                                    >
                                      {/* Checkbox */}
                                      <div
                                        class="w-6 h-6 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
                                        classList={{
                                          "bg-primary-600 border-primary-600 text-white": checked(),
                                          "border-gray-300 dark:border-gray-600": !checked(),
                                        }}
                                      >
                                        <Show when={checked()}>
                                          <span class="text-xs">✓</span>
                                        </Show>
                                      </div>

                                      {/* Item info */}
                                      <div class="flex-1 min-w-0">
                                        <div class="flex items-center gap-2">
                                          <span class="text-sm font-medium truncate">{item.name}</span>
                                          <Show when={item.isNew}><NewBadge /></Show>
                                          <ItemTypeBadge type={item.type ?? ""} />
                                        </div>
                                      </div>

                                      {/* Price */}
                                      <span class="text-sm tabular-nums font-medium shrink-0">
                                        ¥{(item.price ?? 0).toLocaleString()}
                                      </span>

                                      {/* Priority selector (only when picked) */}
                                      <Show when={checked()}>
                                        <select
                                          class={`border-0 cursor-pointer min-h-7 ${priorityCls(pickData()!.priority)}`}
                                          value={pickData()!.priority}
                                          onClick={(e) => e.stopPropagation()}
                                          onChange={(e) => {
                                            e.stopPropagation();
                                            setPriority(circle.id, idx(), Number(e.currentTarget.value) as 1 | 2 | 3);
                                          }}
                                        >
                                          <option value={1}>必須</option>
                                          <option value={2}>欲しい</option>
                                          <option value={3}>余裕</option>
                                        </select>
                                      </Show>

                                      {/* Delete item */}
                                      <button
                                        class="text-gray-400 hover:text-red-500 p-2 shrink-0 transition-colors"
                                        onClick={(e) => { e.stopPropagation(); removeItemFromCircle(circle.id, idx()); }}
                                        title="削除"
                                      >
                                        <X size={16} />
                                      </button>
                                    </div>
                                  );
                                }}
                              </For>
                            </div>
                          </Show>

                          {/* Add item / visit-only */}
                          <Show when={addingItemCircle() === circle.id} fallback={
                            <div class="flex items-center border-t border-gray-100 dark:border-gray-800">
                              <button
                                class="flex-1 px-3 py-2 text-xs text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors text-left flex items-center gap-1.5"
                                onClick={(e) => { e.stopPropagation(); setAddingItemCircle(circle.id); }}
                              >
                                <span class="text-sm leading-none">+</span>
                                <span>頒布物を追加</span>
                              </button>
                              <button
                                class="px-3 py-2 text-xs transition-colors border-l border-gray-100 dark:border-gray-800 shrink-0"
                                classList={{
                                  "text-primary-600 dark:text-primary-400 font-medium": isVisitOnly(circle.id),
                                  "text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30": !isVisitOnly(circle.id),
                                }}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleVisitOnly(circle.id);
                                }}
                              >
                                {isVisitOnly(circle.id) ? "巡回追加済み ✓" : "巡回のみ追加"}
                              </button>
                            </div>
                          }>
                            <div class="px-3 py-2.5 bg-gray-50 dark:bg-gray-800/50" onClick={(e) => e.stopPropagation()}>
                              <QuickAddItemForm
                                onAdd={(item) => addItemToCircle(circle.id, item)}
                                onClose={() => setAddingItemCircle(null)}
                              />
                            </div>
                          </Show>
                        </div>
                      </Show>
                    </div>
                  );
                }}
              </For>
            </div>

            {/* Bottom bar - Cart summary */}
            <Show when={picked.length > 0}>
              <div class="fixed bottom-16 left-0 right-0 z-40">
                <div class="max-w-lg mx-auto px-4 pb-2">
                  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm font-bold">{pickedTotal().count} 点選択</span>
                        <span class="text-sm text-gray-500 ml-2">¥{pickedTotal().price.toLocaleString()}</span>
                      </div>
                      <Show when={!isAddMode()}>
                        <div class="flex items-center gap-2">
                          <span class="text-xs text-gray-500">予算</span>
                          <input
                            type="number"
                            class="input-field !w-24 !py-1 text-sm text-right tabular-nums"
                            placeholder="¥"
                            value={budget() || ""}
                            onInput={(e) => setBudget(Number(e.currentTarget.value) || 0)}
                            min="0"
                            step="1000"
                            onClick={(e) => e.stopPropagation()}
                          />
                        </div>
                      </Show>
                    </div>
                    <button
                      class="btn-primary w-full"
                      onClick={createBuyList}
                      disabled={creating()}
                    >
                      {creating() ? "処理中..." : isAddMode() ? "購入リストに追加" : "購入リストを作成"}
                    </button>
                  </div>
                </div>
              </div>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}