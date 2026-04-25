import { createSignal, createMemo, For, Show } from "solid-js";
import { A, useParams } from "@solidjs/router";
import { useLiveQuery } from "~/hooks/useLiveQuery";
import { db } from "~/db/schema";
import { updateEvent } from "~/db/repositories/events";
import { calculateBudget } from "~/services/budgetCalculator";
import { BudgetBar } from "~/components/BudgetBar";
import { ArrowLeft, Users } from "~/components/icons";

export default function BudgetSummaryPage() {
  const params = useParams();

  const event = useLiveQuery(() => db.events.get(params.eventId));
  const items = useLiveQuery(() =>
    db.buyListItems.where("eventId").equals(params.eventId).toArray()
  );

  const [editingBudget, setEditingBudget] = createSignal(false);
  const [budgetInput, setBudgetInput] = createSignal(0);

  const summary = () => {
    const e = event();
    const i = items();
    if (!e || !i) return null;
    return calculateBudget(i, e.budget);
  };

  const errandBreakdown = createMemo(() => {
    const i = items();
    if (!i) return null;
    const mine = i.filter((item) => !item.requestedBy);
    const errand = i.filter((item) => !!item.requestedBy);
    if (errand.length === 0) return null;

    const byRequester = new Map<string, { total: number; purchased: number; count: number }>();
    for (const item of errand) {
      const key = item.requestedBy;
      const entry = byRequester.get(key) ?? { total: 0, purchased: 0, count: 0 };
      const amount = item.price * item.quantity;
      entry.total += amount;
      entry.count++;
      if (item.purchased) entry.purchased += amount;
      byRequester.set(key, entry);
    }

    return {
      mineTotal: mine.reduce((s, it) => s + it.price * it.quantity, 0),
      errandTotal: errand.reduce((s, it) => s + it.price * it.quantity, 0),
      byRequester: [...byRequester.entries()].sort((a, b) => b[1].total - a[1].total),
    };
  });

  const startEditBudget = () => {
    setBudgetInput(event()?.budget ?? 0);
    setEditingBudget(true);
  };

  const saveBudget = async () => {
    await updateEvent(params.eventId, { budget: budgetInput() });
    setEditingBudget(false);
  };

  return (
    <div class="max-w-lg mx-auto">
      <div class="sticky top-0 glass z-10 px-4 pt-3 pb-2">
        <div class="flex items-center gap-2">
          <A href={`/event/${params.eventId}`} class="text-gray-500 touch-target" aria-label="戻る"><ArrowLeft size={20} /></A>
          <h1 class="text-lg font-bold">予算サマリー</h1>
        </div>
      </div>

      <Show when={summary()}>
        {(s) => (
          <div class="p-4 space-y-4">
            {/* Budget setting */}
            <div class="card">
              <div class="flex items-center justify-between mb-2">
                <h2 class="font-bold">予算上限</h2>
                <button class="text-sm text-primary-600" onClick={startEditBudget}>変更</button>
              </div>
              <Show when={editingBudget()}>
                <div class="flex gap-2 mt-2">
                  <input
                    type="number"
                    class="input-field flex-1"
                    value={budgetInput()}
                    onInput={(e) => setBudgetInput(Number(e.currentTarget.value))}
                    min="0"
                    step="1000"
                  />
                  <button class="btn-primary text-sm" onClick={saveBudget}>保存</button>
                </div>
              </Show>
              <Show when={!editingBudget()}>
                <div class="text-2xl font-bold tabular-nums">¥{s().budget.toLocaleString()}</div>
              </Show>
            </div>

            {/* Budget bar */}
            <Show when={s().budget > 0}>
              <div class="card">
                <BudgetBar summary={s()} />
              </div>
            </Show>

            {/* Priority breakdown */}
            <div class="card space-y-3">
              <h2 class="font-bold">優先度別</h2>
              <For each={s().byPriority}>
                {(p) => (
                  <div class="flex items-center justify-between">
                    <div class="flex items-center gap-2">
                      <span class={`w-3 h-3 rounded-full ${
                        p.priority === 1 ? "bg-danger" : p.priority === 2 ? "bg-warning" : "bg-success"
                      }`} aria-hidden="true" />
                      <span class={`text-sm font-medium ${
                        p.priority === 1 ? "badge-priority-1" : p.priority === 2 ? "badge-priority-2" : "badge-priority-3"
                      }`}>{p.label}</span>
                    </div>
                    <div class="text-sm text-right tabular-nums">
                      <span class="text-gray-500">¥{p.purchased.toLocaleString()}</span>
                      <span class="mx-1">/</span>
                      <span class="font-medium">¥{p.total.toLocaleString()}</span>
                    </div>
                  </div>
                )}
              </For>
            </div>

            {/* Simulation */}
            <div class="card space-y-2">
              <h2 class="font-bold">試算</h2>
              <div class="text-sm space-y-1 tabular-nums">
                <div class="flex justify-between">
                  <span>「必須」のみ購入した場合</span>
                  <span class="font-medium">¥{s().byPriority[0].total.toLocaleString()}</span>
                </div>
                <div class="flex justify-between">
                  <span>「必須」+「欲しい」</span>
                  <span class="font-medium">
                    ¥{(s().byPriority[0].total + s().byPriority[1].total).toLocaleString()}
                  </span>
                </div>
                <div class="flex justify-between">
                  <span>全品目購入した場合</span>
                  <span class="font-medium">¥{s().totalPlanned.toLocaleString()}</span>
                </div>
              </div>
              <Show when={s().budget > 0}>
                <div class="text-xs text-gray-500 mt-2">
                  {s().totalPlanned <= s().budget
                    ? "✅ 全品目購入しても予算内です"
                    : s().byPriority[0].total + s().byPriority[1].total <= s().budget
                      ? "⚠️ 「余裕があれば」を含めると予算超過"
                      : s().byPriority[0].total <= s().budget
                        ? "⚠️ 「欲しい」を含めると予算超過"
                        : "🔴 「必須」だけでも予算超過"}
                </div>
              </Show>
            </div>

            {/* Totals */}
            <div class="card">
              <div class="grid grid-cols-2 gap-4 text-center">
                <div>
                  <div class="text-sm text-gray-500">予定合計</div>
                  <div class="text-xl font-bold tabular-nums">¥{s().totalPlanned.toLocaleString()}</div>
                </div>
                <div>
                  <div class="text-sm text-gray-500">購入済み</div>
                  <div class="text-xl font-bold tabular-nums text-green-600">¥{s().totalPurchased.toLocaleString()}</div>
                </div>
              </div>
            </div>

            {/* Errand breakdown */}
            <Show when={errandBreakdown()}>
              {(eb) => (
                <div class="card space-y-3">
                  <h2 class="font-bold">自分用 / おつかい</h2>
                  <div class="flex items-center justify-between">
                    <span class="text-sm">自分用</span>
                    <span class="text-sm font-medium">¥{eb().mineTotal.toLocaleString()}</span>
                  </div>
                  <div class="flex items-center justify-between">
                    <span class="text-sm text-errand dark:text-errand-dark-text flex items-center gap-1"><Users size={14} /> おつかい合計</span>
                    <span class="text-sm font-medium text-errand dark:text-errand-dark-text">¥{eb().errandTotal.toLocaleString()}</span>
                  </div>
                  <div class="border-t border-gray-200 dark:border-gray-700 pt-2 space-y-1">
                    <For each={eb().byRequester}>
                      {([name, data]) => (
                        <div class="flex items-center justify-between text-xs">
                          <span class="text-gray-500 flex items-center gap-1"><Users size={12} /> {name}（{data.count}品）</span>
                          <span>
                            <span class="text-gray-500">¥{data.purchased.toLocaleString()}</span>
                            <span class="mx-1">/</span>
                            <span class="font-medium">¥{data.total.toLocaleString()}</span>
                          </span>
                        </div>
                      )}
                    </For>
                  </div>
                </div>
              )}
            </Show>
          </div>
        )}
      </Show>
    </div>
  );
}
