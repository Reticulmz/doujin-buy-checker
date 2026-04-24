import { createSignal, createMemo, For, Show } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db, type Circle, type BuyListItem } from "~/db/schema";
import { createCircle } from "~/db/repositories/circles";
import { togglePurchased } from "~/db/repositories/buyListItems";
import { calculateBudget } from "~/services/budgetCalculator";
import { BudgetBar } from "~/components/BudgetBar";

type SortMode = "priority" | "space" | "name";
type FilterMode = "all" | "unpurchased" | "purchased";

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

  const [sortMode, setSortMode] = createSignal<SortMode>("priority");
  const [filterMode, setFilterMode] = createSignal<FilterMode>("all");
  const [searchQuery, setSearchQuery] = createSignal("");
  const [showAddCircle, setShowAddCircle] = createSignal(false);
  const [newCircleName, setNewCircleName] = createSignal("");
  const [newCircleSpace, setNewCircleSpace] = createSignal("");

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

    const itemsByCircle = new Map<string, BuyListItem[]>();
    for (const item of i) {
      const arr = itemsByCircle.get(item.circleId) || [];
      arr.push(item);
      itemsByCircle.set(item.circleId, arr);
    }

    return c.map((circle) => ({
      circle,
      items: itemsByCircle.get(circle.id) || [],
      totalPrice: (itemsByCircle.get(circle.id) || []).reduce(
        (sum, it) => sum + it.price * it.quantity,
        0
      ),
      allPurchased: (itemsByCircle.get(circle.id) || []).length > 0 &&
        (itemsByCircle.get(circle.id) || []).every((it) => it.purchased),
      highestPriority: Math.min(
        ...(itemsByCircle.get(circle.id) || []).map((it) => it.priority),
        3
      ) as 1 | 2 | 3,
    }));
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
    if (fm === "unpurchased") list = list.filter((ci) => !ci.allPurchased);
    else if (fm === "purchased") list = list.filter((ci) => ci.allPurchased);

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
      hall: "",
      genre: "",
      url: "",
      twitterUrl: "",
      description: "",
    });
    setNewCircleName("");
    setNewCircleSpace("");
    setShowAddCircle(false);
    navigate(`/event/${params.eventId}/circle/${circle.id}`);
  };

  const handleToggleAllItems = async (circleId: string, purchased: boolean) => {
    const circleItemsList = items()?.filter((i) => i.circleId === circleId) || [];
    await Promise.all(circleItemsList.map((i) => togglePurchased(i.id, purchased)));
  };

  const priorityBadge = (p: 1 | 2 | 3) => {
    const cls = {
      1: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300",
      2: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300",
      3: "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
    };
    const labels = { 1: "必須", 2: "欲しい", 3: "余裕" };
    return <span class={`text-xs px-1.5 py-0.5 rounded-full ${cls[p]}`}>{labels[p]}</span>;
  };

  return (
    <div class="max-w-lg mx-auto">
      <Show when={event()} fallback={<div class="p-4 text-center">読み込み中...</div>}>
        {(ev) => (
          <>
            {/* Header */}
            <div class="sticky top-0 bg-gray-50 dark:bg-gray-900 z-10 px-4 pt-3 pb-2 border-b border-gray-200 dark:border-gray-700">
              <div class="flex items-center gap-2 mb-2">
                <A href="/" class="text-gray-500 touch-target">←</A>
                <h1 class="text-lg font-bold truncate flex-1">{ev().name}</h1>
                <A
                  href={`/event/${params.eventId}/budget`}
                  class="text-sm text-primary-600 dark:text-primary-400"
                >
                  予算詳細
                </A>
              </div>
              <Show when={budgetSummary() && ev().budget > 0}>
                <BudgetBar summary={budgetSummary()!} />
              </Show>
            </div>

            {/* Controls */}
            <div class="px-4 pt-3 space-y-2">
              <input
                type="search"
                class="input-field text-sm"
                placeholder="サークル名・スペース番号で検索..."
                value={searchQuery()}
                onInput={(e) => setSearchQuery(e.currentTarget.value)}
              />
              <div class="flex gap-2 text-xs">
                <select
                  class="input-field !py-1 flex-1"
                  value={sortMode()}
                  onChange={(e) => setSortMode(e.currentTarget.value as SortMode)}
                >
                  <option value="priority">優先度順</option>
                  <option value="space">スペース順</option>
                  <option value="name">名前順</option>
                </select>
                <select
                  class="input-field !py-1 flex-1"
                  value={filterMode()}
                  onChange={(e) => setFilterMode(e.currentTarget.value as FilterMode)}
                >
                  <option value="all">すべて</option>
                  <option value="unpurchased">未購入</option>
                  <option value="purchased">購入済み</option>
                </select>
              </div>
            </div>

            {/* Circle List */}
            <div class="p-4 space-y-2">
              <For each={filteredAndSorted()}>
                {(ci) => (
                  <div
                    class="card !p-0 overflow-hidden"
                    classList={{ "opacity-60": ci.allPurchased }}
                  >
                    <div class="flex items-stretch">
                      {/* Purchase toggle */}
                      <button
                        class="flex items-center justify-center w-14 shrink-0 border-r border-gray-200 dark:border-gray-700 transition-colors"
                        classList={{
                          "bg-green-50 dark:bg-green-900/30": ci.allPurchased,
                          "hover:bg-gray-50 dark:hover:bg-gray-700": !ci.allPurchased,
                        }}
                        onClick={() => handleToggleAllItems(ci.circle.id, !ci.allPurchased)}
                      >
                        <span class="text-2xl">
                          {ci.allPurchased ? "✅" : "⬜"}
                        </span>
                      </button>

                      {/* Circle info */}
                      <A
                        href={`/event/${params.eventId}/circle/${ci.circle.id}`}
                        class="flex-1 p-3 min-w-0"
                      >
                        <div class="flex items-center gap-2">
                          <span class="font-bold truncate">{ci.circle.name}</span>
                          <Show when={ci.items.length > 0}>
                            {priorityBadge(ci.highestPriority)}
                          </Show>
                        </div>
                        <div class="flex items-center gap-3 text-sm text-gray-500 dark:text-gray-400 mt-1">
                          <Show when={ci.circle.spaceNumber}>
                            <span>📍 {ci.circle.spaceNumber}</span>
                          </Show>
                          <Show when={ci.items.length > 0}>
                            <span>¥{ci.totalPrice.toLocaleString()}</span>
                          </Show>
                          <Show when={ci.items.length > 0}>
                            <span>
                              {ci.items.filter((i) => i.purchased).length}/{ci.items.length}品
                            </span>
                          </Show>
                        </div>
                      </A>
                    </div>
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

            {/* Add circle FAB / form */}
            <Show
              when={showAddCircle()}
              fallback={
                <button
                  class="fixed bottom-18 right-4 w-14 h-14 rounded-full bg-primary-600 text-white text-2xl shadow-lg flex items-center justify-center hover:bg-primary-700 active:bg-primary-800 z-40"
                  onClick={() => setShowAddCircle(true)}
                >
                  +
                </button>
              }
            >
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
            </Show>
          </>
        )}
      </Show>
    </div>
  );
}
