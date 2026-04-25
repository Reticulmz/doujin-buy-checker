import { createSignal, createMemo, createEffect, For, Show } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type BuyListItem } from "~/db/schema";
import { createCircle, toggleVisited } from "~/db/repositories/circles";
import { createItem, togglePurchased } from "~/db/repositories/buyListItems";
import { updateEvent } from "~/db/repositories/events";
import { calculateBudget } from "~/services/budgetCalculator";
import { inferM3Hall } from "~/services/eventPresets";
import { BudgetBar } from "~/components/BudgetBar";
import { QuickAddItemForm } from "~/components/QuickAddItemForm";
import { ArrowLeft, BookOpen, Pencil, SquareCheckBig, MapPin, Plus, Square, User, Users } from "~/components/icons";
import { ListSkeleton } from "~/components/Skeleton";

type SortMode = "priority" | "space" | "name";
type FilterMode = "all" | "unpurchased" | "purchased";
type OwnerFilter = "all" | "mine" | "errand";

export default function BuyListPage() {
  const params = useParams();
  const navigate = useNavigate();

  const event = useLiveQuery(() => db.events.get(params.eventId));
  const circles = useLiveQuery(() =>
    db.circles.where("eventId").equals(params.eventId).toArray()
  );
  const items = useLiveQuery(() =>
    db.buyListItems.where("eventId").equals(params.eventId).toArray()
  );

  // Auto-sync circles from catalog (run once on load)
  const [synced, setSynced] = createSignal(false);
  createEffect(() => {
    const ev = event();
    const c = circles();
    if (!ev || !c || synced()) return;
    if (!ev.sourceCatalogId) return;
    setSynced(true);

    const catalogId = ev.sourceCatalogId;
    const evType = ev.eventType;
    const circlesCopy = [...c];

    // Defer async work outside the tracking scope
    (async () => {
      const stored = await db.storedCatalogs.get(catalogId);
      if (!stored) return;

      try {
        const data = JSON.parse(stored.data);
        const catCircles: any[] = data.circles ?? [];
        const catMap = new Map(catCircles.map((cc: any) => [cc.id, cc]));
        const now = new Date().toISOString();

        for (const dbCircle of circlesCopy) {
          if (!dbCircle.externalId) continue;
          const cat = catMap.get(dbCircle.externalId);
          if (!cat) continue;
          const updates: Record<string, string> = {};
          if (!dbCircle.name && cat.name) updates.name = cat.name;
          if (!dbCircle.author && cat.author) updates.author = cat.author;
          if (!dbCircle.spaceNumber && cat.space?.raw) {
            updates.spaceNumber = cat.space.raw;
            if (evType === "m3") updates.hall = inferM3Hall(cat.space.raw);
          }
          if (!dbCircle.genre && cat.genre) updates.genre = cat.genre;
          if (!dbCircle.websiteUrl && cat.urls?.website) updates.websiteUrl = cat.urls.website;
          if (!dbCircle.twitterUrl && cat.urls?.twitter) updates.twitterUrl = cat.urls.twitter;
          if (Object.keys(updates).length === 0) continue;
          await db.circles.update(dbCircle.id, { ...updates, updatedAt: now });
        }
      } catch { /* ignore parse errors */ }
    })();
  });

  const stored = (() => {
    try { return JSON.parse(localStorage.getItem("buylist-prefs") ?? "{}"); }
    catch { return {}; }
  })();
  const [sortMode, setSortMode] = createSignal<SortMode>(stored.sort ?? "priority");
  const [filterMode, setFilterMode] = createSignal<FilterMode>(stored.filter ?? "all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [ownerFilter, setOwnerFilter] = createSignal<OwnerFilter>(stored.owner ?? "all");

  createEffect(() => {
    localStorage.setItem("buylist-prefs", JSON.stringify({
      sort: sortMode(),
      filter: filterMode(),
      owner: ownerFilter(),
    }));
  });
  const [editingName, setEditingName] = createSignal(false);
  const [editName, setEditName] = createSignal("");

  const startEditName = () => {
    const e = event();
    if (!e) return;
    setEditName(e.name);
    setEditingName(true);
  };

  const saveEditName = async () => {
    const trimmed = editName().trim();
    if (!trimmed) return;
    await updateEvent(params.eventId, { name: trimmed });
    setEditingName(false);
  };

  const [showAddCircle, setShowAddCircle] = createSignal(false);
  const [newCircleName, setNewCircleName] = createSignal("");
  const [newCircleSpace, setNewCircleSpace] = createSignal("");

  // Quick add item
  const [quickAddCircleId, setQuickAddCircleId] = createSignal<string | null>(null);

  const budgetSummary = createMemo(() => {
    const e = event();
    const i = items();
    if (!e || !i) return null;
    return calculateBudget(i, e.budget);
  });

  const circleItems = createMemo(() => {
    const c = circles();
    const i = items();
    if (!c || !i) return [];

    const of = ownerFilter();
    const filtered = of === "all" ? i
      : of === "mine" ? i.filter((item) => !item.requestedBy)
      : i.filter((item) => !!item.requestedBy);

    const itemsByCircle = new Map<string, BuyListItem[]>();
    for (const item of filtered) {
      const arr = itemsByCircle.get(item.circleId) || [];
      arr.push(item);
      itemsByCircle.set(item.circleId, arr);
    }

    // Show circles that have matching items, or all circles when owner filter is "all"
    const circlesWithItems = of === "all" ? c : c.filter((circle) => itemsByCircle.has(circle.id));

    return circlesWithItems.map((circle) => {
      const cItems = itemsByCircle.get(circle.id) || [];
      const allItemsPurchased = cItems.length > 0 && cItems.every((it) => it.purchased);
      return {
        circle,
        items: cItems,
        totalPrice: cItems.reduce((sum, it) => sum + it.price * it.quantity, 0),
        isCompleted: cItems.length > 0 ? allItemsPurchased : circle.visited,
        highestPriority: Math.min(...cItems.map((it) => it.priority), 3) as 1 | 2 | 3,
      };
    });
  });

  const filteredAndSorted = createMemo(() => {
    let list = circleItems();
    const q = searchQuery().toLowerCase();

    if (q) {
      list = list.filter(
        (ci) =>
          ci.circle.name.toLowerCase().includes(q) ||
          ci.circle.author.toLowerCase().includes(q) ||
          ci.circle.spaceNumber.toLowerCase().includes(q)
      );
    }

    const fm = filterMode();
    if (fm === "unpurchased") list = list.filter((ci) => !ci.isCompleted);
    else if (fm === "purchased") list = list.filter((ci) => ci.isCompleted);

    const sm = sortMode();
    list = [...list].sort((a, b) => {
      if (sm === "priority") return a.highestPriority - b.highestPriority;
      if (sm === "space") return a.circle.spaceNumber.localeCompare(b.circle.spaceNumber);
      return a.circle.name.localeCompare(b.circle.name);
    });

    return list;
  });

  const handleAddCircle = async (e: SubmitEvent) => {
    e.preventDefault();
    if (!newCircleName().trim()) return;
    const circle = await createCircle({
      eventId: params.eventId,
      name: newCircleName().trim(),
      author: "",
      spaceNumber: newCircleSpace().trim(),
      hall: event()?.eventType === "m3" ? inferM3Hall(newCircleSpace()) : "",
      genre: "",
      websiteUrl: "",
      twitterUrl: "",
      description: "",
    });
    setNewCircleName("");
    setNewCircleSpace("");
    setShowAddCircle(false);
    navigate(`/event/${params.eventId}/circle/${circle.id}`);
  };

  const handleToggleCircle = async (circleId: string, completed: boolean) => {
    const circleItemsList = items()?.filter((i) => i.circleId === circleId) || [];
    if (circleItemsList.length > 0) {
      await Promise.all(circleItemsList.map((i) => togglePurchased(i.id, completed)));
    } else {
      await toggleVisited(circleId, completed);
    }
  };

  const priorityBadge = (p: 1 | 2 | 3) => {
    const cls = { 1: "badge-priority-1", 2: "badge-priority-2", 3: "badge-priority-3" };
    const labels = { 1: "必須", 2: "欲しい", 3: "余裕" };
    return <span class={cls[p]}>{labels[p]}</span>;
  };

  const hallLabel = (hall: string) => {
    const map: Record<string, { short: string; cls: string }> = {
      "第一展示場": { short: "第一", cls: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300" },
      "第二展示場1F": { short: "第二1F", cls: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300" },
      "第二展示場2F": { short: "第二2F", cls: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300" },
    };
    const info = map[hall] ?? { short: hall, cls: "bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300" };
    return <span class={`text-[10px] leading-tight px-1 py-px rounded font-medium ${info.cls}`}>{info.short}</span>;
  };

  return (
    <div class="max-w-lg mx-auto">
      <Show when={event()} fallback={<ListSkeleton />}>
        {(ev) => (
          <>
            {/* Header */}
            <div class="sticky top-0 glass z-10 px-4 pt-3 pb-2">
              <div class="flex items-center gap-2 mb-2">
                <A href="/" class="text-gray-500 touch-target" aria-label="戻る"><ArrowLeft size={20} /></A>
                <Show when={editingName()} fallback={
                  <h1
                    class="text-lg font-bold truncate flex-1 cursor-pointer hover:text-primary-600 transition-colors flex items-center gap-1 group"
                    onClick={startEditName}
                    title="クリックして名前を変更"
                  >
                    {ev().name}
                    <Pencil size={14} class="text-gray-400 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
                  </h1>
                }>
                  <input
                    type="text"
                    class="input-field flex-1 text-lg font-bold !py-1"
                    value={editName()}
                    onInput={(e) => setEditName(e.currentTarget.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") saveEditName();
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    onBlur={saveEditName}
                    autofocus
                  />
                </Show>
                <A
                  href={`/event/${params.eventId}/budget`}
                  class="text-sm text-primary-600 dark:text-primary-400 shrink-0"
                >
                  予算詳細
                </A>
              </div>
              <Show when={budgetSummary() && ev().budget > 0}>
                <BudgetBar summary={budgetSummary()!} />
              </Show>
            </div>

            {/* Controls */}
            <div class="px-4 pt-3 space-y-2.5">
              <input
                type="search"
                class="input-field text-sm"
                placeholder="サークル名・スペース番号で検索..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />
              {/* Filter chips */}
              <div class="flex gap-1.5 flex-wrap">
                {([["all", "すべて"], ["unpurchased", "未購入"], ["purchased", "購入済"]] as const).map(([v, l]) => (
                  <button
                    class="chip"
                    classList={{ "chip-active": filterMode() === v, "chip-inactive": filterMode() !== v }}
                    onClick={() => setFilterMode(v)}
                  >{l}</button>
                ))}
                <span class="w-px bg-gray-200 dark:bg-gray-700 mx-1" />
                {([["all", "全員"], ["mine", "自分"], ["errand", "おつかい"]] as const).map(([v, l]) => (
                  <button
                    class="chip"
                    classList={{ "chip-active": ownerFilter() === v, "chip-inactive": ownerFilter() !== v }}
                    onClick={() => setOwnerFilter(v)}
                  >{l}</button>
                ))}
                <span class="flex-1" />
                <select
                  class="text-xs rounded-full px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 border-0 cursor-pointer"
                  value={sortMode()}
                  onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
                >
                  <option value="priority">優先度順</option>
                  <option value="space">スペース順</option>
                  <option value="name">名前順</option>
                </select>
              </div>
            </div>

            {/* Circle List */}
            <div class="p-4 pb-24 space-y-2">
              <For each={filteredAndSorted()}>
                {(ci) => (
                  <div
                    class="card !p-0 overflow-hidden"
                    classList={{ "opacity-60": ci.isCompleted }}
                  >
                    <div class="flex items-stretch">
                      {/* Purchase toggle */}
                      <button
                        class="flex items-center justify-center w-14 shrink-0 border-r border-gray-200 dark:border-gray-700 transition-colors select-none active:scale-95"
                        classList={{
                          "bg-green-50 dark:bg-green-900/30": ci.isCompleted,
                          "hover:bg-gray-50 dark:hover:bg-gray-700": !ci.isCompleted,
                        }}
                        onClick={() => handleToggleCircle(ci.circle.id, !ci.isCompleted)}
                      >
                        {ci.isCompleted
                          ? <SquareCheckBig size={24} class="text-green-600 dark:text-green-400" />
                          : <Square size={24} class="text-gray-400 dark:text-gray-500" />
                        }
                      </button>

                      {/* Circle info */}
                      <A
                        href={`/event/${params.eventId}/circle/${ci.circle.id}`}
                        class="flex-1 p-3 min-w-0"
                      >
                        <div class="flex items-center gap-2">
                          <span class="font-bold truncate">{ci.circle.name}</span>
                          <Show when={ci.items.length > 0} fallback={
                            <span class="text-xs px-1.5 py-0.5 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium">巡回</span>
                          }>
                            {priorityBadge(ci.highestPriority)}
                          </Show>
                        </div>
                        <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1 tabular-nums">
                          <Show when={ci.circle.spaceNumber}>
                            <span class="flex items-center gap-1">
                              <MapPin size={13} />
                              {ci.circle.spaceNumber}
                              <Show when={ci.circle.hall}>{hallLabel(ci.circle.hall)}</Show>
                            </span>
                          </Show>
                          <Show when={ci.circle.author}>
                            <span class="truncate flex items-center gap-0.5"><User size={13} /> {ci.circle.author}</span>
                          </Show>
                          <Show when={ci.items.length > 0}>
                            <span>¥{ci.totalPrice.toLocaleString()}</span>
                          </Show>
                          <Show when={ci.items.length > 0}>
                            <span>
                              {ci.items.filter((i) => i.purchased).length}/{ci.items.length}品
                            </span>
                          </Show>
                          <Show when={ci.items.some((i) => i.requestedBy)}>
                            <span class="text-errand dark:text-errand-dark-text flex items-center gap-0.5"><Users size={13} />{ci.items.filter((i) => i.requestedBy).length}</span>
                          </Show>
                        </div>
                      </A>

                      {/* Quick add item button */}
                      <button
                        class="flex items-center justify-center w-12 shrink-0 border-l border-gray-200 dark:border-gray-700 text-gray-500 hover:text-primary-600 hover:bg-gray-50 dark:hover:bg-gray-700/30 transition-colors"
                        onClick={() => setQuickAddCircleId(quickAddCircleId() === ci.circle.id ? null : ci.circle.id)}
                        title="頒布物を追加"
                      >
                        <Plus size={20} />
                      </button>
                    </div>

                    {/* Quick add form */}
                    <Show when={quickAddCircleId() === ci.circle.id}>
                      <div class="px-3 py-2.5 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
                        <QuickAddItemForm
                          onAdd={async (item) => {
                            await createItem({
                              eventId: params.eventId,
                              circleId: ci.circle.id,
                              itemName: item.itemName,
                              itemType: item.itemType,
                              isNew: item.isNew,
                              price: item.price,
                              quantity: 1,
                              priority: item.priority,
                              note: "",
                              requestedBy: item.requestedBy,
                            });
                            setQuickAddCircleId(null);
                          }}
                          onClose={() => setQuickAddCircleId(null)}
                        />
                      </div>
                    </Show>
                  </div>
                )}
              </For>

              <Show when={filteredAndSorted().length === 0 && circles()?.length === 0}>
                <div class="text-center text-gray-500 dark:text-gray-400 py-8">
                  <p>サークルがありません</p>
                  <p class="text-sm mt-1">下の「+」から追加しましょう</p>
                </div>
              </Show>
            </div>

            {/* Add circle: catalog-first or manual */}
            <Show
              when={showAddCircle()}
              fallback={
                <Show when={ev().sourceCatalogId} fallback={
                  <button
                    class="fixed bottom-18 right-4 w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 active:bg-primary-800 z-40"
                    onClick={() => setShowAddCircle(true)}
                  >
                    <Plus size={24} />
                  </button>
                }>
                  <div class="fixed bottom-18 right-4 z-40 flex flex-col gap-2 items-end">
                    <button
                      class="w-14 h-14 rounded-full bg-primary-600 text-white shadow-lg flex items-center justify-center hover:bg-primary-700 active:bg-primary-800"
                      onClick={() => navigate(`/catalog-browse?id=${ev().sourceCatalogId}&eventId=${params.eventId}`)}
                      title="カタログから追加"
                    >
                      <BookOpen size={22} />
                    </button>
                    <button
                      class="w-11 h-11 rounded-full bg-gray-500 text-white shadow-md flex items-center justify-center hover:bg-gray-600 active:bg-gray-700"
                      onClick={() => setShowAddCircle(true)}
                      title="手動追加"
                    >
                      <Plus size={20} />
                    </button>
                  </div>
                </Show>
              }
            >
              <>
              <div class="fixed inset-0 bg-black/30 z-30" onClick={() => setShowAddCircle(false)} />
              <div class="fixed bottom-18 left-4 right-4 card shadow-xl z-40 max-w-lg mx-auto">
                <form onSubmit={handleAddCircle} class="space-y-2">
                  <input
                    type="text"
                    class="input-field text-sm"
                    placeholder="サークル名 *"
                    value={newCircleName()}
                    onInput={(e) => setNewCircleName(e.currentTarget.value)}
                    autofocus
                    required
                  />
                  <input
                    type="text"
                    class="input-field text-sm"
                    placeholder="スペース番号（例: A-01）"
                    value={newCircleSpace()}
                    onInput={(e) => setNewCircleSpace(e.currentTarget.value)}
                  />
                  <div class="flex gap-2">
                    <button type="submit" class="btn-primary flex-1 text-sm">
                      追加して詳細へ
                    </button>
                    <button
                      type="button"
                      class="btn-secondary text-sm"
                      onClick={() => setShowAddCircle(false)}
                    >
                      閉じる
                    </button>
                  </div>
                </form>
              </div>
              </>
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
