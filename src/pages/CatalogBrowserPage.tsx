import { createSignal, createMemo, onMount, For, Show } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { useNavigate, useSearchParams } from "@solidjs/router";
import { ulid } from "ulidx";
import { db, type EventType } from "~/db/schema";
import { EVENT_PRESETS, inferM3Hall } from "~/services/eventPresets";

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
  itemIndex: number;
  priority: 1 | 2 | 3;
}

export default function CatalogBrowserPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [catalog, setCatalog] = createSignal<CatalogData | null>(null);
  const [eventType, setEventType] = createSignal<EventType>("m3");
  const [picked, setPicked] = createStore<PickedItem[]>([]);
  const [budget, setBudget] = createSignal(0);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [expandedCircle, setExpandedCircle] = createSignal<string | null>(null);
  const [creating, setCreating] = createSignal(false);

  // Load from stored catalog if ID is provided
  onMount(async () => {
    const id = searchParams.id;
    if (!id) return;
    const stored = await db.storedCatalogs.get(id);
    if (stored) {
      const data = JSON.parse(stored.data) as CatalogData;
      setCatalog(data);
      if (stored.eventVenue.includes("流通センター")) setEventType("m3");
    }
  });

  const isPicked = (circleId: string, itemIndex: number) =>
    picked.some((p) => p.circleId === circleId && p.itemIndex === itemIndex);

  const togglePick = (circleId: string, itemIndex: number) => {
    const idx = picked.findIndex((p) => p.circleId === circleId && p.itemIndex === itemIndex);
    if (idx >= 0) {
      setPicked(produce((p) => p.splice(idx, 1)));
    } else {
      setPicked(produce((p) => p.push({ circleId, itemIndex, priority: 2 })));
    }
  };

  const setPriority = (circleId: string, itemIndex: number, priority: 1 | 2 | 3) => {
    const idx = picked.findIndex((p) => p.circleId === circleId && p.itemIndex === itemIndex);
    if (idx >= 0) {
      setPicked(idx, "priority", priority);
    }
  };

  const pickedTotal = createMemo(() => {
    const cat = catalog();
    if (!cat) return { count: 0, price: 0 };
    let count = 0;
    let price = 0;
    for (const p of picked) {
      const circle = cat.circles.find((c) => c.id === p.circleId);
      const item = circle?.items?.[p.itemIndex];
      if (item) {
        count++;
        price += item.price ?? 0;
      }
    }
    return { count, price };
  });

  const filteredCircles = createMemo(() => {
    const cat = catalog();
    if (!cat) return [];
    const q = searchQuery().toLowerCase();
    if (!q) return cat.circles;
    return cat.circles.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.author ?? "").toLowerCase().includes(q) ||
        (c.space?.raw ?? "").toLowerCase().includes(q) ||
        (c.genre ?? "").toLowerCase().includes(q)
    );
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
        setCatalog(data);
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

  const createBuyList = async () => {
    const cat = catalog();
    if (!cat || picked.length === 0) return;
    setCreating(true);

    try {
      const now = new Date().toISOString();
      const eventId = ulid();

      // Collect unique circle IDs that have picked items
      const pickedCircleIds = new Set(picked.map((p) => p.circleId));

      await db.transaction("rw", [db.events, db.circles, db.buyListItems], async () => {
        // Create event
        await db.events.add({
          id: eventId,
          name: cat.event.name,
          date: cat.event.date,
          venue: cat.event.venue ?? "",
          budget: budget(),
          eventType: eventType(),
          createdAt: now,
          updatedAt: now,
        });

        // Create circles & items
        for (const catCircle of cat.circles) {
          if (!pickedCircleIds.has(catCircle.id)) continue;

          const circleId = ulid();
          const spaceRaw = catCircle.space?.raw ?? "";
          await db.circles.add({
            id: circleId,
            eventId,
            catalogSourceId: null,
            externalId: catCircle.id,
            name: catCircle.name,
            author: catCircle.author ?? "",
            spaceNumber: spaceRaw,
            hall: eventType() === "m3" ? inferM3Hall(spaceRaw) : "",
            genre: catCircle.genre ?? "",
            url: catCircle.urls?.website ?? "",
            twitterUrl: catCircle.urls?.twitter ?? "",
            description: "",
            createdAt: now,
            updatedAt: now,
          });

          // Create buy list items for picked items in this circle
          const circlePickedItems = picked.filter((p) => p.circleId === catCircle.id);
          for (const p of circlePickedItems) {
            const catItem = catCircle.items?.[p.itemIndex];
            if (!catItem) continue;
            await db.buyListItems.add({
              id: ulid(),
              eventId,
              circleId,
              itemName: catItem.name,
              price: catItem.price ?? 0,
              quantity: 1,
              priority: p.priority,
              purchased: false,
              purchasedAt: null,
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

  const priorityLabel = (p: 1 | 2 | 3) => ({ 1: "必須", 2: "欲しい", 3: "余裕" }[p]);
  const priorityCls = (p: 1 | 2 | 3) => ({
    1: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
    2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300",
    3: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  }[p]);

  return (
    <div class="max-w-2xl mx-auto min-h-screen flex flex-col pb-24">
      {/* No catalog loaded yet */}
      <Show when={!catalog()}>
        <div class="p-4 space-y-6">
          <h1 class="text-xl font-bold">カタログから購入リスト作成</h1>
          <p class="text-sm text-gray-500 dark:text-gray-400">
            カタログJSONを読み込んで、欲しい頒布物をピックアップしましょう
          </p>

          <button class="btn-primary w-full py-4 text-base" onClick={handleFileUpload}>
            カタログJSONを選択
          </button>

          <div class="text-center text-gray-400 text-sm">
            <p>カタログがない場合は「作成」タブでカタログを作れます</p>
          </div>
        </div>
      </Show>

      {/* Catalog loaded */}
      <Show when={catalog()}>
        {(cat) => (
          <>
            {/* Header */}
            <div class="sticky top-0 z-10 bg-gray-50 dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 px-4 py-3">
              <div class="flex items-center gap-2 mb-2">
                <button class="text-gray-500 touch-target" onClick={() => searchParams.id ? navigate("/catalogs") : setCatalog(null)}>←</button>
                <div class="flex-1 min-w-0">
                  <h1 class="text-lg font-bold truncate">{cat().event.name}</h1>
                  <div class="text-xs text-gray-500">
                    {cat().event.date}
                    <Show when={cat().event.venue}>
                      <span class="ml-2">{cat().event.venue}</span>
                    </Show>
                    <span class="ml-2">{cat().circles.length} サークル</span>
                  </div>
                </div>
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
              <For each={filteredCircles()}>
                {(circle) => {
                  const hasItems = () => (circle.items?.length ?? 0) > 0;
                  const isExpanded = () => expandedCircle() === circle.id;
                  const circlePickedCount = () =>
                    picked.filter((p) => p.circleId === circle.id).length;

                  return (
                    <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 overflow-hidden shadow-sm">
                      {/* Circle header */}
                      <button
                        class="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        onClick={() => setExpandedCircle(isExpanded() ? null : circle.id)}
                      >
                        <span class="text-xs text-gray-400 transition-transform" classList={{ "rotate-90": isExpanded() }}>
                          ▶
                        </span>
                        <div class="flex-1 min-w-0">
                          <div class="flex items-center gap-2">
                            <span class="font-medium text-sm truncate">{circle.name}</span>
                            <Show when={circlePickedCount() > 0}>
                              <span class="text-[10px] px-1.5 py-0.5 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300 font-bold">
                                {circlePickedCount()}
                              </span>
                            </Show>
                          </div>
                          <div class="text-xs text-gray-400 flex items-center gap-2 mt-0.5">
                            <Show when={circle.space?.raw}>
                              <span class="font-mono bg-gray-100 dark:bg-gray-700 px-1 py-0.5 rounded text-[10px]">
                                {circle.space!.raw}
                              </span>
                            </Show>
                            <Show when={circle.author}>
                              <span>{circle.author}</span>
                            </Show>
                            <Show when={circle.genre}>
                              <span>{circle.genre}</span>
                            </Show>
                          </div>
                        </div>
                        <Show when={hasItems()}>
                          <span class="text-xs text-gray-400">{circle.items!.length} 品</span>
                        </Show>
                      </button>

                      {/* Expanded items */}
                      <Show when={isExpanded()}>
                        <div class="border-t border-gray-200 dark:border-gray-700">
                          <Show when={circle.urls?.twitter}>
                            <div class="px-3 py-1.5 text-xs text-gray-400 border-b border-gray-100 dark:border-gray-800">
                              <a
                                href={circle.urls!.twitter!.startsWith("@") ? `https://x.com/${circle.urls!.twitter!.slice(1)}` : circle.urls!.twitter!}
                                target="_blank"
                                rel="noopener noreferrer"
                                class="text-primary-600 dark:text-primary-400 hover:underline"
                              >
                                {circle.urls!.twitter}
                              </a>
                            </div>
                          </Show>

                          <Show when={hasItems()} fallback={
                            <div class="px-3 py-4 text-sm text-gray-400 text-center">
                              頒布物情報なし（全体をリストに追加できます）
                              <button
                                class="block mx-auto mt-2 btn-secondary text-xs"
                                onClick={() => {
                                  // Add a generic "visit" item
                                  const fakeIndex = -1;
                                  if (!isPicked(circle.id, fakeIndex)) {
                                    setPicked(produce((p) => p.push({ circleId: circle.id, itemIndex: fakeIndex, priority: 2 })));
                                  }
                                }}
                              >
                                {isPicked(circle.id, -1) ? "追加済み" : "リストに追加"}
                              </button>
                            </div>
                          }>
                            <div class="divide-y divide-gray-100 dark:divide-gray-800">
                              <For each={circle.items!}>
                                {(item, idx) => {
                                  const checked = () => isPicked(circle.id, idx());
                                  const pickData = () => picked.find((p) => p.circleId === circle.id && p.itemIndex === idx());

                                  return (
                                    <div
                                      class="flex items-center gap-3 px-3 py-2.5 transition-colors cursor-pointer"
                                      classList={{
                                        "bg-primary-50/50 dark:bg-primary-900/15": checked(),
                                        "hover:bg-gray-50 dark:hover:bg-gray-700/20": !checked(),
                                      }}
                                      onClick={() => togglePick(circle.id, idx())}
                                    >
                                      {/* Checkbox */}
                                      <div
                                        class="w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors"
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
                                          <Show when={item.isNew}>
                                            <span class="text-[10px] px-1 py-0.5 rounded bg-red-100 dark:bg-red-900/40 text-red-600 dark:text-red-300 font-bold">NEW</span>
                                          </Show>
                                          <Show when={item.type}>
                                            <span class="text-[10px] text-gray-400">{item.type}</span>
                                          </Show>
                                        </div>
                                      </div>

                                      {/* Price */}
                                      <span class="text-sm tabular-nums font-medium shrink-0">
                                        ¥{(item.price ?? 0).toLocaleString()}
                                      </span>

                                      {/* Priority selector (only when picked) */}
                                      <Show when={checked()}>
                                        <select
                                          class={`text-[10px] px-1.5 py-0.5 rounded-full font-bold border-0 cursor-pointer ${priorityCls(pickData()!.priority)}`}
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
                                    </div>
                                  );
                                }}
                              </For>
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
              <div class="fixed bottom-14 left-0 right-0 z-40">
                <div class="max-w-2xl mx-auto px-4 pb-2">
                  <div class="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 shadow-xl p-3 space-y-2">
                    <div class="flex items-center justify-between">
                      <div>
                        <span class="text-sm font-bold">{pickedTotal().count} 点選択</span>
                        <span class="text-sm text-gray-500 ml-2">¥{pickedTotal().price.toLocaleString()}</span>
                      </div>
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
                    </div>
                    <button
                      class="btn-primary w-full"
                      onClick={createBuyList}
                      disabled={creating()}
                    >
                      {creating() ? "作成中..." : "購入リストを作成"}
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